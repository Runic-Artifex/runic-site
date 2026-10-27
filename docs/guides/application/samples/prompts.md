# Ask the user from a ViewModel

A ViewModel asks a question, and the frontend shows it inside the page. With
ReactiveUI, use an `Interaction`; with CommunityToolkit.Mvvm, push a dialog
page into a navigation region.

Both keep the decision in the ViewModel and the presentation in the frontend.
The ViewModel never opens a browser dialog itself, and the frontend never
decides what happens after the answer.

## With ReactiveUI: an Interaction

ReactiveUI's `Interaction<TInput, TOutput>` is a question with a typed input
and answer. The Reactive Notes example asks before it discards a note's body.
The ViewModel declares the interaction as a public getter-only property, and
the input as a record:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
public Interaction<DiscardNoteRequest, bool> ConfirmDiscard { get; } = new();
```

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
public sealed record DiscardNoteRequest(string Title, int BodyLength);
```

A command asks with `Handle` and continues with the answer:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
private async Task DiscardAsync(CancellationToken token)
{
    var request = new DiscardNoteRequest(Title, Body.Length);
    if (request.BodyLength == 0)
    {
        SavedMessage = "Nothing to discard.";
        return;
    }

    bool approved = await ConfirmDiscard.Handle(request);
    token.ThrowIfCancellationRequested();
    if (approved)
    {
        Body = "";
        SavedMessage = $"Discarded {request.Title}";
    }
    else SavedMessage = "Kept current changes.";
}
```

The generator turns the property into a typed surface on the View's client,
`view.interactions.confirmDiscard`. The frontend registers a handler that
receives the request and returns the answer. The example uses the browser's
own `window.confirm`; an application renders its own dialog component the same
way and resolves the promise when the user answers:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-reactive-views/Frontend/src/editor.ts
const removeDiscardHandler = view.interactions.confirmDiscard.handle(async (request, { signal }) => {
  if (signal.aborted) throw signal.reason;
  return window.confirm(`Discard the ${request.bodyLength} unsaved characters in “${request.title}”?`);
});
```

`handle` returns a function that removes the handler; the example calls it
when the View unmounts. How the question travels:

- The request goes only to a mounted handler of the View that presents this
  ViewModel, in the Window whose command asked. It is never broadcast to other
  Windows and never appears in the published state.
- The handler's `signal` aborts when the View unmounts, the connection drops,
  the command is cancelled or the Window closes. Answering `false` is an
  ordinary answer; a cancelled or failed handler is a different outcome.
- `Handle` takes no cancellation token. A command's token still reaches the
  browser request, so cancelling the command aborts the handler.

With no mounted browser handler, for example in a test or before the View
mounts, Runic doesn't answer, and ReactiveUI uses its own handlers as usual.
Register a .NET handler with a safe default, so that a headless run declines
instead of throwing an unhandled interaction exception:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
ConfirmDiscard.RegisterHandler(context =>
{
    // A native or headless invocation has no mounted browser endpoint.
    // Keep ReactiveUI's normal handler precedence and decline the discard.
    context.SetOutput(false);
    return Task.CompletedTask;
});
```

A test can register its own handler to answer `true` or `false`.

## With CommunityToolkit.Mvvm: a dialog region

CommunityToolkit.Mvvm has no interaction type. The SDK's Toolkit examples ask
through a second navigation region of the Window, used only for dialogs. The
question is a ViewModel, pushed into that region for a result. Read
[Pages and navigation](../guides/pages-and-navigation.md) first.

The CommunityToolkit Notes example creates the region next to the main page
region. It starts empty:

```csharp docs-test=source:examples/notes-view-first/ViewModels.cs
public WorkspaceNavigation(RunicNavigator navigator, HomeViewModel home)
{
    Main = navigator.CreateRegion<IMainViewModel>(this, NavigationTarget.Borrow<IMainViewModel>(home));
    Dialog = navigator.CreateRegion<IDialogViewModel>(this);
}
```

The navigator constructs the dialog's ViewModel and passes it its
`NavigationEntryContext` as a constructor parameter, so the ViewModel holds its
entry from the start. Its commands answer through it: `CompleteAsync(true)`
ends the request with a value, and `DismissAsync()` ends it without one.
Either leaves the region empty again:

```csharp docs-test=source:examples/notes-view-first/ViewModels.cs
public partial class ConfirmNavigationViewModel(NavigationEntryContext entry, string message) : ObservableObject, IDialogViewModel
{
    public string Message => message;
    // ...
    [RelayCommand]
    private Task Confirm() => entry.CompleteAsync(true).AsTask();

    [RelayCommand]
    private Task Cancel() => entry.DismissAsync().AsTask();
}
```

A constructor parameter of type `NavigationEntryContext` is filled by the
navigator, never by the container: a service that asks for one fails to
resolve. Content you create yourself and pass with `NavigationTarget.Own` or
`Borrow` exists before its entry, so it receives the context in
`INavigationInitialize.InitializeAsync` instead.

A command asks with `PushForResult`. A dialog that takes its entry and a
message in its constructor, as `ConfirmNavigationViewModel` does, is created
with the factory overload of `NavigationTarget.Create`: the navigator calls the
factory with the window's services and the new entry's context. The SDK's
ReactiveUI WPF example deletes a note this way:

```csharp docs-test=source:examples/wpf-navigation/NotesNavigation.ReactiveUI/Notes/NotesListViewModel.cs
var answer = await regions.Dialog.PushForResult<bool>(NavigationTarget.Create<ConfirmViewModel>( // [S2]
    (_, dialog) => new ConfirmViewModel(dialog, $"Delete '{note.Title}'?")), cancellationToken: token).Completion; // [S2]
if (answer is NavigationCompletion<bool>.Completed { Value: true }) // [S2]
```

`NavigationTarget.Create<TDialog, TInput>(input)` is for a dialog that takes
its input in `INavigationInitialize<TInput>` instead of its constructor.

`PushForResult` returns a request whose `Completion` task ends as
`NavigationCompletion<bool>.Completed` with the value when the dialog called
`CompleteAsync`, and as `Dismissed` on every other path: the user cancelled,
the caller's token was cancelled, or the Window closed. So a command acts only
on `Completed { Value: true }`. Pass the command's cancellation token to
`PushForResult`; cancelling it also closes the dialog.

The most common question, "discard unsaved changes before leaving?", is ready
made. `LeaveConfirmation.InDialog` is a departure guard that asks in the
dialog region and discards the changes only when the user confirms:

```csharp docs-test=source:examples/notes-view-first/ViewModels.cs
_leave = LeaveConfirmation.InDialog(navigation.Dialog,
    () => NavigationTarget.Create<IDialogViewModel>((_, entry) =>
        new ConfirmNavigationViewModel(entry, "Discard the unsaved edits and return Home?")),
    () => Editor.IsDirty, Editor.DiscardChanges);
```

The factory target's second argument is the new entry's context, which the
dialog takes in its constructor.

The frontend renders the dialog region like any other ViewModel content: an
outlet with one View per dialog kind, hidden while the region is empty. The
example's plain TypeScript frontend mounts it into a modal element:

```ts docs-test=source:examples/notes-view-first/Frontend/src/app.ts
const dialogViews = {
  confirmNavigation: mountConfirmNavigation,
} satisfies ViewTemplates<NonNullable<ShellState["dialog"]>>;
...
const unmountDialog = mountContent(modalHost, shell, "dialog", dialogViews, report);
const unsubscribe = shell.subscribe(state => {
  modalHost.hidden = state.dialog === null;
});
```

The dialog View calls the ViewModel's commands, such as `dialog.confirm()` and
`dialog.cancel()`, and moves focus into the dialog and back as any modal
should. With React, Vue, Svelte or Angular, use the framework's View outlet
for the dialog region in the same way.

## Which one to use

- ReactiveUI apps: use an `Interaction`. It needs no navigation and keeps the
  question inside the View that is already on screen. With navigation,
  `ReactiveLeaveConfirmation.WithInteraction` asks "discard unsaved changes?"
  through one; see
  [Guard against leaving](../guides/pages-and-navigation.md#guard-against-leaving).
- CommunityToolkit.Mvvm apps that use navigation: use a dialog region.
- A CommunityToolkit.Mvvm app without navigation can model the question as
  ViewModel state: a nullable property holding the question, set by the
  command, and an answer command that the dialog calls. The SDK has no example
  of this yet.
- Where the page cannot answer, such as before it loaded or for a close
  confirmation that must follow the platform's button order, Runic Desktop and
  WPF windows show a native message box since SDK `0.11.0`:
  `IWindowPlatformServices.MessageBoxes` (`IDesktopMessageBoxes`). Keep
  ordinary prompts in the page; see the
  [Runic.Platform README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/packages/dotnet/Runic.Platform/README.md#message-boxes).

## Next steps

- [Pages and navigation](../guides/pages-and-navigation.md) introduces regions
  and departure guards.
- [Operations and cancellation](../guides/operations-and-cancellation.md)
  explains the tokens that end a pending question.
- [Open and save files](files.md) uses native dialogs, which the operating
  system renders, instead of in-page prompts.
