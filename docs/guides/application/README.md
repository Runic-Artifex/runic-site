# Runic Application Views

Runic Application Views composes explicit .NET Windows and logical Views with
ordinary TypeScript clients. A `RunicWindow<TViewModel>` owns a window context;
a `RunicView<TViewModel>` declares a typed presentation contract. The build
inspects the compiled application after its MVVM source generators run and emits
C# attachments and TypeScript modules.

The browser framework owns the visual tree. .NET owns ViewModel scopes, View
construction, typed commands, property writes, and operation lifetimes. A View
mount is acknowledged by the browser, so a content session can create and release
its logical View as frontend routes change. Generated clients are framework-neutral;
React, Vue, Svelte, Angular, and plain TypeScript use the same contract. They
share one browser runtime, [`@runic-artifex/views`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/web/views/README.md),
which also provides a mock Bridge for development without .NET. The
[React](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/web/react/README.md) and
[Vue](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/web/vue/README.md) packages, `useView` in
[`@runic-artifex/svelte/views`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/web/svelte/README.md) and
`injectView()` in [`@runic-artifex/angular`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/web/angular/README.md)
connect and dispose clients with component lifetimes.

Start with [getting started](getting-started/README.md), follow
[Windows and Views, step by step](tutorial/README.md), or
[add Runic to an existing app](existing-app.md). Existing WPF applications can
[adopt Runic incrementally](migrations/wpf-incremental.md), keeping their shell
and models while adding native navigation and optional embedded web Views. The
[first Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/first-window/README.md) is the smallest example; then read the
[CommunityToolkit Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/notes-view-first/README.md) and
[Reactive Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/notes-reactive-views/README.md) examples. The
package API and build properties are in the
[`Runic.Application` package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Application.Views/README.md).
The package is built from `packages/dotnet/Runic.Application.Views`, and its
types are in the `Runic.Application.Views` namespace; the
[reference](reference/README.md) lists every package with its source folder.

## Navigation and model context packages

Since 0.7.0-preview.4, navigation and model contexts live in
[`Runic.Navigation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Navigation/README.md).
It can be used independently of Views; `Runic.Application` references it
transitively. Add `using Runic.Navigation;` for `RunicNavigator`, regions,
`IRunicModelContext`, `RunicModelContext` and `RunicModelContextRegistry`, then
recompile. There are no type forwards. ReactiveUI navigation and scheduling
helpers also moved to `Runic.Navigation.ReactiveUI` (or its `.Reactive` flavor);
Views-specific adapters stay in their Application packages. The
[preview.4 migration tables](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/eng/release/notes/0.7.0-preview.4.md)
list the moved types.

## Upgrading generated clients

Rebuild after upgrading so the C# bridges and TypeScript clients regenerate
together, and add `@runic-artifex/views` to the frontend's dependencies.

- Connected client types are named `<Name>Client`. The former `<Name>View`
  name remains as a deprecated alias.
- Import `BridgeError`, `BridgeOperation*` and `FieldBaseline*` from
  `@runic-artifex/views`. Generated modules no longer export them, so
  `instanceof BridgeError` holds across modules.
- Generated state types no longer contain `revision`.
- `snapshot` returns the last state after disposal, and `subscribe` after
  disposal delivers that state once and returns a no-op unsubscribe.
- Generated C# files are named `<FullName>.Bridge.g.cs` and
  `<FullName>.View.g.cs`. The build removes the former files automatically.
- `DateTimeOffset` values keep their offset on the wire, and outbound date values
  must be ISO 8601 strings.
- Toolkit asynchronous commands and ReactiveUI commands with an argument publish
  `is<Name>Executing`; nullable ReactiveUI command and interaction types are
  `T | null`.
