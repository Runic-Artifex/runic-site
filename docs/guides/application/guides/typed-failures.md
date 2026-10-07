# Typed domain failures

A command can fail in ways the user should see and fix: a note without a title,
a title another note already has. Declare those failures on the .NET command,
and the generated TypeScript client returns them as typed values instead of
rejecting. Everything else, such as a crashed handler or a lost connection,
still rejects with `BridgeError`.

> Declared failures are new in Runic SDK 0.7.0-preview.1 and are not in
> 0.6.0-preview.1. Every code block is an excerpt of the
> [Notes examples](https://github.com/Runic-Artifex/runic-sdk/tree/v0.7.0-preview.1/examples/notes-view-first),
> which the SDK's CI builds and tests, or of a package README.

## Before you add a declaration

Adding `[RunicFailure]` to an existing command changes what its callers see.
Before, a failed `save()` rejected, so `await save(); navigate()` stopped at
the rejection. After, a declared failure resolves, so the same code continues
and navigates away from an unsaved note. Find every call site of the command
and its `start{Command}` operation, and check `outcome.ok` before you continue:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/web/views/README.md
const outcome = await editor.save();
if (!outcome.ok) {
  showError(matchCase(outcome.failure, {
    titleRequired: () => "A note needs a title.",
    titleTaken: failure => `"${failure.existingTitle}" already exists.`,
  }));
  return;
}
navigate();
```

TypeScript does not flag the old code: an ignored
`Promise<BridgeOutcome<...>>` compiles like an ignored `Promise<State>`.
Callers that already read the result, or use a framework command helper, only
need to show the new `failure`. The
[0.7 upgrade notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.1/eng/release/notes/0.7.0-preview.1.md#upgrading)
list this with the other breaking changes.

## Shape the failure

Describe the failure as a `[RunicUnion]` of records. Each case has a stable
`$case` name for TypeScript and may carry data:

```csharp docs-test=source:examples/notes-view-first/ViewModels.cs
/// <summary>Why a note could not be saved.</summary>
[RunicUnion(typeof(TitleRequired), typeof(TitleTaken))]
public abstract record SaveFailure;
/// <summary>The note has no title.</summary>
[RunicUnionCase("titleRequired")]
public sealed record TitleRequired : SaveFailure;
/// <summary>Another saved note already has the title.</summary>
[RunicUnionCase("titleTaken")]
public sealed record TitleTaken(string ExistingTitle) : SaveFailure;
```

A failure may also be a single record or another type the Bridge can encode,
such as a string. `matchCase` and `catchCase` accept only `$case` unions
(`[RunicUnion]`), so read such a failure directly: `outcome.failure` in
TypeScript, or `Effect.catchTag("ViewDomainFailure", …)` in Effect. Keep it
small: an encoded failure over 4 KiB is reported as an ordinary failure, as is
a value that is not the declared type.

## Declare and throw it

Put `[RunicFailure(typeof(X))]` on the command. With CommunityToolkit.Mvvm it
goes on the `[RelayCommand]` method; throw `RunicFailureException` with the
failure value:

```csharp docs-test=source:examples/notes-view-first/ViewModels.cs
/// <summary>Saves the note. A missing title, or the title of another saved note, is a declared failure.</summary>
[RelayCommand, RunicFailure(typeof(SaveFailure))]
private async Task SaveAsync(CancellationToken token)
{
    var title = Title;
    if (string.IsNullOrWhiteSpace(title))
        throw new RunicFailureException(new TitleRequired());
    // Saving under this editor's own saved title replaces that note; taking
    // the title of another note would overwrite it.
    if (title != _savedTitle && library.Contains(title))
        throw new RunicFailureException(new TitleTaken(title));
    // ...
}
```

With ReactiveUI, or any other command property, it goes on the property:

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
/// <summary>Saves the note. A missing or overlong title is a declared failure.</summary>
[RunicFailure(typeof(SaveFailure))]
public ReactiveCommand<RxVoid, RxVoid> SaveCommand { get; }
```

The Bridge replies `domain-failed` with the encoded failure in every
environment, never with the development `detail` of an unexpected failure. It
logs the failure at Debug, not as an error, and its trace span ends with the
outcome `domain_failed`. A misplaced, repeated or unsupported declaration is
the build error `RUNICBRIDGE012`. A synchronous plain `ICommand` reports only a
failure thrown before `Execute` returns; use an asynchronous command for
failures that happen after an `await`. The
[Runic.Application README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.1/packages/dotnet/Runic.Application.Views/README.md#declared-failures)
has the full rules.

## Handle the outcome in TypeScript

The generator emits the failure as a named type in `types.ts`, a union
discriminated by `$case`:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/src/generated/types.ts
/** Why a note could not be saved. */
export type SaveFailure =
  | { readonly $case: "titleRequired" }
  | ({ readonly $case: "titleTaken" } & TitleTaken);
```

The command resolves a `BridgeOutcome`, `{ ok: true, value }` with the new
state or `{ ok: false, failure }`, and its operation carries the failure type:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/src/generated/editor.ts
  /** Saves the note. A missing title, or the title of another saved note, is a declared failure. */
  save(): Promise<BridgeOutcome<EditorState, SaveFailure>>;
  startSave(): Promise<EditorSaveOperation>;
  startSaveWithRequestId(requestId: string): Promise<EditorSaveOperation>;
  recoverSaveWithRequestId(requestId: string): Promise<EditorSaveOperation>;
```

For a `[RunicUnion]` failure, `matchCase` from `@runic-artifex/views` needs a
handler for every `$case`, so a case added in .NET is a compile error until
the frontend handles it. The Notes frontends share one description of Save's
failure:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/src/save-failure.ts
import { matchCase } from "@runic-artifex/views";
import type { SaveFailure } from "./generated/editor.js";

/** The text every Notes frontend shows for Save's declared failure; a new case is a compile error. */
export function describeSaveFailure(failure: SaveFailure): string {
  return matchCase(failure, {
    titleRequired: () => "A note needs a title.",
    titleTaken: taken => `Another note is already called "${taken.existingTitle}".`,
  });
}
```

The plain TypeScript editor checks `ok` and shows the description. A rejection
still means something unexpected went wrong and goes to its `catch`:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/src/editor.ts
const saveClicked = () => {
  void run(async () => {
    const outcome = await writes.run(() => editor.save());
    return outcome.ok ? undefined : describeSaveFailure(outcome.failure);
  });
};
```

A `switch` over `failure.$case` with a `never` check in its `default` works
too. `bridgeSuccess`, `bridgeFailure` and `isBridgeOutcome` build and
recognize outcomes, for example in tests.

### Operations

An operation started with `start{Command}` keeps its status API. `wait()` and
`completion` return a status discriminated by `kind`, which includes
`domain-failed` only when the command declares a failure. `outcome()` waits
like `wait()` and resolves the same `BridgeOutcome` as the command; it rejects
with `BridgeError` when the operation failed unexpectedly, was cancelled or
timed out, and with `BridgeOperationUncertainError` when its outcome is
unknown. A stream keeps the values it published before the failure. The
[Views README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.1/packages/web/views/README.md#declared-failures)
maps every terminal status to `outcome()`.

## Framework command helpers

`useCommand` (React, Vue and Svelte) and `injectCommand` (Angular) expose
`failure` next to `pending` and `error`. `failure` is the declared failure of
the latest run and is typed from the command's `BridgeOutcome`; `error` holds
only unexpected failures. A new run and `reset()` clear both, and a run
superseded by a later one or by `reset()` sets neither.

React state:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/React/src/editor.ts
// A declared failure is save.failure; save.error holds unexpected ones.
const save = useCommand(() => writes.run(() => editor.save()));
// ...
const issue = save.error ?? writeError;
const alert = save.failure !== undefined ? describeSaveFailure(save.failure) : issue !== undefined ? String(issue) : undefined;
```

A Vue reactive property:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Vue/src/editor.ts
// A declared failure is save.failure; save.error holds unexpected ones.
const save = useCommand(() => writes.run(() => props.editor.save()));
// ...
const issue = save.error ?? writeError.value;
const alert = save.failure !== undefined ? describeSaveFailure(save.failure) : issue !== undefined ? String(issue) : undefined;
```

A Svelte rune. The command function returns the outcome, so the helper can
read its failure:

<!-- prettier-ignore -->
```svelte docs-test=source:examples/notes-view-first/Svelte/src/Editor.svelte
// Save waits for the form's queued writes. save.failure is its declared
// failure; the latest run wins, and the button is disabled while it runs.
const save = useCommand(async () => {
  let outcome: Awaited<ReturnType<EditorClient["save"]>> | undefined;
  await form.run(async view => { outcome = await view.save(); });
  return outcome;
});
<!-- ... -->
{#if save.failure}<p role="alert">{describeSaveFailure(save.failure)}</p>
{:else if error ?? editor.error}<p role="alert">{String(error ?? editor.error)}</p>{/if}
```

An Angular signal:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Angular/src/app/bound-editor.ts
@if (save.failure(); as failure) { <p role="alert">{{ describeSaveFailure(failure) }}</p> }
@else if (save.error() ?? binding.error() ?? editor.error(); as issue) { <p role="alert">{{ issue }}</p> }
```

The helpers come from `@runic-artifex/react`, `@runic-artifex/vue`,
`@runic-artifex/svelte` and `@runic-artifex/angular`; other code can use
`createCommandController` from `@runic-artifex/views` directly.

## Effect

In `@runic-artifex/views-effect`, `command` and `operation` succeed with the
outcome's value and move a declared failure into the error channel as the
tagged `ViewDomainFailure<F>`. Commands without a declaration keep their
types. For a `[RunicUnion]` failure, `catchCase` handles every case; for any
other failure type, use `Effect.catchTag("ViewDomainFailure", …)` and read
`error.failure`:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/web/views-effect/README.md
const saved = catchCase(command(() => editor.save()), {
  titleRequired: () => Effect.succeed("A note needs a title."),
  titleTaken: taken => Effect.succeed(`"${taken.existingTitle}" already exists.`),
});
// Or one tag for every case: Effect.catchTag("ViewDomainFailure", error => ...)
```

The Effect Notes editor reports it with the other errors of its save
operation:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Effect/src/editor.ts
}))).pipe(Effect.tapError(failure => Effect.sync(() => showError(
  // Save declares SaveFailure, which arrives as ViewDomainFailure<SaveFailure>.
  failure._tag === "ViewDomainFailure" ? { message: describeSaveFailure(failure.failure) } : failure)))));
```

A declared failure is a terminal outcome, so `operation`'s `retry` never
retries it.

## ReactiveUI: observe ThrownExceptions

A `ReactiveCommand` reports every exception on `ThrownExceptions`, including a
declared `RunicFailureException` that the Bridge already sent to the client.
Without a subscriber, ReactiveUI's default handler breaks into the debugger and
throws. Give every bridged `ReactiveCommand` a subscriber.
`ObserveBridgeExceptions` from `Runic.Application.ReactiveUI` (or its
`.Reactive` flavor) ignores declared failures and cancellations and logs
everything else as `ReactiveCommandFailed` (event 1042):

```csharp docs-test=source:examples/notes-reactive-views/ViewModels.cs
SaveCommand = ReactiveCommand.CreateFromTask(SaveAsync, scheduler);
DiscardCommand = ReactiveCommand.CreateFromTask(DiscardAsync, scheduler);
// A ReactiveCommand also reports its exceptions on ThrownExceptions. The
// Bridge already delivered declared failures; log anything else.
_saveExceptions = SaveCommand.ObserveBridgeExceptions(logger);
_discardExceptions = DiscardCommand.ObserveBridgeExceptions(logger);
```

Dispose the returned subscriptions with the ViewModel. To handle the other
exceptions yourself, pass a callback instead of a logger:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.ReactiveUI/README.md
_discardExceptions = DiscardCommand.ObserveBridgeExceptions(error => status.Report(error));
```

## Test declared failures

In .NET, `RunicWindowTestHost` drives the command by ViewModel member. The
reply and the operation status carry the encoded failure:

```csharp docs-test=source:examples/notes-view-first/Tests/NotesWindowTests.cs
var reply = await editor.ExecuteAsync(vm => vm.SaveCommand);
Assert.Equal("domain-failed", reply.ErrorKind);
Assert.Equal("""{"$case":"titleTaken","existingTitle":"Groceries"}""", reply.Failure?.GetRawText());

// The operation path reports the same failure.
var status = await editor.Start(vm => vm.SaveCommand).WaitAsync();
Assert.Equal("domain-failed", status.Kind);
Assert.Equal("titleTaken", status.Failure?.GetProperty("$case").GetString());
```

In the frontend, the generated typed mock fails with a declared failure in
three ways: a handler throws `mockFailure(failure)` from
`@runic-artifex/views/mock`, as .NET throws `RunicFailureException`;
`failNext(method, { kind: "domain-failed", failure })` fails the next call; and
a `"manual"` operation's `failWith(failure)` ends it `domain-failed`.
`failNext` and `failWith` are type-checked against the method's failure type.
Unexpected failures still reject:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/test/notes.test.ts
test("Save's declared failures resolve its outcome with the typed failure", async () => {
  const editor = mockEditor(bridge, {
    state: { ...draft, title: " " },
    commands: { save: () => { throw mockFailure<SaveFailure>({ $case: "titleRequired" }); } },
  });
  const client = await connectEditor();
  const missing = await client.save();
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(describeSaveFailure(missing.failure), "A note needs a title.");
  editor.failNext("save", { kind: "domain-failed", failure: { $case: "titleTaken", existingTitle: "Groceries" } });
  const taken = await client.save();
  assert.equal(taken.ok ? "" : describeSaveFailure(taken.failure), 'Another note is already called "Groceries".');
  // Unexpected failures still reject.
  editor.failNext("save", { kind: "failed", message: "Disk full." });
  await assert.rejects(client.save(), (error: unknown) => error instanceof BridgeError && error.kind === "failed");
  client.dispose();
});
```

The [tutorial](../tutorial/README.md#7-test-the-window-and-the-frontend) sets
up both test hosts.
