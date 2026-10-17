# Operations, selection and cancellation

Use generated `start{Command}` handles for pending state, status and Cancel.
Recovery and shutdown follow the actual domain task, which can outlive its
generated invocation.

## Observe an accepted operation

A Start receipt establishes admission. Observe the handle until terminal status,
including after Cancel. Distinguish declared domain failure from transport errors;
inspect application state when completion is unknown before retrying a mutation.

Since `Runic.Desktop` `0.7.0-preview.6`, draft and Cancel callbacks run while
an awaited command or operation wait remains in flight. With earlier packages,
use Start followed by short `status()` calls and request `outcome()` only
after terminal status; a running wait can hold later callbacks.

Framework `useCommand`/`injectCommand` helpers track a call's pending and error
state. Operation observation, selection queues and recovery need their own policy.

## Results and parameterised queries

A call resolves to the ViewModel's state after the command, `can{Command}(input)`
to whether the command can run with that argument, and `start{Command}(input)`
to a `BridgeOperation<TResult>` handle. A ReactiveUI
`ReactiveCommand<TInput, TResult>` has a typed result: its `outcome()` resolves
to `{ ok: true, value }`. Since SDK `0.8.0-preview.4`, a CommunityToolkit
`[RelayCommand]` method that returns `Task<T>` does too: its operation is a
`BridgeOperation<T>`. Other commands have none (`BridgeOperation<void>`).

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
[RelayCommand(IncludeCancelCommand = true)]
private async Task<CleanupEstimate> MeasureAsync(CleanupChoice choice, CancellationToken token) =>
    new(choice.Retention, await estimator.FreedBytesAsync(choice.Retention, token), DateTimeOffset.Now);
```

```ts docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
const outcome = await cleanup.startMeasure({ retention: 3 }).outcome();
if (outcome.ok) render(outcome.value.bytes);
```

A result that other parts of the page show is better published as state.
Publish it in a read-only property together with the input it answers, and a
second property for the phase of the work. The page then shows a result only
when it answers the current choice, and shows progress, cancellation and
failure from the phase. A question that takes parameters works the same way:
there is no query route that returns a computed value, so run a command with
the parameters and read the answer from the state it publishes. Start each question with
`createLatestOperationController` (see [below](#bind-operation-feedback)) so a
newer choice cancels the one it supersedes.

The Views README walks through a complete example, a cleanup
estimate in C# and TypeScript, in
[Operation results and parameterised queries](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Application.Views/README.md#operation-results-and-parameterised-queries).
Its
[wire types](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Application.Views/README.md#wire-types)
explain why a result such as a byte count shown in the UI is better a `double`
than a `long`, which becomes a `bigint`.

Since SDK `0.8.0-preview.4`, a read-only `string` state property marked
`[RunicAppendOnlyText]`, such as an operation's output, crosses as the text it
appends:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
[ObservableProperty, RunicAppendOnlyText]
public partial string Log { get; private set; } = "";

private void OnOutput(string text)
{
    var log = Log + text;
    // Keeps the last 128 KB; the page receives the dropped length and the new text.
    Log = log.Length > LogCharacters ? log[^LogCharacters..] : log;
}
```

The page still sees a `string`. See
[live logs and other growing text](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Application.Views/README.md#live-logs-and-other-growing-text).

## Choose a policy for the action

| Interaction                               | Application policy                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Commit, publish, save or another mutation | Disable duplicate admission while accepted work is active. Retain the accepted task and its recovery outcome.                           |
| File, commit or search-result selection   | Preserve the latest intent, cancel a superseded read, and admit the latest choice after the previous operation reaches terminal status. |
| Repository/session replacement            | Invalidate queued intent and stale publication from the departing session. Drain its accepted work before releasing its resources.      |

A running ReactiveUI command can reject another Start as `unavailable`.
Read epochs suppress stale results but cannot retain rejected clicks. Keep
latest-selection intent outside the running command.

When superseded before its receipt arrives, cancel and observe the old handle
once admitted. Discard intermediate choices; check selection and session identity
before publishing. Wait for actual workflow cleanup when it can outlive terminal
invocation status. Acknowledged cancellation alone does not permit replacement.

An uncertain transport result can mean accepted work. Block further admission
until session replacement or reconciliation; retrying can duplicate a mutation.

## Cancellation and shutdown have different boundaries

ReactiveUI invocation cancellation can complete its wrapper before the workflow
finishes. `WindowContentSession.BeginCloseAsync(...).Completion` observes tracked
bridge invocations; application domain tasks need a separate drain.

Retain accepted tasks through recovery after failure or cancellation. Stop
admission on close, request cancellation according to policy, and await tasks
in asynchronous disposal before releasing their resources. Keep busy state until
recovery finishes, even when work ignores cancellation.

For native close, `ConfirmCloseAsync` can refuse while a mutation is active or
await draft persistence. `CloseAsync` and disposal bypass that decision, so
application-owned draining must also work on forced cleanup. Native services
must release resources while their presentation dispatcher and event loop are
still available. See [window close lifecycle](../../desktop/window-close-lifecycle.md)
and [published-package desktop onboarding](../package-consumer.md).

## Bind operation feedback

The following helpers are new in SDK `0.7.0-preview.6`.

[`createOperationController`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/web/views/src/operation-controller.ts)
and Svelte's
[`useOperation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/web/svelte/src/views/use-operation.svelte.ts)
bind Start handles to admission, pending state, status, outcome, declared failure,
error and Cancel. Progress stays in the generated View snapshot.
Disposal detaches observation; the application still owns cancellation and drain.

For a generated editor View, bind Save to its Start handle. The pending flag
includes admission before the receipt arrives, so it also prevents an immediate
duplicate click:

```svelte docs-test=skip:illustrative-fragment
<script lang="ts">
  import { useOperation, useView } from '@runic-artifex/svelte/views';
  import type { EditorPageReference } from './generated/editor.js';

  let { page }: { page: EditorPageReference } = $props();
  const editor = useView(() => page);
  const save = useOperation(() => editor.client?.startSave());
</script>

<button
  disabled={!editor.state?.canSave || save.pending}
  onclick={() => save.run()}>Save</button
>
<button
  disabled={!save.pending || save.cancelling}
  onclick={() => save.cancel()}>Cancel</button
>
{#if save.pending}<p role="status">
    {save.admitting ? 'Starting…' : 'Saving…'}
  </p>{/if}
{#if save.outcome?.ok}<p role="status">
    {editor.state?.savedMessage || 'Saved.'}
  </p>{/if}
{#if save.failure}<p role="alert">{save.failure.$case}</p>{/if}
{#if save.error ?? editor.error}<p role="alert">
    {String(save.error ?? editor.error)}
  </p>{/if}
{#if save.cancelError}<p role="alert">{String(save.cancelError)}</p>{/if}
```

Create `useOperation` during component initialization. Flush queued field writes
before Save; see [typed domain failures](typed-failures.md#framework-command-helpers).
For mutations, keep the model's `canSave` false through accepted work and recovery;
the binding's `pending` flag tracks the invocation, not domain-task completion.

`createLatestOperationController` coalesces selections and waits for terminal
status before another admission in the same session. Intents can add a real-work
barrier and session-validity check.

For a workspace contract exposing `startSelectCommit` and a short `cancelRead`
control command, pass the session that rendered the selected item:

```ts docs-test=skip:illustrative-fragment
import { createLatestOperationController } from '@runic-artifex/views';
import type {
  CommitSelection,
  WorkspaceClient,
} from './generated/workspace.js';

const selection = createLatestOperationController();
type SelectionSession = { readonly client: WorkspaceClient };
let currentSession: SelectionSession | undefined;

function selectCommit(session: SelectionSession, commit: CommitSelection) {
  return selection.run({
    start: () => session.client.startSelectCommit(commit),
    cancel: async () => {
      await session.client.cancelRead();
    },
    isCurrent: () => session === currentSession,
  });
}

function sessionReplaced(client: WorkspaceClient) {
  currentSession = { client };
  selection.clear('replace');
}
```

Use `clear("cancel")` for a user Cancel that also discards queued selections.
Call `clear("replace")` only when the application establishes a replacement
session. It detaches the old observation, suppresses cancellation against the
departing identity and permits fresh-session admission; the application keeps
ownership of the old work's drain. It also clears uncertain admission.
Transport uncertainty otherwise blocks the controller's next admission.
Add `waitForCompletion` when domain work or command
availability must finish after terminal invocation status. Call `dispose()`
when the selection owner leaves; it drops feedback and queued intent without
requesting cancellation of accepted work.

[`AcceptedWorkScope.RunAsync`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/packages/dotnet/Runic.Application.Views/AcceptedWorkScope.cs)
reserves application-owned work before invoking
its factory. `DrainAsync` stops new admission and waits for accepted tasks;
cancelling the caller's drain wait does not cancel those tasks. Asynchronous
disposal drains the actual work even when individual tasks failed. Callers still
observe failures through the original tasks. It tracks task lifetime; the app
continues to own mutation ordering, recovery, cancellation and state publication.

Return a task that includes recovery, cleanup and all work using the model's
resources. The package consumer wraps its mutation workflow and drains it before
disposing commands and its model-context lease:

```csharp docs-test=source:tests/fixtures/application/operations-consumer/OperationsViewModel.cs
private readonly AcceptedWorkScope _accepted = new();
...
MutationCommand = ReactiveCommand.CreateFromTask<RxVoid, string>((_, token) =>
    _accepted.RunAsync(() => MutateAsync(token)), scheduler);
...
public async ValueTask DisposeAsync()
{
    await _accepted.DisposeAsync();
    ...
    _lease.Dispose();
    Disposed = true;
}
```

The editor and workspace snippets illustrate application-specific contracts.
The package onboarding snippets are checked against the pinned release template. The
[external package consumer](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.4/tests/fixtures/application/operations-consumer/README.md)
builds from packed NuGet/npm archives and exercises operation feedback, latest
selection, session replacement, DTO opt-in and accepted-work disposal through the
real Desktop bridge.
