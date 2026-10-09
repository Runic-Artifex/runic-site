# Operations, selection and cancellation

Use the generated `start{Command}` API when the frontend needs to show an
accepted operation's pending state, status, progress and Cancel action. Keep
application recovery and shutdown tied to the actual domain task. They can
outlive the generated invocation that admitted it.

## Observe an accepted operation

A Start receipt establishes admission. Retain the operation handle and observe
it until terminal status, including after requesting cancellation. Show declared
domain failure separately from a bridge or transport error, and inspect current
application state when completion is unknown before retrying a mutation.

With published `Runic.Desktop` `0.7.0-preview.5`, an awaited WebUI callback can
hold later callbacks, including Cancel. For that release, use Start followed
by short `status()` calls; request `outcome()` after a terminal status. Do not
hold a running `wait()`, `completion` or `outcome()` callback while the same
surface needs control callbacks. The asynchronous callback fix is in SDK
development and has not changed the published package contract.

Released framework `useCommand`/`injectCommand` helpers track a call's pending
and error state. They do not by themselves implement an operation observer,
selection queue, mutation coordinator, or domain recovery policy.

## Choose a policy for the action

| Interaction                               | Application policy                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Commit, publish, save or another mutation | Disable duplicate admission while accepted work is active. Retain the accepted task and its recovery outcome.                           |
| File, commit or search-result selection   | Preserve the latest intent, cancel a superseded read, and admit the latest choice after the previous operation reaches terminal status. |
| Repository/session replacement            | Invalidate queued intent and stale publication from the departing session. Drain its accepted work before releasing its resources.      |

A running ReactiveUI command can reject a second Start as `unavailable`.
Read epochs suppress stale results only after a read reaches the model; they
cannot admit a click that the command rejected. A latest-selection policy
therefore needs to retain intent outside that running command.

Supersession can happen before Start returns its receipt. Once it arrives,
cancel and observe the old handle before admitting the queued choice. Discard
intermediate choices, and check both selection identity and repository/session
identity before publishing. If terminal invocation status can precede real
workflow cleanup, wait for that cleanup too. Do not start a replacement merely
because a cancellation request was acknowledged.

An uncertain transport result can mean that work was accepted. Preserve that
uncertainty until the owning application replaces the session or reconciles its
state; automatically issuing another mutation can duplicate it.

## Cancellation and shutdown have different boundaries

Generated ReactiveUI invocation cancellation can complete its wrapper and
release its subscription before the underlying workflow finishes. Consequently,
`WindowContentSession.BeginCloseAsync(...).Completion` establishes completion
of tracked bridge invocations, not arbitrary domain work started by a model.

Keep an application-owned completion task for accepted work, including recovery
after failure or cancellation. Stop accepting new work when the model closes,
request cancellation according to the application's policy, and await that
task in asynchronous disposal before releasing resources it still uses. Keep
busy state until recovery has finished; an operation that ignores cancellation
must still be observed.

For native close, `ConfirmCloseAsync` can refuse while a mutation is active or
await draft persistence. `CloseAsync` and disposal bypass that decision, so
application-owned draining must also work on forced cleanup. Native services
must release resources while their presentation dispatcher and event loop are
still available. See [window close lifecycle](../../desktop/window-close-lifecycle.md)
and [published-package desktop onboarding](../package-consumer.md).

## Development APIs

The following helpers are unreleased SDK `0.7.0-preview.6` development APIs,
absent from published `0.7.0-preview.5`. Use a deliberately built candidate or a
release that contains them; a development version does not establish package
availability.

[`createOperationController`](https://github.com/Runic-Artifex/runic-sdk/blob/d230f42e391bf778649eb827191aa56edbeb1372/packages/web/views/src/operation-controller.ts)
and Svelte's
[`useOperation`](https://github.com/Runic-Artifex/runic-sdk/blob/d230f42e391bf778649eb827191aa56edbeb1372/packages/web/svelte/src/views/use-operation.svelte.ts)
bind generated
Start handles to admission, pending state, status, terminal outcome, declared
failure, unexpected error and Cancel. Progress remains application state in the
generated View snapshot. Disposing a binding stops its observation;
it does not cancel or drain the accepted domain task.

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

Create `useOperation` during component initialization; its component cleanup
detaches observation. Keep progress and recovery messages in the generated
model state. Flush pending field writes before Save when your editor has a form
write queue; see [typed domain failures](typed-failures.md#framework-command-helpers).

`createLatestOperationController` coalesces the latest selection intent and
waits for terminal status before the next admission in the same session. An intent can additionally
supply a real-work barrier and a session-validity check. Cancellation and
replacement clear queued intent. Transport uncertainty blocks further admission
until an explicit replacement resolves ownership.

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
Add `waitForCompletion` when domain work or command
availability must finish after terminal invocation status. Call `dispose()`
when the selection owner leaves; it drops feedback and queued intent without
requesting cancellation of accepted work.

[`AcceptedWorkScope.RunAsync`](https://github.com/Runic-Artifex/runic-sdk/blob/d230f42e391bf778649eb827191aa56edbeb1372/packages/dotnet/Runic.Application.Views/AcceptedWorkScope.cs)
reserves application-owned work before invoking
its factory. `DrainAsync` stops new admission and waits for accepted tasks;
cancelling the caller's drain wait does not cancel those tasks. Asynchronous
disposal drains the actual work even when individual tasks failed. Callers still
observe failures through the original tasks. It tracks task lifetime; the app
continues to own mutation ordering, recovery, cancellation and state publication.

Return a task that includes recovery, cleanup and all work using the model's
resources:

```csharp docs-test=skip:illustrative-fragment
private readonly AcceptedWorkScope _acceptedWork = new();

public Task SaveAsync(CancellationToken cancellationToken) =>
    _acceptedWork.RunAsync(() => SaveAndRecoverAsync(cancellationToken));

public async ValueTask DisposeAsync()
{
    await _acceptedWork.DisposeAsync();
    // Release the model's resources after its accepted tasks finish.
}
```

These development snippets are illustrative; published-package onboarding stays
checked against the portal's pinned template. The
[external package consumer](https://github.com/Runic-Artifex/runic-sdk/blob/d230f42e391bf778649eb827191aa56edbeb1372/tests/fixtures/application/operations-consumer/README.md)
builds from packed NuGet/npm archives and exercises operation feedback, latest
selection, session replacement, DTO opt-in and accepted-work disposal through the
real Desktop bridge.
