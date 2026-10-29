# Adopt Runic incrementally in WPF

An existing WPF application can adopt Runic one capability or screen at a time.
Keep the WPF shell, application services and ViewModels. This guide follows
Application SDK `0.12.0` and independently versioned Translations
`0.8.0`; use exact versions within each product family.

## 1. Start with independent products

Localization can move one screen at a time. Follow the
[Translations WPF quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/packages/dotnet/Runic.Translations.Wpf/README.md#wpf-quick-start)
to add `Runic.Translations.Wpf` and build integration, author an RMF2 catalog,
and supply a `TranslationSource` over the generated `text.Messages` surface.
`{rt:Message}` binds plain messages; `TranslationProperties.RichMessage` renders
inline rich content with typed slots. These bindings coexist with `.resx` and
resource dictionaries. Optional `RunicTranslationsXamlCatalog` assertions enable
build-time checks of static XAML declarations. Locale switching remains separate
from the WPF culture and `FrameworkElement.Language` you configure.

[Runic Command Line](../../command-line/README.md)
can supply a separate automation or maintenance tool using existing application
services. It owns parsing and command output and has its own package version.
Neither product requires Views, navigation, a web frontend or a shell migration.

## 2. Share navigation, retain native MVVM

Install `Runic.Navigation.Wpf` at `0.12.0`. It brings the host-neutral
`Runic.Navigation` engine and adds `DispatcherModelContext`, `NavigationHost`
and `NavigationDialogHost`. Register `AddRunicWpfNavigation()` and map your
native Views with `MapView`, a naming convention or data templates. Follow the
[WPF navigation example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/examples/wpf-navigation/README.md)
for typed page inputs, results from dialogs, nested tabs and departure guards.
`NavigationSelector.Selection`, new in SDK `0.12.0`, connects a `TabControl`
or other single-selection control to a `NavigationSelection`, for tabs that
each keep their own stack of pages; `NavigationSelector.Region` connects single
selection to borrowed replacement, for existing models without stacks of their
own; `ViewHost` presents a plain application-owned model without a navigation
entry.

`RunicNavigator` is the shared engine for history, guards, outcomes, cancellation
and ownership. CommunityToolkit models call its async operations from native
`AsyncRelayCommand` or `[RelayCommand]` methods and forward their cancellation
tokens. Handle `Committed`, `Rejected`, `Failed` and `Superseded` results as
application policy. ReactiveUI models use the
[navigation adapter's observables and native command recipes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Navigation.ReactiveUI/README.md#native-command-composition);
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
`Button.IsCancel` work as in `ShowDialog`. Both are new in SDK
`0.7.0-preview.7`. Since SDK `0.11.0`, a guard from
`WindowCloseConfirmation.Create` or `OncePerClose` asks once per window close,
however many guarded regions the close clears, and
`NavigationRequestOptions.RetainView` decides per entry whether a
`NavigationHost` keeps the entry's View while it is retained, overriding the
host's `RetainViews`.

Which departures ask a page's guard in a tabbed shell:

- **Back, Replace, Clear and the other retiring operations** ask every page
  they retire, and every page in the regions that a retired owned page owns.
- **A window close** with `GuardWindowClose` clears the guarded regions, so it
  asks their pages as retiring, whichever tab is selected.
- **A tab switch** through `NavigationSelector.Selection` (since SDK
  `0.12.0`) is a guarded `SelectAsync`: it asks the current page of the tab
  left, and of the regions below it, as a retained departure, and changes no
  stack. A veto restores the committed tab. Retiring the page that owns the
  tabs, as a guarded window close does, asks every page of every tab as
  retiring, also tabs that were never selected.
- **A tab switch** through `NavigationSelector.Region` first asks the current
  page of each region that the tab model owns, and of the regions below it, as
  a retained departure, then the tab model's own guard. A guard that keeps its
  page keeps the tab selected, and the pages keep their drafts when the switch
  commits. `LeaveConfirmation` asks on a retained departure only with
  `askOnRetain: true`. This is new in SDK `0.7.0-preview.8`; in
  `0.7.0-preview.7` a tab switch asked only the tab model's own guard.

Only regions owned by the tab model are its pages. A region of the
application that the tab merely exposes is not asked when the tab is left, so
create a tab's page region with the tab model as its owner, as the SDK's WPF
navigation tests do:

```csharp docs-test=source:tests/dotnet/Runic.Navigation.Wpf.Tests/Support.cs
// A tab model that creates its page region with itself as the owner.
public PagesTab(string name, RunicNavigator navigator, INavigationTarget<object> initial)
{
    Name = name;
    Pages = navigator.CreateRegion(this, initial);
}
```

For tabs that each keep their own pages, let the page own one region per tab
and choose among them with a `NavigationSelection`, as the same tests do:

```csharp docs-test=source:tests/dotnet/Runic.Navigation.Wpf.Tests/Support.cs
// A page whose tabs each keep their own stack (#648): one region per tab, owned by the page, and a selection among them.
internal sealed class TabsPage : Page
{
    public TabsPage(string name, RunicNavigator navigator, params Page[] roots) : base(name)
    {
        Tabs = [.. roots.Select(root => navigator.CreateRegion(this, NavigationTarget.Own<object>(root)))];
        Selection = navigator.CreateSelection(this, Tabs);
    }

    public NavigationRegion<object>[] Tabs { get; }
    public NavigationSelection Selection { get; }
}
```

```xml docs-test=skip:illustrative-fragment
<TabControl rn:NavigationSelector.Selection="{Binding Selection}">
  <TabItem Header="Customers" />
  <TabItem Header="Reports" />
</TabControl>
```

Moving tab models selected with `Region` to `Selection`: the page owns the tab
regions and creates the selection, tab header models become plain data or
static `TabItem`s, the binding changes to `rn:NavigationSelector.Selection`,
and hand-written "can I leave this tab?" checks go, because the switch asks the
pages' departure guards. See the Runic.Navigation.Wpf README,
["Tabs with their own stacks"](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Navigation.Wpf/README.md#tabs-with-their-own-stacks).

The [Runic.Navigation guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Navigation/README.md#which-departures-ask-a-child-region)
lists which departures ask a child region.

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
in the page's existing `DataTemplate` View. Bind its `ViewModel`, keep the native
View inside it as the fallback, and set the services once on the window with
`RunicViewHost.SetServices`. The host opens after loading, serializes swaps,
cancels an open on unload, disposes in order and shows the fallback when the
web View can't open.
[Host Runic Views in a WPF app](wpf-hybrid.md) walks through this step: the
one-project layout and the optional split into a WPF-free model project, the
page's `webui.js` script, how the frontend reaches the output, window-close
guards and why to start windows in code rather than with `StartupUri`.

Since SDK `0.11.0`, `RunicViewHost` also takes `WebContent`,
`ContentSecurityPolicy` and a shared `Desktop`, and serves a frontend that the
build embedded with `RunicApplicationFrontendDelivery=Embedded`.
`WpfPlatformServices.ForWindow` gives ViewModels screen reader announcements,
context menus, message boxes, file drag-out, clipboard formats beyond text, and
a taskbar badge and progress for the WPF window.

`Runic.Application.Views.Wpf`, `RunicViewHost` and the one-project layout are
new in SDK `0.7.0-preview.7`. An
application built on `0.7.0-preview.6` keeps its `RunicWebView` and
`DesktopHost` code compiling after the
[upgrade steps in the 0.7.0-preview.7 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/eng/release/notes/0.7.0-preview.7.md#upgrading),
which also cover a two-project application.

The host borrows the model, the application service provider and the model
context. When WPF and the web View present the same model, set `ModelContext`
to the navigation's dispatcher model context. The host creates no DI scope or
replacement model and does not own the navigator. Keep services alive until
presentation cleanup finishes. Unloading the host closes the web session, which
cancels its unfinished operations and drains accepted work; work started through
native commands remains governed by the application's model lifetime.

The [hybrid editor example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/examples/wpf-hybrid-editor/README.md)
switches a single editor between WPF controls and a generated web client while
preserving model, navigation entry, store and draft. Reloading or recreating the
presentation uses the same model; switching back to native controls can preserve
the draft when web mounting fails. Test both presentations against the shared
validation, save, cancellation and departure behavior before migrating another
screen.

## Limits

WPF targets .NET 10 on Windows and requires the Microsoft Edge WebView2 Runtime
for embedded web Views. The WPF web adapter is stable since SDK `0.9.0`; remove
earlier `RUNICWPF001` suppressions, as that ID is retired. Since SDK `0.10.0`,
`WpfBridgeView` and `RunicViewHost` open with the default web content policy:
links to other sites open in the default browser, downloads are refused and
developer tools are on only in Development; since SDK `0.11.0`, their
`WebContent` property changes that policy. Also since `0.11.0`,
`Runic.Desktop`, which the WPF adapter brings, depends on
`Runic.Platform.Linux.DBus` and Tmds.DBus.Protocol on every OS, so a WPF
application ships those two managed assemblies, unused on Windows.
The child supports one surface per
control and follows normal HWND airspace constraints. WPF owns the shell's
layout, focus and window operations; browser fallback is unavailable. Tab and
Shift+Tab enter the web document and, at its last or first tab stop, return to
the surrounding WPF controls. Windows targeting can
compile elsewhere; native WPF behavior must run on Windows.

Do not block the live dispatcher on navigation or disposal with `.Wait()` or
`.Result`. Synchronous provider disposal starts navigator shutdown without
waiting; when cleanup must finish, follow the
[WPF asynchronous exit recipe](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Navigation.Wpf/README.md#disposal-at-exit).
