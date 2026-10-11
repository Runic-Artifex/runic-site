# Glossary

Each of these words names one concept across the Runic packages, the generated
clients and these guides. The first seven follow the glossary of the
[`Runic.Application.Views` package guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views/README.md#glossary).

## Windows and Views

- **Window**: a top-level application window and its root ViewModel, declared
  as a partial `RunicWindow<TViewModel>`. The same declaration opens on every
  host with `host.OpenWindowAsync<TWindow>()`, with ReactiveUI or
  CommunityToolkit.Mvvm ViewModels. A Window is also a View. Runic Desktop's
  `DesktopWindow` is the native window underneath one.
- **View**: a logical .NET presentation object for one ViewModel, a partial
  `RunicView<TViewModel>` (`ReactiveRunicView<TViewModel>` with ReactiveUI)
  with a typed `DataContext`. It owns no DOM: the frontend renders a component
  for it. The browser acknowledges each mount, so a fresh View is created when
  a component mounts and released when it unmounts, while the ViewModel stays.
- **ViewModel content**: a ViewModel-typed property, such as the template's
  `Main`, whose value the frontend receives as a reference (for example a
  `CounterPageReference`) rather than as state. Changing the property changes
  the page.
- **`ViewOutlet`**: the component that renders the View for a ViewModel content
  reference, in React, Vue, Svelte and Angular. A `ViewRegistry` maps each kind
  of reference to a component, and the compiler checks that every kind has one.
- **Generated client**: the TypeScript module the build writes for each
  ViewModel to `Frontend/src/generated`, such as `counter.ts` with
  `CounterState` and `CounterClient`. It is regenerated on every build and not
  committed.
- **Bridge**: the code generated per ViewModel, C# and its TypeScript client,
  that carries snapshots, property writes, commands and operations between the
  ViewModel and its View over the wire protocol. `Bridge*` types and the
  `RUNICBRIDGE` diagnostics belong to this generated layer.

## Hosts and windows

- **Host**: the adapter that opens Windows on a platform: `RunicDesktopHost`
  (`Runic.Application.Views.Desktop`) and `RunicCsWebUiHost`
  (`Runic.Application.Views.CsWebUi`), both an `IRunicWindowHost`. In WPF,
  `RunicViewHost` hosts one View inside the visual tree. An open Window's
  `Host` property returns its per-Window adapter, an `IBridgeWindow`.
  [Choosing a host and MVVM library](choosing.md) compares the hosts.
- **Presentation**: what shows a Window's or View's web content on screen: an
  embedded WebView or an installed browser window, such as
  `DesktopBridgeWindow.Presentation` (a `DesktopWindow`). A presentation closes
  and reopens without changing the ViewModel.
- **Surface**: Runic Desktop's `DesktopSurface`, which serves a Window's web
  content, capabilities and browser sessions, and opens presentations of it.
  `DesktopBridgeWindow.Surface` is the Window's surface.
- **Owner**: the native window that platform services, such as file dialogs,
  the clipboard and file launchers, attach to: `DesktopNativeOwner` for a Runic
  Desktop window, or an `INativePickerOwner` for another host. With
  `AddRunicPlatformServices()`, the services a ViewModel takes in its
  constructor bind to the Window's owner when it opens.

## State and threads

- **Model context**: the `IRunicModelContext` that a Window's ViewModels belong
  to. It runs their changes one at a time, as a UI thread does, so ViewModels
  need no locks. The host gives each Window the context of its DI scope; with
  WPF it is the UI dispatcher (`DispatcherModelContext`).
- **Turn**: one short, synchronous unit of work on a model context. The Bridge
  reads state, applies property writes and starts commands in turns. An
  `await` in a command resumes in a later turn of the same context, so setting
  state after `await` is correct; see
  [ViewModel state and threads](guides/model-context.md).

## Navigation

- **Region**: a `NavigationRegion<TContent>` from `Runic.Navigation`, a
  navigable place in a Window, such as the main page or a dialog, with Back
  history, departure guards and owned content. Exposed as a get-only property,
  it is a content slot like any ViewModel content. Navigation is experimental
  (`RUNICNAV001`); see [pages and navigation](guides/pages-and-navigation.md).
- **Entry**: one visit in a region's history. A borrowed entry presents a
  ViewModel that someone else owns, such as the Window's scope; an owned
  entry's ViewModel belongs to the entry, usually created for the visit, and is
  disposed when the entry retires.
- **Departure guard**: an `INavigationDepartureGuard` ViewModel that can refuse
  to be left, for example while it has unsaved changes.
