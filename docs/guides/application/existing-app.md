# Add Runic to an existing app

Use this path when you already have a .NET console or desktop project and a
frontend, and want them to talk through typed Windows and Views. To start from
nothing, [create a project](getting-started/README.md) instead; the steps below
reproduce what the template sets up. Replace `<VERSION>` with the current
release from the [package catalog](https://docs.runic-artifex.eu/packages/) and
keep all Runic packages on that version.

## 1. Add the packages

Choose one host adapter. CS-WebUI opens the app in an installed browser or the
platform WebView; Runic Desktop opens native windows and adds platform services
(see [host selection](../desktop/host-selection.md)):

```sh docs-test=commands
dotnet add package Runic.Application.CsWebUi --version <VERSION>
# or, for native windows:
dotnet add package Runic.Application.Desktop --version <VERSION>
```

Add a ViewModel library and the dependency injection container. The versions are
the ones the template uses:

```sh docs-test=commands
dotnet add package CommunityToolkit.Mvvm --version 8.4.2
dotnet add package Microsoft.Extensions.DependencyInjection --version 10.0.12
```

For ReactiveUI, add `Runic.Application.ReactiveUI` instead of
CommunityToolkit.Mvvm.

## 2. Opt the project in

The host adapter brings the build targets. They expect the frontend in a
`Frontend` folder next to the project file; set `RunicBridgeFrontendDir` if
yours lives elsewhere. Opt in to `dotnet runic dev` and `dotnet runic doctor`
in the project file:

```xml docs-test=template:RunicWindowApp.csproj
<RunicViewsWindowProject>true</RunicViewsWindowProject>
```

Install the project-local `dotnet runic` tool:

```sh docs-test=commands
dotnet new tool-manifest
dotnet tool install --local dotnet-runic --version <VERSION>
```

## 3. Declare a Window and its Views

Keep your ViewModels as they are; they need `INotifyPropertyChanged` and at
least one property or command. Declare the Window over the root ViewModel and a
View for each ViewModel the Window presents:

```csharp docs-test=template:Views.cs
public sealed partial class WorkspaceWindow(CsWebUiBridgeWindow<WorkspaceViewModel> host)
    : CsWebUiWindow<WorkspaceViewModel>(host);

public sealed partial class WelcomeView : RunicView<WelcomeViewModel>;
public sealed partial class CounterView : RunicView<CounterViewModel>;
```

A Window with a single ViewModel needs no Views.

## 4. Register and open the Window

Register each ViewModel with the lifetime your application needs; the Window's
root ViewModel must be scoped. `AddRunicViews()` is generated for your project:

```csharp docs-test=template:Program.cs
var services = new ServiceCollection();
services.AddScoped<WorkspaceViewModel>();
services.AddScoped<WelcomeViewModel>();
services.AddScoped<CounterViewModel>();
services.AddRunicViews();

using var provider = services.BuildServiceProvider(new ServiceProviderOptions
{
    ValidateScopes = true,
    ValidateOnBuild = true
});
```

Then open the Window where your application starts its UI:

```csharp docs-test=template:Program.cs
await using (var window = provider.OpenWindow<WorkspaceWindow, WorkspaceViewModel>(host => new WorkspaceWindow(host)))
{
    window.SetRootFolder(Path.Combine(AppContext.BaseDirectory, "www"));
    window.Show("index.html");
    WebUiApplication.Wait();
}
WebUiApplication.Clean();
```

With Runic Desktop, `OpenDesktopWindowAsync` takes the host and the surface
content instead; the [tutorial](tutorial/README.md#4-register-and-open-the-window)
shows both.

## 5. Connect the frontend

From the frontend folder, install the shared runtime and the binding for your
framework:

```sh docs-test=commands
npm install --save-exact @runic-artifex/views@<VERSION>
npm install --save-exact @runic-artifex/react@<VERSION>
```

Use `@runic-artifex/vue`, `@runic-artifex/svelte` or `@runic-artifex/angular`
for those frameworks, or only `@runic-artifex/views` for plain TypeScript. Vite
projects can add `@runic-artifex/vite-plugin-runic` as a development
dependency for Runic diagnostics; with Runic Desktop, `runic({ desktop: true })`
also loads the Desktop bootstrap.

The page loads the host's scripts before your module. With CS-WebUI:

<!-- prettier-ignore -->
```html docs-test=template:frontends/react/index.html
<script src="webui.js"></script>
<script src="runic-cswebui.js"></script>
```

With Runic Desktop, load `runic-desktop-views.js` instead of
`runic-cswebui.js`.

`dotnet build` now writes the typed clients to `Frontend/src/generated`, builds
the frontend with its `build` script and copies `Frontend/dist` to `www` next
to the executable. Add `Frontend/src/generated` to `.gitignore`. Build the
frontend with relative asset URLs (Vite's `base: "./"`) so the `www` folder can
move. The [tutorial](tutorial/README.md#5-render-the-views) shows how the
generated clients are used from components.

## 6. Run it

```sh docs-test=commands
dotnet tool restore
dotnet runic dev
```

`dotnet runic doctor` reports a missing opt-in, package or frontend lock file.
