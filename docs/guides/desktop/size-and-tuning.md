# Measure and tune a published application

`dotnet runic size` publishes into a new directory, retains the publish log and
complete ZIP, and records a JSON inventory with hashes and byte counts. It never
removes files based on its category guesses.

```sh docs-test=readme:tools/dotnet-runic/README.md
dotnet runic size --project path/to/App.csproj --runtime linux-x64 --report measurements/linux.json
```

`--runtime` is required. `--project` selects the project when the directory has
several, and `--configuration` overrides Release. The host and the
[minimal hosting profile](#minimal-desktop-hosting) come from the project, so
compare them by measuring each project configuration into its own report.

The command uses Release, self-contained NativeAOT and size optimization by
default. Use `--no-aot` for a managed comparison; since SDK `0.11.0`,
`--no-aot --no-self-contained` measures a framework-dependent build.
`--property Name=Value`, also new in `0.11.0`, passes another MSBuild property
to the evaluation and the publish, as `dotnet publish -p` does, and the report
lists it in `effectiveProperties`; `--property OptimizationPreference=Speed`
measures a speed-optimized build. The properties that have their own options
are refused with `RAPPSIZE1006`. `-v`/`--verbosity` sets the publish's MSBuild
verbosity. It preserves your project's
culture and diagnostic settings. Each report needs a new path so previous
evidence is retained. `--format json` selects the command's JSON envelope;
`--report` selects the measurement file. Progress streams to stderr in JSON mode.

A successful publish alone has verification status `not-run`. Supply a checker
that exercises the actual published application to earn `passed`:

```sh docs-test=skip:illustrative-command
dotnet runic size --runtime linux-x64 --report measurements/checked.json \
  --verify bun --verify-argument ./check-published-app.mjs
```

The checker receives its explicit arguments, then the publish directory and
main executable path. Arguments are passed without a shell. A nonzero checker
exit records `failed` and makes the size command fail. Publish failures also
produce a report and retain diagnostics. The checker controls its application
lifetime; it should fail on crashes and forced termination. The SDK's customer
checker tests validation, save, cancel, reconnect and shutdown of the published
NativeAOT executable.

Reports include SDK, build OS/architecture, installed runtime versions, target
RID, package/project dependency versions, source revision when available,
evaluated MSBuild settings, every file's SHA-256, total disk bytes and actual ZIP
bytes. Empty MSBuild values mean unspecified, not false; some defaults are
computed later by publish targets. Each command stream is bounded to 4 Mi
characters and explicitly marked if truncated. The report is local and includes
paths and command arguments: review it before sharing.

## The native server

Since SDK `0.15.0`, the largest saving for a Runic Desktop application is its
server: `Runic.Desktop.NativeServer`, which new projects use, replaces ASP.NET
Core Kestrel (`Runic.Desktop.Kestrel`). For the SDK's first-window example on
linux-x64, its NativeAOT executable is 9.97 instead of 12.96 MiB and serves its
first page after about 13 instead of 21 ms, and a framework-dependent build
needs no ASP.NET Core runtime. The
[native server's README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/dotnet/Runic.Desktop.NativeServer/README.md#what-you-get)
has the measurements for each publish mode, and
[the presentation server](host-selection.md#presentation-server) explains the
choice. The measurements below predate it and use Kestrel.

## Minimal Desktop hosting

The minimal profile applies to `Runic.Desktop.Kestrel`; the native server
has no ASP.NET Core host to trim. Enable it for ordinary publishing with:

```xml docs-test=skip:illustrative-project-setting
<PropertyGroup>
  <RunicDesktopMinimalHost>true</RunicDesktopMinimalHost>
  <PublishAot>true</PublishAot>
  <OptimizationPreference>Size</OptimizationPreference>
</PropertyGroup>
```

The default host uses ASP.NET Core's slim builder. The minimal profile uses the
empty builder and registers Kestrel's core server and socket transport explicitly.
A linker feature switch removes the unused builder branch. Listener isolation,
surfaces, WebSockets, admission, origin and message limits, and shutdown use the
same code. Both profiles pass the 69 Desktop conformance tests locally.

The profile omits the slim builder's default configuration providers and other
optional hosting defaults. Applications relying on host configuration or implicit
services must test those assumptions; `ConfigureServices` still runs. It does
not add MVC, authentication, HTTPS configuration or other ASP.NET facilities.
It does not remove any documented Runic presentation or bridge capability.
The default profile remains available by omitting the property or setting false.
This property has no role in CS-WebUI, which has no ASP.NET Core dependency.

## Making the executable smaller

Runic already keeps a NativeAOT or trimmed publish small without a setting of
yours; SDK `0.22.0` made both hosts smaller, and `0.23.0` leaves Bridge blobs
out where no Bridge uses them:

- Its packages are built for trimming and NativeAOT, so the trimmer removes the
  Runic code an application does not reach, including the platform backends of
  other operating systems.
- Development-only code sits behind feature switches that a trimmed or
  NativeAOT publish turns off: the development server fallback
  (`Runic.Application.DevelopmentServerForwarding`), the CS-WebUI Window's
  DevTools Protocol endpoint (`Runic.Desktop.WebUiRemoteDebugging`) and
  `dotnet runic dev`'s live frontend directory
  (`Runic.Application.Views.Desktop.DevelopmentAssets`). Only the publish turns
  them off: builds and `dotnet run` keep them, also when the project sets
  `PublishAot`.
- **Bridge blobs and uploads only where a Bridge uses them** (0.23). The
  generated codecs of a member that holds a `RunicBlob` or takes a
  `RunicUpload` mark their assembly. A trimmed or NativeAOT publish in which no
  assembly is marked or names `RunicBlob` or `RunicUpload` in its metadata
  turns the feature switch `Runic.Application.Views.Blobs` off: the producer
  no longer lists `blobs/1` or grants uploads, the CS-WebUI host starts no
  blob endpoint, Runic Desktop serves no blob exchange, and the trimmer removes
  the Window's blob store, its upload folder and the CS-WebUI loopback blob
  server. On linux-x64 the scaling suite's CS-WebUI fixture is 365 KB smaller
  (7,431,440 instead of 7,796,672 bytes), its Runic Desktop fixture 163 KB and
  its Translations fixture 353 KB. Such an application's pages get no upload
  grant, and `client.upload` rejects with `unavailable`. Builds, `dotnet run`
  and untrimmed publishes keep `blobs/1`; set
  `<RunicBridgeBlobs>true</RunicBridgeBlobs>` to keep it in every publish, for
  example when only reflection reaches a `RunicBlob`. `RunicBridgeBlobs` and
  `RunicDevelopmentOnlyViews` take `auto` or `true`; another value, such as
  `false`, is warning `RUNICBRIDGE075` and counts as `auto`.
- **No ICU before the first page** (fixed in 0.23). Since 0.22.0, the
  generated reader of the Bridges' descriptor tables parsed member ids with
  `int.Parse(…, CultureInfo.InvariantCulture)`, which loaded ICU on the first
  window's Bridge: about 5 MiB more memory at startup on Linux for a NativeAOT
  application on the native server. Rebuild with 0.23.0 to regenerate it.
- **Generated Bridges cost less per ViewModel** (0.22). They share one codec
  per wire type, one getter per property and one async command runner per
  assembly, and describe their members in a table instead of creating
  descriptors with a lambda per member. In the scaling suite's `aot-size`
  fixture a ViewModel costs 8.1 KiB instead of 25.4 KiB in 0.21; the table
  reader adds 17 to 29 KB once per bridged assembly. Generated TypeScript and
  the wire protocol are unchanged.
- **CS-WebUI on Linux and macOS** serves each window's blob and upload endpoint
  from Runic's own loopback HTTP/1.1 server instead of .NET's `HttpListener`,
  so the executable no longer carries `SslStream`, X.509 or an `HttpClient` for
  it: the CS-WebUI size fixture on linux-x64 goes from 10,710,336 to 7,743,328
  bytes (−28 %). Windows keeps http.sys. The new server is stricter: it answers
  `400` to ambiguous body framing, bare CR or LF line ends, dot segments and
  repeated `Host`, `Origin` or upload headers, limits request heads to 8 KiB
  lines, 32 KiB and 100 fields, and holds at most 128 connections; the
  [security guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/security.md)
  lists the limits.
- **Runic Desktop** (0.22) no longer links the CS-WebUI endpoint, the macOS
  backend outside macOS, `HttpClient` for a hosted region's component
  manifest, or hosted mode in an application that never creates
  `RunicGuestOptions`. On Linux the CS-WebUI endpoint and the manifest read
  take about 2.8 MB off a Runic Desktop executable, and the size fixture's
  Desktop host goes from 11.79 MB to 10.75 MB with the rest. `RunicDesktopServer=None` now turns the presentation server off, as
  documented for an executable that opens no window, also when the project
  references `Runic.Desktop.Kestrel` (−4.6 MB in that case): a window then
  fails with `presentation-server-unavailable`, and build warning
  [`RUNICDESK007`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/diagnostics.md#runicdesk007)
  reports `None` together with a referenced server package. An application
  whose pages declare no hosted regions can leave the region host out with
  `<RunicDesktopRegionHost>false</RunicDesktopRegionHost>`.
- **`Runic.Application.Views` and `Runic.Navigation`** avoid the LINQ operators
  and value-type generics that make the rest of an application's code larger:
  about 135 KB and another 150 KB off a CS-WebUI executable on Linux.
- **The asset archive stores identical files once** (archive schema
  `runic.assets.archive/2`): a fixture with two entries that share three fonts
  and a stylesheet goes from a 618,913-byte archive to 354,901 bytes. An
  archive without duplicate content is written as before. Runic.Assets 0.21 and
  earlier cannot read a schema-2 archive, so an application that embeds an
  archive packed with 0.22 through `RunicAssetsEmbeddedArchive` needs 0.22 as
  well.
- **Runic Translations 0.14** compresses each catalog's locale data, keeps its
  messages in one table and links no Hot Reload reflection in a trimmed
  publish; see [Translations](../translations/README.md#upgrading-to-0140).
- **Runic Translations 0.15** embeds each locale as binary data and the
  message table as DEFLATE data (RMF2 runtime ABI 5), so a NativeAOT
  executable no longer links the JSON reader for generated data (about 34 KB)
  and grows by about 130 bytes per message instead of 198; see
  [Translations](../translations/README.md#upgrading-to-0151).

The SDK's
[smallest NativeAOT executable](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/packaging.md#the-smallest-nativeaot-executable)
table lists every choice and setting above with what it saved.

Beyond that, four .NET settings make the executable smaller in exchange for
something the application gives up. Runic sets none of them and the templates
keep the defaults; each is the application's choice:

```xml docs-test=skip:illustrative-project-setting
<PropertyGroup>
  <StackTraceSupport>false</StackTraceSupport>
  <InvariantGlobalization>true</InvariantGlobalization>
  <OptimizationPreference>Size</OptimizationPreference>
  <UseSystemResourceKeys>true</UseSystemResourceKeys>
</PropertyGroup>
```

The SDK measured each one alone on linux-x64 for the CS-WebUI reference
application of its `tests/scaling/aot-size` suite; the savings vary by
application, platform and .NET version:

| Property                      | Saving                                          | What the application gives up                                                                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StackTraceSupport=false`     | 574 KB                                          | Stack traces have no method names, only offsets: `Exception.ToString()`, logged exceptions and crash output no longer say where an error happened.                                                                                                                                                 |
| `InvariantGlobalization=true` | 222 KB                                          | .NET's culture-aware APIs behave like the invariant culture, and `CultureInfo` for any other culture throws `CultureNotFoundException` (unless `PredefinedCulturesOnly` is `false`). Runic Translations' own formatting of numbers, dates, plurals and lists uses its CLDR data and is unaffected. |
| `OptimizationPreference=Size` | 213 KB                                          | The compiler optimizes for size rather than speed, so hot code can run slower. `dotnet runic size` already publishes with it.                                                                                                                                                                      |
| `UseSystemResourceKeys=true`  | None measurable here; larger apps may save more | .NET's own exception messages become resource keys, such as `Arg_NullReferenceException`. The application's own messages and Runic's are unchanged.                                                                                                                                                |

To see what takes the space inside the executable, publish with
`-p:IlcGenerateMstatFile=true`: the NativeAOT compiler writes
`<application>.mstat` under `obj/`, which lists the size of every type, method
and data blob by assembly. Open it in
[sizoscope](https://github.com/MichalStrehovsky/sizoscope), which also compares
two builds. See
[making the executable smaller](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/packaging.md#making-the-executable-smaller).

## Development-only views and members

Since SDK `0.22.0`, a view that only development needs, such as a mock-control
or diagnostics panel, can stay out of the published executable. Mark its
ViewModel with `[RunicDevelopmentOnly]`, or mark single state properties and
commands of another ViewModel (on the command property or its `[RelayCommand]`
method):

```csharp docs-test=skip:illustrative-fragment
[RunicDevelopmentOnly]
public sealed partial class MockControlsViewModel : ObservableObject { /* ... */ }

public sealed partial class OrdersViewModel : ObservableObject
{
    [ObservableProperty, RunicDevelopmentOnly] public partial string Diagnostics { get; set; } = "";

    [RelayCommand, RunicDevelopmentOnly] private void InjectFault() { /* ... */ }
}
```

Builds, `dotnet run`, the debugger and untrimmed publishes keep everything. A
trimmed or NativeAOT publish turns the feature switch
`Runic.Application.Views.DevelopmentOnlyViews` off, so the trimmer removes the
marked ViewModel's generated Bridge (about 15 KB per ViewModel) and the code of
marked members:

- Opening or presenting a marked ViewModel throws an
  `InvalidOperationException` that names it. Test
  `RunicDevelopmentOnly.IsSupported` before presenting it, as your own
  development-only code can.
- A marked property is absent from the state and cannot be set or written; a
  marked command and its `can…` and `is…Executing` state are absent too, and
  calling or starting it is rejected with reason `unavailable`.

The generated TypeScript is the same in every configuration and describes the
marked members truthfully: optional state members, and commands documented as
possibly unavailable. Marking a member changes the View's contract; marking a
ViewModel does not. Set the MSBuild property `RunicDevelopmentOnlyViews` to
`true` to keep the marked code in every publish (`auto`, the default, removes it
only from trimmed and NativeAOT publishes). `[RunicDevelopmentOnly]` on an
interaction or view request has no effect and is warning `RUNICBRIDGE072`: mark
its ViewModel. See
[development-only views and members](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/packaging.md#development-only-views-and-members).

## Choose tradeoffs using evidence

- NativeAOT and `OptimizationPreference=Size` are useful starting points. Keep
  trimming and AOT warnings visible and test the published executable.
- `InvariantGlobalization=true` changes culture behavior. Only choose it when
  the application's formatting, parsing and translations support that decision.
  Since SDK `0.15.0` the host itself loads no ICU before its first page, so the
  setting only saves what the application's own culture-aware code would load.
- For framework-dependent and self-contained publishes, ReadyToRun
  (`PublishReadyToRun`) shortens startup at the cost of a larger publish, and
  works since SDK `0.15.0`; see
  [choose the publish mode](shipping.md#choose-the-publish-mode).
- Stack traces and diagnostics have support value. Do not disable them globally
  to improve a headline number. Check evaluated switches before varying them;
  NativeAOT already disables some features.
- Keep symbols separately if your deployment needs crash analysis. Count the
  complete distribution as well as the executable and required native libraries.
- Documentation and other-RID loaders can inflate a publish directory. The size
  report identifies candidates for packaging review; retaining or excluding them
  does not change the linked executable. Do not remove the loader for a native
  presentation mode your application uses.
- Embedded frontend assets are included inside their executable or assembly.
  Since SDK `0.11.0`,
  `<RunicApplicationFrontendDelivery>Embedded</RunicApplicationFrontendDelivery>`
  packs the frontend into the application assembly without code, so a
  single-file or NativeAOT executable carries it and the publish folder has no
  `www`; measure both deliveries with `--property`, because the frontend's
  bytes move from `www` into the executable. An assembly list cannot attribute
  NativeAOT bytes. Startup time and process-tree
  memory need separate measurements; neither is inferred from file size.

A Linux x64 package-consumer measurement (2026-09-07, .NET SDK 10.0.302) published
the same customer editor under all three profiles; each passed the same browser
and lifecycle checks:

| Host / profile    | Executable | Executable + required native libraries | Complete distribution |      ZIP |
| ----------------- | ---------: | -------------------------------------: | --------------------: | -------: |
| desktop / default |  10.42 MiB |                              10.42 MiB |             11.16 MiB | 5.03 MiB |
| desktop / minimal |   9.42 MiB |                               9.42 MiB |             10.16 MiB | 4.57 MiB |
| cswebui / default |   5.16 MiB |                               5.47 MiB |              5.47 MiB | 2.64 MiB |

Minimal Desktop reduced its executable by about 9.6%. These application-specific
results are separate from the older minimal sample's 8.25 MiB Desktop measurement.

## Reproduce the package comparison

After building and packing local package candidates:

```sh docs-test=skip:sdk-repository-workflow
nix develop
CONFIGURATION=Release bun run pack
CONFIGURATION=Release bun run verify:footprint
```

The matrix creates isolated consumers outside the checkout. Every SDK reference
comes from candidate NuGet packages, while the customer's own application and
domain projects remain local. All candidates embed the same compiled frontend.
The fixture explicitly chooses invariant globalization and stripped symbols; this
is an experiment setting, not a template default. Results, logs, hashes and ZIPs
are retained under `artifacts/host-footprint/<RID>/run-*/`. Browser and OS libraries
are excluded from the byte counts. The matrix records the source revision and
whether the checkout was dirty.

The CI matrix targets Windows x64, Linux x64 and macOS arm64. A configured
job is not evidence of a passing platform: inspect its uploaded reports. Local
measurements here are NixOS builds run in the repository shell; their native linker
and OS-library paths must not be treated as a portable distribution for arbitrary
Linux machines. Use the target platform's packaging and runtime environment;
[ship a Desktop application](shipping.md) covers it per operating system.
