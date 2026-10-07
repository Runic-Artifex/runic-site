// Usage: ApiExtractor <output-directory> <package-id>=<package.nupkg>...
//
// For each package, selects one target framework under lib/ (the highest
// netX.Y, else the highest netstandard), reads every assembly in it with
// System.Reflection.Metadata and joins its XML documentation. Writes
// <output-directory>/<package-id>.json. Never loads or executes package code.
using System.IO.Compression;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace ApiExtractor;

internal static partial class Program
{
    private static int Main(string[] args)
    {
        if (args is ["--select-framework", .. var candidates])
        {
            // Test hook: prints the framework the extractor would document.
            Console.WriteLine(SelectFramework(candidates) ?? "(none)");
            return 0;
        }

        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: ApiExtractor <output-directory> <package-id>=<package.nupkg>...");
            return 2;
        }

        Directory.CreateDirectory(args[0]);
        foreach (var argument in args.Skip(1))
        {
            var separator = argument.IndexOf('=', StringComparison.Ordinal);
            if (separator <= 0)
            {
                Console.Error.WriteLine($"Expected <package-id>=<package.nupkg>, got {argument}");
                return 2;
            }

            var expected = argument[..separator];
            var nupkg = argument[(separator + 1)..];
            var package = ExtractPackage(nupkg);
            var id = package["package"]!.GetValue<string>();
            // The nuspec id names the output file: it must be the requested
            // package and a plain file name.
            if (!string.Equals(id, expected, StringComparison.Ordinal) || !PackageId().IsMatch(id))
            {
                Console.Error.WriteLine($"{nupkg}: nuspec id '{id}' is not the expected '{expected}'");
                return 1;
            }

            var path = Path.Combine(args[0], $"{id}.json");
            File.WriteAllText(path, package.ToJsonString(JsonOptions) + "\n");
            Console.WriteLine($"{id}: {package["types"]!.AsArray().Count} types -> {path}");
        }

        return 0;
    }

    internal static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static JsonObject ExtractPackage(string nupkg)
    {
        using var zip = ZipFile.OpenRead(nupkg);
        var nuspecEntry = zip.Entries.Single(entry =>
            !entry.FullName.Contains('/') && entry.FullName.EndsWith(".nuspec", StringComparison.OrdinalIgnoreCase));
        XDocument nuspec;
        using (var stream = nuspecEntry.Open())
        {
            nuspec = XDocument.Load(stream);
        }

        var metadata = nuspec.Root!.Elements().Single(element => element.Name.LocalName == "metadata");
        string Meta(string name) => metadata.Elements().Single(element => element.Name.LocalName == name).Value;

        var frameworks = zip.Entries
            .Select(entry => entry.FullName.Split('/'))
            .Where(parts => parts.Length == 3 && parts[0] == "lib" && parts[2].EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
            .Select(parts => parts[1])
            .Distinct()
            .ToList();
        var framework = SelectFramework(frameworks)
            ?? throw new InvalidOperationException($"{nupkg} has no lib/net* or lib/netstandard* assemblies");

        var types = new JsonArray();
        var assemblies = new JsonArray();
        foreach (var dll in zip.Entries
                     .Where(entry => entry.FullName.StartsWith($"lib/{framework}/", StringComparison.Ordinal)
                                     && entry.FullName.Count(c => c == '/') == 2
                                     && entry.FullName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
                     .OrderBy(entry => entry.FullName, StringComparer.Ordinal))
        {
            var xmlName = dll.FullName[..^4] + ".xml";
            var xml = zip.GetEntry(xmlName);
            var docs = xml is null ? new Dictionary<string, XElement>() : LoadDocs(xml);
            using var image = new MemoryStream();
            using (var stream = dll.Open())
            {
                stream.CopyTo(image);
            }

            image.Position = 0;
            var assembly = new AssemblyExtractor(image, docs);
            assemblies.Add(assembly.Name);
            foreach (var type in assembly.Extract())
            {
                types.Add(type);
            }
        }

        return new JsonObject
        {
            ["package"] = Meta("id"),
            ["version"] = Meta("version"),
            ["framework"] = framework,
            ["frameworks"] = new JsonArray(frameworks.Order(StringComparer.Ordinal).Select(f => (JsonNode)f).ToArray()),
            ["assemblies"] = assemblies,
            ["types"] = types,
        };
    }

    /// <summary>Highest netX.Y (without a platform suffix first), else netstandard.</summary>
    internal static string? SelectFramework(IReadOnlyCollection<string> frameworks)
    {
        static (int Family, Version Version, int Plain)? Rank(string tfm)
        {
            var net = NetFramework().Match(tfm);
            if (net.Success)
            {
                return (2, Version.Parse(net.Groups[1].Value), net.Groups[2].Success ? 0 : 1);
            }

            var standard = NetStandard().Match(tfm);
            return standard.Success ? (1, Version.Parse(standard.Groups[1].Value), 1) : null;
        }

        return frameworks
            .Select(tfm => (Tfm: tfm, Rank: Rank(tfm)))
            .Where(candidate => candidate.Rank is not null)
            .OrderByDescending(candidate => candidate.Rank!.Value.Family)
            .ThenByDescending(candidate => candidate.Rank!.Value.Version)
            .ThenByDescending(candidate => candidate.Rank!.Value.Plain)
            .Select(candidate => candidate.Tfm)
            .FirstOrDefault();
    }

    private static Dictionary<string, XElement> LoadDocs(ZipArchiveEntry entry)
    {
        using var stream = entry.Open();
        var document = XDocument.Load(stream, LoadOptions.PreserveWhitespace);
        var members = new Dictionary<string, XElement>(StringComparer.Ordinal);
        foreach (var member in document.Descendants("member"))
        {
            var name = member.Attribute("name")?.Value;
            if (name is not null)
            {
                members[name] = member;
            }
        }

        return members;
    }

    [GeneratedRegex(@"^[A-Za-z0-9_][A-Za-z0-9._-]*$")]
    private static partial Regex PackageId();

    [GeneratedRegex(@"^net(\d+\.\d+)(-.+)?$")]
    private static partial Regex NetFramework();

    [GeneratedRegex(@"^netstandard(\d+\.\d+)$")]
    private static partial Regex NetStandard();
}
