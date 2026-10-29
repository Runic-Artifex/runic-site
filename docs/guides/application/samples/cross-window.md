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

The [multi-window example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.13.0/examples/multi-window)
opens its first Window from the host callback. The application ends when that
Window closes:

```csharp docs-test=source:examples/multi-window/Program.cs
return RunicDesktopHost.Run(provider, async host =>
{
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
[multi-window example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.13.0/examples/multi-window).

```csharp docs-test=source:examples/multi-window/ProjectServices.cs
// IRunicWindowService, which ProjectViewModel uses to open more Windows.
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
- Runic has no owned or modal Windows, so there is no owner parameter. The new
  Window's ViewModel is resolved from DI like the first one's; to give it
  input, let it read a singleton service, as this example does with the shared
  project.

In a test, register a fake after the application's services. The example's
fake records the requested Window types and opens nothing:

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
    IRunicWindowService windows, IRunicModelContext context)
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

## Next steps

- [ViewModel state and threads](../guides/model-context.md) states the
  threading rule and the model-context API.
- [App settings and desktop preferences](settings.md) uses a shared settings
  store.
- [Translations in ViewModels](../guides/model-context.md#translations-in-viewmodels)
  applies the same pattern to locale changes.
