# Update every Window from a shared service

When a change in one Window must show in the others, put the shared data in a
singleton service. Each Window's ViewModel subscribes to it and applies changes
on its own model context. A ViewModel can also open another Window, with
`IRunicWindowService`.

## Each Window has its own scope

`host.OpenWindowAsync<TWindow>()` resolves the Window's root ViewModel in a new
DI scope. Scoped services, including the model context, therefore exist once
per Window, and two Windows never share a ViewModel. A singleton exists once
for the application, so it is the place for data that every Window shows.

The DynamicData example registers its row store this way. The store is a
singleton; the ViewModel is scoped, so each Window gets its own:

```csharp docs-test=source:examples/dynamicdata/Program.cs
services.AddRunicReactiveModelContext();
services.AddSingleton<RowStore>();
services.AddScoped<RowsViewModel>();
```

The [multi-window example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.18.0/examples/multi-window)
opens its first Window from the host callback. The application ends when that
Window closes. Before it opens the Window, the example applies the app's theme
to every Window with `host.Desktop.SetColorSchemeAsync`, see
[Light and dark at run time](settings.md#light-and-dark-at-run-time), and
starts in the application's language, see
[The application's language](../guides/languages.md):

```csharp docs-test=source:examples/multi-window/Program.cs
return RunicDesktopHost.Run(provider, async host =>
{
    // The theme is the application's: every Window shows it, the page's prefers-color-scheme follows, and a new choice
    // switches the open Windows at once. "system" (NoPreference) follows the desktop.
    var settings = provider.GetRequiredService<SettingsStore>();
    await host.Desktop.SetColorSchemeAsync(settings.Load().ColorScheme);
    settings.Saved += (_, saved) => _ = host.Desktop.SetColorSchemeAsync(saved.ColorScheme).AsTask();
    // ...
    await provider.StartLanguageAsync(Environment.GetEnvironmentVariable("RUNIC_LOCALE"));
    SetMenuBar();
    // The first Window. Its ViewModel opens more with IRunicWindowService; the application ends when this one closes.
    await using var window = await host.OpenWindowAsync<ProjectWindow>(new RunicWindowOptions { Width = 640, Height = 420 });
    await window.WaitForCloseAsync();
    return 0;
});
```

## Open a Window from a ViewModel

The host is passed only to that callback; it isn't registered in the
container. To open Windows from a command or a service, register
`IRunicWindowService` with `AddRunicWindowService()`. It is new in SDK
`0.7.0-preview.7`, as is the
[multi-window example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.18.0/examples/multi-window).

```csharp docs-test=source:examples/multi-window/ProjectServices.cs
// IRunicWindowService, which ProjectViewModel uses to open more Windows, find open documents and ask for an account.
// It also registers IRunicApplicationLocale, the application's language.
services.AddRunicWindowService();
```

A ViewModel takes it in its constructor and opens a Window from a command:

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
// Opens another Window on the same project, in its own scope. The service releases it when it closes.
NewWindowCommand = ReactiveCommand.CreateFromTask(async token =>
{
    await windows.OpenWindowAsync<ProjectWindow>(cancellationToken: token);
});
```

- `OpenWindowAsync<TWindow>()` takes the same options and runs the same checks
  as the host's, and opens the Window in its own DI scope on the host that runs
  the application, Runic Desktop or CS-WebUI.
- The service is a singleton, so ViewModels of every Window and singleton
  services can take it. It works from the first Window's ViewModel
  constructor on; before any Window has opened it throws
  `InvalidOperationException`.
- It releases each Window it opened, with its scope and ViewModels, once the
  Window closes, so the command doesn't keep it. Keep the returned Window only
  to wait for it or to close it with `RequestCloseAsync()`.
- The new Window's ViewModel is resolved from DI like the first one's. State
  that every Window shares stays in a singleton service, as this example does
  with the shared project. Since SDK `0.16.0` a Window can belong to another;
  see [Owned and window-modal Windows](#owned-and-window-modal-windows).
- Since SDK `0.14.0`, a Window can get input of its own:
  `OpenWindowAsync<TWindow, TParameter>(parameter, options)`, on the service
  and on the host, hands the value to the new Window's scope, where its
  ViewModel takes `IRunicWindowParameter<TParameter>` in its constructor. Each
  Window gets its own, also when several open at once, which replaces a
  hand-off through a shared service guarded by a semaphore.
  `AddRunicWindowService()` registers it; without it the open fails with
  `window-parameter-not-registered`. A test that builds such a ViewModel passes
  `new RunicWindowParameter<TParameter>(value)`:

  ```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
  await windows.OpenWindowAsync<PartWindow, PartRequest>(new PartRequest(world, WindowedPart.Atlas));

  public sealed class PartViewModel(IRunicWindowParameter<PartRequest> request) : ReactiveObject
  {
      public WorldViewModel World { get; } = request.Value.World;
  }
  ```

- Since SDK `0.14.0`, code that holds only the host-neutral `IRunicWindowHost`
  opens a Window for a launch with its activation context,
  `host.OpenWindowAsync<TWindow>(options, activation)`, instead of casting to
  `RunicDesktopHost`; hosts other than Runic Desktop ignore the context.

In a test, register a fake after the application's services. The example's
fake records the requested Window types and opens nothing; the parameter
overload, and the members added in SDK `0.16.0` below, have default
implementations that throw `NotSupportedException`, so a fake or an
implementation of your own overrides them only when the application uses them.
Since `0.16.0` a test can also open real Windows headless with
`RunicWindowTestHost.CreateWindowAsync<TWindow>(services)`; see
[Real Windows in tests](../guides/frontend-testing.md#real-windows-in-tests).

```csharp docs-test=source:examples/multi-window/Tests/ProjectWindowTests.cs
// The window service's test double: it records the requested Window and opens nothing.
private sealed class RecordingWindowService : IRunicWindowService
{
    public List<Type> Opened { get; } = [];

    public ValueTask<TWindow> OpenWindowAsync<TWindow>(RunicWindowOptions? options = null, CancellationToken cancellationToken = default)
        where TWindow : class, IRunicWindow, new()
    {
        Opened.Add(typeof(TWindow));
        return ValueTask.FromResult(new TWindow());
    }
}
```

## Find or open a Window

Since SDK `0.16.0`, `IRunicWindowService` also manages the open Windows.
`FindOrOpenAsync<TWindow, TParameter>(key, parameter)` brings the `TWindow`
with that key to the front, or opens a new one with the key and parameter. So
"open this document" focuses the document's Window when it is open already,
without a dictionary of open Windows of your own. The example keys a document
Window by its path:

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
// Opens the document in a Window of its own, or brings the one already open for that path to the front.
OpenDocumentCommand = ReactiveCommand.CreateFromTask<string>(async (path, token) =>
{
    await windows.FindOrOpenAsync<DocumentWindow, DocumentRequest>(path, new DocumentRequest(path),
        new RunicWindowOptions { StartPage = "document.html", Width = 480, Height = 320 }, cancellationToken: token);
});
```

- The key belongs to the Window type and is compared with `Equals`. Two calls
  with the same key at once open one Window. A Window whose close has started
  is never found, so the next call opens a new one. `FindWindow<TWindow>(key)`
  only looks it up.
- `ActivateAsync(window)` shows a hidden Window, restores a minimized one and
  focuses it. When a window-modal Window blocks it, that Window comes forward
  too.
- `Windows` lists the open Windows in the order they opened. `WindowsChanged`
  reports each open and close on a thread-pool thread, not in a model context,
  so a ViewModel posts what it does to its own context. `ObserveWindows()`
  returns the list as a plain `IObservable`, without System.Reactive, and
  `ObserveWindows(context)` delivers each list in a turn of `context`. A
  handler that throws is logged as event 1181.

## A Window for a result

`OpenForResultAsync<TWindow, TParameter, TResult>(parameter, options)`, new in
`0.16.0`, opens a Window and returns its result once it closed. The example's
account chooser is a dialog over the Window that opens it:

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
// A dialog over this Window: it blocks this Window until it closes, and returns the account chosen, if any.
ChooseAccountCommand = ReactiveCommand.CreateFromTask(async token =>
{
    var chosen = await windows.OpenForResultAsync<AccountWindow, AccountRequest, string>(new AccountRequest(Account),
        new RunicWindowOptions
        {
            StartPage = "account.html",
            Width = 360,
            Height = 280,
            Owner = window.Window,
            Modality = RunicWindowModality.Window,
        }, token);
    if (chosen.TryGetValue(out var account)) Account = account;
});
```

The dialog's ViewModel takes `IRunicWindowResult<TResult>` and calls
`CompleteAsync(value)`, which sets the result and closes the Window without
asking its close guard. In CommunityToolkit.Mvvm form, from the
Runic.Application.Views README:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
public sealed partial class AccountViewModel(IRunicWindowResult<string> result) : ObservableObject
{
    [RelayCommand]
    private async Task ChooseAsync(string account) => await result.CompleteAsync(account);
}
```

- A Window that closes without a result, by the user or the application,
  returns a result whose `HasValue` is `false`.
- Cancelling the opener's token closes the Window without asking and throws
  `OperationCanceledException`.
- The example's
  [AccountWindow.cs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/examples/multi-window/AccountWindow.cs)
  also has a Cancel command, which closes the Window with
  `IRunicWindowContext.RequestCloseAsync`.

## Owned and window-modal Windows

Since SDK `0.16.0`, `RunicWindowOptions.Owner` names the open Window that a
new Window belongs to, and `Modality = RunicWindowModality.Window` makes the
owner take no input until the new Window closes. A window-modal Window needs an
owner; the application's other Windows stay usable. A ViewModel names its own
Window with `IRunicWindowContext.Window`, as the account chooser above does.

- **Windows:** the owner's `HWND` owns the window, which stays above it and has
  no taskbar button. A window-modal one disables its owner with `EnableWindow`.
  In WPF, `WpfPlatformServices.ForDesktopWindowOwner(window)` gives a Runic
  Desktop window a WPF owner.
- **macOS:** an owned window is a child window of the owner's `NSWindow`, and a
  window-modal one is a sheet. A sheet has no title-bar close button, and Esc
  does not close it, so give its page a Cancel button. AppKit shows one sheet
  of an owner at a time.
- **Linux (GTK 3 and GTK 4):** the window is transient for its owner, and a
  window-modal one makes the owner insensitive while it is shown.
- **CS-WebUI**, serve-only mode and a browser fallback open the Window on its
  own and log event 1180 `WindowOwnerIgnored`.

An owned Window hides and shows with its owner, and closes when its owner
closes. A guarded owner asks its owned Windows before it closes; see
[Owned Windows](../../desktop/window-close-lifecycle.md#owned-windows). The
[Runic.Application.Views README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/packages/dotnet/Runic.Application.Views/README.md#owned-and-window-modal-windows)
has the full platform table.

## The threading rule across Windows

Each Window has its own model context. A context runs one turn at a time, but
nothing orders the turns of two different contexts: a command in the first
Window and a command in the second Window can run at the same moment on two
threads. So:

- **The shared service must be thread-safe.** Guard its state with a lock or
  use immutable snapshots.
- **A change arrives on the thread of the Window that made it.** A ViewModel
  that hears about it is outside its own model context and must not set its
  state directly. It commits the change in a turn of its own context, as the
  [threading rule](../guides/model-context.md#the-rule) requires.

## A shared service with an event

This sample keeps a project title that any Window can rename. The service
guards its state and raises an event after each change:

```csharp docs-test=source:examples/multi-window/ProjectService.cs
public sealed class ProjectService
{
    private readonly Lock _gate = new();
    private string _title = "Untitled";

    public event EventHandler? Renamed;

    public string Title { get { lock (_gate) return _title; } }

    public void Rename(string title)
    {
        lock (_gate) _title = title;
        Renamed?.Invoke(this, EventArgs.Empty);
    }
}
```

Each Window's ViewModel takes the service and its own `IRunicModelContext`.
Its event handler posts the change into a turn with `TryPost`; it reads the
current title inside the turn, so the last rename always wins. Unsubscribe
when the Window's scope disposes the ViewModel, because the singleton outlives
it:

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
public ProjectViewModel(ProjectService project, SettingsStore settings, IDesktopSettings desktop,
    IRunicWindowService windows, IRunicWindowContext window, IRunicModelContext context,
    IRunicApplicationLocale application, IRunicWindowLocale locale, TranslationContext translations)
{
    _project = project;
    _context = context;
    _title = project.Title;
    // ...
    _project.Renamed += OnRenamed;
    // ...
}

public string Title { get => _title; private set => this.RaiseAndSetIfChanged(ref _title, value); }
// ...
// Raised on the renaming Window's thread: apply it in this Window's turn.
private void OnRenamed(object? sender, EventArgs e) => _context.TryPost(() => Title = _project.Title);
// ...
public void Dispose()
{
    _project.Renamed -= OnRenamed;
    // ...
}
```

The registration follows the same pattern as the DynamicData example. The
model context and the ViewModel are scoped, so each Window has its own:

```csharp docs-test=source:examples/multi-window/ProjectServices.cs
// Once for the application: every Window reads and writes the same project and settings file.
services.AddSingleton<ProjectService>();
services.AddSingleton(new SettingsStore(SettingsStore.DefaultPath));
// Once per Window: each Window's scope has its own model context and ViewModel. ReactiveUI commands
// deliver their notifications on the model context of the Window that runs them.
services.AddRunicReactiveModelContext();
// ...
services.AddScoped<ProjectViewModel>();
```

The Window that renamed the project also gets the event and posts its own
update; that is harmless, and it keeps every Window on the same path. The
example's test renames in one Window and reads the title in the other after a
turn of its context:

```csharp docs-test=source:examples/multi-window/Tests/ProjectWindowTests.cs
(await _first.Root.ExecuteAsync(vm => vm.RenameCommand, "\"Atlas\"")).ThrowIfFailed();

// The rename posted a turn to the second Window's model context; a turn after it sees the new title.
await _secondScope.ServiceProvider.GetRequiredService<IRunicModelContext>().InvokeAsync(static () => { });
await Assert.That(_second.Root.Snapshot().Read(vm => vm.Title)).IsEqualTo("Atlas");
```

With CommunityToolkit.Mvvm the ViewModel is the same, with an
`[ObservableProperty]` for the title and a `[RelayCommand]` for `Rename`.
CommunityToolkit.Mvvm apps without navigation register the model context
themselves, as
[ViewModel state and threads](../guides/model-context.md#injecting-the-model-context)
describes.

## Observable streams

When the shared service exposes an observable, as a DynamicData `SourceCache`
does, move the stream onto the model context with `ObserveOn` instead of
posting. `ReactiveSchedulers.For` turns the Window's context into a
sequencer:

```csharp docs-test=source:examples/dynamicdata/RowsViewModel.cs
public RowsViewModel(RowStore store, IRunicModelContext context)
    : this(store, ReactiveSchedulers.For(context), 30)
{
}
```

Each Window's ViewModel connects to the shared cache and observes on its own
sequencer, so every Window gets its own sorted, virtualized view of the same
rows:

```csharp docs-test=source:examples/dynamicdata/RowsViewModel.cs
var changes = store.Source.Connect()
    .SortAndVirtualize(Comparer<Row>.Create((left, right) => left.Id.CompareTo(right.Id)), _requests)
    .ObserveOn(sequencer);
```

[DynamicData collections](../guides/dynamicdata.md) explains the rest of
this binding.

## Who is connected

A Window's page can be open more than once: a CS-WebUI window with WebUI's
`MultiClient` configuration is shared by every browser that reaches it, and a
page gets a new connection when it reloads. `IRunicConnections`, new in
`0.16.0` and registered per Window by `AddRunicWindowService()`, shows a
ViewModel these connections:

- `Current` lists them, each a `RunicConnection(ConnectionKey, ClientKey)`.
  Compare and store the keys, but don't parse them or show them to users.
- `Connected` and `Disconnected` are raised in a turn of the Window's model
  context, so a handler may change state. A handler that throws is logged as
  event 1230.
- `Caller` is the connection whose command, operation or in-page menu click
  runs now. It is `null` elsewhere, such as in a native menu-bar command.
- `WhenChanged()` gives ReactiveUI an observable of the list.
- `RunicConnectionState<T>` keeps a value per connection, such as a draft, and
  drops it when the page disconnects:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
// In a ViewModel whose primary constructor takes IRunicConnections connections:
private readonly RunicConnectionState<Draft> _drafts = new(connections, _ => new Draft());

[RelayCommand]
private void Type(string text)
{
    if (_drafts.TryGetCaller(out var draft)) draft.Text = text;
}
```

The keys come from the transport, never from the page, are never reused within
a Window, and cannot be set by application code. They tell pages apart; they
are not user identity, so a `MultiClient` window still needs your own sign-in.
A Runic Desktop window has one page connection, and a new one after each
reload. A WPF `RunicViewHost` has no Window scope and reports none.

In a test, `host.Root.ForConnection("bob-tab", clientKey: "bob")` drives the
Window as a second page, `RunicViewDriver.Connection` is a driver's
connection, and `host.Connections` lists them; see
[Several pages of one window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/packages/dotnet/Runic.Application.Testing/README.md#several-pages-of-one-window).

**Security fix for CS-WebUI in `0.16.0`.** Before, a page that reloaded, or
another browser that connected right after a page left, could take over the
closed page's connection, so a command still running for it could send its
questions and pushes to the new page. Full protection needs a 0.16 page and a
0.16 host: update the Runic NuGet and npm packages together, and replace any
copy of `runic-cswebui.js` that the application keeps outside `www/`; see the
[release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/eng/release/notes/0.16.0.md#security-connection-keys-on-cs-webui).

**Security fix for CS-WebUI in `0.17.0`.** A CS-WebUI window's page server and
its blob endpoint did not hold both loopback addresses that `localhost` names,
so another process on the same computer could listen on the other one and
receive or serve the window's page, blobs and uploads. Update to
`Runic.Application.Views.CsWebUi` `0.17.0-preview.1`, which requires CsWebUi
2.5.0-beta.4.9; applications need no code changes. See the advisories
[GHSA-vhx5-crr3-7pv5](https://github.com/Runic-Artifex/runic-sdk/security/advisories/GHSA-vhx5-crr3-7pv5)
and
[GHSA-9p7m-x6rx-97qh](https://github.com/Runic-Artifex/cs-webui/security/advisories/GHSA-9p7m-x6rx-97qh),
and the
[release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/eng/release/notes/0.17.0.md#security-cs-webui-blob-endpoint).

## Next steps

- [ViewModel state and threads](../guides/model-context.md) states the
  threading rule and the model-context API.
- [App settings and desktop preferences](settings.md) uses a shared settings
  store.
- [Translations in ViewModels](../guides/model-context.md#translations-in-viewmodels)
  applies the same pattern to locale changes.
