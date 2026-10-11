# ViewModel state and threads

A desktop UI framework runs ViewModel code on its UI thread. Runic has no UI
thread in .NET: the frontend runs in a WebView or a browser. Instead, each
Window's ViewModels belong to its **model context**, an `IRunicModelContext`
that runs their changes one at a time, in short units of work called
**turns**. The Bridge reads state, applies property writes from the frontend
and starts commands in turns, so ViewModels need no locks. This guide explains
what that means for command code, for work that leaves the context, and for
events from other services such as translations. The
[glossary](../glossary.md) defines both terms.

## The rule

The rule is the same for ReactiveUI and CommunityToolkit.Mvvm, and on every
host:

> **Set ViewModel state directly in a command, also after `await`. Leave the
> model context only for work that doesn't touch ViewModel state, and commit
> its result with `IRunicModelContext.InvokeAsync`.**

A command body that the Bridge starts runs in a turn, and every `await` in it
resumes in a later turn of the same context, as code on a UI thread resumes on
that thread. No other turn runs between two awaits of one body, and writes
after `await` are applied in the order in which their continuations become
ready.

With ReactiveUI, a `ReactiveCommand.CreateFromTask` body reads and sets state
around its `await`:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
private async Task SaveAsync(CancellationToken token)
{
    // The bridge starts the body in a model-context turn, and every await
    // resumes in that context, so the body reads and sets state directly.
    var title = Title;
    if (string.IsNullOrWhiteSpace(title)) throw new RunicFailureException(new TitleRequired());
    if (title.Length > MaximumTitleLength) throw new RunicFailureException(new TitleTooLong(MaximumTitleLength));
    await Task.Delay(120, token);
    SavedMessage = $"Saved {title}";
}
```

With CommunityToolkit.Mvvm, a `[RelayCommand]` method does the same:

```csharp docs-test=source:examples/notes-view-first/ViewModels.cs
[RelayCommand, RunicFailure(typeof(SaveFailure))]
private async Task SaveAsync(CancellationToken token)
{
    // ...
    var body = Body;
    await storage.SaveAsync(title, body, token);
    _savedTitle = title;
    _savedBody = body;
    IsDirty = Title != title || Body != body;
    SavedMessage = $"Saved {title}";
    library.Record(title, body);
}
```

With ReactiveUI, register the model context with
`AddRunicReactiveModelContext()`, as the template does. It also makes every
`ReactiveCommand` deliver its results and `IsExecuting` on the Window's model
context, so commands need no scheduler argument:

```csharp docs-test=template:WorkspaceServices.cs
services.AddRunicReactiveModelContext();
```

## Leaving the context

Code after `ConfigureAwait(false)`, in `Task.Run`, in a timer or in another
service's callback runs outside the context. Do CPU-bound or blocking work
there, then commit its result in a turn with `InvokeAsync`. This command marks
itself active, waits outside the context, and commits each change back:

```csharp docs-test=source:tests/fixtures/application/operations-consumer/OperationsViewModel.cs
await _context.InvokeAsync(() => LongActive = true);
try
{
    await Task.Delay(Timeout.InfiniteTimeSpan, cancellation.Token).ConfigureAwait(false);
    return "finished";
}
finally
{
    _longCancellation = null;
    await _context.InvokeAsync(() => LongActive = false);
}
```

- Don't use `ConfigureAwait(false)` in ViewModel code that sets state after
  it. Library code that a ViewModel awaits may use it freely: the ViewModel's
  own `await` still resumes in the context.
- `InvokeAsync(action)` runs the action in a turn and completes when it has
  run. `InvokeAsync(func)` returns the function's result. `TryPost(action)`
  queues the action without waiting, and returns `false` when the context no
  longer accepts work, for example because the Window closed. Keep each action
  short and synchronous. `IsExecuting` tells whether
  the current code runs in a turn of this context.
- Code that you start outside a turn, such as a test that calls a command
  directly, also commits with `InvokeAsync`.
- Don't block a turn on asynchronous work with `.Result`, `.Wait()` or
  `GetAwaiter().GetResult()`. Its continuation needs the same context, so it
  deadlocks, as it would on a UI thread.
- When the context closes, pending continuations run on the thread pool
  outside any turn. The command still finishes, but nothing presents its later
  writes.
- Navigation hooks, such as departure guards and initialize hooks, are not
  commands: they run outside turns. See
  [pages and navigation](pages-and-navigation.md).

## Injecting the model context

ViewModels that commit work take `IRunicModelContext` in their constructor.
The hosts give each Window the context registered in its DI scope, and create
one of their own when none is registered:

- With ReactiveUI, `AddRunicReactiveModelContext()` registers a scoped
  `RunicModelContext`.
- With navigation, `AddRunicNavigation()` registers one too.
- A CommunityToolkit.Mvvm app without navigation registers it itself, with
  `services.AddScoped<IRunicModelContext, RunicModelContext>()` from the
  `Runic.Navigation` namespace, before its ViewModels.

`AddRunicReactiveModelContext()` and `AddRunicNavigation()` use `TryAdd`, so
together they register one context per Window scope, and they keep one you
registered before them. The model context types are stable API; only the navigation types are
experimental.

## Translations in ViewModels

[Runic Translations](https://github.com/Runic-Artifex/runic-translations-sdk)
generates a typed text class, such as `AppText`, from your catalog. Each of
its members reads the active locale when it is read, so a ViewModel property
that returns translated text is always current. The ViewModel only needs to
tell the frontend that the text changed when the locale changes.

Register the translation manager and the text class as singletons, so every
Window shares one locale. `AppTextCatalog.CreateManager()` loads the embedded
catalog synchronously, without I/O:

```csharp docs-test=skip:translations-repository
services.AddSingleton<ITranslationManager>(_ => AppTextCatalog.CreateManager());
services.AddSingleton(provider => new AppText(provider.GetRequiredService<ITranslationManager>()));
```

`ITranslationManager.LocaleChanged` is raised on the thread that completed the
switch, which is usually a thread-pool thread, not the model context. A
ViewModel therefore raises its change notification in a turn with `TryPost`:

```csharp docs-test=skip:translations-repository
public sealed class WelcomeViewModel : ReactiveObject, IDisposable
{
    private readonly ITranslationManager _translations;
    private readonly IRunicModelContext _context;
    private readonly AppText _text;

    public WelcomeViewModel(ITranslationManager translations, AppText text, IRunicModelContext context)
    {
        _translations = translations;
        _text = text;
        _context = context;
        _translations.LocaleChanged += OnLocaleChanged;
    }

    public string Greeting => _text.Messages.welcome_greeting;

    // Raised off the model context: notify the frontend in a turn.
    private void OnLocaleChanged(object? sender, TranslationLocaleChangedEventArgs e) =>
        _context.TryPost(() => this.RaisePropertyChanged(nameof(Greeting)));

    public void Dispose() => _translations.LocaleChanged -= OnLocaleChanged;
}
```

With CommunityToolkit.Mvvm, call `OnPropertyChanged(nameof(Greeting))` in the
posted action instead. A command that switches the locale awaits
`SetLocaleAsync` like any other work and needs nothing more: the event, not
the command, refreshes the text. `CreateManager()` is newer than Runic
Translations 0.6.0-preview.5; with that release, create the manager with
`await AppTextCatalog.CreateManagerAsync()` before building the service
provider and register the instance.

## Next steps

- [Operations and cancellation](operations-and-cancellation.md) covers
  long-running commands, progress and cancellation.
- The
  [threading rule](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views/README.md#threading-state-after-await)
  and
  [model-context scheduling](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views.ReactiveUI/README.md#model-context-scheduling)
  in the SDK guides cover the details, including WPF's dispatcher context.
