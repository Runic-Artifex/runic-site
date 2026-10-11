# Update every Window from a shared service

When a change in one Window must show in the others, put the shared data in a
singleton service. Each Window's ViewModel subscribes to it and applies changes
on its own model context.

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

Open as many Windows as you need from the host callback. Each `await using`
disposes its Window, and with it the Window's scope and ViewModels, when the
callback ends:

```csharp docs-test=skip:missing-sdk-example
return RunicDesktopHost.Run(provider, async host =>
{
    await using var first = await host.OpenWindowAsync<ProjectWindow>();
    await using var second = await host.OpenWindowAsync<ProjectWindow>();
    await Task.WhenAll(first.WaitForCloseAsync().AsTask(), second.WaitForCloseAsync().AsTask());
    return 0;
});
```

The host is passed to this callback; it isn't registered in the container, so
a ViewModel can't open a Window by itself. To open Windows on demand, keep the
callback running and let a singleton service ask it to open one.

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

```csharp docs-test=skip:missing-sdk-example
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

```csharp docs-test=skip:missing-sdk-example
public sealed partial class ProjectViewModel : ObservableObject, IDisposable
{
    private readonly ProjectService _project;
    private readonly IRunicModelContext _context;

    public ProjectViewModel(ProjectService project, IRunicModelContext context)
    {
        _project = project;
        _context = context;
        _title = project.Title;
        _project.Renamed += OnRenamed;
    }

    [ObservableProperty] private string _title;

    [RelayCommand]
    private void Rename(string title) => _project.Rename(title);

    // Raised on the renaming Window's thread: apply it in this Window's turn.
    private void OnRenamed(object? sender, EventArgs e) => _context.TryPost(() => Title = _project.Title);

    public void Dispose() => _project.Renamed -= OnRenamed;
}
```

The registration follows the same pattern as the DynamicData example:

```csharp docs-test=skip:missing-sdk-example
services.AddSingleton<ProjectService>();
services.AddScoped<ProjectViewModel>();
```

The Window that renamed the project also gets the event and posts its own
update; that is harmless, and it keeps every Window on the same path. With
ReactiveUI the ViewModel is the same, with a property that calls
`this.RaiseAndSetIfChanged` and a `ReactiveCommand` for `Rename`.
CommunityToolkit.Mvvm apps without navigation register the model context
themselves, as
[ViewModel state and threads](../guides/model-context.md#injecting-the-model-context)
describes.

## Observable streams

When the shared service exposes an observable, as a DynamicData `SourceCache`
does, move the stream onto the model context with `ObserveOn` instead of
posting. `RunicReactiveSchedulerProvider` turns the Window's context into a
sequencer:

```csharp docs-test=source:examples/dynamicdata/RowsViewModel.cs
public RowsViewModel(RowStore store, IRunicModelContext context)
    : this(store, new RunicReactiveSchedulerProvider().For(context), 30)
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
