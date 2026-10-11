# Adopt Runic incrementally in WPF

An existing WPF application can adopt Runic one capability or screen at a time.
Keep the WPF shell, application services and ViewModels. This guide follows
Application SDK `0.7.0-preview.6` and independently versioned Translations
`0.6.0-preview.5`; use exact versions within each product family.

## 1. Start with independent products

Localization can move one screen at a time. Follow the
[Translations WPF quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/packages/dotnet/Runic.Translations.Wpf/README.md#wpf-quick-start)
to add `Runic.Translations.Wpf` and build integration, author an RMF2 catalog,
and supply a `TranslationSource` over the generated `text.Messages` surface.
`{rt:Message}` binds plain messages; `TranslationProperties.RichMessage` renders
inline rich content with typed slots. These bindings coexist with `.resx` and
resource dictionaries. Optional `TranslationsXamlCatalog` assertions enable
build-time checks of static XAML declarations. Locale switching remains separate
from the WPF culture and `FrameworkElement.Language` you configure.

[Runic Command Line](../../command-line/README.md)
can supply a separate automation or maintenance tool using existing application
services. It owns parsing and command output and has its own package version.
Neither product requires Views, navigation, a web frontend or a shell migration.

## 2. Share navigation, retain native MVVM

Install `Runic.Navigation.Wpf` at `0.7.0-preview.6`. It brings the host-neutral
`Runic.Navigation` engine and adds `DispatcherModelContext`, `NavigationHost`
and `NavigationDialogHost`. Register `AddRunicWpfNavigation()` and map your
native Views with `MapView`, a naming convention or data templates. Follow the
[WPF navigation example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/wpf-navigation/README.md)
for typed page inputs, results from dialogs, nested tabs and departure guards.
`NavigationSelector.Region` connects single selection to borrowed replacement;
`ViewHost` presents a plain application-owned model without a navigation entry.

`RunicNavigator` is the shared engine for history, guards, outcomes, cancellation
and ownership. CommunityToolkit models call its async operations from native
`AsyncRelayCommand` or `[RelayCommand]` methods and forward their cancellation
tokens. Handle `Committed`, `Rejected`, `Failed` and `Superseded` results as
application policy. ReactiveUI models use the
[navigation adapter's observables and native command recipes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Navigation.ReactiveUI/README.md#native-command-composition);
choose its `.Reactive` package for System.Reactive. Native commands retain their
framework's behavior. There is no second navigation engine for a later web View.

The navigator owns container-created entries and their configured service scopes;
borrowed content stays application-owned. Keep dirty state, validation, storage,
save/cancel commands and departure confirmation in the model. Use
`LeaveConfirmation.InDialog` to discard edits only when departure commits.
Initialize a new entry once and resume it on return; changing its presentation
does not create a new navigation entry or authorize resetting its draft.

## 3. Optionally replace one View with a web View

Add `Runic.Application.Views.Wpf` (`Runic.Application.Wpf` up to
0.7.0-preview.6) for an embedded child WebView2.
Declare a logical `RunicView<TModel>`, register generated `AddRunicViews()`, and
build the frontend and generated client. The application keeps its WPF `Window`.
[Host Runic Views in a WPF app](wpf-hybrid.md) walks through this step: the
project layout, the page's `webui.js` script, how the frontend is copied into
the output, window-close guards and why to start windows in code rather than
with `StartupUri`. It uses `RunicViewHost`, which is newer than
0.7.0-preview.6. With 0.7.0-preview.6, the
[adapter README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Application.Wpf/README.md)
shows `RunicWebView`, its `CreateWindowHostFactory()`, `DesktopHost.StartAsync`
and `CreateWpfViewAsync`. Add the control to the WPF visual tree and open the
binding after loading, with the dispatcher pumping.

Pass the exact existing model, application service provider and shared dispatcher
model context to `CreateWpfViewAsync`. The binding borrows all three; it creates
no DI scope or replacement model and does not own the navigator. Keep services
alive until presentation cleanup finishes. Dispose the old binding before
removing its control or replacing its presentation. Closing the web session
cancels its unfinished operations and drains accepted work; work started through
native commands remains governed by the application's model lifetime.

The [hybrid editor example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/wpf-hybrid-editor/README.md)
switches a single editor between WPF controls and a generated web client while
preserving model, navigation entry, store and draft. Reloading or recreating the
presentation uses the same model; switching back to native controls can preserve
the draft when web mounting fails. Test both presentations against the shared
validation, save, cancellation and departure behavior before migrating another
screen.

## Preview limits

WPF targets .NET 10 on Windows and requires the Microsoft Edge WebView2 Runtime
for embedded web Views. Navigation integrations are experimental (`RUNICNAV001`);
the WPF web adapter is experimental (`RUNICWPF001`). Suppress the relevant
diagnostics explicitly while evaluating them. The child supports one surface per
control and follows normal HWND airspace constraints. WPF owns the shell's
layout, focus and window operations; browser fallback is unavailable. Tab enters
the web document, but automatic traversal back to surrounding WPF controls at
the document boundary remains a prototype limitation. Windows targeting can
compile elsewhere; native WPF behavior must run on Windows.

Do not block the live dispatcher on navigation or disposal with `.Wait()` or
`.Result`. Synchronous provider disposal starts navigator shutdown without
waiting; when cleanup must finish, follow the
[WPF asynchronous exit recipe](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Navigation.Wpf/README.md#disposal-at-exit).
