# Pages and navigation

A Window changes pages the way any MVVM application does: a ViewModel property
holds the current page's ViewModel, and the View renders whatever that property
holds. This guide starts with that plain property, which the template uses,
then moves to navigation regions, which add Back history, guards against
leaving with unsaved changes and per-visit pages. The examples use ReactiveUI,
the default; [CommunityToolkit.Mvvm](#with-communitytoolkitmvvm) follows the
same model with its own commands. Words such as region and entry are defined in
the [glossary](../glossary.md).

## A page property

The template's Window ViewModel keeps its page in `Main`, typed as an interface
that every page implements. A command assigns another page:

```csharp docs-test=template:WorkspaceViewModel.cs
public WorkspaceViewModel(WelcomeViewModel welcome, CounterViewModel counter)
{
    _main = welcome;
    ShowWelcomeCommand = ReactiveCommand.Create(() => { Main = welcome; });
    ShowCounterCommand = ReactiveCommand.Create(() => { Main = counter; });
}

public IWorkspacePage Main
{
    get => _main;
    private set => this.RaiseAndSetIfChanged(ref _main, value);
}
```

A ViewModel-typed property is ViewModel content. The frontend receives a typed
reference to the page, not its state, and a `ViewOutlet` renders the View
registered for its kind. The registry must cover every page, which the
TypeScript compiler checks:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/App.tsx
const pages = { counter: CounterPage, welcome: WelcomePage } satisfies ViewRegistry<WorkspaceState["main"]>;
...
<ViewOutlet content={state?.main} registry={pages} fallback={<p>Connecting to the Window…</p>} />
```

Each page View connects to its own ViewModel. When `Main` changes, the outlet
unmounts the old View and mounts the new one; the ViewModels keep their state,
so returning to the counter shows the same count. Keep a page property while
the pages are fixed and switching between them is all you need.

## Navigation regions

A `NavigationRegion<TContent>` from `Runic.Navigation` is a page property with
history. It adds what a page property leaves to you:

- Back history, with `CanGoBack`, `BackAsync` and a ready-made Back command.
- Pages created for one visit and disposed when you leave them.
- Departure guards that can refuse to leave a page, for example while it has
  unsaved changes, also when the user closes the Window.
- Typed results: a refused, superseded or failed navigation is a value, not an
  exception, and a page can return a value to the code that opened it.

The
[Runic.Navigation guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Navigation/README.md)
is the reference for every operation, hook and ownership rule, and the
[ReactiveUI walkthrough](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Navigation.ReactiveUI/README.md#walkthrough)
covers the adapter.

The entry context as a constructor parameter, `INavigationAware`,
`WhenNavigatedTo`, the result commands, `ReactiveLeaveConfirmation` and
`GuardClose` are new in SDK `0.7.0-preview.7`. This guide follows `0.8.0-preview.4`.

### Coming from ReactiveUI navigation

Regions replace ReactiveUI's `RoutingState` rather than wrap it: pages need no
`IScreen` or `IRoutableViewModel`, only an interface of your own that the
region's pages implement. If you know host-based ReactiveUI navigation from
CrissCross, the shape is familiar: you navigate to a ViewModel type, the
container builds it, and you go back, ask whether you can, or veto leaving.
The differences are that a region is a plain ViewModel property rather than a
View host, that each request returns a result you can inspect, and that the
navigator, not the View, owns the pages it created.

| Task                                      | With a region                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| Show a page built by the container        | `await Main.PushAsync<DocumentViewModel>()`                                |
| Pass the page an input                    | `PushAsync<NoteDetailViewModel, int>(id)` and `INavigationInitialize<int>` |
| Go back                                   | `Main.CreateBackCommand()`, or `await Main.BackAsync()`                    |
| Enable a Back button                      | `Main.WhenCanGoBackChanged()`, included in the Back command                |
| Show a busy state                         | `Main.WhenIsTransitioningChanged()`                                        |
| Run code each time a page becomes current | `entry.WhenNavigatedTo(...)`, or `INavigationAware`                        |
| Refuse to leave a page                    | `INavigationDepartureGuard` with `ReactiveLeaveConfirmation`               |
| Return a value to the caller              | `PushForResult<TPage, TResult>()` and `entry.CreateCompleteCommand()`      |
| Ask before the Window closes              | `GuardClose = true` on the `RunicWindow<T>`                                |

`ReactiveRoutedRegion<T>` in `Runic.Application.Views.ReactiveUI` still
presents an existing `RoutingState` for an app that keeps one, without guards,
results or owned pages.

### Set up

Add the ReactiveUI adapter, which brings `Runic.Navigation`:

```sh docs-test=commands
dotnet add package Runic.Navigation.ReactiveUI --version <VERSION>
```

Register the navigator with the Window's other services.
`AddRunicNavigation()` adds one navigator per Window scope, on the model
context that `AddRunicReactiveModelContext()` registers. The
[Reactive Notes example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.8.0-preview.4/examples/notes-reactive-views),
which this guide follows, registers:

```csharp docs-test=source:examples/notes-reactive-views/NotesApplication.cs
// A window scope owns one execution lane for the whole reactive graph, and
// ReactiveUI commands deliver their notifications on it without a scheduler.
services.AddRunicReactiveModelContext();
// One navigator per window scope, on that model context. It constructs each
// DocumentViewModel from the window's services and owns it.
services.AddRunicNavigation();
services.AddScoped<HomeViewModel>();
services.AddScoped<EditorViewModel>();
services.AddScoped<PreviewViewModel>();
services.AddScoped<ShellViewModel>();
```

No command in this guide takes a scheduler: the model context is ReactiveUI's
main-thread scheduler. In WPF the dispatcher is, once ReactiveUI's WPF platform
is built; the
[WPF ReactiveUI example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/examples/wpf-navigation/README.md#the-reactiveui-variant)
registers the navigator with `AddRunicWpfNavigation()`:

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/App.xaml.cs
// ReactiveUI's WPF platform, once per process: commands deliver on the dispatcher, and Views activate.
static App() => RxAppBuilder.CreateReactiveUIBuilder().WithWpf().BuildApp();
// ...
public static IServiceCollection AddNotes(IServiceCollection services) => services
    .AddRunicWpfNavigation(options => options.UseViewNamingConvention()) // NotesListViewModel -> NotesListView
    .AddSingleton<NoteStore>()
    .AddSingleton<AppRegions>();
```

## With ReactiveUI

### A region in the shell

Create the region in the Window's ViewModel with the injected
`RunicNavigator`, and expose it as a get-only property. The region starts on a
borrowed home page; the Window's scope owns that ViewModel, so the navigator
never disposes it. The adapter in `Runic.Navigation.ReactiveUI` turns the
region's state into observables and commands:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
public ShellViewModel(RunicNavigator navigator, HomeViewModel home, EditorViewModel editor)
{
    // ...
    Main = navigator.CreateRegion<IMainPage>(this, NavigationTarget.Borrow<IMainPage>(home));
    // Back runs the document's leave guard; it is enabled while Main has history.
    OpenHomeCommand = Main.CreateBackCommand();
    OpenDocumentCommand = ReactiveCommand.CreateFromTask(OpenDocumentAsync,
        Main.WhenCurrentChanged().Select(page => page is HomeViewModel));
    // ...
}

public NavigationRegion<IMainPage> Main { get; }
// ...
public ReactiveCommand<RxVoid, NavigationOutcome> OpenHomeCommand { get; }
public ReactiveCommand<RxVoid, RxVoid> OpenDocumentCommand { get; }
```

`CreateBackCommand()` can execute while the region has history and no
transition is running. Its output is a `NavigationOutcome`, the kind of result
without any .NET content, so the frontend can read it.

The commands need no `ThrownExceptions` subscription. The generated Bridge
observes each bridged command and logs an unexpected exception once, as
`ReactiveCommandFailed` (event 1042) through the Window's logger factory. A
declared failure reaches the frontend instead.
[Typed failures](typed-failures.md#reactiveui-thrownexceptions) has the details.

They also need no disposal. Like any ReactiveUI subscription, dispose a command
only when its `canExecute` observes an object that outlives the ViewModel.
These observe `Main`, the shell's own region.

### A root page that navigates its region

When the root page pushes into its own region, as a list pushes its detail
page, it needs the service that holds the region. That service can't create
the region with the page as its initial target, because building the page
would need the service again. Create the region empty in the service, and
start it in the Window's ViewModel, where both exist:

```csharp docs-test=readme:packages/dotnet/Runic.Navigation/README.md
public sealed class AppNavigation // registered per window scope
{
    public AppNavigation(RunicNavigator navigator) => Main = navigator.CreateRegion<IPage>(this);

    public NavigationRegion<IPage> Main { get; }
}

public sealed class ListViewModel(AppNavigation navigation) : IPage { /* pushes into navigation.Main */ }

public sealed class ShellViewModel
{
    public ShellViewModel(AppNavigation navigation, ListViewModel list)
    {
        Main = navigation.Main;
        Main.Start(NavigationTarget.Borrow<IPage>(list)); // or NavigationTarget.Create<ListViewModel>()
    }

    public NavigationRegion<IPage> Main { get; }
}
```

`NavigationTarget.Create<ListViewModel>()` instead builds the list from the
Window's services, and the region owns it.

`Start` commits the root page before it returns, like an initial target of
`CreateRegion`: the page's `OnNavigatedTo` and the region's change
notifications run on the calling thread, and `Main.Current` is the list when
`OpenWindowAsync` returns. If the page can't be created, `Start` throws, so
`OpenWindowAsync` fails instead of opening an empty Window. `Start` is allowed
once, before any other navigation of the region; use `ResetAsync` after that.
Don't use `_ = Main.ResetAsync(...)` in the constructor instead: its failure is
only logged, and the region stays empty until a later model turn. `Start` is
new in SDK `0.7.0-preview.8`. A CommunityToolkit.Mvvm or ReactiveUI shell
calls it the same way.

### Navigate in a command

Navigate in an ordinary `ReactiveCommand`. `PushAsync<TPage>()` asks the
navigator to build the page from the Window's services; the new entry owns it,
and the navigator disposes it when the entry retires. A page that needs an
input receives it in `INavigationInitialize<TInput>`, as the WPF example's
note page does:

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/Notes/NotesListViewModel.cs
// The ViewModel type and its typed input are the parameter contract; no string keys.
OpenCommand = ReactiveCommand.CreateFromTask(async token =>
    { await regions.Main.PushAsync<NoteDetailViewModel, int>(Selected!.Id, cancellationToken: token); }, hasSelection);
```

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/Notes/NoteDetailViewModel.cs
// Runs once, before the page is shown. A retained page keeps its note and edits.
public ValueTask InitializeAsync(NavigationEntryContext entry, int id, CancellationToken cancellationToken)
{
    _note = _store.Get(id);
    Title = _note.Title;
    return ValueTask.CompletedTask;
}
```

Other operations replace the current page, go back to an earlier entry, or
reset the history. `NavigationTarget` chooses who owns the page:

- `NavigationTarget.Borrow<TContent>(model)` presents a ViewModel that someone else owns,
  such as a Window-scoped page that keeps its state across visits.
- `NavigationTarget.Own<TContent>(model)` hands an existing ViewModel to the entry.
- `NavigationTarget.Create<TContent>(factory)` builds the ViewModel during the
  navigation and hands it to the entry. The factory receives the Window's
  services and the new entry's context.

Every request returns a `NavigationResult<TContent>`: `Committed`, `Rejected`
with a reason such as `Guard` or `NoHistory`, `Superseded` by a later request,
or `Failed` with the exception. Decide in the ViewModel what each one means;
a completed command task does not mean the page changed. After the `await`,
the command is back on the Window's model context, so it sets state directly.
[ViewModel state and threads](model-context.md) explains why.

### The page and its entry

Each visit is an entry with a `NavigationEntryContext`: its id, its state, and
the operations it performs on itself. A page that the navigator constructs
takes it as a constructor parameter, next to its services:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
public sealed class DocumentViewModel : ReactiveObject, IMainPage, INavigationDepartureGuard
{
    // ...
    public DocumentViewModel(NavigationEntryContext entry, RunicNavigator navigator, EditorViewModel editor,
        PreviewViewModel preview)
```

- The navigator passes the context to the content it constructs: with
  `PushAsync<TPage>()`, `ReplaceAsync<TPage>()`, `ResetAsync<TPage>()`,
  `PushForResult<TPage, TResult>()`, and as the second argument of a
  `NavigationTarget.Create` factory. The container never resolves it, so a
  service that asks for one fails to resolve; pass it on from the page.
- The page is constructed while its entry is still pending. Keep the context
  for commands and subscriptions; don't navigate from the constructor.
- A page you create yourself and pass with `Own` or `Borrow` exists before its
  entry, so it receives the context in `INavigationInitialize.InitializeAsync`.

`entry.WhenNavigatedTo` runs each time the entry becomes current: when it is
first shown and after every Back to it. Its second argument is a scope that
ends when the entry stops being current, so per-visit subscriptions go there.
`WhenNavigatedTo` itself ends when the entry retires:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
// Per visit, not per mounted View: follow the window-scoped draft while this entry
// is current. The visit scope ends that subscription when the entry is left.
entry.WhenNavigatedTo((_, visit) => editor.WhenAnyValue(model => model.IsDirty)
    .Subscribe(dirty => Status = dirty ? "Unsaved changes" : "No unsaved changes")
    .DisposeWith(visit));
```

The WPF example's list refreshes itself whenever the user returns to it:

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/Notes/NotesListViewModel.cs
// Each time the list becomes current again, for example after Back from a note. Ends when the entry retires.
entry.WhenNavigatedTo((_, _) => Notes.ReplaceWith(store.All));
```

`WhenNavigatedFrom()` emits each departure. Without the adapter, a page
implements `INavigationAware`, whose `OnNavigatedTo` and `OnNavigatedFrom` the
navigator calls at the same moments, in the turn that commits the navigation.
ReactiveUI's `WhenActivated` follows a mounted View instead, not the entry: a
page that another page covers stays alive with its state while its View is
unmounted. Put per-View subscriptions in `WhenActivated` and per-visit ones in
`WhenNavigatedTo`.

### Guard against leaving

A page that must not be left silently implements `INavigationDepartureGuard`.
The navigator asks it before every exit: Back, a push from code, a parent
region leaving and a guarded Window close. `ReactiveLeaveConfirmation.WithInteraction`
implements the common case, asking through a ReactiveUI `Interaction` when
there are unsaved changes:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
// Leaving with unsaved edits asks through ConfirmLeave. The edits are reverted
// only when the departure commits; a No, or a superseded departure, keeps them.
_leave = ReactiveLeaveConfirmation.WithInteraction(ConfirmLeave,
    () => new DiscardNoteRequest(editor.Title, editor.Body.Length), () => editor.IsDirty, editor.RevertChanges);
// The web View answers for its Close and the shell's Back. ReactiveUI asks the latest handler
// first, so this fallback answers only when no View is mounted or .NET code starts the departure:
// keep the edits rather than fail it.
ConfirmLeave.RegisterHandler(context => context.SetOutput(false));
// ...
public ValueTask<bool> CanDepartAsync(NavigationDeparture departure, CancellationToken cancellationToken) =>
    _leave.CanDepartAsync(departure, cancellationToken);
```

A web View answers the interaction with its generated client while it is
mounted, for a departure that its own window starts: the page's Close, the
shell's Back, or a guarded Window close:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-reactive-views/Frontend/src/document.ts
// The leave guard asks here when this window leaves the document with unsaved
// edits: its Close or the shell's Home (Back).
// Answering false keeps the document and its edits.
const removeLeaveHandler = view.interactions.confirmLeave.handle(async (request, { signal }) => {
  if (signal.aborted) throw signal.reason;
  return window.confirm(`Close “${request.title}” and lose its unsaved changes?`);
});
```

The View registers its handler when it mounts. A departure during the page's
first render, such as a Window close just as the page opened, therefore gets
the ViewModel's .NET fallback above, which keeps the edits.

A WPF View answers in `WhenActivated`. Its XAML sets
`ViewModel="{Binding}"`, so the ReactiveUI View receives the page that the
region presents:

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/Notes/NoteDetailView.xaml.cs
// Answers the ViewModel's leave confirmation while this View is shown.
this.WhenActivated((MultipleDisposable disposables) => ViewModel!.ConfirmDiscard.RegisterHandler(context => context.SetOutput(
    MessageBox.Show(context.Input, "Notes", MessageBoxButton.OKCancel) == MessageBoxResult.OK)).DisposeWith(disposables));
```

The guard fails closed:

- Without unsaved changes it doesn't ask, and a push that keeps the page in
  the history leaves it without asking.
- With no handler that answers, ReactiveUI's `UnhandledInteractionException`
  fails the departure: the result is `Failed`, the navigator logs event 1060,
  and the page stays. So does a handler that throws, and so does a question
  whose View unmounts or disconnects before it answers.
- The browser is asked only from the page's own window, and never from another
  window or browser connection. A command of any View in that window, such as
  the shell's Back, asks the page's View on the connection that invoked it. A
  guarded Window close asks the page's View when it is the only mounted View
  with that handler. Navigation that .NET code starts, such as from a timer,
  never reaches the browser; register a .NET fallback handler, as the example
  does, to give it an answer. ReactiveUI asks the latest handler first: a
  mounted web View answers before a fallback registered in the constructor,
  and a WPF View's `WhenActivated` handler answers before both.
- A superseded or cancelled departure ends at once; the browser handler's
  `signal` aborts, and a late answer is ignored. The discard runs only when
  the departure commits.

Guards, factories and initialize hooks run outside the model context's turns.
An initialize hook may set state directly on a page that was created for its
entry, with `PushAsync<TPage>()`, `NavigationTarget.Create` or a new instance
handed over with `Own`. Nothing presents that page before its entry commits,
and the commit turn runs after the awaited hook. That is why the WPF note
page's `InitializeAsync` above sets `Title` directly. Commit everything else
with `IRunicModelContext.InvokeAsync`: state that is already presented or
shared, such as a borrowed page, a service or another page, and any state
that a guard or `ResumeAsync` sets. Don't schedule work on ReactiveUI's
main-thread scheduler from a hook, for example with a command's
`Execute().Subscribe()`; outside a turn it falls back (Views event 1043).

### Return a result

A caller that needs to know how a visit ended pushes for a result.
`PushForResult` returns a request with two tasks: `Transition` settles when the
page is shown, and `Completion` when the entry ends. The Notes shell awaits the
completion outside its command, so the command ends once the document is
shown:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
private async Task OpenDocumentAsync()
{
    var request = Main.PushForResult<DocumentViewModel, string>();
    if ((await request.Transition).IsCommitted) _ = ShowResultAsync(request.Completion);
}

// Completion never faults: it ends Dismissed on every path but Save and close,
// including a closing window. The continuation resumes on the model context.
private async Task ShowResultAsync(Task<NavigationCompletion<string>> completion) =>
    _home.LastResult = await completion is NavigationCompletion<string>.Completed(var title)
        ? $"Saved and closed {title}"
        : "Closed the document.";
```

The page ends its entry with result commands that the View binds like any
other command. `CreateCompleteCommand` produces the result and goes back, and
`CreateCloseCommand` goes back without one; both run the leave guard, and a
veto keeps the page and the request open:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
// Result commands end the entry: Save and close completes the request with the
// title; Close goes back, asking first when there are unsaved edits.
SaveAndCloseCommand = entry.CreateCompleteCommand(async token =>
{
    await editor.SaveAsync(token);
    return editor.Title;
});
CloseCommand = entry.CreateCloseCommand();
```

The entry disposes its result commands when it retires, so the page doesn't.

A confirm dialog in a dialog region answers the same way, with
`CreateDismissCommand` for its No, which ends the request at once:

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/Dialogs/ConfirmViewModel.cs
public sealed class ConfirmViewModel(NavigationEntryContext entry, string message) : ReactiveObject
{
    public string Message { get; } = message;
    public ReactiveCommand<RxVoid, NavigationOutcome> YesCommand { get; } = entry.CreateCompleteCommand(_ => Task.FromResult(true));
    public ReactiveCommand<RxVoid, NavigationOutcome> NoCommand { get; } = entry.CreateDismissCommand();
}
```

Its caller waits for the answer inside the command, so it passes the
command's token; cancelling the command then also closes the dialog. Don't pass
the token from a command that ends when the push commits, as the Notes shell's
does, because cancelling it later would close the page. The `// [S2]` comments
mark the example's second comparison scenario:

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/Notes/NotesListViewModel.cs
var answer = await regions.Dialog.PushForResult<bool>(NavigationTarget.Create<ConfirmViewModel>( // [S2]
    (_, dialog) => new ConfirmViewModel(dialog, $"Delete '{note.Title}'?")), cancellationToken: token).Completion; // [S2]
if (answer is NavigationCompletion<bool>.Completed { Value: true }) // [S2]
```

`Completion` never faults. It ends `Completed` with the value, or `Dismissed`
on every other path, including a closing Window. Await it directly; it needs
no conversion and no scheduler.

### Guard the Window close

Disposing a navigator retires its entries without asking their guards, so by
default closing the Window loses unsaved edits. To ask the guards first, set
`GuardClose` on the Window, as the SDK's close-guard tests do:

```csharp docs-test=source:tests/dotnet/Runic.Application.Views.Desktop.Tests/CloseGuardTests.cs
sealed class GuardedWindow : RunicWindow<GuardedShellModel>
{
    public GuardedWindow() => GuardClose = true;
}
```

- Before a close that the user starts, the Window calls `CanCloseAsync`. Its
  default clears each region its ViewModel exposes, so the departure guards
  decide, and a guard that refuses or fails keeps the Window open. Override it
  to add a check, and call the base method to keep the guards.
- `RequestCloseAsync()` closes the Window from code as its close button does,
  and returns `false` when the guards kept it open. Keep the Window that
  `OpenWindowAsync` returned and call it from a `ReactiveCommand`:

  ```csharp docs-test=source:tests/dotnet/Runic.Application.Testing.Tests/LeaveGuardRoutingTests.cs
  CloseEditorCommand = ReactiveCommand.CreateFromTask(async token =>
  {
      if (!await _editor.RequestCloseAsync(token)) StatusText = "The editor has unsaved changes.";
  });
  ```

  A ViewModel closes its own Window, for example from a Quit command, by
  taking `IRunicWindowContext` in its constructor and calling its
  `RequestCloseAsync`. `AddRunicWindowService()` registers it per Window, and
  it is new in SDK `0.7.0-preview.8`; see
  [Closing a ViewModel's own Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Application.Views/README.md#closing-a-viewmodels-own-window).

- The page's web View asks the user, as it does for its Close: the close is the
  Window's own departure, so the guard's interaction reaches the View mounted
  in that Window. If the View unmounts during the question, the Window stays
  open. If the application closes the Window meanwhile (`CloseAsync`), the
  question is cancelled and the guard's discard doesn't run. A .NET fallback
  handler answers only when no View is mounted, which includes a close during
  the page's first render, before its View has registered its handler.
- Runic Desktop's embedded window asks. CS-WebUI and a browser window can't
  keep their window open: the Window opens unguarded and logs warning 1053
  `WindowCloseGuardUnavailable`, and a user close doesn't ask. Save drafts as
  the user edits where that matters. `RequestCloseAsync` still asks there.
- `CloseAsync`, disposal and a host shutdown don't ask.
- In WPF, set `GuardWindowClose="True"` on the `NavigationHost` instead. It
  also guards a host on an unselected tab.

### Render a region

The frontend sees a region like any page property, except that a region can be
empty, so its TypeScript type includes `null`. Give the `ViewOutlet` a fallback
for that case. Going Back presents the earlier page's reference again, and the
outlet mounts a fresh View for its retained ViewModel. Reloading the page or
reconnecting never changes the history.

## With CommunityToolkit.Mvvm

The navigator is the same; only the commands differ. A Toolkit app registers
`AddRunicNavigation()`, which also provides the model context, creates regions
the same way, and binds `[RelayCommand]` availability to region state. Region
changes arrive as `PropertyChanged` inside model turns, so a handler can
refresh `CanExecute` directly:

```csharp docs-test=source:examples/notes-view-first/ViewModels.cs
public WorkspaceNavigation(RunicNavigator navigator, HomeViewModel home)
{
    Main = navigator.CreateRegion<IMainViewModel>(this, NavigationTarget.Borrow<IMainViewModel>(home));
    Dialog = navigator.CreateRegion<IDialogViewModel>(this);
}
// ...
// The confirm dialog is modal: while it asks, or while a page navigation is in flight,
// nothing else navigates. Commands bind their CanExecute to this, and the methods check it
// again, so a caller that skips CanExecute can't supersede the Back that asks.
public bool CanNavigate => Dialog.Current is null && !Main.IsTransitioning;

// ExpectedCurrent makes a repeated click a no-op instead of a second document. The navigator
// builds the document from the window's services and owns it.
public Task OpenNotesAsync() => !CanNavigate || Main.Current is DocumentViewModel
    ? Task.CompletedTask
    : Main.PushAsync<DocumentViewModel>(new NavigationRequestOptions(Main.CurrentEntry?.Id)).AsTask();
```

`NavigationRequestOptions.ExpectedCurrent`, the entry id passed here, makes a
request conditional: a double click, or an answer that arrives after the user
moved on, is rejected instead of opening a second page.

CommunityToolkit.Mvvm has no interaction type, so the leave guard asks in the
dialog region with `LeaveConfirmation.InDialog`. The confirm dialog takes its
entry context in its constructor, as the ReactiveUI pages do, and answers with
`CompleteAsync` and `DismissAsync`; see
[Ask the user from a ViewModel](../samples/prompts.md#with-communitytoolkitmvvm-a-dialog-region).
Toolkit pages implement `INavigationAware` instead of the adapter's
`WhenNavigatedTo`, and use `GuardClose` the same way. A `[RelayCommand]`
closes a kept Window with `RequestCloseAsync`:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
[RelayCommand]
private async Task CloseEditorAsync()
{
    if (!await _editor.RequestCloseAsync()) StatusText = "The editor has unsaved changes.";
}
```

## Next steps

- [ViewModel state and threads](model-context.md) covers the model context
  that commands, regions and guards run on.
- [Operations and cancellation](operations-and-cancellation.md) covers
  long-running commands.
- The [Runic.Navigation guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Navigation/README.md)
  documents transitions, entry state, results and testing with a real
  navigator.
