# Build a desktop app from published packages

Use published NuGet/npm packages and generated clients in your application
repository. These examples match the `0.7.0-preview.6` template. Replace
`<VERSION>` with the [catalog version](https://docs.runic-artifex.eu/packages/)
for Application, Desktop, templates, tools and frontend packages. Command Line
and Translations have independent versions on their product pages.

## Create the package consumer

For a Svelte/Bun/ReactiveUI application with GTK 4 on Linux:

```sh docs-test=commands
dnx Runic.Create@<VERSION> -- MyApp --frontend svelte --package-manager bun --host desktop-gtk4 --view-models reactiveui
cd MyApp
dotnet tool restore
dotnet runic dev
```

Install .NET 10 and the frontend tools reported by `dotnet runic doctor`.
The creator uses `--directory` for its destination and `--output` for output
format. Commit generated versions and lockfiles. The
[creator](https://docs.runic-artifex.eu/create/) previews other choices; see
[existing-app setup](existing-app.md) to add Runic to an app.

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

Declare the Window and Views in C#. `dotnet build` generates clients under
`Frontend/src/generated`, runs the frontend build, and copies `Frontend/dist`
into `www` beside the application. Ignore generated clients; missing imports
before the first .NET build are expected. Rebuild after contract or package changes.

Vite's `runic({ desktop: true })` from `@runic-artifex/vite-plugin-runic` loads
the Desktop bootstrap and builds relative asset URLs for each surface path.
App code imports public `@runic-artifex/views`; generated modules own its
generated-code entries.

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

`OpenDesktopWindowAsync` creates the asynchronous DI scope, resolves the root
model and attaches its Bridge to the presentation. Register window-bound services
as scoped. Model state uses the model context; native UI uses its dispatcher.

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

This keeps GTK 4 on Linux's process main thread. Complete Window, scope and
provider cleanup inside the callback while the event loop is active. Retain
the diagnostic sink for missing runtimes and fallback.

## Bind native services to the opened presentation

After opening the Window, pass its `NativeOwner` to the platform provider that
matches the backend. GTK 4 file dialogs use
`PortalPlatformProvider.CreateFileDialogs(Gtk4PlatformProvider.CreatePortalWindowOwner(window.NativeOwner))`.
The GTK 3 `LinuxPlatformProvider.CreateFileDialogs` must not parent a GTK 4 window.
See [desktop services](../desktop-services.md) for other providers.

The owner verifies the presentation and dispatches work on its native thread.
Browser fallback has `IsAvailable == false`; expose unavailability with an app
alternative. Keep native handles inside dispatched C# callbacks. Dispose native
resources while their owner and event loop are available.

For folder selection, use `IFileDialogs.OpenDirectoryAsync` and retain the
selected directory lease while C# work uses its local path. See
[directory selection](../desktop-services.md#directory-selection) for ownership
and unavailable-provider handling.

## Own shutdown and verify the published output

Use `Presentation.RequestCloseAsync` for app close buttons when they should
follow `ConfirmCloseAsync`. A close policy can refuse an active mutation or
await saving a draft. It requires an embedded presentation with
`DesktopPresentationPolicy.RequestedOnly`; the template's
`EmbeddedThenBrowser` fallback cannot promise native confirmation.

Forced `CloseAsync` and disposal bypass confirmation. Bridge invocation completion
does not establish accepted domain-task recovery. Retain and await those tasks
in asynchronous model/service disposal before releasing resources. See
[operations and cancellation](guides/operations-and-cancellation.md)
and [window close lifecycle](../desktop/window-close-lifecycle.md).

```sh docs-test=commands
dotnet publish -c Release -r linux-x64
```

Distribute the whole publish directory, including `www`; the frontend needs no
Node.js or package manager at runtime. A framework-dependent publish still needs
the matching .NET runtime, and embedded hosting still needs the native libraries.
Run the published native output as well as the development host. Check initial
state, a long operation with responsive Cancel, unavailable native services,
and close during recovery. Managed or browser-only checks do not verify the
native host.

For domain DTOs shared with a CLI, see
[serializer and bridge contract boundaries](reference/README.md#shared-dtos-and-serializer-attributes).
