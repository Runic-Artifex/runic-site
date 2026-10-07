using System.Collections.Immutable;
using System.Reflection.Metadata;
using System.Text.RegularExpressions;

namespace ApiExtractor;

/// <summary>A run of display text, optionally linking a type by documentation ID.</summary>
internal sealed record Segment(string Text, string? Ref = null);

/// <summary>
/// A decoded type: its XML documentation ID form (for member IDs and cref
/// links) and its C# display form.
/// </summary>
internal sealed record TypeSig(string Doc, ImmutableArray<Segment> Display, string? DefinitionId = null)
{
    public bool IsByRef { get; init; }

    public bool IsInitOnly { get; init; }

    public bool IsIn { get; init; }

    /// <summary>True for value types and generic parameters, whose null default is <c>default</c>.</summary>
    public bool IsValueType { get; init; }

    public static TypeSig Text(string doc, string display) => new(doc, [new Segment(display)]);

    public string DisplayText => string.Concat(Display.Select(segment => segment.Text));
}

internal sealed record GenericContext(ImmutableArray<string> TypeParameters, ImmutableArray<string> MethodParameters)
{
    public static readonly GenericContext Empty = new([], []);
}

internal sealed partial class SignatureProvider : ISignatureTypeProvider<TypeSig, GenericContext>
{
    private static readonly Dictionary<string, string> Keywords = new(StringComparer.Ordinal)
    {
        ["System.Boolean"] = "bool",
        ["System.Byte"] = "byte",
        ["System.SByte"] = "sbyte",
        ["System.Char"] = "char",
        ["System.Int16"] = "short",
        ["System.UInt16"] = "ushort",
        ["System.Int32"] = "int",
        ["System.UInt32"] = "uint",
        ["System.Int64"] = "long",
        ["System.UInt64"] = "ulong",
        ["System.IntPtr"] = "nint",
        ["System.UIntPtr"] = "nuint",
        ["System.Single"] = "float",
        ["System.Double"] = "double",
        ["System.Decimal"] = "decimal",
        ["System.String"] = "string",
        ["System.Object"] = "object",
        ["System.Void"] = "void",
    };

    public TypeSig GetPrimitiveType(PrimitiveTypeCode typeCode)
    {
        var doc = typeCode switch
        {
            PrimitiveTypeCode.TypedReference => "System.TypedReference",
            _ => $"System.{typeCode}",
        };
        return TypeSig.Text(doc, Keywords.GetValueOrDefault(doc, typeCode.ToString())) with
        {
            IsValueType = typeCode is not (PrimitiveTypeCode.String or PrimitiveTypeCode.Object),
        };
    }

    public TypeSig GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind) =>
        Named(DefinitionName(reader, handle)) with { IsValueType = rawTypeKind == ValueTypeKind };

    public TypeSig GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind) =>
        Named(ReferenceName(reader, handle)) with { IsValueType = rawTypeKind == ValueTypeKind };

    /// <summary>SignatureTypeKind.ValueType in a signature's raw type kind.</summary>
    private const byte ValueTypeKind = 0x11;

    public TypeSig GetTypeFromSpecification(
        MetadataReader reader, GenericContext genericContext, TypeSpecificationHandle handle, byte rawTypeKind) =>
        reader.GetTypeSpecification(handle).DecodeSignature(this, genericContext);

    public TypeSig GetSZArrayType(TypeSig elementType) =>
        new($"{elementType.Doc}[]", [.. elementType.Display, new Segment("[]")]);

    public TypeSig GetArrayType(TypeSig elementType, ArrayShape shape) =>
        new(
            $"{elementType.Doc}[{string.Join(",", Enumerable.Repeat("0:", shape.Rank))}]",
            [.. elementType.Display, new Segment($"[{new string(',', shape.Rank - 1)}]")]);

    public TypeSig GetByReferenceType(TypeSig elementType) =>
        elementType with { Doc = $"{elementType.Doc}@", IsByRef = true };

    public TypeSig GetPointerType(TypeSig elementType) =>
        new($"{elementType.Doc}*", [.. elementType.Display, new Segment("*")]);

    public TypeSig GetPinnedType(TypeSig elementType) => elementType;

    public TypeSig GetFunctionPointerType(MethodSignature<TypeSig> signature) =>
        TypeSig.Text("=FUNC", $"delegate*<{string.Join(", ", signature.ParameterTypes.Append(signature.ReturnType).Select(type => type.DisplayText))}>");

    public TypeSig GetGenericMethodParameter(GenericContext genericContext, int index) =>
        TypeSig.Text($"``{index}", index < genericContext.MethodParameters.Length ? genericContext.MethodParameters[index] : $"TM{index}") with { IsValueType = true };

    public TypeSig GetGenericTypeParameter(GenericContext genericContext, int index) =>
        TypeSig.Text($"`{index}", index < genericContext.TypeParameters.Length ? genericContext.TypeParameters[index] : $"T{index}") with { IsValueType = true };

    public TypeSig GetModifiedType(TypeSig modifier, TypeSig unmodifiedType, bool isRequired) =>
        modifier.Doc switch
        {
            "System.Runtime.CompilerServices.IsExternalInit" => unmodifiedType with { IsInitOnly = true },
            "System.Runtime.InteropServices.InAttribute" => unmodifiedType with { IsIn = true },
            _ => unmodifiedType,
        };

    public TypeSig GetGenericInstantiation(TypeSig genericType, ImmutableArray<TypeSig> typeArguments)
    {
        var definition = genericType.DefinitionId;
        var baseDoc = Arity().Replace(genericType.Doc, string.Empty);
        var doc = $"{baseDoc}{{{string.Join(",", typeArguments.Select(argument => argument.Doc))}}}";
        if (genericType.Doc == "System.Nullable`1")
        {
            return new TypeSig(doc, [.. typeArguments[0].Display, new Segment("?")], definition);
        }

        if (genericType.Doc.StartsWith("System.ValueTuple`", StringComparison.Ordinal))
        {
            return new TypeSig(doc, [new Segment("("), .. Join(typeArguments), new Segment(")")], definition) { IsValueType = true };
        }

        return new TypeSig(
            doc,
            [.. genericType.Display, new Segment("<"), .. Join(typeArguments), new Segment(">")],
            definition)
        {
            IsValueType = genericType.IsValueType,
        };
    }

    internal static IEnumerable<Segment> Join(IEnumerable<TypeSig> types)
    {
        var first = true;
        foreach (var type in types)
        {
            if (!first)
            {
                yield return new Segment(", ");
            }

            first = false;
            foreach (var segment in type.Display)
            {
                yield return segment;
            }
        }
    }

    /// <summary>Documentation name (namespace.Outer.Inner`1) and display name.</summary>
    internal readonly record struct TypeName(string Doc, string Display);

    internal static TypeName DefinitionName(MetadataReader reader, TypeDefinitionHandle handle)
    {
        var definition = reader.GetTypeDefinition(handle);
        var name = reader.GetString(definition.Name);
        var declaring = definition.GetDeclaringType();
        if (!declaring.IsNil)
        {
            var outer = DefinitionName(reader, declaring);
            return new TypeName($"{outer.Doc}.{name}", $"{outer.Display}.{StripArity(name)}");
        }

        var ns = reader.GetString(definition.Namespace);
        return new TypeName(ns.Length == 0 ? name : $"{ns}.{name}", StripArity(name));
    }

    internal static TypeName ReferenceName(MetadataReader reader, TypeReferenceHandle handle)
    {
        var reference = reader.GetTypeReference(handle);
        var name = reader.GetString(reference.Name);
        if (reference.ResolutionScope.Kind == HandleKind.TypeReference)
        {
            var outer = ReferenceName(reader, (TypeReferenceHandle)reference.ResolutionScope);
            return new TypeName($"{outer.Doc}.{name}", $"{outer.Display}.{StripArity(name)}");
        }

        var ns = reader.GetString(reference.Namespace);
        return new TypeName(ns.Length == 0 ? name : $"{ns}.{name}", StripArity(name));
    }

    internal static string StripArity(string name) => Arity().Replace(name, string.Empty);

    private static TypeSig Named(TypeName name)
    {
        var display = Keywords.GetValueOrDefault(name.Doc, name.Display);
        var id = $"T:{name.Doc}";
        return new TypeSig(name.Doc, [new Segment(display, id)], id);
    }

    [GeneratedRegex(@"`\d+")]
    private static partial Regex Arity();
}
