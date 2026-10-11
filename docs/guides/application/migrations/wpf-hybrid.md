# Host Runic Views in a WPF app

Keep your WPF shell and present one page as a Runic web View with
`RunicViewHost`. This guide covers the project layout, the page's scripts, the
frontend build, close guards and startup.

It builds on step 3 of [Adopt Runic incrementally in WPF](wpf-incremental.md).
`RunicViewHost`, `GuardWindowClose` and the package-only project layouts below
are newer than SDK `0.7.0-preview.6`. With that release, compose `RunicWebView`,
`DesktopHost` and `CreateWpfViewAsync` yourself, as the incremental guide
describes. The WPF web adapter is experimental (`RUNICWPF001`), and so is
navigation (`RUNICNAV001`); suppress them where you use them.

## What stays in WPF

The WPF application keeps its `Application`, its windows, its dispatcher, its
DI container, its native dialogs and its navigation. A web View is one more
control in the visual tree. It presents an existing ViewModel, the same object
that a native WPF View can bind to, so the user can switch between the two
without losing a draft.

The
[hybrid editor example](https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/wpf-hybrid-editor)
is the complete application this guide quotes. Its notes list and dialogs are
WPF; its editor page can switch between WPF controls and a web View.

## Choose a project layout

The build generates the web View's TypeScript client and C# Bridge from your
ViewModels. There are two layouts.

### Split: a WPF-free model project

The ViewModels and the web View declaration live in a class library without
WPF. It references `Runic.Application.Views`, which turns generation on, and it
builds the frontend:

```xml docs-test=source:tests/fixtures/application/wpf-bridge-consumer/Split/Model/SplitModel.csproj
<PropertyGroup>
  <OutputType>Library</OutputType>
  <TargetFramework>net10.0</TargetFramework>
  ...
  <RunicApplicationFrontendCompositionType>SplitModel.RunicBridgeComposition</RunicApplicationFrontendCompositionType>
  <RunicApplicationFrontendDirectory>$(MSBuildProjectDirectory)/../Frontend</RunicApplicationFrontendDirectory>
  ...
</PropertyGroup>
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.DependencyInjection.Abstractions" Version="$(RunicContainerVersion)" />
  <PackageReference Include="Runic.Application.Views" Version="$(RunicPackageVersion)" />
</ItemGroup>
```

The WPF application references `Runic.Application.Views.Wpf` and the model
project. It needs no Runic properties: the package's build targets copy the
model project's built frontend, `Frontend/dist`, to the application's `www/`
folder:

```xml docs-test=source:tests/fixtures/application/wpf-bridge-consumer/Split/App/SplitApp.csproj
<PropertyGroup>
  <OutputType>WinExe</OutputType>
  <TargetFramework>net10.0-windows</TargetFramework>
  <UseWPF>true</UseWPF>
  ...
  <NoWarn>$(NoWarn);RUNICWPF001;RUNICNAV001</NoWarn>
</PropertyGroup>
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="$(RunicContainerVersion)" />
  <PackageReference Include="Runic.Application.Views.Wpf" Version="$(RunicPackageVersion)" />
  <ProjectReference Include="../Model/SplitModel.csproj" />
</ItemGroup>
```

The application declares no web View of its own, so its own generation is
optional. The hybrid example turns it off with
`RunicApplicationFrontendGenerationEnabled=false`. The application calls the
model project's generated `AddRunicViews()`.

Use the split layout when the ViewModels should also run in tests, in another
host or in a later Runic Window: a WPF-free project can't depend on WPF types
by accident.

### Single: one WPF project

A single `UseWPF` project can reference only `Runic.Application.Views.Wpf`.
The adapter turns generation on, and the default `Frontend` folder next to the
project receives the generated client:

```xml docs-test=source:tests/fixtures/application/wpf-bridge-consumer/Single/WpfSingle.csproj
<PropertyGroup>
  <OutputType>WinExe</OutputType>
  <TargetFramework>net10.0-windows</TargetFramework>
  <UseWPF>true</UseWPF>
  ...
  <NoWarn>$(NoWarn);RUNICWPF001;RUNICNAV001</NoWarn>
  ...
</PropertyGroup>
<ItemGroup>
  <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="$(RunicContainerVersion)" />
  <PackageReference Include="Runic.Application.Views.Wpf" Version="$(RunicPackageVersion)" />
</ItemGroup>
```

WPF compiles XAML in a temporary `*_wpftmp` project first; that pass reuses
the generated code instead of generating it again. The generator still skips
ViewModels and Views that depend on WPF types, so keep the ViewModels a web
View presents free of WPF types in this layout too. A project that declares
Views but has no `Frontend` folder fails with `RUNICBRIDGE014`.

### Where the Translations catalog goes

With [Runic Translations](../../translations/README.md), the WPF project's
build-time XAML checks (`TranslationsXamlCatalog`) need to see the catalog,
and ViewModels that use the typed `AppText` class need to reference it. In the
split layout these pull in different directions:

- **Catalog in the model project.** ViewModels use `AppText` directly.
  Translations releases newer than `0.6.0-preview.5` check the WPF project's
  XAML against a catalog in a directly referenced project. With
  `0.6.0-preview.5`, the XAML keys are checked only at run time.
- **Catalog in the WPF project.** The XAML checks work with
  `0.6.0-preview.5`, but ViewModels in the model project can't use `AppText`;
  they receive their texts through an interface that the WPF project
  implements.
- **Single project.** The catalog, the XAML and the ViewModels share one
  project, so both work.

## Declare the web View

A web View is a logical `RunicView<TViewModel>` for an existing ViewModel. The
hybrid example declares it next to its CommunityToolkit.Mvvm editor model:

```csharp docs-test=source:examples/wpf-hybrid-editor/Model/EditorViewModel.cs
public sealed partial class EditorWebView : RunicView<EditorViewModel>;
```

That is enough to generate the client and the Bridge. There is no Runic
Window: the WPF window stays the window. Register the generated
`AddRunicViews()` with the application's services, next to your own.

## The page: `webui.js` first

The frontend's `index.html` loads two classic scripts before its module:

```html docs-test=source:examples/wpf-hybrid-editor/Frontend/index.html
<script src="webui.js"></script>
<script src="runic-desktop-views.js"></script>
<script type="module" src="app.js"></script>
```

- `webui.js` is served by the Runic Desktop surface that hosts the page. It
  connects the page to .NET; there is no file to copy.
- `runic-desktop-views.js` is the Views client for Runic Desktop. The
  `Runic.Application.Views.Desktop` package, which the WPF adapter depends on,
  copies it to `www/` on build and publish.
- `app.js` is your bundled frontend. It calls the generated `connect…()`
  function, here `connectEditor()`.

Without the first two scripts the page loads, but the generated client can't
connect.

## How the frontend reaches the output

On `dotnet build`, the project that generates the client:

1. writes the TypeScript client to `<frontend>/src/generated`,
2. installs the frontend's packages when `package.json` or the lock file
   changed,
3. runs the frontend's `build` script, and
4. copies `<frontend>/dist` to `www/` in the build output.

`dotnet publish` always copies the frontend. In the split layout, the WPF
application copies the model project's `dist` to its own `www/`.
`RunicViewHost` opens `www/index.html` next to the application by default; its
`ContentRoot` and `EntryPage` properties change that. The
[Runic.Application.Views build properties](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views/README.md)
change the frontend folder, the package manager and the build command.

## Place a `RunicViewHost`

`RunicViewHost` is a WPF element that presents a model through its web View.
Its content is the fallback, shown with the same `DataContext` when the web
View can't open, for example without the WebView2 Runtime:

```xml docs-test=readme:packages/dotnet/Runic.Application.Views.Wpf/README.md
<UserControl xmlns:rv="clr-namespace:Runic.Application.Views.Wpf;assembly=Runic.Application.Views.Wpf"
             xmlns:local="clr-namespace:MyApp">
  <rv:RunicViewHost Model="{Binding}">
    <!-- Shown with the same DataContext when the web View can't open. -->
    <local:NativeEditorView />
  </rv:RunicViewHost>
</UserControl>
```

The host needs the application's services. `Services` is an inherited
property, so set it once on the window, and every host inside, including one
in a `DataTemplate`, receives it:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.Wpf/README.md
RunicViewHost.SetServices(mainWindow, services);
```

The hybrid example creates the host in code instead, in a page View that
navigation created with its own services and model context. It binds `Model`
to the page's `DataContext` and passes the navigation's dispatcher model
context, because WPF and the web View present the same model:

```csharp docs-test=source:examples/wpf-hybrid-editor/App/EditorView.xaml.cs
var host = WebHost = new RunicViewHost { Services = _services, ModelContext = _context, Fallback = new NativeEditorView() };
host.SetBinding(RunicViewHost.ModelProperty, new Binding());
host.StateChanged += (_, _) => PresentationError.Text = host.State == RunicViewHostState.Failed
    ? $"Web editor unavailable: {host.Error?.Message} You can keep editing natively or reload the web editor."
    : "";
EditorHost.Content = host;
```

The host opens when it is loaded and has a `Model` and `Services`, and closes
when it is unloaded. It borrows the model, the services and the context: it
never creates or disposes a ViewModel, a scope or a navigation entry.
`State`, `Error` and `StateChanged` report failures, and `ReloadAsync()`
retries. Closing the host cancels the web View's unfinished operations, such
as a Save started from the page; the model and its draft stay.

## Guard the window's close

Disposing the services at exit retires navigation entries without asking
their departure guards, so a dirty draft would be lost. Set `GuardWindowClose` on the main window's
`NavigationHost` to ask the same guards as Back does:

```xml docs-test=source:examples/wpf-hybrid-editor/App/MainWindow.xaml
<rn:NavigationDialogHost Region="{Binding Dialog}" />
<!-- Closing the window asks the editor's departure guard, as Back does. -->
<rn:NavigationHost x:Name="Main" Region="{Binding Main}" GuardWindowClose="True" />
```

Closing the window, with the close button, Alt+F4 or `Close()`, is then
cancelled while the region has entries, and the host clears the region
instead. Each entry's guard can ask in the dialog region, for example with
`LeaveConfirmation.InDialog`. When the clear commits, the window closes; when
a guard refuses, it stays open. Two cases skip the guards:

- `Application.Shutdown()` ignores a cancelled close. Close the main window
  instead of calling `Shutdown()`.
- WPF doesn't raise `Closing` when the Windows session ends. Handle
  `Application.SessionEnding` yourself if drafts must survive a log-off.

## Start windows in code, not with `StartupUri`

With `StartupUri`, WPF creates the window from XAML right after `OnStartup`
returns. It doesn't wait for anything that `OnStartup` awaits, and the window
has no constructor parameters for services. So a window that needs services,
a navigation scope or a translation manager at load time can see none of
them.

The hybrid example therefore has no `StartupUri`. `OnStartup` builds the
services, creates the window's scope, shows the window with its regions and
only then navigates:

```csharp docs-test=source:examples/wpf-hybrid-editor/App/App.xaml.cs
protected override async void OnStartup(StartupEventArgs e)
{
    base.OnStartup(e);
    _services = AddServices(new ServiceCollection()).BuildServiceProvider();
    _windowScope = _services.CreateScope();
    var regions = _windowScope.ServiceProvider.GetRequiredService<AppRegions>();
    new MainWindow { DataContext = regions }.Show();
    await regions.Main.ResetAsync<NotesListViewModel>();
}

protected override void OnExit(ExitEventArgs e)
{
    _windowScope?.Dispose();
    _services?.Dispose();
    base.OnExit(e);
}
```

If you keep `StartupUri`, everything the window needs when it loads must exist
when `OnStartup` returns: build the services synchronously, give the window
its services from its constructor, and create a Translations manager with the
synchronous `CreateManager` instead of an awaited `CreateManagerAsync`. Only
Translations releases newer than `0.6.0-preview.5` have `CreateManager`.
`StartupUri` remains fine for a window that needs no services when it loads.

`ServiceProvider.Dispose()` in `OnExit` starts the navigator's shutdown but
doesn't wait for it. When owned cleanup must finish, dispose the provider
asynchronously after `app.Run()` returns in a custom `Main`, as the
[Runic.Navigation.Wpf guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Navigation.Wpf/README.md#disposal-at-exit)
shows. Never block the dispatcher on `DisposeAsync` while it runs.

## Limits

- WPF runs on .NET 10 on Windows, and the web View needs the Microsoft Edge
  WebView2 Runtime. The projects also compile on Linux and macOS with
  `EnableWindowsTargeting`.
- One host presents one surface. WPF elements can't draw over the web View
  (the usual HWND airspace rule).
- Tab moves into the web page, but not yet back out to the surrounding WPF
  controls at the page's last tab stop.
- There is no browser fallback: on a machine without WebView2 the host shows
  its fallback content.

## Next steps

- [Adopt Runic incrementally in WPF](wpf-incremental.md) is the migration path
  this guide belongs to.
- [Pages and navigation](../guides/pages-and-navigation.md) explains regions,
  guards and dialog results.
- The
  [Runic.Application.Views.Wpf README](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views.Wpf/README.md)
  lists every `RunicViewHost` property and the lower-level API.
