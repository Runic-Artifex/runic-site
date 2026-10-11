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
the pages are fixed and switching between them is all you need. It is stable
API, and the rest of this guide is not.

## Navigation regions (experimental)

A `NavigationRegion<TContent>` from `Runic.Navigation` is a page property with
history. It adds what a page property leaves to you:

- Back history, with `CanGoBack`, `BackAsync` and a ready-made Back command.
- Pages created for one visit and disposed when you leave them.
- Departure guards that can refuse to leave a page, for example while it has
  unsaved changes.
- Typed results: a refused, superseded or failed navigation is a value, not an
  exception.

Navigation is experimental. Every navigation type is marked
`[Experimental("RUNICNAV001")]`, so code that uses it must suppress
`RUNICNAV001`, and the API may change before it is supported. The code that
Runic generates for a region needs no suppression. The
[Runic.Navigation guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Navigation/README.md)
is the reference for every operation, hook and ownership rule.

### Coming from ReactiveUI navigation

Regions replace ReactiveUI's `RoutingState` rather than wrap it. If you know
host-based ReactiveUI navigation from CrissCross, the shape is familiar: you
navigate to a ViewModel type, the container builds it, and you go back, ask
whether you can, or veto leaving. The differences are that a region is a plain
ViewModel property rather than a View host, that each request returns a result
you can inspect, and that the navigator, not the View, owns the pages it
created.

| Task                               | With a region                                               |
| ---------------------------------- | ----------------------------------------------------------- |
| Show a page built by the container | `await Main.PushAsync<DocumentViewModel>()`                 |
| Go back                            | `Main.CreateBackCommand()`, or `await Main.BackAsync()`     |
| Enable a Back button               | `Main.WhenCanGoBackChanged()`, included in the Back command |
| Show a busy state                  | `Main.WhenIsTransitioningChanged()`                         |
| Refuse to leave a page             | Implement `INavigationDepartureGuard` on its ViewModel      |
| Run code once per visit            | Implement `INavigationInitialize` on its ViewModel          |

### Set up

Add the ReactiveUI adapter, which brings `Runic.Navigation`:

```sh docs-test=commands
dotnet add package Runic.Navigation.ReactiveUI --version <VERSION>
```

Register the navigator with the Window's other services. `AddRunicNavigation()`
adds one model context and one navigator per Window scope; it keeps the model
context that `AddRunicReactiveModelContext()` registers:

```csharp docs-test=source:tests/fixtures/application/navigation-consumer/Program.cs
services.AddRunicNavigation();
services.AddScoped<HomeViewModel>();
services.AddScoped<ShellViewModel>();
services.AddRunicViews();
```

Suppress the experimental warning in the files that use navigation, or for the
whole project with `<NoWarn>$(NoWarn);RUNICNAV001</NoWarn>`:

```csharp docs-test=source:tests/fixtures/application/navigation-consumer/Shell.cs
#pragma warning disable RUNICNAV001 // The experimental navigation API (docs/experimental.md).
```

### A region in the Window ViewModel

Create the region in the Window ViewModel with the injected `RunicNavigator`,
and expose it as a get-only property. The region starts on a borrowed home
page; the Window's scope owns that ViewModel, so the navigator never disposes
it. The adapter turns the region's state into ReactiveUI observables and
commands:

```csharp docs-test=source:tests/dotnet/Runic.Application.Testing.Tests/ReactiveNavigationFixture.cs
public ReactiveNavShellViewModel(RunicNavigator navigator, IRunicModelContext context, NavHomeViewModel home)
{
    Main = navigator.CreateRegion<INavPageViewModel>(this, NavigationTarget.Borrow<INavPageViewModel>(home));
    // ...
    _busyHelper = Main.WhenIsTransitioningChanged().ToProperty(this, model => model.Busy);
    // ...
    // No scheduler: AddRunicReactiveModelContext or InstallMainThreadScheduler routes it to the turn's context.
    BackCommand = Main.CreateBackCommand();
}

public NavigationRegion<INavPageViewModel> Main { get; }

[ObservableAsProperty]
public partial bool Busy { get; }
// ...
// A NavigationOutcome crosses the Bridge without RUNICBRIDGE003 (W250-014).
public ReactiveCommand<RxVoid, NavigationOutcome> BackCommand { get; }
```

`CreateBackCommand()` can execute while the region has history and no
transition is running. Its output is a `NavigationOutcome`, the kind of result
without any .NET content, so the frontend can read it. Dispose the commands and
the property helper with the ViewModel, and observe each command's
`ThrownExceptions`, for example with `ObserveBridgeExceptions`.

### Navigate in a command

Navigate in an ordinary `ReactiveCommand`. Compose its availability from the
region's observables and your own conditions:

```csharp docs-test=readme:packages/dotnet/Runic.Navigation.ReactiveUI/README.md
var canOpen = Main.WhenIsTransitioningChanged()
    .CombineLatest(this.WhenAnyValue(vm => vm.HasSelection),
        (busy, selected) => !busy && selected);

OpenCommand = ReactiveCommand.CreateFromTask(async token =>
{
    var result = await Main.PushAsync<DocumentViewModel>(cancellationToken: token);
    HandleNavigationOutcome(result); // resumes on the model context
}, canOpen).DisposeWith(disposables);
```

`PushAsync<DocumentViewModel>()` asks the navigator to build the page from the
Window's services. The new entry owns it, and the navigator disposes it when
the entry retires, for example when the user goes Back. Other operations
replace the current page, go back to an earlier entry, or reset the history;
`NavigationTarget` chooses who owns the page:

- `NavigationTarget.Borrow<TContent>(model)` presents a ViewModel that someone else owns,
  such as a Window-scoped page that keeps its state across visits.
- `NavigationTarget.Own<TContent>(model)` hands an existing ViewModel to the entry.
- `NavigationTarget.Create<TContent>(factory)` builds the ViewModel during the
  navigation, from the Window's services, and hands it to the entry.

Every request returns a `NavigationResult<TContent>`: `Committed`, `Rejected`
with a reason such as `Guard` or `NoHistory`, `Superseded` by a later request,
or `Failed` with the exception. Decide in the ViewModel what each one means;
a completed command task does not mean the page changed. After the `await`,
the command is back on the Window's model context, so it sets state directly.
[ViewModel state and threads](model-context.md) explains why.

### Guard against leaving

A page that must not be left silently implements `INavigationDepartureGuard`.
The navigator asks it before the page is left, and a `false` answer rejects
the request with `NavigationRejection.Guard`:

```csharp docs-test=source:tests/fixtures/application/navigation-consumer/Shell.cs
// Created per visit and owned: its guard can veto leaving, and retiring disposes it.
public sealed class EditorViewModel(string title) : IPageViewModel, INavigationDepartureGuard, IDisposable
{
    public string Title { get; } = title;

    [RunicIgnore]
    public bool CanLeave { get; set; }
// ...
    public ValueTask<bool> CanDepartAsync(NavigationDeparture departure, CancellationToken cancellationToken) =>
        ValueTask.FromResult(departure.Kind == NavigationDepartureKind.Retain || CanLeave);
```

A `Retain` departure is a push on top of the page, which keeps it in the
history, so this guard only refuses when the page would retire. A guard can also ask
the user in another region, such as a dialog; the
[CommunityToolkit Notes example](https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/notes-view-first)
does that with `LeaveConfirmation`.

Guards, factories and initialize hooks are not commands: they run outside the
model context's turns. Don't set ViewModel state in them without committing it
with `IRunicModelContext.InvokeAsync`.

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
moved on, is rejected instead of opening a second page. The
[CommunityToolkit Notes example](https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/notes-view-first)
adds a child region for the document's panes and a dialog region for the
leave confirmation.

## Next steps

- [ViewModel state and threads](model-context.md) covers the model context
  that commands, regions and guards run on.
- [Operations and cancellation](operations-and-cancellation.md) covers
  long-running commands.
- The [Runic.Navigation guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Navigation/README.md)
  documents transitions, results from an entry, window close and testing.
