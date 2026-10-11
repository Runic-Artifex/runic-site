# Choosing a host and MVVM library

The [creator](https://docs.runic-artifex.eu/create/) and `dotnet new runic-app`
ask two questions that shape a project: which host opens the Window, and which
library the ViewModels use. The defaults are Runic Desktop and ReactiveUI. Keep
them unless one of the reasons below applies. Either way the Window
declaration, the Views, the generated clients and the frontend are the same, and
switching later changes a few lines.

| Choice                   | Template option            | Choose it when                                                             |
| ------------------------ | -------------------------- | -------------------------------------------------------------------------- |
| Runic Desktop (default)  | `--host desktop`           | You are building a desktop app. It is the first-class host.                |
| Runic Desktop with GTK 4 | `--host desktop-gtk4`      | Your Linux users run GTK 4 and WebKitGTK 6.                                |
| CS-WebUI                 | `--host cswebui`           | A browser window is enough and you want the smallest runtime.              |
| ReactiveUI (default)     | `--view-models reactiveui` | You are starting fresh, or already use ReactiveUI. It is the primary path. |
| CommunityToolkit.Mvvm    | `--view-models toolkit`    | Your team or existing ViewModels use CommunityToolkit.Mvvm.                |

Unfamiliar words, such as Window, View, Host or model context, are defined in
the [glossary](glossary.md).

## Window host

### Runic Desktop (default)

Runic Desktop opens each Window as a native window with the platform's embedded
WebView: WebView2 on Windows, WKWebView on macOS and WebKitGTK on Linux. It is
Runic's first-class host; Desktop features and fixes come first.

ViewModels get native file dialogs, the clipboard and the file launcher by
taking `IFileDialogs`, `ITextClipboard` or `IWindowPlatformServices` in their
constructor. The template registers them, and the provider is selected from the
backend that is running, so a GTK 4 process never loads the GTK 3 provider:

```csharp docs-test=template:WorkspaceServices.cs
// Per-window file dialogs, clipboard and file launcher from the provider for the running backend. A
// ViewModel can take IFileDialogs, ITextClipboard or IWindowPlatformServices in its constructor; they
// bind to the native window when it opens and report OwnerUnavailable until then, as in tests.
```

When the WebView runtime is missing, the template's Window falls back to an
installed browser and writes the reason to standard error; `dotnet runic doctor`
lists what a machine needs. `--host desktop` uses GTK 3 with WebKitGTK 4.1 on
Linux. `--host desktop-gtk4` uses GTK 4.12 or newer with WebKitGTK 6.0 and
xdg-desktop-portal file dialogs, and behaves like `desktop` on Windows and
macOS. [Ship a Desktop application](../desktop/shipping.md) covers publishing,
signing and packaging for each platform.

### CS-WebUI (best effort)

CS-WebUI opens a browser window: an installed browser in app mode, or the
platform WebView when no browser is found. Chrome, Edge and other
Chromium-based browsers work best; Firefox works without app mode.

CS-WebUI is a supported second host on a best-effort basis. Where something
cannot work well with it, Runic limits or diagnoses the capability instead of
holding back Runic Desktop. A browser window has no native owner, so the
platform services resolve but report `OwnerUnavailable`. In exchange its
runtime is smaller: in one
[Linux measurement](../desktop/size-and-tuning.md) the same NativeAOT
application was 5.16 MiB with CS-WebUI and 10.42 MiB with Runic Desktop,
excluding the browser.

|                                        | Runic Desktop                                                          | CS-WebUI                                                    |
| -------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Window                                 | Native window with the embedded WebView; installed browser as fallback | Installed browser in app mode; platform WebView as fallback |
| File dialogs, clipboard, file launcher | Native, through `AddRunicPlatformServices()`                           | Report `OwnerUnavailable`                                   |
| Linux runtime                          | GTK 3 and WebKitGTK 4.1, or GTK 4.12 and WebKitGTK 6.0                 | A Chromium-based browser, or GTK 3 and WebKitGTK 4.1        |
| .NET package                           | `Runic.Application.Views.Desktop`                                      | `Runic.Application.Views.CsWebUi`                           |
| Host script in `index.html`            | `runic-desktop-views.js`                                               | `runic-cswebui.js`                                          |
| Support                                | First-class                                                            | Best effort                                                 |

### Switching host later

The application body is the same on every host. It opens the Window and waits
until it closes:

```csharp docs-test=template:Program.cs
static async Task<int> RunAsync(IRunicWindowHost host)
{
    await using var window = await host.OpenWindowAsync<WorkspaceWindow>(new RunicWindowOptions { Width = 1000, Height = 700 });
    await window.WaitForCloseAsync();
    return 0;
}
```

Only the entry point names the host. Runic Desktop runs the body on the event
loop the platform needs:

```csharp docs-test=template:Program.cs
return RunicDesktopHost.Run(provider, options, RunAsync);
```

CS-WebUI runs the same body:

```csharp docs-test=template:Program.cs host=cswebui
return RunicCsWebUiHost.Run(provider, RunAsync);
```

To switch, change that line and its `using`, the host package in the project
file, and the host script in `index.html`. Generate a project with the other
`--host` in the [creator](https://docs.runic-artifex.eu/create/) to compare the
files.

## ViewModel library

### ReactiveUI (default)

ReactiveUI is Runic's primary MVVM path and the template default. Runic targets
ReactiveUI 26 with its `ReactiveUI.Primitives` flavour, chosen for NativeAOT,
through `Runic.Application.Views.ReactiveUI`. Commands are ordinary
`ReactiveCommand`s; the template's Counter page is one read-only property, one
settable property and one command:

```csharp docs-test=template:WorkspaceViewModel.cs
public int Count
{
    get => _count;
    private set => this.RaiseAndSetIfChanged(ref _count, value);
}

public int Step
{
    get => _step;
    set => this.RaiseAndSetIfChanged(ref _step, value);
}

public ReactiveCommand<RxVoid, RxVoid> IncrementCommand { get; }
```

`AddRunicReactiveModelContext()` makes every command deliver its results on
the Window's model context, so a command needs no scheduler argument:

```csharp docs-test=template:WorkspaceServices.cs
services.AddRunicReactiveModelContext();
services.AddScoped<WorkspaceViewModel>();
```

If you know ReactiveUI from System.Reactive: `RxVoid` replaces `Unit`,
`ISequencer` replaces `IScheduler`, and awaiting a command needs
`using ReactiveUI.Primitives.Signals;`. Applications that must stay on
System.Reactive use `Runic.Application.Views.ReactiveUI.Reactive` instead;
never reference both flavours in one application. Navigation has a ReactiveUI
adapter with observable region state and reactive commands; see
[pages and navigation](guides/pages-and-navigation.md).

### CommunityToolkit.Mvvm

CommunityToolkit.Mvvm is supported with its own idiomatic path: source-generated
partial properties and relay commands, with no Runic adapter package. The same
Counter page reads:

```csharp docs-test=template:WorkspaceViewModel.cs view-models=toolkit
[ObservableProperty]
public partial int Count { get; private set; }

[ObservableProperty]
public partial int Step { get; set; }

[RelayCommand]
private void Increment() => Count += Step;
```

### What stays the same

|                    | ReactiveUI                                 | CommunityToolkit.Mvvm                   |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| .NET package       | `Runic.Application.Views.ReactiveUI`       | `CommunityToolkit.Mvvm`                 |
| Window             | `RunicWindow<TViewModel>`                  | `RunicWindow<TViewModel>`               |
| Views              | `ReactiveRunicView<TViewModel>`            | `RunicView<TViewModel>`                 |
| Commands           | `ReactiveCommand.Create`, `CreateFromTask` | `[RelayCommand]`                        |
| Model context      | `AddRunicReactiveModelContext()`           | Provided by the host                    |
| Navigation helpers | `Runic.Navigation.ReactiveUI`              | Region properties and `PropertyChanged` |

In both, the C# setter's accessibility decides what the frontend may set: a
public setter adds `set<Property>` to the generated client, and a private
setter keeps the property read-only. Command bodies run on the Window's model
context, so setting a property after `await` is correct in both; see
[ViewModel state and threads](guides/model-context.md).

## Packages for each choice

The template references what each choice needs. For the defaults:

```xml docs-test=template:RunicWindowApp.csproj
<PackageReference Include="Runic.Application.Views.ReactiveUI" Version="<VERSION>" />
<PackageReference Include="Runic.Application.Views.Desktop" Version="<VERSION>" />
```

`--host desktop-gtk4` adds `Runic.Desktop.Gtk4`, `--host cswebui` references
`Runic.Application.Views.CsWebUi` instead, and `--view-models toolkit`
references `CommunityToolkit.Mvvm` instead of the ReactiveUI adapter. Each host
package brings `Runic.Application.Views` and its build targets. The frontend
installs `@runic-artifex/views` and the binding for its framework. To add Runic
to a project you already have, follow
[add Runic to an existing app](existing-app.md).

## Next steps

- [Windows and Views, step by step](tutorial/README.md) walks through the
  generated project.
- [Pages and navigation](guides/pages-and-navigation.md) shows how a Window
  changes pages.
- [ViewModel state and threads](guides/model-context.md) explains the model
  context and translated text in ViewModels.
