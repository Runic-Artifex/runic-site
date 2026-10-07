using System.Collections.Immutable;
using System.Globalization;
using System.Reflection;
using System.Reflection.Metadata;
using System.Reflection.PortableExecutable;
using System.Text.Json.Nodes;
using System.Xml.Linq;

namespace ApiExtractor;

/// <summary>
/// Reads the externally visible API of one assembly: public and protected
/// types and members, with C# display signatures and their XML docs.
/// </summary>
internal sealed class AssemblyExtractor
{
    private readonly PEReader _pe;
    private readonly MetadataReader _reader;
    private readonly Dictionary<string, XElement> _docs;
    private readonly SignatureProvider _provider = new();

    public AssemblyExtractor(Stream image, Dictionary<string, XElement> docs)
    {
        _pe = new PEReader(image, PEStreamOptions.PrefetchEntireImage);
        _reader = _pe.GetMetadataReader();
        _docs = docs;
        Name = _reader.GetString(_reader.GetAssemblyDefinition().Name);
    }

    public string Name { get; }

    public IEnumerable<JsonObject> Extract()
    {
        var types = new List<(string Id, JsonObject Type)>();
        foreach (var handle in _reader.TypeDefinitions)
        {
            if (IsVisible(handle))
            {
                var type = ExtractType(handle);
                types.Add((type["id"]!.GetValue<string>(), type));
            }
        }

        return types.OrderBy(type => type.Id, StringComparer.Ordinal).Select(type => type.Type);
    }

    private bool IsVisible(TypeDefinitionHandle handle)
    {
        var definition = _reader.GetTypeDefinition(handle);
        var name = _reader.GetString(definition.Name);
        if (name.Contains('<') || HasAttribute(definition.GetCustomAttributes(), "System.Runtime.CompilerServices", "CompilerGeneratedAttribute"))
        {
            return false;
        }

        var visibility = definition.Attributes & TypeAttributes.VisibilityMask;
        if (visibility == TypeAttributes.Public)
        {
            return true;
        }

        var declaring = definition.GetDeclaringType();
        if (declaring.IsNil || !IsVisible(declaring))
        {
            return false;
        }

        var declaringSealed = (_reader.GetTypeDefinition(declaring).Attributes & TypeAttributes.Sealed) != 0;
        return visibility switch
        {
            TypeAttributes.NestedPublic => true,
            TypeAttributes.NestedFamily or TypeAttributes.NestedFamORAssem => !declaringSealed,
            _ => false,
        };
    }

    private JsonObject ExtractType(TypeDefinitionHandle handle)
    {
        var definition = _reader.GetTypeDefinition(handle);
        var name = SignatureProvider.DefinitionName(_reader, handle);
        var id = $"T:{name.Doc}";
        var allTypeParameters = definition.GetGenericParameters()
            .Select(parameter => _reader.GetString(_reader.GetGenericParameter(parameter).Name))
            .ToImmutableArray();
        var ownArity = OwnArity(_reader.GetString(definition.Name));
        var ownTypeParameters = definition.GetGenericParameters()
            .Skip(allTypeParameters.Length - ownArity)
            .Select(parameter => _reader.GetGenericParameter(parameter))
            .Select(parameter => (parameter.Attributes & GenericParameterAttributes.VarianceMask) switch
            {
                GenericParameterAttributes.Covariant => "out ",
                GenericParameterAttributes.Contravariant => "in ",
                _ => string.Empty,
            } + _reader.GetString(parameter.Name))
            .ToArray();
        var context = new GenericContext(allTypeParameters, []);
        var kind = TypeKind(definition, out var baseType);
        var sealedType = (definition.Attributes & TypeAttributes.Sealed) != 0;

        // The signature shows variance; the type's name does not.
        // A nested type shows each containing type's parameters with it
        // (Outer<T>.Inner<U>), as references do.
        var outerArity = allTypeParameters.Length - ownArity;
        string GroupedName(bool variance)
        {
            if (name.Parts.Sum(part => part.Arity) != allTypeParameters.Length)
            {
                var own = variance ? ownTypeParameters : ownTypeParameters.Select(parameter => parameter.Split(' ')[^1]);
                return name.Display + (ownTypeParameters.Length > 0 ? $"<{string.Join(", ", own)}>" : string.Empty);
            }

            var next = 0;
            return string.Join(".", name.Parts.Select(part =>
            {
                var parameters = Enumerable.Range(next, part.Arity)
                    .Select(index => variance && index >= outerArity ? ownTypeParameters[index - outerArity] : allTypeParameters[index]);
                next += part.Arity;
                return part.Arity > 0 ? $"{part.Display}<{string.Join(", ", parameters)}>" : part.Display;
            }));
        }

        var declaredName = GroupedName(variance: true);
        var displayName = GroupedName(variance: false);
        var parts = new List<Segment> { new(Accessibility(definition.Attributes)) };
        if (kind == "class" && (definition.Attributes & (TypeAttributes.Abstract | TypeAttributes.Sealed)) == (TypeAttributes.Abstract | TypeAttributes.Sealed))
        {
            parts.Add(new Segment(" static"));
        }
        else if (kind is "class" or "record" && (definition.Attributes & TypeAttributes.Abstract) != 0)
        {
            parts.Add(new Segment(" abstract"));
        }
        else if (kind is "class" or "record" && sealedType)
        {
            parts.Add(new Segment(" sealed"));
        }

        if (kind is "struct" or "record struct")
        {
            if (HasAttribute(definition.GetCustomAttributes(), "System.Runtime.CompilerServices", "IsReadOnlyAttribute"))
            {
                parts.Add(new Segment(" readonly"));
            }

            if (HasAttribute(definition.GetCustomAttributes(), "System.Runtime.CompilerServices", "IsByRefLikeAttribute"))
            {
                parts.Add(new Segment(" ref"));
            }
        }

        var members = new JsonArray();
        var type = new JsonObject
        {
            ["id"] = id,
            ["namespace"] = Namespace(handle),
            ["name"] = displayName,
            ["kind"] = kind,
        };

        if (kind == "delegate")
        {
            var invoke = definition.GetMethods().First(method => _reader.GetString(_reader.GetMethodDefinition(method).Name) == "Invoke");
            var invokeMethod = _reader.GetMethodDefinition(invoke);
            var signature = invokeMethod.DecodeSignature(_provider, context);
            var invokeContext = Context(invokeMethod.GetCustomAttributes(), handle);
            parts.Add(new Segment(" delegate "));
            parts.AddRange(RefReturn(signature.ReturnType, ReturnIsReadOnly(invokeMethod)));
            parts.AddRange(SignatureRenderer.Render(signature.ReturnType, ReturnFlags(invokeMethod, invokeContext)));
            parts.Add(new Segment($" {declaredName}("));
            parts.AddRange(Parameters(invokeMethod, signature, isExtension: false, invokeContext));
            parts.Add(new Segment(")"));
            parts.AddRange(Constraints(definition.GetGenericParameters().Skip(allTypeParameters.Length - ownArity), context, Context(null, handle)));
        }
        else
        {
            parts.Add(new Segment($" {kind} {declaredName}"));
            var typeNullableContext = Context(null, handle);
            var inherits = new List<ImmutableArray<Segment>>();
            if (baseType is not null)
            {
                inherits.Add(SignatureRenderer.Render(baseType, Flags(definition.GetCustomAttributes(), typeNullableContext)));
                type["base"] = baseType.DefinitionId;
            }

            // Internal interfaces of this assembly are implementation details.
            var interfaces = definition.GetInterfaceImplementations()
                .Select(implementationHandle => _reader.GetInterfaceImplementation(implementationHandle))
                .Select(implementation => (Implementation: implementation, Type: Decode(implementation.Interface, context)))
                .Where(item => item.Type.Definition.IsNil || IsVisible(item.Type.Definition))
                .ToList();
            if (interfaces.Count > 0)
            {
                type["interfaces"] = new JsonArray(interfaces
                    .Select(item => item.Type.DefinitionId)
                    .OfType<string>()
                    .Distinct()
                    .Select(item => (JsonNode)item)
                    .ToArray());
            }

            if (kind != "enum")
            {
                inherits.AddRange(interfaces.Select(item =>
                    SignatureRenderer.Render(item.Type, Flags(item.Implementation.GetCustomAttributes(), typeNullableContext))));
            }

            if (inherits.Count > 0)
            {
                parts.Add(new Segment(" : "));
                parts.AddRange(SignatureRenderer.Join(inherits));
            }

            parts.AddRange(Constraints(definition.GetGenericParameters().Skip(allTypeParameters.Length - ownArity), context, typeNullableContext));

            ExtractMembers(handle, definition, kind, sealedType, name, context, members);
        }

        var declaring = definition.GetDeclaringType();
        if (!declaring.IsNil)
        {
            type["declaringType"] = $"T:{SignatureProvider.DefinitionName(_reader, declaring).Doc}";
        }

        type["signature"] = Parts(parts);
        AddCommon(type, id, definition.GetCustomAttributes());
        if (members.Count > 0)
        {
            type["members"] = members;
        }

        return type;
    }

    private void ExtractMembers(
        TypeDefinitionHandle handle,
        TypeDefinition definition,
        string kind,
        bool sealedType,
        SignatureProvider.TypeName typeName,
        GenericContext typeContext,
        JsonArray members)
    {
        var isInterface = kind == "interface";
        var accessors = new HashSet<MethodDefinitionHandle>();
        var entries = new List<(int Order, string Name, JsonObject Member)>();

        foreach (var propertyHandle in definition.GetProperties())
        {
            var property = _reader.GetPropertyDefinition(propertyHandle);
            var propertyAccessors = property.GetAccessors();
            accessors.Add(propertyAccessors.Getter);
            accessors.Add(propertyAccessors.Setter);
            var getter = Method(propertyAccessors.Getter);
            var setter = Method(propertyAccessors.Setter);
            var visibleGetter = getter is { } g && IsVisibleMember(g.Attributes, sealedType) ? getter : null;
            var visibleSetter = setter is { } s && IsVisibleMember(s.Attributes, sealedType) ? setter : null;
            var primary = visibleGetter ?? visibleSetter;
            if (primary is null || IsCompilerGenerated(property.GetCustomAttributes()))
            {
                continue;
            }

            var signature = property.DecodeSignature(_provider, typeContext);
            var name = _reader.GetString(property.Name);
            var parameterDocs = signature.ParameterTypes.Length > 0 ? $"({string.Join(",", signature.ParameterTypes.Select(type => type.Doc))})" : string.Empty;
            var id = $"P:{typeName.Doc}.{name}{parameterDocs}";
            var widest = Widest(visibleGetter?.Attributes, visibleSetter?.Attributes);
            var parts = new List<Segment>();
            if (!isInterface)
            {
                parts.Add(new Segment(AccessibilityText(widest) + Modifiers(primary.Value.Attributes, isInterface)));
            }
            else if ((primary.Value.Attributes & MethodAttributes.Static) != 0)
            {
                parts.Add(new Segment("static "));
            }

            if (HasAttribute(property.GetCustomAttributes(), "System.Runtime.CompilerServices", "RequiredMemberAttribute"))
            {
                parts.Add(new Segment("required "));
            }

            var propertyContext = Context(null, handle);
            parts.AddRange(RefReturn(signature.ReturnType, HasAttribute(property.GetCustomAttributes(), "System.Runtime.CompilerServices", "IsReadOnlyAttribute") || (visibleGetter is { } readOnlyGetter && ReturnIsReadOnly(readOnlyGetter))));
            parts.AddRange(SignatureRenderer.Render(signature.ReturnType, Flags(property.GetCustomAttributes(), propertyContext)));
            if (signature.ParameterTypes.Length > 0)
            {
                parts.Add(new Segment(" this["));
                parts.AddRange(Parameters(primary.Value, signature, isExtension: false, Context(primary.Value.GetCustomAttributes(), handle)));
                parts.Add(new Segment("]"));
            }
            else
            {
                parts.Add(new Segment($" {name}"));
            }

            var accessorText = new List<string>();
            if (visibleGetter is not null)
            {
                accessorText.Add(AccessorText(visibleGetter.Value.Attributes, widest, isInterface) + "get;");
            }

            if (visibleSetter is not null)
            {
                var setterSignature = visibleSetter.Value.DecodeSignature(_provider, typeContext);
                var keyword = setterSignature.ReturnType.IsInitOnly ? "init;" : "set;";
                accessorText.Add(AccessorText(visibleSetter.Value.Attributes, widest, isInterface) + keyword);
            }

            parts.Add(new Segment($" {{ {string.Join(" ", accessorText)} }}"));
            var member = new JsonObject
            {
                ["id"] = id,
                ["kind"] = signature.ParameterTypes.Length > 0 ? "indexer" : "property",
                ["name"] = signature.ParameterTypes.Length > 0 ? "this[]" : name,
                ["signature"] = Parts(parts),
            };
            AddCommon(member, id, property.GetCustomAttributes());
            entries.Add((2, name, member));
        }

        foreach (var eventHandle in definition.GetEvents())
        {
            var @event = _reader.GetEventDefinition(eventHandle);
            var eventAccessors = @event.GetAccessors();
            accessors.Add(eventAccessors.Adder);
            accessors.Add(eventAccessors.Remover);
            accessors.Add(eventAccessors.Raiser);
            var adder = Method(eventAccessors.Adder);
            if (adder is null || !IsVisibleMember(adder.Value.Attributes, sealedType))
            {
                continue;
            }

            var name = _reader.GetString(@event.Name);
            var id = $"E:{typeName.Doc}.{name}";
            var eventType = Decode(@event.Type, typeContext);
            var parts = new List<Segment>
            {
                new((isInterface ? string.Empty : AccessibilityText(adder.Value.Attributes) + Modifiers(adder.Value.Attributes, isInterface)) + "event "),
            };
            parts.AddRange(SignatureRenderer.Render(eventType, Flags(@event.GetCustomAttributes(), Context(null, handle))));
            parts.Add(new Segment($" {name}"));
            var member = new JsonObject
            {
                ["id"] = id,
                ["kind"] = "event",
                ["name"] = name,
                ["signature"] = Parts(parts),
            };
            AddCommon(member, id, @event.GetCustomAttributes());
            entries.Add((4, name, member));
        }

        foreach (var methodHandle in definition.GetMethods())
        {
            if (accessors.Contains(methodHandle))
            {
                continue;
            }

            var method = _reader.GetMethodDefinition(methodHandle);
            var name = _reader.GetString(method.Name);
            if (!IsVisibleMember(method.Attributes, sealedType)
                || name == ".cctor"
                || name.Contains('<')
                || IsCompilerGenerated(method.GetCustomAttributes())
                || (kind == "record" && name is "PrintMembers" or "<Clone>$"))
            {
                continue;
            }

            var methodTypeParameters = method.GetGenericParameters()
                .Select(parameter => _reader.GetString(_reader.GetGenericParameter(parameter).Name))
                .ToImmutableArray();
            var context = typeContext with { MethodParameters = methodTypeParameters };
            var signature = method.DecodeSignature(_provider, context);
            var isConstructor = name == ".ctor";
            var isOperator = (method.Attributes & MethodAttributes.SpecialName) != 0 && name.StartsWith("op_", StringComparison.Ordinal);
            var isExtension = HasAttribute(method.GetCustomAttributes(), "System.Runtime.CompilerServices", "ExtensionAttribute");
            var docName = isConstructor ? "#ctor" : name;
            if (methodTypeParameters.Length > 0)
            {
                docName += $"``{methodTypeParameters.Length}";
            }

            var parameterDocs = signature.ParameterTypes.Length > 0 ? $"({string.Join(",", signature.ParameterTypes.Select(type => type.Doc))})" : string.Empty;
            var id = $"M:{typeName.Doc}.{docName}{parameterDocs}";
            if (name is "op_Implicit" or "op_Explicit")
            {
                id += $"~{signature.ReturnType.Doc}";
            }

            var methodContext = Context(method.GetCustomAttributes(), handle);
            var returnType = SignatureRenderer.Render(signature.ReturnType, ReturnFlags(method, methodContext));
            var parts = new List<Segment>();
            if (!isInterface)
            {
                parts.Add(new Segment(AccessibilityText(method.Attributes) + (isConstructor ? string.Empty : Modifiers(method.Attributes, isInterface))));
            }
            else if ((method.Attributes & MethodAttributes.Static) != 0)
            {
                parts.Add(new Segment((method.Attributes & MethodAttributes.Abstract) != 0 ? "static abstract " : "static "));
            }

            string displayName;
            string memberKind;
            if (isConstructor)
            {
                memberKind = "constructor";
                displayName = typeName.Display.Split('.')[^1];
                parts.Add(new Segment(displayName));
            }
            else if (isOperator)
            {
                memberKind = "operator";
                var symbol = OperatorSymbol(name);
                if (name is "op_Implicit" or "op_Explicit")
                {
                    displayName = $"{(name == "op_Implicit" ? "implicit" : "explicit")} operator {string.Concat(returnType.Select(segment => segment.Text))}";
                    parts.Add(new Segment($"{(name == "op_Implicit" ? "implicit" : "explicit")} operator "));
                    parts.AddRange(returnType);
                }
                else
                {
                    displayName = $"operator {symbol}";
                    parts.AddRange(returnType);
                    parts.Add(new Segment($" operator {symbol}"));
                }
            }
            else
            {
                memberKind = "method";
                displayName = name;
                parts.AddRange(RefReturn(signature.ReturnType, ReturnIsReadOnly(method)));
                parts.AddRange(returnType);
                parts.Add(new Segment($" {name}"));
                if (methodTypeParameters.Length > 0)
                {
                    parts.Add(new Segment($"<{string.Join(", ", methodTypeParameters)}>"));
                }
            }

            parts.Add(new Segment("("));
            parts.AddRange(Parameters(method, signature, isExtension, methodContext));
            parts.Add(new Segment(")"));
            parts.AddRange(Constraints(method.GetGenericParameters(), context, methodContext));
            var member = new JsonObject
            {
                ["id"] = id,
                ["kind"] = memberKind,
                ["name"] = displayName,
                ["signature"] = Parts(parts),
            };
            if (isExtension)
            {
                member["extension"] = true;
            }

            AddCommon(member, id, method.GetCustomAttributes());
            entries.Add((isConstructor ? 0 : isOperator ? 5 : 3, displayName, member));
        }

        foreach (var fieldHandle in definition.GetFields())
        {
            var field = _reader.GetFieldDefinition(fieldHandle);
            var name = _reader.GetString(field.Name);
            if ((field.Attributes & FieldAttributes.SpecialName) != 0 || name.Contains('<') || IsCompilerGenerated(field.GetCustomAttributes()))
            {
                continue;
            }

            var access = field.Attributes & FieldAttributes.FieldAccessMask;
            var visible = access == FieldAttributes.Public
                          || (!sealedType && access is FieldAttributes.Family or FieldAttributes.FamORAssem);
            if (!visible)
            {
                continue;
            }

            var id = $"F:{typeName.Doc}.{name}";
            var constant = field.GetDefaultValue();
            var parts = new List<Segment>();
            JsonObject member;
            if (kind == "enum")
            {
                parts.Add(new Segment(constant.IsNil ? name : $"{name} = {ConstantText(constant)}"));
                member = new JsonObject { ["id"] = id, ["kind"] = "value", ["name"] = name };
            }
            else
            {
                var fieldType = field.DecodeSignature(_provider, typeContext);
                var modifiers = (field.Attributes & FieldAttributes.Literal) != 0
                    ? " const"
                    : ((field.Attributes & FieldAttributes.Static) != 0 ? " static" : string.Empty)
                      + ((field.Attributes & FieldAttributes.InitOnly) != 0 ? " readonly" : string.Empty);
                if (HasAttribute(field.GetCustomAttributes(), "System.Runtime.CompilerServices", "RequiredMemberAttribute"))
                {
                    modifiers += " required";
                }

                parts.Add(new Segment((access == FieldAttributes.Public ? "public" : access == FieldAttributes.Family ? "protected" : "protected internal") + modifiers + " "));
                parts.AddRange(SignatureRenderer.Render(fieldType, Flags(field.GetCustomAttributes(), Context(null, handle))));
                parts.Add(new Segment($" {name}"));
                if ((field.Attributes & FieldAttributes.Literal) != 0 && !constant.IsNil)
                {
                    parts.Add(new Segment($" = {ConstantText(constant)}"));
                }

                member = new JsonObject { ["id"] = id, ["kind"] = "field", ["name"] = name };
            }

            member["signature"] = Parts(parts);
            AddCommon(member, id, field.GetCustomAttributes());
            entries.Add((kind == "enum" ? 0 : 1, kind == "enum" ? string.Empty : name, member));
        }

        // Constructors, fields, properties, methods, events, operators; enum
        // values keep declaration order.
        foreach (var entry in entries
                     .Select((entry, index) => (entry, index))
                     .OrderBy(item => item.entry.Order)
                     .ThenBy(item => item.entry.Name, StringComparer.Ordinal)
                     .ThenBy(item => item.index))
        {
            members.Add(entry.entry.Member);
        }
    }

    private IEnumerable<Segment> Parameters(
        MethodDefinition method,
        MethodSignature<TypeSig> signature,
        bool isExtension,
        byte nullableContext)
    {
        var parameters = method.GetParameters()
            .Select(handle => _reader.GetParameter(handle))
            .Where(parameter => parameter.SequenceNumber > 0)
            .ToDictionary(parameter => parameter.SequenceNumber);
        for (var index = 0; index < signature.ParameterTypes.Length; index++)
        {
            if (index > 0)
            {
                yield return new Segment(", ");
            }

            var type = signature.ParameterTypes[index];
            parameters.TryGetValue(index + 1, out var parameter);
            var hasParameter = parameters.ContainsKey(index + 1);
            var prefix = index == 0 && isExtension ? "this " : string.Empty;
            if (hasParameter
                && (HasAttribute(parameter.GetCustomAttributes(), "System", "ParamArrayAttribute")
                    || HasAttribute(parameter.GetCustomAttributes(), "System.Runtime.CompilerServices", "ParamCollectionAttribute")))
            {
                prefix += "params ";
            }

            if (type.IsByRef)
            {
                var attributes = hasParameter ? parameter.Attributes : default;
                prefix += (attributes & ParameterAttributes.Out) != 0 && (attributes & ParameterAttributes.In) == 0
                    ? "out "
                    : type.RequiresLocation || (hasParameter && HasAttribute(parameter.GetCustomAttributes(), "System.Runtime.CompilerServices", "RequiresLocationAttribute"))
                        ? "ref readonly "
                    : type.IsIn || (hasParameter && HasAttribute(parameter.GetCustomAttributes(), "System.Runtime.CompilerServices", "IsReadOnlyAttribute"))
                        ? "in "
                        : "ref ";
            }

            if (prefix.Length > 0)
            {
                yield return new Segment(prefix);
            }

            var flags = hasParameter ? Flags(parameter.GetCustomAttributes(), nullableContext) : new NullableFlags([], nullableContext);
            foreach (var segment in SignatureRenderer.Render(type, flags))
            {
                yield return segment;
            }

            if (hasParameter)
            {
                yield return new Segment($" {_reader.GetString(parameter.Name)}");
                if ((parameter.Attributes & ParameterAttributes.HasDefault) != 0)
                {
                    var constant = parameter.GetDefaultValue();
                    var text = constant.IsNil ? "default" : ConstantText(constant);
                    yield return new Segment($" = {DefaultText(type, text)}");
                }
            }
        }
    }

    /// <summary>Shows enum defaults by name and value-type nulls as <c>default</c>.</summary>
    private string DefaultText(TypeSig type, string text)
    {
        var target = type.IsByRef ? type.Element : type;
        if (text == "null")
        {
            return target.IsValueType ? "default" : text;
        }

        if (target.Kind != SigKind.Named || !target.IsValueType)
        {
            return text;
        }

        if (!target.Definition.IsNil)
        {
            var definition = _reader.GetTypeDefinition(target.Definition);
            if (!definition.BaseType.IsNil && Decode(definition.BaseType, GenericContext.Empty).Doc == "System.Enum")
            {
                foreach (var fieldHandle in definition.GetFields())
                {
                    var field = _reader.GetFieldDefinition(fieldHandle);
                    var constant = field.GetDefaultValue();
                    if ((field.Attributes & FieldAttributes.Literal) != 0 && !constant.IsNil && ConstantText(constant) == text)
                    {
                        return $"{target.Name}.{_reader.GetString(field.Name)}";
                    }
                }

                return $"({target.Name}){text}";
            }

            return text;
        }

        // A named value type with a numeric constant is an enum from another
        // assembly, whose member names are not available here.
        return $"({target.Name}){text}";
    }

    /// <summary>
    /// NullableContextAttribute of the member, else of its declaring types
    /// outward; 0 (oblivious) when none applies.
    /// </summary>
    private byte Context(CustomAttributeHandleCollection? memberAttributes, TypeDefinitionHandle type)
    {
        if (memberAttributes is { } attributes && NullableValue(attributes, "NullableContextAttribute") is { Length: 1 } member)
        {
            return member[0];
        }

        for (var current = type; !current.IsNil; current = _reader.GetTypeDefinition(current).GetDeclaringType())
        {
            if (NullableValue(_reader.GetTypeDefinition(current).GetCustomAttributes(), "NullableContextAttribute") is { Length: 1 } value)
            {
                return value[0];
            }
        }

        return 0;
    }

    private NullableFlags Flags(CustomAttributeHandleCollection attributes, byte context)
    {
        var names = TupleElementNames(attributes);
        return NullableValue(attributes, "NullableAttribute") switch
        {
            { Length: 1 } single => new NullableFlags([], single[0], names),
            { } flags => new NullableFlags(flags, context, names),
            null => new NullableFlags([], context, names),
        };
    }

    /// <summary>The names of TupleElementNamesAttribute, in pre-order of the tuples in the type.</summary>
    private ImmutableArray<string?> TupleElementNames(CustomAttributeHandleCollection attributes)
    {
        foreach (var handle in attributes)
        {
            if (AttributeName(handle) != ("System.Runtime.CompilerServices", "TupleElementNamesAttribute"))
            {
                continue;
            }

            var value = _reader.GetCustomAttribute(handle).DecodeValue(new AttributeTypeProvider());
            return value.FixedArguments[0].Value is ImmutableArray<CustomAttributeTypedArgument<string>> names
                ? names.Select(name => name.Value as string).ToImmutableArray()
                : default;
        }

        return default;
    }

    /// <summary>A <c>ref readonly</c> return without a modifier has IsReadOnlyAttribute on parameter row 0.</summary>
    private bool ReturnIsReadOnly(MethodDefinition method) =>
        method.GetParameters()
            .Select(handle => _reader.GetParameter(handle))
            .Any(parameter => parameter.SequenceNumber == 0
                              && HasAttribute(parameter.GetCustomAttributes(), "System.Runtime.CompilerServices", "IsReadOnlyAttribute"));

    private static IEnumerable<Segment> RefReturn(TypeSig type, bool readOnly) =>
        type.IsByRef ? [new Segment(SignatureRenderer.ByRefPrefix(type, isReturn: true, readOnly))] : [];

    /// <summary>The return type's annotations live on parameter row 0.</summary>
    private NullableFlags ReturnFlags(MethodDefinition method, byte context)
    {
        foreach (var handle in method.GetParameters())
        {
            var parameter = _reader.GetParameter(handle);
            if (parameter.SequenceNumber == 0)
            {
                return Flags(parameter.GetCustomAttributes(), context);
            }
        }

        return new NullableFlags([], context);
    }

    /// <summary>The byte or byte[] argument of a nullable attribute, if present.</summary>
    private ImmutableArray<byte>? NullableValue(CustomAttributeHandleCollection attributes, string name)
    {
        foreach (var handle in attributes)
        {
            if (AttributeName(handle) != ("System.Runtime.CompilerServices", name))
            {
                continue;
            }

            var value = _reader.GetCustomAttribute(handle).DecodeValue(new AttributeTypeProvider());
            return value.FixedArguments[0].Value switch
            {
                byte single => [single],
                ImmutableArray<CustomAttributeTypedArgument<string>> array => array.Select(item => (byte)item.Value!).ToImmutableArray(),
                _ => null,
            };
        }

        return null;
    }

    /// <summary>C# <c>where</c> clauses for generic parameters that have constraints.</summary>
    private IEnumerable<Segment> Constraints(IEnumerable<GenericParameterHandle> parameters, GenericContext context, byte nullableContext)
    {
        foreach (var handle in parameters)
        {
            var parameter = _reader.GetGenericParameter(handle);
            var attributes = parameter.Attributes;
            // Roslyn marks notnull and class with 1, class? and unconstrained
            // parameters with 2, eliding the value that equals the context.
            var own = NullableValue(parameter.GetCustomAttributes(), "NullableAttribute")?.FirstOrDefault() ?? nullableContext;
            var clauses = new List<ImmutableArray<Segment>>();
            var isStruct = (attributes & GenericParameterAttributes.NotNullableValueTypeConstraint) != 0;
            if ((attributes & GenericParameterAttributes.ReferenceTypeConstraint) != 0)
            {
                clauses.Add([new Segment(own == 2 ? "class?" : "class")]);
            }
            else if (isStruct)
            {
                clauses.Add([new Segment(HasAttribute(parameter.GetCustomAttributes(), "System.Runtime.CompilerServices", "IsUnmanagedAttribute") ? "unmanaged" : "struct")]);
            }

            var types = parameter.GetConstraints()
                .Select(constraintHandle => _reader.GetGenericParameterConstraint(constraintHandle))
                .Select(constraint => (Constraint: constraint, Type: Decode(constraint.Type, context)))
                .Where(item => !(isStruct && item.Type.Doc == "System.ValueType"))
                .ToList();
            if (clauses.Count == 0 && types.Count == 0 && own == 1)
            {
                clauses.Add([new Segment("notnull")]);
            }

            clauses.AddRange(types.Select(item => SignatureRenderer.Render(item.Type, Flags(item.Constraint.GetCustomAttributes(), nullableContext))));
            if ((attributes & GenericParameterAttributes.DefaultConstructorConstraint) != 0 && !isStruct)
            {
                clauses.Add([new Segment("new()")]);
            }

            if (((int)attributes & 0x20) != 0)
            {
                clauses.Add([new Segment("allows ref struct")]);
            }

            if (clauses.Count == 0)
            {
                continue;
            }

            yield return new Segment($" where {_reader.GetString(parameter.Name)} : ");
            foreach (var segment in SignatureRenderer.Join(clauses))
            {
                yield return segment;
            }
        }
    }

    private void AddCommon(JsonObject target, string id, CustomAttributeHandleCollection attributes)
    {
        if (Obsolete(attributes) is { } obsolete)
        {
            target["obsolete"] = obsolete;
        }

        if (Docs.Convert(_docs.GetValueOrDefault(id)) is { } docs)
        {
            target["docs"] = docs;
        }
    }

    private string TypeKind(TypeDefinition definition, out TypeSig? baseType)
    {
        baseType = null;
        if ((definition.Attributes & TypeAttributes.Interface) != 0)
        {
            return "interface";
        }

        var baseName = definition.BaseType.IsNil ? null : Decode(definition.BaseType, GenericContext.Empty);
        switch (baseName?.Doc)
        {
            case "System.Enum":
                return "enum";
            case "System.MulticastDelegate":
                return "delegate";
            case "System.ValueType":
                return definition.GetMethods().Any(method => _reader.GetString(_reader.GetMethodDefinition(method).Name) == "PrintMembers")
                    ? "record struct"
                    : "struct";
        }

        var isRecord = definition.GetMethods().Any(method => _reader.GetString(_reader.GetMethodDefinition(method).Name) == "<Clone>$");
        if (baseName is not null && baseName.Doc != "System.Object")
        {
            var context = new GenericContext(
                definition.GetGenericParameters().Select(parameter => _reader.GetString(_reader.GetGenericParameter(parameter).Name)).ToImmutableArray(),
                []);
            baseType = Decode(definition.BaseType, context);
        }

        return isRecord ? "record" : "class";
    }

    private TypeSig Decode(EntityHandle handle, GenericContext context) => handle.Kind switch
    {
        HandleKind.TypeDefinition => _provider.GetTypeFromDefinition(_reader, (TypeDefinitionHandle)handle, 0),
        HandleKind.TypeReference => _provider.GetTypeFromReference(_reader, (TypeReferenceHandle)handle, 0),
        HandleKind.TypeSpecification => _provider.GetTypeFromSpecification(_reader, context, (TypeSpecificationHandle)handle, 0),
        _ => throw new InvalidOperationException($"Unexpected type handle {handle.Kind}"),
    };

    private MethodDefinition? Method(MethodDefinitionHandle handle) =>
        handle.IsNil ? null : _reader.GetMethodDefinition(handle);

    private static bool IsVisibleMember(MethodAttributes attributes, bool sealedType)
    {
        var access = attributes & MethodAttributes.MemberAccessMask;
        return access == MethodAttributes.Public
               || (!sealedType && access is MethodAttributes.Family or MethodAttributes.FamORAssem);
    }

    private static MethodAttributes Widest(MethodAttributes? first, MethodAttributes? second)
    {
        static int Rank(MethodAttributes? attributes) => (attributes & MethodAttributes.MemberAccessMask) switch
        {
            MethodAttributes.Public => 3,
            MethodAttributes.FamORAssem => 2,
            MethodAttributes.Family => 1,
            _ => 0,
        };

        return (Rank(first) >= Rank(second) ? first : second) ?? default;
    }

    private static string AccessorText(MethodAttributes accessor, MethodAttributes widest, bool isInterface) =>
        isInterface || (accessor & MethodAttributes.MemberAccessMask) == (widest & MethodAttributes.MemberAccessMask)
            ? string.Empty
            : AccessibilityText(accessor);

    private static string AccessibilityText(MethodAttributes attributes) => (attributes & MethodAttributes.MemberAccessMask) switch
    {
        MethodAttributes.Public => "public ",
        MethodAttributes.Family => "protected ",
        MethodAttributes.FamORAssem => "protected internal ",
        _ => string.Empty,
    };

    private static string Accessibility(TypeAttributes attributes) => (attributes & TypeAttributes.VisibilityMask) switch
    {
        TypeAttributes.NestedFamily => "protected",
        TypeAttributes.NestedFamORAssem => "protected internal",
        _ => "public",
    };

    private static string Modifiers(MethodAttributes attributes, bool isInterface)
    {
        if (isInterface)
        {
            return string.Empty;
        }

        if ((attributes & MethodAttributes.Static) != 0)
        {
            return "static ";
        }

        if ((attributes & MethodAttributes.Abstract) != 0)
        {
            return "abstract ";
        }

        if ((attributes & MethodAttributes.Virtual) == 0)
        {
            return string.Empty;
        }

        var newSlot = (attributes & MethodAttributes.NewSlot) != 0;
        var final = (attributes & MethodAttributes.Final) != 0;
        return (newSlot, final) switch
        {
            (true, true) => string.Empty, // Interface implementation, not virtual in C#.
            (true, false) => "virtual ",
            (false, true) => "sealed override ",
            (false, false) => "override ",
        };
    }

    private string Namespace(TypeDefinitionHandle handle)
    {
        var definition = _reader.GetTypeDefinition(handle);
        while (!definition.GetDeclaringType().IsNil)
        {
            definition = _reader.GetTypeDefinition(definition.GetDeclaringType());
        }

        return _reader.GetString(definition.Namespace);
    }

    private static int OwnArity(string metadataName)
    {
        var tick = metadataName.LastIndexOf('`');
        return tick < 0 ? 0 : int.Parse(metadataName[(tick + 1)..], CultureInfo.InvariantCulture);
    }

    private bool IsCompilerGenerated(CustomAttributeHandleCollection attributes) =>
        HasAttribute(attributes, "System.Runtime.CompilerServices", "CompilerGeneratedAttribute");

    private bool HasAttribute(CustomAttributeHandleCollection attributes, string ns, string name) =>
        attributes.Any(handle => AttributeName(handle) == (ns, name));

    private (string Namespace, string Name) AttributeName(CustomAttributeHandle handle)
    {
        var attribute = _reader.GetCustomAttribute(handle);
        EntityHandle type = attribute.Constructor.Kind switch
        {
            HandleKind.MemberReference => _reader.GetMemberReference((MemberReferenceHandle)attribute.Constructor).Parent,
            HandleKind.MethodDefinition => _reader.GetMethodDefinition((MethodDefinitionHandle)attribute.Constructor).GetDeclaringType(),
            _ => default,
        };
        return type.Kind switch
        {
            HandleKind.TypeReference => (_reader.GetString(_reader.GetTypeReference((TypeReferenceHandle)type).Namespace), _reader.GetString(_reader.GetTypeReference((TypeReferenceHandle)type).Name)),
            HandleKind.TypeDefinition => (_reader.GetString(_reader.GetTypeDefinition((TypeDefinitionHandle)type).Namespace), _reader.GetString(_reader.GetTypeDefinition((TypeDefinitionHandle)type).Name)),
            _ => (string.Empty, string.Empty),
        };
    }

    private string? Obsolete(CustomAttributeHandleCollection attributes)
    {
        foreach (var handle in attributes)
        {
            if (AttributeName(handle) != ("System", "ObsoleteAttribute"))
            {
                continue;
            }

            try
            {
                var value = _reader.GetCustomAttribute(handle).DecodeValue(new AttributeTypeProvider());
                return value.FixedArguments.FirstOrDefault().Value as string ?? string.Empty;
            }
            catch (BadImageFormatException)
            {
                return string.Empty;
            }
        }

        return null;
    }

    private string ConstantText(ConstantHandle handle)
    {
        var constant = _reader.GetConstant(handle);
        var blob = _reader.GetBlobReader(constant.Value);
        return constant.TypeCode switch
        {
            ConstantTypeCode.NullReference => "null",
            ConstantTypeCode.String => Quote(blob.ReadUTF16(blob.Length)),
            ConstantTypeCode.Boolean => blob.ReadBoolean() ? "true" : "false",
            ConstantTypeCode.Char => $"'{blob.ReadChar()}'",
            ConstantTypeCode.SByte => blob.ReadSByte().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.Byte => blob.ReadByte().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.Int16 => blob.ReadInt16().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.UInt16 => blob.ReadUInt16().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.Int32 => blob.ReadInt32().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.UInt32 => blob.ReadUInt32().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.Int64 => blob.ReadInt64().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.UInt64 => blob.ReadUInt64().ToString(CultureInfo.InvariantCulture),
            ConstantTypeCode.Single => blob.ReadSingle().ToString("R", CultureInfo.InvariantCulture),
            ConstantTypeCode.Double => blob.ReadDouble().ToString("R", CultureInfo.InvariantCulture),
            _ => "default",
        };
    }

    private static string Quote(string value) =>
        "\"" + value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal)
            .Replace("\n", "\\n", StringComparison.Ordinal).Replace("\r", "\\r", StringComparison.Ordinal) + "\"";

    private static JsonArray Parts(IEnumerable<Segment> segments)
    {
        var merged = new List<Segment>();
        foreach (var segment in segments)
        {
            if (segment.Text.Length == 0)
            {
                continue;
            }

            if (merged.Count > 0 && merged[^1].Ref is null && segment.Ref is null)
            {
                merged[^1] = new Segment(merged[^1].Text + segment.Text);
            }
            else
            {
                merged.Add(segment);
            }
        }

        // Strings are plain text; [text, ref] pairs link a type.
        return new JsonArray(merged
            .Select(segment => segment.Ref is null
                ? (JsonNode)segment.Text
                : new JsonArray(segment.Text, segment.Ref))
            .ToArray());
    }

    private static string OperatorSymbol(string name) => name switch
    {
        "op_Addition" => "+",
        "op_Subtraction" => "-",
        "op_Multiply" => "*",
        "op_Division" => "/",
        "op_Modulus" => "%",
        "op_Equality" => "==",
        "op_Inequality" => "!=",
        "op_LessThan" => "<",
        "op_GreaterThan" => ">",
        "op_LessThanOrEqual" => "<=",
        "op_GreaterThanOrEqual" => ">=",
        "op_BitwiseAnd" => "&",
        "op_BitwiseOr" => "|",
        "op_ExclusiveOr" => "^",
        "op_LogicalNot" => "!",
        "op_OnesComplement" => "~",
        "op_UnaryNegation" => "-",
        "op_UnaryPlus" => "+",
        "op_Increment" => "++",
        "op_Decrement" => "--",
        "op_True" => "true",
        "op_False" => "false",
        "op_LeftShift" => "<<",
        "op_RightShift" => ">>",
        _ => name,
    };

    private sealed class AttributeTypeProvider : ICustomAttributeTypeProvider<string>
    {
        public string GetPrimitiveType(PrimitiveTypeCode typeCode) => typeCode.ToString();

        public string GetSystemType() => "System.Type";

        public string GetSZArrayType(string elementType) => elementType + "[]";

        public string GetTypeFromDefinition(MetadataReader reader, TypeDefinitionHandle handle, byte rawTypeKind) =>
            SignatureProvider.DefinitionName(reader, handle).Doc;

        public string GetTypeFromReference(MetadataReader reader, TypeReferenceHandle handle, byte rawTypeKind) =>
            SignatureProvider.ReferenceName(reader, handle).Doc;

        public string GetTypeFromSerializedName(string name) => name;

        public PrimitiveTypeCode GetUnderlyingEnumType(string type) => PrimitiveTypeCode.Int32;

        public bool IsSystemType(string type) => type == "System.Type";
    }
}
