using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace ApiExtractor;

/// <summary>
/// Converts XML documentation into a small JSON tree that the portal renders:
/// strings are text; objects are <c>{"c": code}</c>, <c>{"see": cref, "t"?}</c>,
/// <c>{"href": url, "t"}</c>, <c>{"p": nodes}</c>, <c>{"pre": code}</c>,
/// <c>{"ul"|"ol": [nodes]}</c>, <c>{"b"|"i": nodes}</c>.
/// </summary>
internal static partial class Docs
{
    private static readonly string[] Sections = ["summary", "remarks", "returns", "value", "example"];

    public static JsonObject? Convert(XElement? member)
    {
        if (member is null)
        {
            return null;
        }

        var docs = new JsonObject();
        foreach (var section in Sections)
        {
            var element = member.Element(section);
            if (element is not null && Nodes(element.Nodes()) is { Count: > 0 } nodes)
            {
                docs[section] = nodes;
            }
        }

        AddNamed(docs, member, "param", "params");
        AddNamed(docs, member, "typeparam", "typeparams");

        var exceptions = new JsonArray();
        foreach (var exception in member.Elements("exception"))
        {
            exceptions.Add(new JsonObject
            {
                ["cref"] = exception.Attribute("cref")?.Value,
                ["doc"] = Nodes(exception.Nodes()),
            });
        }

        if (exceptions.Count > 0)
        {
            docs["exceptions"] = exceptions;
        }

        var seeAlso = member.Elements("seealso")
            .Select(element => element.Attribute("cref")?.Value)
            .OfType<string>()
            .Select(cref => (JsonNode)cref)
            .ToArray();
        if (seeAlso.Length > 0)
        {
            docs["seealso"] = new JsonArray(seeAlso);
        }

        if (member.Element("inheritdoc") is { } inheritdoc)
        {
            var cref = inheritdoc.Attribute("cref")?.Value;
            docs["inheritdoc"] = cref is null ? new JsonObject() : new JsonObject { ["cref"] = cref };
        }

        return docs.Count == 0 ? null : docs;
    }

    private static void AddNamed(JsonObject docs, XElement member, string element, string property)
    {
        var entries = new JsonArray();
        foreach (var item in member.Elements(element))
        {
            entries.Add(new JsonObject
            {
                ["name"] = item.Attribute("name")?.Value ?? string.Empty,
                ["doc"] = Nodes(item.Nodes()),
            });
        }

        if (entries.Count > 0)
        {
            docs[property] = entries;
        }
    }

    public static JsonArray Nodes(IEnumerable<XNode> nodes)
    {
        var result = new List<JsonNode>();
        foreach (var node in nodes)
        {
            switch (node)
            {
                case XText text:
                    AppendText(result, Whitespace().Replace(text.Value, " "));
                    break;
                case XElement element:
                    foreach (var converted in Element(element))
                    {
                        if (converted is JsonValue value && value.TryGetValue<string>(out var s))
                        {
                            AppendText(result, s);
                        }
                        else
                        {
                            result.Add(converted);
                        }
                    }

                    break;
            }
        }

        Trim(result);
        return new JsonArray(result.ToArray());
    }

    private static IEnumerable<JsonNode> Element(XElement element)
    {
        string? Attr(string name) => element.Attribute(name)?.Value;
        var inner = Whitespace().Replace(element.Value, " ").Trim();
        switch (element.Name.LocalName)
        {
            case "see":
            case "seealso":
                if (Attr("langword") is { } langword)
                {
                    yield return new JsonObject { ["c"] = langword };
                }
                else if (Attr("cref") is { } cref)
                {
                    var see = new JsonObject { ["see"] = cref };
                    if (inner.Length > 0)
                    {
                        see["t"] = inner;
                    }

                    yield return see;
                }
                else if (Attr("href") is { } href)
                {
                    yield return new JsonObject { ["href"] = href, ["t"] = inner.Length > 0 ? inner : href };
                }

                break;
            case "paramref":
            case "typeparamref":
                yield return new JsonObject { ["c"] = Attr("name") ?? string.Empty };
                break;
            case "c":
                yield return new JsonObject { ["c"] = inner };
                break;
            case "code":
                yield return new JsonObject { ["pre"] = Dedent(element.Value) };
                break;
            case "para":
                yield return new JsonObject { ["p"] = Nodes(element.Nodes()) };
                break;
            case "list":
                var items = new JsonArray();
                foreach (var item in element.Elements("item"))
                {
                    var term = item.Element("term");
                    var description = item.Element("description");
                    if (term is not null && description is not null)
                    {
                        var nodes = Nodes(term.Nodes()).Select(node => node!.DeepClone()).ToList();
                        nodes.Add(" – ");
                        nodes.AddRange(Nodes(description.Nodes()).Select(node => node!.DeepClone()));
                        items.Add(new JsonArray(nodes.ToArray()));
                    }
                    else
                    {
                        items.Add(Nodes(item.Nodes()));
                    }
                }

                yield return new JsonObject { [Attr("type") == "number" ? "ol" : "ul"] = items };
                break;
            case "b":
            case "strong":
                yield return new JsonObject { ["b"] = Nodes(element.Nodes()) };
                break;
            case "i":
            case "em":
                yield return new JsonObject { ["i"] = Nodes(element.Nodes()) };
                break;
            case "a":
                yield return new JsonObject { ["href"] = Attr("href") ?? string.Empty, ["t"] = inner };
                break;
            case "br":
                yield return JsonValue.Create(" ")!;
                break;
            default:
                foreach (var node in Nodes(element.Nodes()))
                {
                    yield return node!.DeepClone();
                }

                break;
        }
    }

    private static void AppendText(List<JsonNode> result, string text)
    {
        if (result.Count > 0 && result[^1] is JsonValue previous && previous.TryGetValue<string>(out var before))
        {
            var merged = Whitespace().Replace(before + text, " ");
            result[^1] = JsonValue.Create(merged)!;
        }
        else if (text.Length > 0)
        {
            result.Add(JsonValue.Create(text)!);
        }
    }

    private static void Trim(List<JsonNode> result)
    {
        if (result.Count > 0 && result[0] is JsonValue first && first.TryGetValue<string>(out var start))
        {
            start = start.TrimStart();
            if (start.Length == 0)
            {
                result.RemoveAt(0);
            }
            else
            {
                result[0] = JsonValue.Create(start)!;
            }
        }

        if (result.Count > 0 && result[^1] is JsonValue last && last.TryGetValue<string>(out var end))
        {
            end = end.TrimEnd();
            if (end.Length == 0)
            {
                result.RemoveAt(result.Count - 1);
            }
            else
            {
                result[^1] = JsonValue.Create(end)!;
            }
        }
    }

    private static string Dedent(string code)
    {
        var lines = code.Replace("\r\n", "\n").Split('\n').ToList();
        while (lines.Count > 0 && string.IsNullOrWhiteSpace(lines[0]))
        {
            lines.RemoveAt(0);
        }

        while (lines.Count > 0 && string.IsNullOrWhiteSpace(lines[^1]))
        {
            lines.RemoveAt(lines.Count - 1);
        }

        var indent = lines
            .Where(line => line.Trim().Length > 0)
            .Select(line => line.Length - line.TrimStart().Length)
            .DefaultIfEmpty(0)
            .Min();
        return string.Join("\n", lines.Select(line => line.Length >= indent ? line[indent..] : line.TrimStart()));
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
