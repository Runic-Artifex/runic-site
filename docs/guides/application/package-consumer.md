# Build a desktop app from published packages

This path uses NuGet and npm packages in an application repository. You do not
need an SDK checkout, sibling project references, frontend source links, or a
custom bridge protocol. The examples below match the published
`0.7.0-preview.5` template. Replace `<VERSION>` with the published version in the
[package catalog](https://docs.runic-artifex.eu/packages/), and keep the
Application, Desktop, template, tool and frontend Runic packages on that version.
Command Line and Translations have independent releases; choose their versions
from their product pages.

## Create the package consumer

For a Svelte/Bun/ReactiveUI application with GTK 4 on Linux:

```sh docs-test=commands
dnx Runic.Create@<VERSION> -- MyApp --frontend svelte --package-manager bun --host desktop-gtk4 --view-models reactiveui
cd MyApp
dotnet tool restore
dotnet runic dev
```

You need the .NET 10 SDK and the frontend tools reported by
`dotnet runic doctor`. The creator's destination option is `--directory`;
`--output` selects the creator's output format, not a filesystem destination.
Keep the generated package versions and lockfiles in your app repository. The
[project creator](https://docs.runic-artifex.eu/create/) previews other frontend,
ViewModel and host choices. For an existing project, use
[Add Runic to an existing app](existing-app.md).

`desktop-gtk4` adds `Runic.Application.Desktop`, `Runic.Desktop.Gtk4`,
`Runic.Platform.Linux.Gtk4` and `Runic.Platform.Linux.Portal`. Linux needs GTK
4.12 or newer and WebKitGTK 6.0. `desktop` selects GTK 3/WebKitGTK 4.1 on Linux.
Both use WebView2 on Windows and WKWebView on macOS; see
[host selection](../desktop/host-selection.md) for native prerequisites.

## Let the build produce clients and assets

`RunicViewsWindowProject` opts the project into the packaged build targets:

```xml docs-test=template:RunicWindowApp.csproj
<RunicViewsWindowProject>true</RunicViewsWindowProject>
```

Declare the Window and its Views in C#. `dotnet build` inspects those contracts,
writes typed clients under `Frontend/src/generated`, runs the frontend's `build`
script, and copies `Frontend/dist` into `www` beside the application. Keep the
generated client directory ignored; an editor can report missing modules before
the first .NET build. Regenerate clients when you change a contract or upgrade
Runic packages.

The Desktop Vite template uses `runic({ desktop: true })` from
`@runic-artifex/vite-plugin-runic`. It loads the Desktop bootstrap and builds
relative asset URLs for each window's surface path. Application code imports the
public `@runic-artifex/views` entry; generated modules own its generated-code
entries.

The default asset bundle is the `www` directory. The Window serves it with
`DesktopContent.Directory(Path.Combine(AppContext.BaseDirectory, "www"), "index.html")`.
For an embedded archive, follow [Embed and serve assets](../assets/README.md).

## Keep one scope and model context per Window

The generated `AddRunicViews()` registers Bridges and Views; the application
registers its ViewModels and services. The Window's root ViewModel is scoped.
For ReactiveUI, register its model context before constructing commands:

```csharp docs-test=template:Program.cs host=desktop-gtk4 view-models=reactiveui
var services = new ServiceCollection();
services.AddRunicReactiveModelContext();
services.AddScoped<WorkspaceViewModel>();
services.AddScoped<WelcomeViewModel>();
services.AddScoped<CounterViewModel>();
services.AddRunicViews();
```

`OpenDesktopWindowAsync` creates the Window's asynchronous DI scope, resolves
the root model, opens the surface and presentation, and attaches the generated
Bridge. Register window-bound native services as scoped too. Keep shared domain
services independent of the window where their lifetime permits it. Use the
Window's model context for model state and its native dispatcher for native UI;
they are different owners.

## Start the native event loop before asynchronous work

Use the template's entry point before any top-level `await`:

```csharp docs-test=template:Program.cs host=desktop-gtk4
var options = new DesktopHostOptions { DiagnosticSink = ReportDiagnostic }.WithGtk4();
...
return DesktopEventLoop.Run(options, async desktop =>
{
    await using var provider = services.BuildServiceProvider(new ServiceProviderOptions
    {
        ValidateScopes = true,
        ValidateOnBuild = true
    });
```

On Linux this keeps GTK 4 on the process main thread. Keep asynchronous Window,
scope and provider cleanup inside the callback so the event loop remains active
until cleanup finishes. Retain the diagnostic sink: a missing embedded runtime
or a fallback should be visible to the app.

## Bind native services to the opened presentation

After opening the Window, pass its `NativeOwner` to the platform provider that
matches the backend. GTK 4 file dialogs use
`PortalPlatformProvider.CreateFileDialogs(Gtk4PlatformProvider.CreatePortalWindowOwner(window.NativeOwner))`.
The GTK 3 `LinuxPlatformProvider.CreateFileDialogs` must not parent a GTK 4 window.
See [desktop services](../desktop-services.md) for other providers.

The owner verifies the presentation and dispatches native work on its owning
thread. A browser fallback has `IsAvailable == false`; show an unavailable state
and retain an appropriate application alternative. Keep native handles inside
owner-dispatched callbacks and never send them to JavaScript. Dispose owner-bound
resources while their owner and event loop are still available.

Published `0.7.0-preview.5` file dialogs select read/save files; they do not
provide a directory-selection contract. A read lease's display name is not an
exact directory path. An app needing folder selection must own an adapter and
its native lifetime or accept a typed path. Do not treat file selection as
directory access.

The [directory-selection development API](../desktop-services.md#directory-selection)
is unreleased; it does not change these published-package prerequisites.

## Own shutdown and verify the published output

Use `Presentation.RequestCloseAsync` for app close buttons when they should
follow `ConfirmCloseAsync`. A close policy can refuse an active mutation or
await saving a draft. It requires an embedded presentation with
`DesktopPresentationPolicy.RequestedOnly`; the template's
`EmbeddedThenBrowser` fallback cannot promise native confirmation.

Forced `CloseAsync` and disposal bypass confirmation. They stop bridge admission
and observe tracked invocation completion, but cancelled command completion does
not prove that an accepted domain task has finished recovery. The application
must retain that task, await it during asynchronous model/service disposal, and
release its resources afterwards. See [operations and cancellation](guides/operations-and-cancellation.md)
and [window close lifecycle](../desktop/window-close-lifecycle.md).

```sh docs-test=commands
dotnet publish -c Release -r linux-x64
```

Distribute the whole publish directory, including `www`; the frontend needs no
Node.js or package manager at runtime. A framework-dependent publish still needs
the matching .NET runtime, and embedded hosting still needs the native libraries.
Run the published output as well as the development host. Check initial model
state, a long operation with responsive Cancel, native-service unavailability,
and close while accepted work is recovering. A managed test or browser-only run
does not establish that the selected native host works.

For domain DTOs shared with a CLI, see
[serializer and bridge contract boundaries](reference/README.md#shared-dtos-and-serializer-attributes).
