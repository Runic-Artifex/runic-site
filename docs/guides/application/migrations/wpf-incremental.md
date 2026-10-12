# Adopt Runic incrementally in WPF

An existing WPF application can adopt Runic one capability or screen at a time.
Keep the WPF shell, application services and ViewModels. This guide follows
Application SDK `0.7.0-preview.7` and independently versioned Translations
`0.6.0-preview.5`; use exact versions within each product family. Application
SDK `0.7.0-preview.7` is newer than the current release, `0.7.0-preview.6`, so
its links point to the SDK's `main` branch until it is published.

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

Install `Runic.Navigation.Wpf` at `0.7.0-preview.7`. It brings the host-neutral
`Runic.Navigation` engine and adds `DispatcherModelContext`, `NavigationHost`
and `NavigationDialogHost`. Register `AddRunicWpfNavigation()` and map your
native Views with `MapView`, a naming convention or data templates. Follow the
[WPF navigation example](https://github.com/Runic-Artifex/runic-sdk/blob/main/examples/wpf-navigation/README.md)
for typed page inputs, results from dialogs, nested tabs and departure guards.
`NavigationSelector.Region` connects single selection to borrowed replacement;
`ViewHost` presents a plain application-owned model without a navigation entry.

`RunicNavigator` is the shared engine for history, guards, outcomes, cancellation
and ownership. CommunityToolkit models call its async operations from native
`AsyncRelayCommand` or `[RelayCommand]` methods and forward their cancellation
tokens. Handle `Committed`, `Rejected`, `Failed` and `Superseded` results as
application policy. ReactiveUI models use the
[navigation adapter's observables and native command recipes](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Navigation.ReactiveUI/README.md#native-command-composition);
choose its `.Reactive` package for System.Reactive. Native commands retain their
framework's behavior. There is no second navigation engine for a later web View.

The navigator owns container-created entries and their configured service scopes;
borrowed content stays application-owned. Keep dirty state, validation, storage,
save/cancel commands and departure confirmation in the model. Use
`LeaveConfirmation.InDialog` to discard edits only when departure commits.
Initialize a new entry once and resume it on return; changing its presentation
does not create a new navigation entry or authorize resetting its draft.
Set `GuardWindowClose="True"` on a `NavigationHost` so that closing the window
asks the region's departure guards, as Back does, also for a host on an
unselected tab. In `NavigationDialogHost`, `Button.IsDefault` and
`Button.IsCancel` work as in `ShowDialog`. Both are newer than SDK
`0.7.0-preview.6`.

## 3. Optionally replace one View with a web View

Add `Runic.Application.Views.Wpf` (`Runic.Application.Wpf` up to
0.7.0-preview.6) for an embedded child WebView2. It is the only Runic package
the WPF project needs: referencing it turns Bridge generation on. Keep the
ViewModels in the WPF project, declare a logical `RunicView<TModel>` for the one
you migrate, and put the frontend in a `Frontend` folder next to the project.
The build writes the generated client to `Frontend/src/generated`, builds the
frontend and copies it to `www/`. Register the generated `AddRunicViews()` with
the application's services. The application keeps its WPF `Window`.

Present the web View with `RunicViewHost` where the native View was, for example
in the page's existing `DataTemplate` View. Bind its `Model`, keep the native
View inside it as the fallback, and set the services once on the window with
`RunicViewHost.SetServices`. The host opens after loading, serializes swaps,
cancels an open on unload, disposes in order and shows the fallback when the
web View can't open.
[Host Runic Views in a WPF app](wpf-hybrid.md) walks through this step: the
one-project layout and the optional split into a WPF-free model project, the
page's `webui.js` script, how the frontend reaches the output, window-close
guards and why to start windows in code rather than with `StartupUri`.

`Runic.Application.Views.Wpf`, `RunicViewHost` and the one-project layout are
newer than SDK `0.7.0-preview.6`; this step follows `0.7.0-preview.7`. An
application built on `0.7.0-preview.6` keeps its `RunicWebView` and
`DesktopHost` code compiling after the
[upgrade steps in the 0.7.0-preview.7 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/main/eng/release/notes/0.7.0-preview.7.md#upgrading),
which also cover a two-project application.

The host borrows the model, the application service provider and the model
context. When WPF and the web View present the same model, set `ModelContext`
to the navigation's dispatcher model context. The host creates no DI scope or
replacement model and does not own the navigator. Keep services alive until
presentation cleanup finishes. Unloading the host closes the web session, which
cancels its unfinished operations and drains accepted work; work started through
native commands remains governed by the application's model lifetime.

The [hybrid editor example](https://github.com/Runic-Artifex/runic-sdk/blob/main/examples/wpf-hybrid-editor/README.md)
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
[WPF asynchronous exit recipe](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Navigation.Wpf/README.md#disposal-at-exit).
