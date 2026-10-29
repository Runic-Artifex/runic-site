# Runic Application Views

Runic Application Views composes explicit .NET Windows and logical Views with
ordinary TypeScript clients. A `RunicWindow<TViewModel>` owns a window context;
a `RunicView<TViewModel>` declares a typed presentation contract. The build
inspects the compiled application after its MVVM source generators run and emits
C# attachments and TypeScript modules.

The browser framework owns the visual tree. .NET owns ViewModel scopes, View
construction, typed commands, property writes, and operation lifetimes. The
browser opens and closes a presentation of each View it shows, so a content
session can create and release its logical View as frontend routes change. Generated clients are framework-neutral;
React, Vue, Svelte, Angular, and plain TypeScript use the same contract. They
share one browser runtime, [`@runic-artifex/views`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/web/views/README.md),
which also provides a mock Bridge for development without .NET. The
[React](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/web/react/README.md) and
[Vue](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/web/vue/README.md) packages, `useView` in
[`@runic-artifex/svelte`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/web/svelte/README.md) and
`injectView()` in [`@runic-artifex/angular`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/web/angular/README.md)
connect and dispose clients with component lifetimes. Since SDK `0.11.0`, a
SvelteKit frontend uses `@runic-artifex/svelte` with
[`@runic-artifex/sveltekit`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/web/sveltekit/README.md),
which prerenders its pages for the Window.

Start with [getting started](getting-started/README.md), follow
[Windows and Views, step by step](tutorial/README.md), or
[add Runic to an existing app](existing-app.md). Existing WPF applications can
[adopt Runic incrementally](migrations/wpf-incremental.md), keeping their shell
and models while adding native navigation and optional embedded web Views. The
[first Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/examples/first-window/README.md) is the smallest example; then read the
[CommunityToolkit Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/examples/notes-view-first/README.md) and
[Reactive Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/examples/notes-reactive-views/README.md) examples. The
package API and build properties are in the
[`Runic.Application.Views` package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Application.Views/README.md).
The package is built from `packages/dotnet/Runic.Application.Views`, and its
types are in the `Runic.Application.Views` namespace; the
[reference](reference/README.md) lists every package with its source folder.

## Navigation and model context packages

Since 0.7.0-preview.4, navigation and model contexts live in
[`Runic.Navigation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Navigation/README.md).
It can be used independently of Views; `Runic.Application.Views` references it
transitively. Add `using Runic.Navigation;` for `RunicNavigator`, regions,
`IRunicModelContext`, `RunicModelContext` and `RunicModelContextRegistry`, then
recompile. There are no type forwards. ReactiveUI navigation helpers are in
`Runic.Navigation.ReactiveUI` (or its `.Reactive` flavor). The model-context
scheduling helpers, `AddRunicReactiveModelContext()` and
`ReactiveSchedulers` (`RunicReactiveSchedulerProvider` before 0.9.0), moved back to
`Runic.Application.Views.ReactiveUI` in 0.7.0-preview.7; replace
`using Runic.Navigation.ReactiveUI;` with
`using Runic.Application.Views.ReactiveUI;` for them.
[Pages and navigation](guides/pages-and-navigation.md) and
[ViewModel state and threads](guides/model-context.md) show both in use. The
[preview.4 migration tables](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/eng/release/notes/0.7.0-preview.4.md)
list the moved types.

## Upgrading generated clients

Rebuild after upgrading so the C# bridges and TypeScript clients regenerate
together, and add `@runic-artifex/views` to the frontend's dependencies.

- Connected client types are named `<Name>Client`; the former `<Name>View`
  name is no longer generated.
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
- Since SDK `0.11.0`, regenerated clients need `@runic-artifex/views` `0.11`
  and TypeScript 5.2 or later, because the `.d.ts` files reference the
  `esnext.disposable` library. `connect<Name>()` returns
  `Promise<<Name>Client & globalThis.Disposable>`, so `using` disposes a
  client where the engine has `Symbol.dispose`, and takes `{ signal }` to abort
  the connection. Clients generated by
  `0.10` keep working with the `0.11` runtime.
- Since SDK `0.13.0`, the generated clients, bridges and mocks speak Views
  protocol 4. Update every Runic NuGet and npm package to `0.13.0` together,
  rebuild, and reload open pages: a cached `0.12` page and a `0.13` host do not
  connect, and the page reports a `protocol` diagnostic. Code that uses
  generated clients compiles unchanged. `TimeSpan` values travel as ISO 8601
  durations (`"PT1H30M"`) instead of `"01:30:00"`, a custom `__runicBridge`
  implements `request`, `onMessage` and `onConnectionChange` instead of `call`,
  a custom `IBridgeTransport` implements `Serve` and `BroadcastAsync`, and the
  untyped mock names members (`commands: { increment }`) instead of route
  suffixes. Replace copies of `runic-desktop-views.js` or `runic-cswebui.js`
  kept outside the web content with the `0.13` copies.
- Since SDK `0.13.0`, `snapshot` and `subscribe` show a setter's value at once,
  until the state that includes it arrives. Await the setter's promise where
  the page needs .NET's confirmation, such as a "Saved" indicator. For text
  inputs, prefer `injectTextField` (Angular) or `useTextField` (React, Vue,
  Svelte); see
  [text inputs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/web/views/README.md#text-inputs).

The
[0.13.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/eng/release/notes/0.13.0.md#upgrading)
list everything to check when upgrading, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/docs/migration-1.0.md#from-012-to-013)
has before and after tables.
