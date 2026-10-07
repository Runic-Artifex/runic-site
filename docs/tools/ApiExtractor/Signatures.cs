using System.Collections.Immutable;
using System.Reflection.Metadata;
using System.Text.RegularExpressions;

namespace ApiExtractor;

/// <summary>A run of display text, optionally linking a type by documentation ID.</summary>
internal sealed record Segment(string Text, string? Ref = null);

internal enum SigKind
{
    Primitive,
    Named,
    Generic,
    SZArray,
    Array,
    ByRef,
    Pointer,
    TypeParameter,
    FunctionPointer,
}

/// <summary>
/// A decoded signature type as a tree. <see cref="Doc"/> is the XML
/// documentation ID form; <see cref="SignatureRenderer"/> produces the C#
/// display form, applying nullable reference annotations in metadata order.
/// </summary>
internal sealed record TypeSig(SigKind Kind, string Doc)
{
    /// <summary>Display name of a primitive, named type or type parameter.</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>Documentation ID (T:...) of a named type or generic definition.</summary>
    public string? DefinitionId { get; init; }

    /// <summary>The type definition in the assembly being read, when it is one.</summary>
    public TypeDefinitionHandle Definition { get; init; }

    public ImmutableArray<TypeSig> Children { get; init; } = [];

    public int Rank { get; init; }

    public bool IsValueType { get; init; }

    public bool IsInitOnly { get; init; }

    public bool IsIn { get; init; }

    public bool IsByRef => Kind == SigKind.ByRef;

    public TypeSig Element => Children[0];
}

internal sealed record GenericContext(ImmutableArray<string> TypeParameters, ImmutableArray<string> MethodParameters)
{
    public static readonly GenericContext Empty = new([], []);
}

/// <summary>
/// Reads nullable annotations: a NullableAttribute byte array consumed in
/// pre-order, a single NullableAttribute byte, or the NullableContext value.
/// 0 is oblivious, 1 not annotated, 2 annotated.
/// </summary>
internal sealed class NullableFlags(ImmutableArray<byte> flags, byte fallback)
{
    private int _position;

    public static readonly NullableFlags Oblivious = new([], 0);

    public byte Next() => _position < flags.Length ? flags[_position++] : fallback;
}

internal static class SignatureRenderer
{
    /// <summary>
    /// C# display form. Follows Roslyn's NullableAttribute layout: reference
    /// types, arrays and type parameters take one byte before their type
    /// arguments or element; generic value types take one (ignored) byte;
    /// non-generic value types take none; Nullable&lt;T&gt; contributes only T.
    /// </summary>
    public static ImmutableArray<Segment> Render(TypeSig type, NullableFlags? flags = null)
    {
        var segments = ImmutableArray.CreateBuilder<Segment>();
        Write(type, flags ?? NullableFlags.Oblivious, segments);
        return segments.ToImmutable();
    }

    public static string Text(TypeSig type) => string.Concat(Render(type).Select(segment => segment.Text));

    private static void Write(TypeSig type, NullableFlags flags, ImmutableArray<Segment>.Builder output)
    {
        switch (type.Kind)
        {
            case SigKind.Primitive:
                var primitiveAnnotated = !type.IsValueType && flags.Next() == 2;
                output.Add(new Segment(type.Name + (primitiveAnnotated ? "?" : string.Empty)));
                break;
            case SigKind.Named:
                var namedAnnotated = !type.IsValueType && flags.Next() == 2;
                output.Add(new Segment(type.Name, type.DefinitionId));
                if (namedAnnotated)
                {
                    output.Add(new Segment("?"));
                }

                break;
            case SigKind.TypeParameter:
                output.Add(new Segment(type.Name + (flags.Next() == 2 ? "?" : string.Empty)));
                break;
            case SigKind.Generic:
                var definition = type.Children[0];
                var arguments = type.Children[1..];
                if (definition.Doc == "System.Nullable`1")
                {
                    Write(arguments[0], flags, output);
                    output.Add(new Segment("?"));
                    break;
                }

                var genericAnnotated = flags.Next() == 2 && !definition.IsValueType;
                var tuple = definition.Doc.StartsWith("System.ValueTuple`", StringComparison.Ordinal);
                if (!tuple)
                {
                    output.Add(new Segment(definition.Name, definition.DefinitionId));
                }

                output.Add(new Segment(tuple ? "(" : "<"));
                for (var index = 0; index < arguments.Length; index++)
                {
                    if (index > 0)
                    {
                        output.Add(new Segment(", "));
                    }

                    Write(arguments[index], flags, output);
                }

                output.Add(new Segment(tuple ? ")" : ">"));
                if (genericAnnotated)
                {
                    output.Add(new Segment("?"));
                }

                break;
            case SigKind.SZArray:
            case SigKind.Array:
                var arrayAnnotated = flags.Next() == 2;
                Write(type.Element, flags, output);
                output.Add(new Segment(type.Kind == SigKind.SZArray ? "[]" : $"[{new string(',', type.Rank - 1)}]"));
                if (arrayAnnotated)
                {
                    output.Add(new Segment("?"));
                }

                break;
            case SigKind.ByRef:
                Write(type.Element, flags, output);
                break;
            case SigKind.Pointer:
                Write(type.Element, flags, output);
                output.Add(new Segment("*"));
                break;
            case SigKind.FunctionPointer:
                output.Add(new Segment(type.Name));
                break;
        }
    }

    internal static IEnumerable<Segment> Join(IEnumerable<ImmutableArray<Segment>> types)
    {
        var first = true;
        foreach (var type in types)
        {
            if (!first)
            {
                yield return new Segment(", ");
            }

            first = false;
            foreach (var segment in type)
            {
                yield return segment;
            }
        }
    }
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
        var doc = typeCode == PrimitiveTypeCode.TypedReference ? "System.TypedReference" : $"System.{typeCode}";
        return new TypeSig(SigKind.Primitive, doc)
        {
            Name = Keywords.GetValueOrDefault(doc, typeCode.ToString()),
            DefinitionId = $"T:{doc}",
            IsValueType = typeCode is not (PrimitiveTypeCode.String or PrimitiveTypeCode.Object),
        };
    }

    public TypeSig GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind) =>
        Named(DefinitionName(reader, handle), rawTypeKind) with { Definition = handle };

    public TypeSig GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind) =>
        Named(ReferenceName(reader, handle), rawTypeKind);

    public TypeSig GetTypeFromSpecification(
        MetadataReader reader, GenericContext genericContext, TypeSpecificationHandle handle, byte rawTypeKind) =>
        reader.GetTypeSpecification(handle).DecodeSignature(this, genericContext);

    public TypeSig GetSZArrayType(TypeSig elementType) =>
        new(SigKind.SZArray, $"{elementType.Doc}[]") { Children = [elementType] };

    public TypeSig GetArrayType(TypeSig elementType, ArrayShape shape) =>
        new(SigKind.Array, $"{elementType.Doc}[{string.Join(",", Enumerable.Repeat("0:", shape.Rank))}]")
        {
            Children = [elementType],
            Rank = shape.Rank,
        };

    public TypeSig GetByReferenceType(TypeSig elementType) =>
        new(SigKind.ByRef, $"{elementType.Doc}@") { Children = [elementType] };

    public TypeSig GetPointerType(TypeSig elementType) =>
        new(SigKind.Pointer, $"{elementType.Doc}*") { Children = [elementType], IsValueType = true };

    public TypeSig GetPinnedType(TypeSig elementType) => elementType;

    public TypeSig GetFunctionPointerType(MethodSignature<TypeSig> signature) =>
        new(SigKind.FunctionPointer, "=FUNC")
        {
            Name = $"delegate*<{string.Join(", ", signature.ParameterTypes.Append(signature.ReturnType).Select(SignatureRenderer.Text))}>",
            IsValueType = true,
        };

    public TypeSig GetGenericMethodParameter(GenericContext genericContext, int index) =>
        new(SigKind.TypeParameter, $"``{index}")
        {
            Name = index < genericContext.MethodParameters.Length ? genericContext.MethodParameters[index] : $"TM{index}",
        };

    public TypeSig GetGenericTypeParameter(GenericContext genericContext, int index) =>
        new(SigKind.TypeParameter, $"`{index}")
        {
            Name = index < genericContext.TypeParameters.Length ? genericContext.TypeParameters[index] : $"T{index}",
        };

    public TypeSig GetModifiedType(TypeSig modifier, TypeSig unmodifiedType, bool isRequired) =>
        modifier.Doc switch
        {
            "System.Runtime.CompilerServices.IsExternalInit" => unmodifiedType with { IsInitOnly = true },
            "System.Runtime.InteropServices.InAttribute" => unmodifiedType with { IsIn = true },
            _ => unmodifiedType,
        };

    public TypeSig GetGenericInstantiation(TypeSig genericType, ImmutableArray<TypeSig> typeArguments)
    {
        var baseDoc = Arity().Replace(genericType.Doc, string.Empty);
        return new TypeSig(SigKind.Generic, $"{baseDoc}{{{string.Join(",", typeArguments.Select(argument => argument.Doc))}}}")
        {
            Children = [genericType, .. typeArguments],
            DefinitionId = genericType.DefinitionId,
            Definition = genericType.Definition,
            IsValueType = genericType.IsValueType && genericType.Doc != "System.Nullable`1",
        };
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

    /// <summary>SignatureTypeKind.ValueType in a signature's raw type kind.</summary>
    private const byte ValueTypeKind = 0x11;

    private static TypeSig Named(TypeName name, byte rawTypeKind) =>
        new(SigKind.Named, name.Doc)
        {
            Name = Keywords.GetValueOrDefault(name.Doc, name.Display),
            DefinitionId = $"T:{name.Doc}",
            IsValueType = rawTypeKind == ValueTypeKind,
        };

    [GeneratedRegex(@"`\d+")]
    private static partial Regex Arity();
}
