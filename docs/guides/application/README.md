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
share one browser runtime, [`@runic-artifex/views`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/web/views/README.md),
which also provides a mock Bridge for development without .NET. The
[React](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/web/react/README.md) and
[Vue](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/web/vue/README.md) packages, `useView` in
[`@runic-artifex/svelte`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/web/svelte/README.md) and
`injectView()` in [`@runic-artifex/angular`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/web/angular/README.md)
connect and dispose clients with component lifetimes. Since SDK `0.11.0`, a
SvelteKit frontend uses `@runic-artifex/svelte` with
[`@runic-artifex/sveltekit`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/web/sveltekit/README.md),
which prerenders its pages for the Window.

Start with [getting started](getting-started/README.md), follow
[Windows and Views, step by step](tutorial/README.md), or
[add Runic to an existing app](existing-app.md). Existing WPF applications can
[adopt Runic incrementally](migrations/wpf-incremental.md), keeping their shell
and models while adding native navigation and optional embedded web Views. The
[first Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/examples/first-window/README.md) is the smallest example; then read the
[CommunityToolkit Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/examples/notes-view-first/README.md) and
[Reactive Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/examples/notes-reactive-views/README.md) examples. The
package API and build properties are in the
[`Runic.Application.Views` package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/dotnet/Runic.Application.Views/README.md).
The package is built from `packages/dotnet/Runic.Application.Views`, and its
types are in the `Runic.Application.Views` namespace; the
[reference](reference/README.md) lists every package with its source folder.

## Navigation and model context packages

Since 0.7.0-preview.4, navigation and model contexts live in
[`Runic.Navigation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/packages/dotnet/Runic.Navigation/README.md).
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
[preview.4 migration tables](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.7.0-preview.4.md)
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
  the page needs .NET's confirmation, such as a "Saved" indicator. For inputs,
  prefer the field bindings of SDK `0.14.0` (`useField`, `injectField`); see
  [forms and validation](guides/forms-and-validation.md).

The
[0.13.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.13.0.md#upgrading)
list everything to check when upgrading, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-012-to-013)
has before and after tables.

## Upgrading from 0.13 to 0.14

Update every Runic NuGet and npm package to `0.14.0` together
(`Runic.Application.Views.CsWebUi` to `0.14.0-preview.1`) and rebuild, so the
generated clients, bridges and mocks regenerate. Views protocol 4 does not
change: the new features are negotiated in `hello`, so a `0.13` page and a
`0.14` host still connect and use whole values. Check these if they apply:

- **Operations started before the upgrade.** Every contract fingerprint
  changes (`runic-bridge-contract-v6`), so an operation that a `0.13` page
  started and recovers after the upgrade is `unknown`.
- **Notifications once per animation frame.** `subscribe` listeners get the
  newest state once per animation frame instead of once per frame, and
  `snapshot` can be up to one frame behind. A setter's value and the result of
  an awaited call are still delivered at once; the mock Bridge still delivers
  each push at once. See [testing frontends](guides/frontend-testing.md).
- **Clients stay connected after unmount.** `useView`, `injectView` and
  `createViewController` keep a client for `keepAlive` milliseconds (2000 by
  default), and the next binding of the same connector takes it over. Tests
  that check that a route closes at unmount pass `{ keepAlive: 0 }`.
- **Requests before `hello`** wait up to 5 seconds for the `hello` instead of
  answering `no-hello` at once, in `InMemoryBridgeTransport` and the mock
  Bridge too.
- **Text fields read checked-write receipts.** `useTextField`,
  `injectTextField` and `createTextFieldController` keep the draft on a
  `rejected` or `conflict` receipt and report it in `error`, instead of
  dropping it; their state adds `text`, `errors` and `conflict`. The new field
  API covers every member type; see [forms and validation](guides/forms-and-validation.md).
- **Validation messages.** An empty or blank message crosses as
  `Invalid value.` instead of `""`. The Runic Artifex forks are stable:
  `RunicArtifex.ReactiveUI.Validation` `9.0.0` and `RunicArtifex.DynamicData`
  `10.0.0`, so an application that references them moves to these versions and
  drops `--prerelease`.
- **`runicDevSession()` is deprecated.** A SvelteKit frontend uses
  `runic({ html: false })` in `vite.config.ts` and imports
  `@runic-artifex/vite-plugin-runic/client` from `src/hooks.client.ts`; the
  deprecated function still works in `0.14`. An Angular frontend keeps
  `runicDevSessionProxy()` and loads the development client from `main.ts`
  behind `ngDevMode`; its `/__runic/state` now answers 200 with the state JSON
  instead of 204.
- **Platform services without a window.** `IApplicationPlatformServices`,
  registered by `AddRunicPlatformServices()` and returned by
  `DesktopPlatformServices.ForApplication()`, opens URIs and files and shows
  message boxes without a window. It replaces the
  `DesktopPlatformServices.OpenUriAsync(uri)` of 0.14 development builds,
  which 0.14.0 does not ship; see
  [without a window](../desktop-services.md#without-a-window).
- **Navigation hooks under `RunicModelContext`** run in the model context, each
  in a turn of its own, as with WPF's `DispatcherModelContext`. Set page state
  in `InitializeAsync` or `OnArrivedAsync` directly, don't block in a hook, and
  remove a wrapper that scheduled hooks itself; see
  [ViewModel state and threads](guides/model-context.md).
- **SDK tool exit codes.** `dotnet runic`, `Runic.Create` and the asset packer
  are built with Runic Command Line `0.11.0`. A failure on what a command found,
  such as a missing project (`RAPPDEV1002`), an invalid Views Window project
  (`RAPPDEV1005`), an existing `size --report` file (`RAPPSIZE1003`), a missing
  packer source directory (`RAS1001`) or a non-empty `runic-create`
  destination (`RCREATE003`), now exits 1 instead of 2; exit code 2 means that
  the command line itself is wrong. Human output writes the message without its
  leading code. Scripts test 1 or read `fault.code` from `--format json`.
- **CS-WebUI shows no "Connection with the backend is lost" banner**, because
  `runic-cswebui.js` installs a WebUI event callback. Show the connection state
  yourself, for example from `useBridgeConnection()` as the template does.
- **Removed types fail with `CS0619`.** Code that still names a type removed in
  0.9 or 0.13, such as `IAsyncBridgeTransport` or `BridgeTestArguments`, gets
  an error that names its replacement, for this release.
- **Toolchain floor.** The build warns with `RUNICBRIDGE033` for a .NET SDK
  older than 10.0.403 or a Bun older than 1.4.4.

The
[0.14.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.14.0.md#upgrading)
list everything to check, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-013-to-014)
has before and after tables for each area, including tests, Windows, Nix and
the CLI tools.

## Upgrading from 0.14 to 0.15

Update every Runic NuGet and npm package to `0.15.1` together
(`Runic.Application.Views.CsWebUi` to `0.15.1-preview.1`) and rebuild, so the
generated clients, bridges and mocks regenerate. `0.15.1` is `0.15.0` with
[one fix](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.15.1.md):
a Svelte `$effect` that reads only `client`, `error` or `pending` from
`useView` no longer runs again with every state. Views protocol 4 does not
change: the new features `presentation-epoch/1` and `presented/1` are
negotiated in `hello`, so a `0.14` page and a `0.15` host still connect and
behave as in `0.14`. Check these if they apply:

- **A Runic Desktop executable references its server.** `Runic.Desktop` no
  longer references ASP.NET Core. Add `Runic.Desktop.NativeServer`, which
  needs no ASP.NET Core and which new projects use, or `Runic.Desktop.Kestrel`
  to keep ASP.NET Core Kestrel, to the executable that references
  `Runic.Application.Views.Desktop`, `Runic.Application.Views.Wpf` or
  `Runic.Desktop`; without either the build fails with `RUNICDESK004`. A
  library changes nothing. Keep Kestrel when the application uses ASP.NET Core
  itself, such as `IConfiguration` or `IHostEnvironment` from
  `DesktopHostOptions.ConfigureServices`: on the native server that callback
  receives a plain service collection with logging. An executable that opens
  no window sets `<RunicDesktopServer>None</RunicDesktopServer>`. See
  [the presentation server](../desktop/host-selection.md#presentation-server).
- **`BridgeConnectionState` has a fifth value, `"closed"`.** The application
  closed the window, and the state stays `closed` when the connection then
  drops. A `switch` or `Record<BridgeConnectionState, …>` that handles every
  value no longer compiles until it handles `"closed"`; the template shows
  "The application closed this window."
- **Late commands of an earlier page.** Replace a presentation number kept in
  state and compared in each command with `[RunicPresentationScoped]` on the
  command and `RunicPresentation.Renew(this)` where the page changes; replace
  a `UiRendered` command that the page called after a frame with
  `RunicPresentation.WaitForPresentedAsync`, and a close-acknowledged command
  with `CloseAsync(timeout)` and `RunicWindowCloseResult.PagesAcknowledged`.
  See [commands scoped to their page](guides/pages-and-navigation.md#commands-scoped-to-their-page).
- **Content presented again pushes its state.** When a slot shows other
  content and then the earlier content again, the Bridge pushes that content's
  state, so a test that expected no push after `Main = b; Main = a` now sees a
  `state` push of the resumed route.
- **Answered dialogs no longer come back.** A retained result entry whose
  caller cancelled, or that called `DismissAsync` while another entry covered
  it, is retired by the Back of the entry above it, which resumes the entry
  below. Code that waited for the dialog to reappear to leave it can drop that
  step. A prompt stack of your own beside a dialog region becomes
  `NavigationAdmission.Queue`, and a `CanLeaveTabAsync()` of your own becomes
  `AskOnParentRetain` or `ConfirmDepartureAsync`; see
  [queue dialogs](guides/pages-and-navigation.md#queue-dialogs).
- **`runicDevSession()` is removed.** A SvelteKit `vite.config.ts` that still
  imports it fails to load: use `runic({ html: false })` and import
  `@runic-artifex/vite-plugin-runic/client` from `src/hooks.client.ts`.
- **CS-WebUI embeds its frontend.** A CS-WebUI project with
  `RunicApplicationFrontendDelivery=Embedded`, which built as `Files` with
  `RUNICBRIDGE030`, now serves the frontend from the assembly, and its output
  has no `www/`; remove the property to keep `www/`. Code that extracted an
  embedded frontend to a folder for `SetRootFolder` becomes
  `RunicCsWebUiHostOptions.Assets`, and a wrapper that filtered an archive by
  folder becomes `archive.Subdirectory("folder")`. See
  [embed and serve assets](../assets/README.md#serve-one-folder-of-an-archive).
- **Embedded archives are checked at build time.** `AssetArchive.ReadEmbedded`
  checks the manifest and ZIP directory at load and inflates each asset when it
  is first requested; the build checks every archive it packs, and a
  `RunicAssetsEmbeddedArchive` that is not a valid archive fails with
  `RAS2006`. Call `ValidateAsync()` to check every digest at run time.
  `AssetArchive.Read` and `ReadAsync` still check every asset.
- **ReadyToRun publishes.** A publish with `-p:PublishReadyToRun=true` no
  longer fails with `NETSDK1191`; remove a workaround that passed the property
  to the application project only. See
  [choose the publish mode](../desktop/shipping.md#choose-the-publish-mode).
- **A slow WebView2 start shows the window early.** On Windows, a window whose
  WebView2 is not ready within 1.5 seconds appears titled `Loading…` with a
  loading surface. UI automation that looks for the page waits for the page's
  document or title, not only the window. A user who closes the window then
  closes it: `OpenWindowAsync` returns it closed and no fallback opens. See
  [the early first window](../desktop/host-selection.md#the-early-first-window-on-windows).
- **A failed browser fallback throws `DesktopPresentationException`.** When
  the `EmbeddedThenBrowser` fallback browser fails too, the exception keeps
  its `Code` and `Category`, and its `InnerException` is the browser's
  `DesktopException`. `catch (DesktopException)` still matches; a check for
  the exact type does not.
- **macOS serve-only starts no AppKit.** With `RUNIC_APPLICATION_SERVE_ONLY=1`
  the process has no Dock icon and gets no open-document or open-URL events;
  stop it with Ctrl+C, SIGTERM or a line on standard input.
- **Windows administration error categories.** A component that is not
  installed or registered, such as the Group Policy Management Console or a
  WMI provider, is `AdministrationErrorCategory.NotInstalled` instead of
  `Unavailable`, and several native errors moved from `NativeFailure` to
  `NotFound`, `InvalidData`, `Unavailable` or `Conflict`; see
  [Windows administration](../desktop-services.md#windows-administration).
- **Vue's `commit()` resolves with the field's state**, as in React, Svelte
  and Angular, so `if ((await title.commit()).error === undefined) …` works.
  Code that awaited it and then read `title.error` still works.

The
[0.15.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.15.0.md#upgrading)
list everything to check, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-014-to-015)
has before and after tables for each area, including the native server's
library version and Nix.

## Upgrading from 0.15 to 0.16

Update every Runic NuGet and npm package to `0.16.0` together
(`Runic.Application.Views.CsWebUi` to `0.16.0-preview.1`) and rebuild, so the
generated clients, bridges and mocks regenerate. `0.16.0` only adds APIs. Views
protocol 4 does not change: the new wire members are features negotiated in
`hello`, such as `view-requests/1`, `field-paths/1` and `navigation-path/1`,
so a `0.15` page and a `0.16` host, or the reverse, still connect and behave
as in `0.15`. Check these if they apply:

- **CS-WebUI needs the `0.16` page and host for its security fix.** A page
  that reloaded, or another browser that connected right after a page left,
  could receive the pushes and questions of the page that had just closed.
  With `request-session/1` each request names its page's session, and each
  connection gets a key that no later connection reuses. Replace any copy of
  `runic-cswebui.js` that the application keeps outside `www/`; a `0.15` page
  on a `0.16` host is only partly protected. A hand-written Views client lists
  `request-session/1` in its `hello` and sends its session with each request.
  See [who is connected](samples/cross-window.md#who-is-connected).
- **`ConnectionKey` is the window's key.** On CS-WebUI and the in-memory test
  transport, `RunicInteractionInvocation.ConnectionKey` is now `connection-1#1`
  or `0:1#2` instead of the transport's key. Compare it with
  `RunicViewDriver.Connection` or `IRunicConnections`, and use
  `IRunicConnections.Caller` instead of telling `MultiClient` pages apart
  through a command argument.
- **A page answers questions that used to fall back to .NET.** A ReactiveUI
  interaction asked by a command on another route of the window, or by a
  menu-bar command, now reaches a page that has a handler mounted, also a
  `0.15` page on a `0.16` host. Keep the .NET handler only for when no page is
  mounted. See [ask the page and await its answer](samples/prompts.md#ask-the-page-and-await-its-answer).
- **A page's command identity ends with the command.** A timer, `Task.Run` or
  background loop that a page's command started no longer asks that page;
  `RunicInteractionInvocation.Current` is `null` there. Enter
  `RunicInteractionInvocation.EnterWindow(viewModel)` for long-lived work that
  should ask the window's page. An async ReactiveCommand run by an in-page menu
  click asks its page before its first `await`.
- **Field kinds and text.** `decimal`, `DateOnly`, `TimeOnly`, `DateTime` and
  `DateTimeOffset` members have the kinds `decimal`, `date`, `time` and
  `datetime` instead of `text`; treat an unknown kind like `value`. Empty text
  in a nullable one is `null`, and in a non-nullable one an `invalid-text`
  error. `time` text is `10:30`, a `datetime` field shows the page's local
  time, and number text no longer accepts `0x10` or `0b1`. Once the
  application sets the window's language with `IRunicWindowLocale`, number,
  date and time fields without their own `locale` follow it: give a field bound
  to `<input type="number">` or `type="date"` `locale: null` (`bindField` does
  that itself). See [upgrading from 0.15](guides/forms-and-validation.md#upgrading-from-015)
  in forms and validation.
- **Departure guards see the last keystrokes.** With a `0.16` page and host,
  the window's pages write their drafts before a departure guard runs
  (`field-flush/1`), so a guard can run up to 1 second later. In tests, set
  `InMemoryBridgeTransport.FieldFlush`.
- **Recent documents on Windows and Linux.**
  `DesktopHost.NoteRecentDocumentAsync` (`AddRecentDocumentAsync` since 0.21)
  and `ClearRecentDocumentsAsync`, which
  did nothing outside macOS, now add to and clear Explorer's Recent items and
  Jump List and `recently-used.xbel`. Guard a call you don't want there. See
  [recent documents](../desktop-services.md#recent-documents).
- **`DesktopWindow.FocusAsync` restores a minimized window on Windows**, as on
  macOS and GTK; an extra restore before it can go.
- **Your own `IRunicWindowService`** still compiles: the new members, such as
  `FindOrOpenAsync` and `OpenForResultAsync`, throw `NotSupportedException`
  until it implements them.
- **CS-WebUI serves blobs and uploads from a loopback endpoint** of each
  window, on another origin than the page. A page `Content-Security-Policy`
  allows `http://localhost:*` for `img-src`, `media-src` and `connect-src` to
  use them. See [blobs and uploads](samples/files.md#blobs-and-uploads).
- **A native server library of your own** (`RunicDesktopNativeServerLibraryDirectory`,
  Nix `runicServer`) is built from `0.16`: its C ABI is version 3, and an older
  library fails at startup with `native-server-unavailable`. Applications that
  reference `Runic.Desktop.NativeServer` get the matching library.
- **Serve-only test harnesses** accept a
  `RUNIC_APPLICATION_WINDOW=<url> <Window type>` line after each
  `RUNIC_APPLICATION_URL=` line, and tests that compare the in-memory
  transport's messages exactly expect a `session` and the new features in its
  `hello`. See [behaviour that 0.16 tests meet](guides/frontend-testing.md#behaviour-that-016-tests-meet).

Code of your own can often become a 0.16 API: a state flag the page watched to
focus a field becomes a [`ViewRequest<T>`](samples/prompts.md#ask-the-page-to-act);
a dictionary of open windows becomes
[`FindOrOpenAsync`](samples/cross-window.md#find-or-open-a-window); a saved
baseline for `IsDirty` becomes
[`RunicEditSession<T>`](guides/forms-and-validation.md#forms-and-edit-sessions);
a command per cell becomes a
[row editor](guides/forms-and-validation.md#editable-rows-and-nested-fields); a
rebuilt menu bar for a check mark becomes
[`IRunicMenuCheckedSource`](../desktop-services.md#check-marks); a theme switch
that reloaded the page becomes
[`SetColorSchemeAsync`](samples/settings.md#light-and-dark-at-run-time); and a
fake file dialog of your own becomes
[`AddRunicTestPlatform()`](guides/frontend-testing.md#platform-fakes). New in
`0.16.0` as well: [document tabs](guides/pages-and-navigation.md#document-tabs),
[saved navigation and deep links](guides/pages-and-navigation.md#save-and-restore-navigation),
[Back and the URL](guides/pages-and-navigation.md#back-and-the-url),
[query collections](guides/dynamicdata.md#query-collections),
[power and session events](../desktop-services.md#power-and-session-events)
and [page errors in .NET logs](../desktop/crash-reporting.md#page-errors-in-net-logs).

The
[0.16.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.16.0.md#upgrading)
list everything to check, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-015-to-016)
has before and after tables for each area, including tests.

## Upgrading from 0.16 to 0.17

Update every Runic NuGet and npm package to `0.17.0` together
(`Runic.Application.Views.CsWebUi` to `0.17.0-preview.1`) and rebuild, so the
generated clients regenerate. Applications that use Runic Translations move
every Translations package to `0.9.1`. `0.17.0` only adds APIs, and its new
wire members are Views protocol 4 features negotiated in `hello`
(`client-languages/1` and `appearance/1`), so a `0.16` page and a `0.17` host,
or the reverse, connect and behave as in `0.16`. Check these if they apply:

- **CS-WebUI applications should update for the security fix.** A window's
  page server and blob endpoint now hold both loopback addresses of their port;
  see [the CS-WebUI fix](samples/cross-window.md#who-is-connected) and the
  advisories on the [Releases](https://docs.runic-artifex.eu/releases/) page.
- **`ViewOutlet` and `RegionOutlets`** show the English "No web component is
  registered for …" alert only in development builds. Production builds render
  nothing and report the kind once through the page's error reporting; pass
  `missing` to render your own text.
- **Window locales fall back to their parent.** A locale the page's runtime
  does not have, such as `de-CH`, sets `de` before the page reports an error; a
  parent in another script, such as `zh` for `zh-Hant-TW`, is skipped.
- **Native windows follow the Window's locale.** On Windows and Linux a Runic
  Views Desktop window opens with the layout direction and web view language of
  its `IRunicWindowLocale` and mirrors when it changes.
  `DesktopWindowOptions.LayoutDirection` and `Language` still win.
- **Shortcut labels and dialogs.** Windows menu shortcut labels use the
  keyboard layout's modifier names, such as `Strg+S`, and the GTK 3 file
  chooser shows GTK's own translated buttons.
- **Tests that compare the in-memory transport's messages exactly** see
  `client-languages/1` with `"languages":[]` and `appearance/1` in its `hello`,
  and an `appearance` push with every member `null` after it. Windows that
  `RunicWindowTestHost.CreateWindowAsync` opens use the application's
  `RunicValidationOptions` and the Window's `MaximumUploadBytes`.
- **Packaging.** Linux `.desktop` files no longer XML-escape the name and
  description. Once the project sets `RunicApplicationLocales`, a manifest
  copied into `packaging/` before 0.17 fails with `RAPPPKG1006`, which names the
  field to add.

New in `0.17.0`: [the application's language](guides/languages.md) with Runic's
own text in English and German and the `--translations` template,
[appearance beyond light and dark](samples/settings.md#contrast-text-size-and-accent-colour),
[shared clients](guides/pages-and-navigation.md#shared-clients),
owner-less file dialogs for CS-WebUI, and, experimental,
[hosted applications](../desktop/hosted-applications.md).

The
[0.17.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.17.0.md#upgrading-from-016)
list everything to check, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-016-to-017)
collects them.

## Upgrading from 0.17 to 0.18

Update every Runic NuGet and npm package to `0.18.0` together
(`Runic.Application.Views.CsWebUi` to `0.18.0-preview.1`) and rebuild, so the
generated clients regenerate. No public .NET API was removed or changed. Check
these if they apply:

- **Runic Translations 0.10 and Runic Command Line 0.12.**
  `Runic.Application.Views.Translations` requires Translations
  `[0.10.0, 0.11.0)`, so move every Translations package to `0.10.0`.
  `dotnet-runic`, `Runic.Create` and the `Runic.Assets` packer bundle Command
  Line `0.12.0`; an application that uses Command Line itself moves to `0.12.0`
  (see [Upgrading from 0.11](../command-line/README.md#upgrading-from-011)).
- **The native presentation server's C ABI is 5.** `Runic.Desktop` `0.18.0`
  binds only ABI 5, so a `Runic.Desktop.NativeServer` of another version fails
  at the first window with `native-server-unavailable`. Use the same version of
  both. An application that links the server itself depends on the
  `runic-server` crate at the `v0.18.0` tag.
- **`describeBridgeError` shows Runic's sentence** for a `BridgeError`'s reason
  or kind and never its `message`: `rejected` with `invalid-input` reads "The
  input is not valid.", and an empty `integer` field reads "Enter a whole
  number." Application text still reaches the page through `FieldError`, and
  `configureRunicText` replaces Runic's wording.
- **GTK 4 windows** show `DesktopPlatformTexts.LoadingTitle` ("Loading…") until
  the page has a title, instead of "Runic Desktop".
- **A `PropertyChanged` that names a bridged member refreshes only that
  member**, so a getter with side effects runs less often. A collection or
  observed sub-object replaced under another member's notification now
  publishes its later changes.
- **Tests that compare a host's or guest's `hello` exactly** see `region/1`
  (and `region-component/1` where allowed), and the Views protocol offers
  `hosted-regions/1`.
- **Generated union encoders are typed:** regenerate generated clients and mock
  doubles.
- **`dotnet runic doctor`** requires the .NET 10 runtime (`dotnet-runtime`), and
  `dotnet runic dev` stops with `RAPPDEV1013` when it is missing. The .NET 11
  SDK (11.0.100) is accepted for `net10.0` applications.

New in `0.18.0`, experimental under `RUNICDESK103`: a host can show a guest
application's Window in a region of its own page (region mode), or a guest's
Views as a component in its document (trusted component mode); see the SDK's
[hosted regions guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/hosted-regions.md).
An elevated host can host an elevated guest of the same user. Stable: exact
window bounds and a run-time minimum size (`DesktopWindow.SetBoundsAsync`,
`SetMinimumSizeAsync`, `DesktopWindowState.Bounds`), and Runic's own page text
in German.

The
[0.18.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.18.0.md#upgrading-from-017)
list everything to check, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-017-to-018)
collects them.

## Upgrading from 0.18 to 0.19

Update every Runic NuGet and npm package to `0.19.0` together
(`Runic.Application.Views.CsWebUi` to `0.19.0-preview.1`) and rebuild, so the
generated clients and Bridges regenerate. No application API was removed.
Check these if they apply:

- **Rebuild every assembly that contains generated Bridges**, including a
  separate `RunicApplicationFrontendModelAssembly` and ViewModel libraries that
  other applications reference. The Bridge runtime in
  `Runic.Application.Views.Generated` is no longer generic over the ViewModel,
  so a Bridge that the 0.18 generator wrote fails to load. The host reports it
  at the first Window or View as `RUNICBRIDGE038`, which names the assembly to
  rebuild. The wire protocol and the generated TypeScript client are
  unchanged. A hand-written Bridge, such as a test double, derives from
  `ViewModelBridge`, passes `typeof` of its ViewModel and casts the ViewModel
  in each descriptor lambda.
- **Runic Translations 0.11 and Runic Command Line 0.13.**
  `Runic.Application.Views.Translations` requires Translations
  `[0.11.0, 0.12.0)`, so move every Translations package to `0.11.0`.
  `dotnet-runic`, `Runic.Create` and the `Runic.Assets` packer bundle Command
  Line `0.13.0`; an application that uses Command Line itself moves to `0.13.0`
  (see [Upgrading from 0.12](../command-line/README.md#upgrading-from-012)).
- **The tools' help and usage errors** follow Command Line 0.13: help lists
  arguments by their placeholder (`<source-directory>`), names options in
  `[requires: …]` and `[conflicts: …]` by their spelling, and shows no
  `[default: False]` for flags. In `--format json`, `RCLI1005`'s `arguments`
  hold the placeholder; a script that read the ID from them reads the new
  `binding` member instead.
- **A Windows title bar without a forced colour scheme follows the system's
  dark mode.** A WebView2 window with `DesktopColorScheme.NoPreference`, and a
  WPF window after `SetColorSchemeAsync(NoPreference)`, takes the system's app
  mode. Set `Light` for a light title bar, which also pins the page's
  `prefers-color-scheme`.
- **`RUNICBRIDGE039`**, a new generator warning, reports a
  `[RunicOperationClose]` declaration that reaches no operation. Only code that
  uses the experimental close drain can meet it.
- **`RunicTestWindowPresentation.AllFeatures`** now includes `SidePanel`,
  `Maximize` and `Placement`; a test that compared `Features` with a list of
  its own adds them.

New in `0.19.0`, experimental: a **side panel** beside the window's page, by
which the window grows (`OpenSidePanelAsync`, `RUNICDESK104`; see the SDK's
[side panel guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/side-panel.md)),
a **close drain** that keeps a Window open until its accepted work has finished,
also at shutdown (`RunicWindowOptions.CloseDrain`, `[RunicOperationClose]`,
`RUNICDESK105`), and an
[appearance override per hosted region](../desktop/hosted-regions.md#design-and-appearance)
(`RUNICDESK103`). Stable: `DesktopWindow.MaximizeAsync`, `RestoreAsync` and
`SetPlacementAsync`, the same on `IRunicWindowPresentation` for ViewModels,
WPF and hosted windows, per-window services for a window the application
opened itself (`DesktopPlatformServices.AttachWindowServices`), and
`AcceptedWorkScope.WaitForAcceptedAsync`. A NativeAOT executable grows by
about 24 KiB per bridged ViewModel instead of about 118 KiB.

The
[0.19.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.19.0.md#upgrading-from-018)
list everything to check, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-018-to-019)
collects them.

## Upgrading from 0.19 to 0.20

Update every Runic NuGet and npm package to `0.20.0` together
(`Runic.Application.Views.CsWebUi` to `0.20.0-preview.1`) and rebuild, so the
generated clients and Bridges regenerate. No application API was removed, and
the wire protocol is unchanged: the new Views protocol features
(`trace-context/1`, `handler-timing/1`) are negotiated, so a 0.19 page and a
0.20 host connect. Check these if they apply:

- **Runic Translations 0.12; Command Line stays at 0.13.**
  `Runic.Application.Views.Translations` requires Translations
  `[0.12.0, 0.13.0)`, so move every Translations package, NuGet and npm, to
  `0.12.0` (see [Upgrading to 0.12.0](../translations/README.md#upgrading-to-0120)).
  With the Translations Vite plugin 0.12, an edited message updates in place
  under `dotnet runic dev`, and Runic Inspect marks the page's messages and
  edits them; an earlier plugin reloads the page and offers no editing.
- **Bridge warnings fail a build that treats warnings as errors.** The Bridge
  analyzers now report `RUNICBRIDGE013`, `028`, `031`, `032`, `034`, `039` and
  `053` as compiler warnings, and the MSBuild warnings of the generator and the
  Views build targets (`015`, `019`, `020`, `029`, `030`, `033`) are errors
  too under `TreatWarningsAsErrors`. Fix the declaration, or keep it a warning
  with `WarningsNotAsErrors` (or hide it with `NoWarn`).
- **WebKit's remote inspector opens only in Development on Linux.** Outside
  Development the GTK 3 and GTK 4 hosts remove `WEBKIT_INSPECTOR_SERVER` and
  `WEBKIT_INSPECTOR_HTTP_SERVER` from the process's environment before their
  first web view. To inspect a build remotely, run it with
  `DOTNET_ENVIRONMENT=Development`; see
  [debugging](guides/debugging.md#the-browsers-developer-tools-per-engine).
- **Generated clients are two files**: `<view>.ts` and `<view>.contract.d.ts`
  with a declaration map, so Go to Definition opens the C#. Imports and the
  built JavaScript are unchanged; commit the new files of a committed generated
  directory, and a library that emits declarations with `tsc` copies the
  `.contract.d.ts` files beside them.
- **Bun bundles the development build of `@runic-artifex/views` by default.**
  `vite build`, `ng build` and `bun build --production` bundle the production
  build; pass `--production` to `bun build`, or set `NODE_ENV=production` for a
  `Bun.build` script, when you build a release page. The Views MSBuild targets
  run an optimized build's frontend build with `NODE_ENV=production`.
- **`dotnet runic doctor --format json` gives each check a `helpUri`.** A
  validator that holds an earlier copy of the
  `runic.application.tool.doctor/1` schema rejects 0.20's payload; update the
  copy.

New in `0.20.0`, for development only and absent from production builds: the
development source map from each Bridge member to its C#, Go to Definition from
generated clients to the C# handlers, Bridge calls in the browser's Performance
panel and in the dock, Runic Inspect (with **Edit** for translations), C#
handler timing and one trace from the page to .NET, an IDE contract and
`dotnet runic dev --no-window`, launch profiles and an optional VS Code setup
in the template, and the Bridge analyzers while you type. See
[debugging an application](guides/debugging.md) and
[tracing Bridge calls](guides/tracing.md). The template's Vite frontends
compile their catalog with the Translations Vite plugin, the Angular template
can build with Vite (`--angular-build vite`), `@runic-artifex/angular` ships in
the Angular Package Format, and an Angular guest can be shown in trusted
component mode (experimental, `RUNICDESK103`).

The
[0.20.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.20.0.md#upgrading-from-019)
list everything to check, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-019-to-020)
collects them.

## Upgrading from 0.20 to 0.21

Update every Runic NuGet and npm package to `0.21.0` together
(`Runic.Application.Views.CsWebUi` to `0.21.0-preview.1`) and rebuild. The
wire formats are unchanged, but 0.21 renames API members from the 0.21 API
review, so code that uses one of them needs an edit. Check these if they apply:

- **Runic Translations 0.13; Command Line stays at 0.13.**
  `Runic.Application.Views.Translations` requires Translations `0.13`, so move
  every Translations package, NuGet and npm, to `0.13.0` and replace
  `TranslationContext.CreateBuilder().Add(` with `.AddCatalog(` (see
  [Upgrading to 0.13.0](../translations/README.md#upgrading-to-0130)).
- **.NET renames.** Rename the calls; nothing else changes, and saved
  navigation paths load unchanged (a selection's index stays `"selected"` in
  the JSON):

  | 0.20                                                                                                                       | 0.21                                                                                                                                              |
  | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `DesktopHost.NoteRecentDocumentAsync(path)`                                                                                | `DesktopHost.AddRecentDocumentAsync(path)`                                                                                                        |
  | `DesktopWindowCapabilities.WindowPlacement`                                                                                | `DesktopWindowCapabilities.Placement` (same value)                                                                                                |
  | `IDesktopWindowBoundsHost`, `IDesktopWindowShowStateHost` (custom window hosts only)                                       | `IDesktopBoundsWindowHost`, `IDesktopShowStateWindowHost`                                                                                         |
  | `NavigationSelectionPath.Selected`, `RunicRegionCollectionState.Selected`                                                  | `SelectedIndex`                                                                                                                                   |
  | `MaximumWindowUploadBytes` (`RunicWindowOptions`, `WindowContentSessionOptions`)                                           | `MaximumPendingUploadBytes`, now also on the host options                                                                                         |
  | `RunicWindowsChangedEventArgs.Opened` (`bool`)                                                                             | `Change == RunicWindowsChange.Opened` (an open enum with `Opened`, `Closed`)                                                                      |
  | `RunicUpload.SaveAsAsync(path, overwrite)`                                                                                 | `RunicUpload.SaveToFileAsync(path, overwrite)`                                                                                                    |
  | `RunicServeOnlyTestPlatform.EnqueueOpenFile`, `EnqueueMessageBoxAnswer`, `EnqueueContextMenuChoice`, `SetClipboardText`, … | `platform.FileDialogs.EnqueueOpen`, `MessageBoxes.EnqueueAnswer`, `ContextMenus.EnqueueChoice`, `Clipboard.SetText`, …, as on `RunicTestPlatform` |

- **Experimental APIs** (`RUNICDESK103` to `RUNICDESK105`). Trusted component
  mode's npm side moved to `./experimental`: import `defineRunicComponent`,
  `connectComponentBridge` and the `RunicComponent*` types from
  `@runic-artifex/views/experimental`, and `runic` from
  `@runic-artifex/vite-plugin-runic/experimental` for
  `runic({ component })`; the `./component` entry is gone without an alias. In
  .NET, `RunicHostedDialogKind.OpenFolder(s)` became `OpenDirectory` and
  `OpenDirectories`, `RunicHostedWindow.Presentation` `DesktopWindow`, a
  region's `DetachAsync`, `MoveToAsync` and `SetAppearanceAsync` return
  `ValueTask`, a detach `Reason` is the open enum
  `RunicHostedRegionDetachReason`, the side panel refuses with
  `DesktopSidePanelRefusal.Closed` when the window closes during a call, and
  `RunicCloseDrain.KeepsWindow` became `KeepWindow`. See
  [hosted regions](../desktop/hosted-regions.md#show-a-guest-as-a-component).
- **Development format IDs are dotted.** The Bridge source map is
  `runic.views.bridge-sources/1` and `/__runic/handlers` answers
  `runic.vite.handlers/1`. A tool of your own that reads `sources.json` or
  `/__runic/sources` accepts the new name; the Runic extension for VS Code
  0.21.0 reads both.
- **Internal MSBuild names start with `_Runic`.** A project that ran its own
  target `BeforeTargets` or `AfterTargets` one of the twelve renamed targets
  and properties (such as `RunicDesktopValidateServer`) hooks onto an MSBuild
  target instead. The documented extension points `RunicViewsGenerateBridge`,
  `RunicViewsBuildFrontend` and `RunicViewsCopyFrontend` are unchanged.
- **WebView2's debugging endpoint opens only in Development.** Outside
  Development the WebView2 host removes
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, so a release opens no DevTools
  Protocol endpoint; run a build with `DOTNET_ENVIRONMENT=Development` to debug
  it that way. `DesktopWindowOptions.BrowserArguments` are not changed.
- **The development server admits fewer clients.** `/__runic/state` and
  `/__runic/diagnostics` answer only loopback and `RUNIC_DEV_ALLOW`, so a tool
  that read them from another machine needs it in the allow list; see
  [debugging](guides/debugging.md#runic-inspect).
- **Kept View clients follow their Bridge.** A client that a binding keeps for
  `keepAlive` is taken over only while it uses the Bridge it connected over:
  `installMockBridge` releases the previous Bridge's kept clients, and
  `releaseKeptViews()` from `@runic-artifex/views/mock` releases them in a
  suite that keeps one Bridge.
- **Linux capabilities count as elevated** for a hosted guest
  (`RUNICDESK103`); see [hosted applications](../desktop/hosted-applications.md#security).
- **SvelteKit security updates.** New SvelteKit apps get
  `@sveltejs/adapter-static` 4.0.1
  ([GHSA-jf9x-2fg2-hx4w](https://github.com/advisories/GHSA-jf9x-2fg2-hx4w))
  and `@sveltejs/kit` 3.1.1
  ([GHSA-mw6w-2fmv-pvw3](https://github.com/advisories/GHSA-mw6w-2fmv-pvw3)).
  The template's static output is not affected; move an existing app to them
  to keep `npm audit` quiet.

New in `0.21.0`, for development only: JavaScript debuggers on Linux through
`dotnet runic dev`'s CDP adapter (preview), `dotnet runic dev --browser` and
the `Window in Chrome` configuration, WebView2's Open DevTools and DevTools
extensions, the Runic DevTools extension (which `dotnet runic dev` loads into
the Window's WebView2 on Windows, and Chrome and Edge load unpacked), Runic state in
React DevTools and Vue DevTools, and custom object formatters; see
[debugging an application](guides/debugging.md). Also new:
`NavigationSelectionPath.ToJson()` and `FromJson`, and
`injectTextLocale()` and the field types in `@runic-artifex/angular`.

The
[0.21.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.21.0.md#upgrading-from-020)
list every change.

## Upgrading from 0.21 to 0.22

Update every Runic NuGet and npm package to `0.22.0` together
(`Runic.Application.Views.CsWebUi` to `0.22.0-preview.1`) and rebuild. The
generated TypeScript and the wire protocol are unchanged. Check these if they
apply:

- **Runic Translations 0.14; Command Line stays at 0.13.**
  `Runic.Application.Views.Translations` requires Translations
  `[0.14.0, 0.15.0)`, so move every Translations package, NuGet and npm, to
  `0.14.0`, and keep `Runic.Translations` and `Runic.Translations.Build` at the
  same version: catalogs that 0.14 generates need its runtime (RMF2 runtime ABI
  4). See [Upgrading to 0.14.0](../translations/README.md#upgrading-to-0140).
- **Load `runic-views.js`** (deprecated host-named copies). The host packages
  copy their Views client into `www/` as `runic-views.js` and, until 0.23, also
  as `runic-desktop-views.js` (Runic Desktop) or `runic-cswebui.js`
  (CS-WebUI). A page that loads the host-named copy still works in 0.22 but
  logs one console warning; 0.23 removes the copy, which saves 5 KB (Runic
  Desktop) or 21 KB (CS-WebUI) per publish. Load
  `<script src="runic-views.js"></script>` after `webui.js`, as the templates
  already do. A project that references more than one host, such as Runic
  Desktop and CS-WebUI, sets `RunicApplicationHost` (`desktop` or `cswebui`),
  or the build copies no `runic-views.js` (warning `RUNICBRIDGE019`). An
  application that keeps its own copy under the old name gets the same warning;
  rename it to `runic-views.js`.
- **The side panel and the close drain are stable.** Their `[Experimental]`
  attributes are gone and their API is supported like the rest of its package.
  Remove `RUNICDESK104` and `RUNICDESK105` from `<NoWarn>` and their
  `#pragma warning disable` lines (a leftover suppression is harmless), and
  import `onBridgeDraining` from `@runic-artifex/views`: the
  `@runic-artifex/views/experimental` import still works in 0.22, marked
  `@deprecated`, and 0.23 removes it. Hosted applications (`RUNICDESK103`) stay
  experimental.
- **A RID-specific publish ships only its own OS's platform code.** A
  `dotnet publish -r <rid>` for Windows, macOS or Linux, framework-dependent or
  self-contained without trimming, leaves the other operating systems'
  `Runic.Platform` assemblies out. Code that calls another operating system's
  `Runic.Platform` API from a method that also runs on this one gets
  `FileNotFoundException`; move the call into a method of its own or set
  `RunicPublishAllPlatformAssemblies`. See
  [shipping](../desktop/shipping.md#choose-the-publish-mode).
- **`RunicDesktopServer=None` turns the presentation server off**, also when
  the project references `Runic.Desktop.Kestrel`: a window then fails with
  `presentation-server-unavailable`. Build warning `RUNICDESK007` reports the
  combination; remove `RunicDesktopServer` to use the referenced server.
- **The asset archive format.** An archive with duplicate content is written as
  `runic.assets.archive/2`, which Runic.Assets 0.21 and earlier cannot read.
  An application that embeds an archive packed with 0.22 through
  `RunicAssetsEmbeddedArchive` needs Runic.Assets 0.22 too.
- **The `(WebView2 script debugging)` launch profile is gone** from the
  template: it did not work in Visual Studio 2026. Delete the entry with
  `"jsWebView2Debugging": true` from an existing project's
  `Properties/launchSettings.json`, and use Runic DevKit's Debug the Window in
  Visual Studio ([debugging](guides/debugging.md#visual-studio)). To add the
  template's new `.vsconfig` to an existing project, copy it from a new one
  into the directory of its solution.
- **The editor extensions are Runic DevKit.** In VS Code it is
  `runic-artifex.runic-devkit` (was `runic-artifex.runic`), on the VS Code
  Marketplace; the template's `.vscode/extensions.json` names the new ID. In
  Visual Studio 2026 it is `runic-artifex.runic-devkit-vs` (was Runic MF2
  Translations), on the Visual Studio Marketplace (Extensions → Manage
  Extensions, search for "Runic DevKit"). Both VSIX files are also on the
  [runic-editors 0.22.0 release](https://github.com/Runic-Artifex/runic-editors/releases/tag/v0.22.0).
  Uninstall the former extension.
- **CS-WebUI's loopback server is stricter** on Linux and macOS than .NET's
  `HttpListener`: it answers `400` to ambiguous body framing, bare CR or LF line
  ends, dot segments and repeated `Host`, `Origin` or upload headers, and
  bounds request heads, connections and idle time. The endpoint's URLs,
  responses and checks (Host, origin, upload token, loopback peers) are
  unchanged; Windows keeps http.sys.
- **Angular CLI starters** move `@angular/build` and `@angular/cli` to 22.2.7
  and no longer override `vite`. An existing Angular CLI project can remove its
  `vite` override (in `package.json`, and for pnpm in `pnpm-workspace.yaml`)
  after moving to `@angular/build` 22.2.5 or later.
- **`dotnet runic doctor`** accepts the npm 11 that Node 24 and 26 ship, from
  11.12.1, with a warning that names the certified npm 12.2.0. Its
  `compatibility-set` check now checks only the train's packages: runic-sdk's
  own, which must match exactly, and the Runic Command Line and Runic
  Translations packages, which warn when older than the train's or of another
  minor. Other packages whose IDs start with `Runic`, such as
  `RunicArtifex.DynamicData`, no longer fail it.

New in `0.22.0`: smaller NativeAOT executables (generated Bridges share their
codecs, getters and command runner, CS-WebUI's own loopback server on Linux and
macOS, fewer framework generics and features that an application does not use),
development-only views and members (`[RunicDevelopmentOnly]`) and the
smallest-executable settings in
[measure and tune](../desktop/size-and-tuning.md#making-the-executable-smaller),
single-file publishing of Views applications and the size of each publish mode
in [shipping](../desktop/shipping.md#choose-the-publish-mode), and for
development: Runic DevKit for Visual Studio, CS-WebUI pages in a JavaScript
debugger (`--debug-endpoint`, port 9225), absolute `vite dev` source maps,
`dotnet runic dev` stopping on its standard input (`RUNIC_DEV_STOP_ON_INPUT`),
and Visual Studio's F5 building after a frontend-only edit; see
[debugging an application](guides/debugging.md). Fixed: `dotnet runic dev`
starts npm and pnpm on Windows, page-relative URLs and the dock's icon under a
Vite or Angular development server, Runic Inspect's open-in-editor on Windows,
Edge fallback windows under a compatibility layer, and the Linux CDP adapter's
stops after a reload or restart.

The
[0.22.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.22.0.md#upgrading-from-021)
list every change, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-021-to-022)
collects them.

## Upgrading from 0.22 to 0.23

Update every Runic NuGet and npm package to `0.23.0` together
(`Runic.Application.Views.CsWebUi` to `0.23.0-preview.1`) and rebuild, so the
generated clients and Bridges are regenerated. Views protocol 4 is unchanged:
a 0.22 page and a 0.23 host still connect, and Bridges that 0.22's generator
wrote keep working with the 0.23 runtime. 0.23 is a consolidation release
before 1.0 and removes what 0.22 deprecated. Check these if they apply:

- **Removed: the host-named Views client scripts.** `runic-desktop-views.js`
  (Runic Desktop) and `runic-cswebui.js` (CS-WebUI), deprecated in 0.22, are
  gone: the host packages copy their Views client into `www/` only as
  `runic-views.js`, which saves 5 KB (Runic Desktop) or 21 KB (CS-WebUI) per
  publish. A page that still loads the old name gets a 404 for it and no
  Bridge, so its Views never connect; the build reports warning
  `RUNICBRIDGE019` naming the page. Load
  `<script src="runic-views.js"></script>` after `webui.js`, as the templates
  do. A project that references more than one host sets
  `RunicApplicationHost` (`desktop` or `cswebui`). A copy under the old name
  that the application keeps itself is served but not updated; rename it. A
  `www/` folder of an earlier build keeps the old copy until `dotnet clean`.
- **Removed: `onBridgeDraining` from `@runic-artifex/views/experimental`.**
  Import it from `@runic-artifex/views`, the same function; an import from
  `./experimental` now fails to compile or bundle.
- **Removed: the error tombstones of types removed in 0.9 and 0.13**, such as
  `RunicBridgeJsonIgnoreAttribute`, `IBridgeArguments`,
  `RunicReactiveSchedulerProvider` and `INativePickerOwner`. Code that still
  names one fails with `CS0246` instead of `CS0619`; the
  [migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#removed-types)
  names the replacements.
- **Removed: vite-plugin-runic's reader of the 0.20 source-map name**
  `runic-bridge-sources/1`. Only a 0.20 generator writes it; rebuilding with
  0.23 regenerates the map.
- **`dotnet runic dev --browser` has an address of its own for each run**,
  `http://<label>.localhost:9224/`, and admits one browser by a one-time code.
  `http://127.0.0.1:9224/` and `http://localhost:9224/` answer 403. In a
  `Window in Chrome` launch configuration generated before 0.23, replace
  `"url": "http://127.0.0.1:9224/"` with
  `"file": "${workspaceFolder}/obj/runic/dev-browser.html"`, as the template
  now does; a configuration that matches by URL (`urlFilter`) uses
  `http://*.localhost:9224/*`. The session file's `browser.url` is now a
  pattern; a reader opens `browser.codeFile` instead. The template's
  `Attach to the page (JavaScript)` configuration names
  `"address": "127.0.0.1"`; add it to one generated earlier. See
  [the page in Chrome](guides/debugging.md#the-page-in-chrome-dotnet-runic-dev---browser).
- **Runic Translations 0.15.1 and Runic Command Line 0.14.**
  `Runic.Application.Views.Translations` requires Translations
  `[0.15.1, 0.16.0)`, so move every Translations package, NuGet and npm, to
  `0.15.1`, and keep `Runic.Translations` and `Runic.Translations.Build` at
  the same version: Runic's own catalog is generated for RMF2 runtime ABI 5.
  Translations 0.15.1 fixes how external and overlay packs are loaded;
  generated ESM carries its own runtime, so an application with ESM output
  regenerates it with 0.15.1 (a build with the 0.15.1 Vite plugin or tool does
  that). An application that uses Command Line itself moves to `0.14.0`, which
  `Runic.Translations.CommandLine` 0.15 requires. See
  [Upgrading to 0.15.1](../translations/README.md#upgrading-to-0151) and
  [Command Line 0.14.0](../command-line/README.md#new-in-0140).
- **The application icon** (#1207). When `icons/icon.png` (or the file
  `RunicPackageIcon` names) exists and the project sets no `ApplicationIcon`,
  the build derives the Windows executable's icon from it, and Runic Desktop
  windows without `IconFile` show it on Windows and on macOS outside a bundle.
  An icon that is not a square PNG of at least 256 px is warning
  `RUNICICON001` to `RUNICICON003`, which fails a build that treats warnings
  as errors: replace the icon or set
  `RunicApplicationIconGenerationEnabled=false`. A project from an earlier
  template can delete `icons/icon.ico` and its `ApplicationIcon` line. See
  [the application icon](../desktop/shipping.md#the-application-icon).
- **Bridge blobs leave a trimmed publish that does not use them.** A trimmed
  or NativeAOT publish in which no Bridge holds a `RunicBlob` or takes a
  `RunicUpload` turns `blobs/1` off, so `client.upload` rejects with
  `unavailable`. Set `<RunicBridgeBlobs>true</RunicBridgeBlobs>` when only
  reflection reaches a `RunicBlob`. `RunicBridgeBlobs` and
  `RunicDevelopmentOnlyViews` warn on a value other than `auto` or `true`
  (`RUNICBRIDGE075`). See
  [measure and tune](../desktop/size-and-tuning.md#making-the-executable-smaller).
- **Questions longer than ten minutes.** Rebuild the frontend with 0.23: a
  page built with `@runic-artifex/views` before 0.23 aborts an interaction's
  handler after ten minutes, whatever its lifetime.
- **Runic's editor extensions.** Update Runic DevKit to 0.23.0 once it is
  published; it needs `dotnet-runic` 0.23 for frontend errors in the error
  list.

New in `0.23.0`:

- **For application code:** an interaction's lifetime with
  `[RunicInteractionTimeout]`, including questions without a deadline
  ([prompts](samples/prompts.md#how-long-the-page-has-to-answer)); operation
  progress through an `IProgress<double>` parameter
  ([operations](guides/operations-and-cancellation.md#report-progress)); drops
  onto the side panel, with `InSidePanel`
  ([desktop services](../desktop-services.md#more-platform-services)); a menu
  bar item that opens the developer tools, now also WebKit's Web Inspector on
  Linux, which the template declares as View ▸ Developer Tools
  ([debugging](guides/debugging.md#the-browsers-developer-tools-per-engine));
  and the application icon from one source.
- **CS-WebUI (preview) catches up with Runic Desktop** in `UseWebView` windows
  on Windows and Linux: a guarded Window keeps its window open while the guard
  decides, the close drain, window placement
  (`RunicCsWebUiHostOptions.Placement`), its own 404, 500 and connection pages
  in the application's language, and a working Development DevTools Protocol
  endpoint in its browser windows
  ([closing a window](../desktop/window-close-lifecycle.md#cs-webui-preview),
  [debugging](guides/debugging.md#cs-webui-pages-in-a-javascript-debugger)).
- **`Runic.Spelling` (preview, `0.23.0-preview.1`):** the application's own
  spell checker, which checks each text in its own language, with English
  bundled and other languages downloaded on request
  ([spell checking](../desktop-services.md#the-applications-own-checker-runicspelling-preview)).
- **Smaller trimmed publishes:** Bridge blobs and uploads are left out where
  no Bridge uses them, 365 KB of the size fixture's CS-WebUI application on
  linux-x64, and a NativeAOT application on the native server no longer loads
  ICU before its first page.
- **For development:** `dotnet runic dev --browser` at an address of its own
  for each run, frontend compile errors in the IDE's error list (`RUNICP008`),
  JavaScript debugging of the WebKitGTK Window out of preview, `dev` no
  longer leaving the development server running on Windows, and the template's
  VS Code tasks finding the file of a build error; see
  [debugging an application](guides/debugging.md).
- **Fixed:** on WebView2, screen-reader announcements are spoken and typed keys
  reach the page after a screen reader presses a button in the page, also in a
  WPF window ([screen-reader announcements](../desktop-services.md#screen-reader-announcements)).
  0.23 also hardens the development tools and the new spelling package; see
  the
  [security guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/security.md#development-server).

The
[0.23.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/eng/release/notes/0.23.0.md#upgrading-from-022)
list every change, and the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.23.0/docs/migration-1.0.md#from-022-to-023)
collects them.
