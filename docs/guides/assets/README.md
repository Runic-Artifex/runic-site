# Embed and serve assets

Runic Assets turns a frontend build, such as Vite's `dist` folder, into one
validated archive inside your .NET application, and serves it from ASP.NET Core
or a Runic Desktop window. Every file keeps its media type, length, SHA-256
digest, entity tag and cache policy, so both hosts answer the same request the
same way.

Use it when the application should ship as one executable instead of an
executable and a folder, or when an ASP.NET Core application serves a single
page application. Projects created with `dotnet new runic-app` do not need it:
they copy the built frontend to a `www` folder next to the executable.

> **Unreleased.** This guide follows the SDK's `main` branch, which becomes
> Runic SDK 0.7.0-preview.1. Differences from the published 0.6.0-preview.1
> are marked where they occur.

Replace `<VERSION>` below with the current release from the
[package catalog](https://docs.runic-artifex.eu/packages/). The code below is quoted
from the package READMEs and checked against them.

## 1. Add the packages

```sh docs-test=commands
dotnet add package Runic.Assets --version <VERSION>
```

Add the adapter for the host that serves the files:

```sh docs-test=commands
dotnet add package Runic.Assets.AspNetCore --version <VERSION>
# or, for Runic Desktop windows:
dotnet add package Runic.Assets.Desktop --version <VERSION>
```

`Runic.Assets` has no UI or web framework dependency. Each adapter brings it
along.

## 2. Embed the frontend build

Build the frontend first, for example with `npm run build`, so its output
folder exists. Then point the .NET project at that folder:

```xml docs-test=readme:packages/dotnet/Runic.Assets/README.md
<PropertyGroup>
  <RunicAssetsDist>../Client.Web/dist</RunicAssetsDist>
</PropertyGroup>
```

`dotnet build` packs the folder into a canonical archive and embeds it as the
`Runic.Assets.StaticFiles` resource. The build skips packing when the files and
the project look unchanged by their timestamps, so after deleting a file from
the folder run a rebuild. The same files always produce the same bytes. Load it at
startup:

```csharp docs-test=readme:packages/dotnet/Runic.Assets/README.md
using System.Reflection;
using Runic.Assets;

AssetArchiveSource assets = AssetArchive.ReadEmbedded(
    Assembly.GetExecutingAssembly());
```

| Property                          | Use                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RunicAssetsDist`                 | Folder to pack and embed.                                                                                                                                        |
| `RunicAssetsEntryPoint`           | Entry document inside the folder. Defaults to `index.html`.                                                                                                      |
| `RunicAssetsDistExclude`          | Paths to leave out, separated by semicolons. Defaults to `runic-assets.zip`; setting it replaces the default, so list that file again if the folder contains it. |
| `RunicAssetsEmbeddedArchive`      | Embed an archive that was packed in a separate step (see below) instead of `RunicAssetsDist`.                                                                    |
| `RunicAssetsEmbeddedResourceName` | Resource name, if not `Runic.Assets.StaticFiles`. Pass the same name to `ReadEmbedded`.                                                                          |

Hashed file names, such as Vite's `index-Cf3tzbYH.js`, are cached as immutable.
Every other file, including `index.html`, is revalidated with its entity tag.

## 3. Serve it from ASP.NET Core

Map the source in `Program.cs`:

```csharp docs-test=readme:packages/dotnet/Runic.Assets.AspNetCore/README.md
AssetArchiveSource assets = AssetArchive.ReadEmbedded(
    Assembly.GetExecutingAssembly());

app.MapRunicAssetSource(assets);
app.Run();
```

The endpoint serves every file at its path, the entry point at `/`, and the
entry point for missing paths without a file extension, such as
`/settings/profile`, so client-side routes survive a reload. It answers only
`GET` and `HEAD`, supports conditional and range requests, and runs after the
application's own endpoints.

Because unknown extensionless paths return the entry point, an application that
also serves an API should mount the assets under a prefix and build the
frontend with the same absolute base (Vite's `base: "/ui/"`):

```csharp docs-test=readme:packages/dotnet/Runic.Assets.AspNetCore/README.md
app.MapRunicAssetSource(assets, "ui");
```

or serve exact paths only:

```csharp docs-test=readme:packages/dotnet/Runic.Assets.AspNetCore/README.md
app.MapRunicAssetSource(assets, routing: new AssetRoutingOptions
{
    ServeEntryPointAtRoot = false,
    EnableSinglePageApplicationFallback = false,
});
```

In 0.6.0-preview.1 `MapRunicAssetSource` serves exact manifest paths only, so
the entry point is at `/index.html` and there is no `AssetRoutingOptions`.

## 4. Serve it in a Runic Desktop window

Pass the adapter's content handler as the surface content:

```csharp docs-test=readme:packages/dotnet/Runic.Assets.Desktop/README.md
AssetArchiveSource assets = AssetArchive.ReadEmbedded(Assembly.GetExecutingAssembly());
await using var host = await DesktopHost.StartAsync();
await using var surface = await host.CreateSurfaceAsync(new DesktopSurfaceOptions
{
    Content = new DesktopContent.Handler(assets.ToDesktopContentHandler()),
});
```

Paths resolve exactly as in ASP.NET Core, so one archive behaves the same on
both hosts. Pass `AssetRoutingOptions` to `ToDesktopContentHandler` to change
the rules.

In 0.6.0-preview.1 set `ContentHandler = assets.ToDesktopContentHandler()`
instead of `Content`. There, `ToDesktopContentHandler` extends `IAssetSource`
and takes `DesktopAssetOptions? options`; in 0.7 it extends
`IAssetSnapshotSource` and takes `AssetRoutingOptions? routing`.

## 5. Pack in a separate step

Most applications let `dotnet build` pack the folder. Run the packer yourself
when the archive is produced in a separate step: a CI job that builds the
frontend once for several .NET builds, an application that loads an archive
file at run time, or to inspect exactly what the build would embed. The packer
ships inside the `Runic.Assets` package:

```sh docs-test=readme:tools/Runic.Assets.Packer/README.md
packer="$HOME/.nuget/packages/runic.assets/<VERSION>/tools/net10.0/Runic.Assets.Packer.dll"
dotnet "$packer" Client.Web/dist artifacts/app.runic-assets --trusted-generated-output
```

Embed the result with `RunicAssetsEmbeddedArchive`, or open the file at run time
with `AssetArchive.Read`. The
[packer README](https://github.com/Runic-Artifex/runic-sdk/blob/main/tools/Runic.Assets.Packer/README.md)
lists its options, JSON output and exit codes.

### Trusted generated output

Without `--trusted-generated-output`, the packer opens every file and folder
through pinned Linux handles, so a file swapped for a symbolic link while it
runs cannot redirect it outside the source folder. That mode requires Linux.

With `--trusted-generated-output` the packer uses ordinary file APIs and works
on Linux, Windows and macOS. It still rejects symbolic links and reparse points
it sees, but assumes that nothing changes the folder while it runs. Use it for
output of your own build or CI job that no other process can write to; the
`dotnet build` integration always uses it for that reason. Leave it off on Linux
when a less trusted process can write to the folder, such as a shared upload
directory.

## Troubleshooting

- **`The RunicAssetsDist directory '...' does not exist.`** The frontend was not
  built before `dotnet build`. Build it first, or make the build depend on it.
- **`Set either RunicAssetsDist or RunicAssetsEmbeddedArchive, not both.`**
  Choose one source for the embedded archive.
- **`Entry point '...' does not exist below '...' or was excluded.`** (packer
  exit code `4`) Set `RunicAssetsEntryPoint` or `--entry-point` to a file in the
  folder that is not excluded.
- **`Directory archive compilation requires Linux handle-pinned traversal.`**
  (packer exit code `5`) Without `--trusted-generated-output` the packer runs
  only on Linux. Pass the option for your own build output on Windows and macOS.
- **A request for `/` or a client route returns `404` on 0.6.0-preview.1.**
  0.6 serves exact paths only; request `/index.html` or upgrade.

## Reference

- [`Runic.Assets`](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Assets/README.md):
  explicit embedded resources, the Linux development directory source,
  validation and inspection.
- [`Runic.Assets.AspNetCore`](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Assets.AspNetCore/README.md)
  and [`Runic.Assets.Desktop`](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Assets.Desktop/README.md):
  HTTP behavior and routing.
- [Archive format](https://github.com/Runic-Artifex/runic-sdk/blob/main/specs/assets/archive-v1.md)
  and the [framework-neutral asset boundary](adr/0013-framework-neutral-asset-boundary.md).
