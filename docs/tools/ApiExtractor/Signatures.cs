using System.Collections.Immutable;
using System.Globalization;
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

    public bool IsOut { get; init; }

    /// <summary>
    /// The named type and its containing types, outermost first, each with
    /// its own type parameter count. A generic instantiation's arguments are
    /// listed outermost first across them.
    /// </summary>
    public ImmutableArray<NamePart> Parts { get; init; } = [];

    public bool IsByRef => Kind == SigKind.ByRef;

    public TypeSig Element => Children[0];
}

/// <summary>
/// One type in a nested type name: <see cref="Display"/> without arity,
/// <see cref="Doc"/> without arity (with the namespace on the outermost part),
/// its own <see cref="Arity"/> and its documentation ID.
/// </summary>
internal sealed record NamePart(string Display, string Doc, int Arity, string Id);

internal sealed record GenericContext(ImmutableArray<string> TypeParameters, ImmutableArray<string> MethodParameters)
{
    public static readonly GenericContext Empty = new([], []);
}

/// <summary>
/// Reads the annotations of one signature type in pre-order: nullable flags
/// from a NullableAttribute byte array, a single NullableAttribute byte, or the
/// NullableContext value (0 is oblivious, 1 not annotated, 2 annotated), and
/// tuple element names from TupleElementNamesAttribute.
/// </summary>
internal sealed class NullableFlags(ImmutableArray<byte> flags, byte fallback, ImmutableArray<string?> names = default)
{
    private int _position;
    private int _namePosition;

    public static readonly NullableFlags Oblivious = new([], 0);

    public byte Next() => _position < flags.Length ? flags[_position++] : fallback;

    /// <summary>The element names of the next tuple, null where unnamed.</summary>
    public string?[] NextNames(int count)
    {
        var result = new string?[count];
        for (var index = 0; index < count; index++)
        {
            result[index] = !names.IsDefault && _namePosition < names.Length ? names[_namePosition] : null;
            _namePosition++;
        }

        return result;
    }
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
                if (IsTuple(type, nested: false))
                {
                    var names = flags.NextNames(TupleLength(type));
                    output.Add(new Segment("("));
                    WriteTupleElements(type, names, 0, flags, output);
                    output.Add(new Segment(")"));
                    break;
                }

                // Outer<A>.Inner<B> lists A and B in one argument list,
                // outermost first; give each type its own arguments.
                var parts = definition.Parts;
                var grouped = parts.Length > 1
                              && parts.Sum(part => part.Arity) == arguments.Length
                              && parts[..^1].Any(part => part.Arity > 0);
                if (!grouped)
                {
                    output.Add(new Segment(definition.Name, definition.DefinitionId));
                    WriteArguments(arguments, flags, output);
                }
                else
                {
                    var next = 0;
                    for (var index = 0; index < parts.Length; index++)
                    {
                        if (index > 0)
                        {
                            output.Add(new Segment("."));
                        }

                        output.Add(new Segment(parts[index].Display, parts[index].Id));
                        if (parts[index].Arity > 0)
                        {
                            WriteArguments(arguments.Slice(next, parts[index].Arity), flags, output);
                            next += parts[index].Arity;
                        }
                    }
                }

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
                // One (ignored) byte for the pointer, then the return type and
                // the parameters; C# shows the return type last.
                flags.Next();
                var returnType = ImmutableArray.CreateBuilder<Segment>();
                WriteByRefPrefix(type.Children[0], isReturn: true, returnType);
                Write(type.Children[0], flags, returnType);
                output.Add(new Segment(type.Name + "<"));
                foreach (var parameter in type.Children[1..])
                {
                    WriteByRefPrefix(parameter, isReturn: false, output);
                    Write(parameter, flags, output);
                    output.Add(new Segment(", "));
                }

                output.AddRange(returnType);
                output.Add(new Segment(">"));
                break;
        }
    }

    private static void WriteArguments(ImmutableArray<TypeSig> arguments, NullableFlags flags, ImmutableArray<Segment>.Builder output)
    {
        output.Add(new Segment("<"));
        for (var index = 0; index < arguments.Length; index++)
        {
            if (index > 0)
            {
                output.Add(new Segment(", "));
            }

            Write(arguments[index], flags, output);
        }

        output.Add(new Segment(">"));
    }

    /// <summary>
    /// Writes the elements of a tuple, continuing into the TRest tuple of a
    /// ValueTuple with eight type arguments. Each tuple type, including a
    /// TRest, has its own nullable byte and its own run of element names, in
    /// pre-order; the outermost run names every element.
    /// </summary>
    private static void WriteTupleElements(
        TypeSig tuple, string?[] names, int offset, NullableFlags flags, ImmutableArray<Segment>.Builder output)
    {
        var arguments = tuple.Children[1..];
        for (var index = 0; index < arguments.Length; index++)
        {
            if (index == 7 && IsTuple(arguments[index], nested: true))
            {
                flags.Next();
                flags.NextNames(TupleLength(arguments[index]));
                WriteTupleElements(arguments[index], names, offset + 7, flags, output);
                return;
            }

            if (offset + index > 0)
            {
                output.Add(new Segment(", "));
            }

            Write(arguments[index], flags, output);
            if (names[offset + index] is { } name)
            {
                output.Add(new Segment($" {name}"));
            }
        }
    }

    /// <summary>
    /// A C# tuple: ValueTuple with two to eight type arguments, or any
    /// ValueTuple in the TRest position of another.
    /// </summary>
    private static bool IsTuple(TypeSig type, bool nested) =>
        type.Kind == SigKind.Generic
        && type.Children[0].Doc.StartsWith("System.ValueTuple`", StringComparison.Ordinal)
        && (nested || type.Children.Length > 2);

    /// <summary>The number of elements of a tuple, including those in TRest.</summary>
    private static int TupleLength(TypeSig tuple)
    {
        var arguments = tuple.Children.Length - 1;
        return arguments == 8 && IsTuple(tuple.Children[8], nested: true) ? 7 + TupleLength(tuple.Children[8]) : arguments;
    }

    private static void WriteByRefPrefix(TypeSig type, bool isReturn, ImmutableArray<Segment>.Builder output)
    {
        if (type.IsByRef)
        {
            output.Add(new Segment(ByRefPrefix(type, isReturn, readOnly: false)));
        }
    }

    /// <summary>
    /// <c>ref</c>, <c>ref readonly</c>, <c>in</c> or <c>out</c> for a by-reference
    /// type. <paramref name="readOnly"/> reports an IsReadOnlyAttribute, which
    /// marks <c>ref readonly</c> returns that carry no modifier.
    /// </summary>
    public static string ByRefPrefix(TypeSig type, bool isReturn, bool readOnly) =>
        isReturn ? (type.IsIn || readOnly ? "ref readonly " : "ref ")
        : type.IsOut ? "out "
        : type.IsIn || readOnly ? "in "
        : "ref ";

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

    /// <summary>
    /// A function pointer. Its documentation ID part is empty, as the C#
    /// compiler writes it in XML documentation.
    /// </summary>
    public TypeSig GetFunctionPointerType(MethodSignature<TypeSig> signature) =>
        new(SigKind.FunctionPointer, string.Empty)
        {
            Name = signature.Header.CallingConvention switch
            {
                SignatureCallingConvention.CDecl => "delegate* unmanaged[Cdecl]",
                SignatureCallingConvention.StdCall => "delegate* unmanaged[Stdcall]",
                SignatureCallingConvention.ThisCall => "delegate* unmanaged[Thiscall]",
                SignatureCallingConvention.FastCall => "delegate* unmanaged[Fastcall]",
                SignatureCallingConvention.Unmanaged => "delegate* unmanaged",
                _ => "delegate*",
            },
            Children = [signature.ReturnType, .. signature.ParameterTypes],
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
            "System.Runtime.InteropServices.OutAttribute" => unmodifiedType with { IsOut = true },
            _ => unmodifiedType,
        };

    public TypeSig GetGenericInstantiation(TypeSig genericType, ImmutableArray<TypeSig> typeArguments)
    {
        // Outer`1.Inner`1<A, B> is documented as Outer{A}.Inner{B}.
        var parts = genericType.Parts;
        string doc;
        if (parts.Length > 0 && parts.Sum(part => part.Arity) == typeArguments.Length)
        {
            var next = 0;
            doc = string.Join(".", parts.Select(part =>
            {
                var arguments = typeArguments.Slice(next, part.Arity);
                next += part.Arity;
                return part.Arity == 0 ? part.Doc : $"{part.Doc}{{{string.Join(",", arguments.Select(argument => argument.Doc))}}}";
            }));
        }
        else
        {
            doc = $"{Arity().Replace(genericType.Doc, string.Empty)}{{{string.Join(",", typeArguments.Select(argument => argument.Doc))}}}";
        }

        return new TypeSig(SigKind.Generic, doc)
        {
            Children = [genericType, .. typeArguments],
            DefinitionId = genericType.DefinitionId,
            Definition = genericType.Definition,
            IsValueType = genericType.IsValueType && genericType.Doc != "System.Nullable`1",
        };
    }

    /// <summary>
    /// Documentation name (namespace.Outer`1.Inner`1), display name
    /// (Outer.Inner) and the name of each type from the outermost.
    /// </summary>
    internal readonly record struct TypeName(string Doc, string Display, ImmutableArray<NamePart> Parts);

    internal static TypeName DefinitionName(MetadataReader reader, TypeDefinitionHandle handle)
    {
        var definition = reader.GetTypeDefinition(handle);
        var declaring = definition.GetDeclaringType();
        return Nested(
            declaring.IsNil ? null : DefinitionName(reader, declaring),
            reader.GetString(definition.Namespace),
            reader.GetString(definition.Name));
    }

    internal static TypeName ReferenceName(MetadataReader reader, TypeReferenceHandle handle)
    {
        var reference = reader.GetTypeReference(handle);
        return Nested(
            reference.ResolutionScope.Kind == HandleKind.TypeReference
                ? ReferenceName(reader, (TypeReferenceHandle)reference.ResolutionScope)
                : null,
            reader.GetString(reference.Namespace),
            reader.GetString(reference.Name));
    }

    private static TypeName Nested(TypeName? outer, string ns, string name)
    {
        var display = StripArity(name);
        var tick = name.LastIndexOf('`');
        var arity = tick >= 0 && int.TryParse(name.AsSpan(tick + 1), NumberStyles.None, CultureInfo.InvariantCulture, out var count) ? count : 0;
        if (outer is { } containing)
        {
            var doc = $"{containing.Doc}.{name}";
            return new TypeName(doc, $"{containing.Display}.{display}", [.. containing.Parts, new NamePart(display, display, arity, $"T:{doc}")]);
        }

        var full = ns.Length == 0 ? name : $"{ns}.{name}";
        var docName = ns.Length == 0 ? display : $"{ns}.{display}";
        return new TypeName(full, display, [new NamePart(display, docName, arity, $"T:{full}")]);
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
            Parts = name.Parts,
        };

    [GeneratedRegex(@"`\d+")]
    private static partial Regex Arity();
}
