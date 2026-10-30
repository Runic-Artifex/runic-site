# Forms and validation

A form binds inputs to ViewModel properties that the page may set. Since SDK
`0.14.0`, every frontend binds such a property through one field API: it knows
the member's type, keeps what the user typed while writes are on their way,
reads checked-write receipts and shows the validation messages that .NET
reports for the member.

> This guide follows Runic SDK 0.14.0. Code blocks are excerpts of the
> [Notes examples](https://github.com/Runic-Artifex/runic-sdk/tree/v0.14.0/examples/notes-view-first),
> which the SDK's CI builds and tests, or of the package READMEs. The
> [Views README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/packages/web/views/README.md#fields)
> is the reference for the field controller.

## Field descriptors

The build writes a `{View}Fields` object into each generated module that has
settable members, with one descriptor per member. The Notes editor has two:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/src/generated/editor.ts
export const EditorFields: {
  readonly title: BridgeField<EditorClient, EditorState, string>;
  readonly body: BridgeField<EditorClient, EditorState, string>;
} = {
  title: {
    name: "title", kind: "text",
    read: state => state.title,
    write: (client, value) => client.setTitle(value),
    checked: (client, value, options) => client.writeTitle(value, options),
    baseline: client => client.fieldBaseline("title"),
  },
```

`kind` is `text` (any TypeScript `string`, including `Guid`, dates and
decimals), `number` (with `integer` for integer types), `bigint`, `boolean`,
`choice` (an enum, whose names are in `choices`) or `value` (objects, lists and
unions). `nullable` marks a nullable member. `read` and `write` are the member
and its setter; `checked` and `baseline` are its checked write and its
`fieldBaseline`. A View with validation also has `errors(state)`: the member's
messages from `{name}Errors`, or from `validation` at the member's path,
followed by the messages of the values below it.

## Binding a field

Each framework wraps the same controller, `createFieldController` from
`@runic-artifex/views`. Pass the View handle and a descriptor.

React's `useField` returns the field's state and `inputProps` to spread on an
`<input>`, `<textarea>` or `<select>` (a checkbox for a boolean field):

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/React/src/editor.ts
// A field is written after a pause in typing or when it loses focus, not on every keystroke.
const title = useField(view, EditorFields.title, { commit: "pause" });
const body = useField(view, EditorFields.body, { commit: "pause" });
// ...
h("label", null, "Title ", h("input", title.inputProps)),
h("label", null, "Body ", h("textarea", body.inputProps)),
```

Vue's `useField` returns a `reactive` handle; `v-model` reads and sets `value`,
or `text` for a number input:

<!-- prettier-ignore -->
```vue docs-test=readme:packages/web/vue/README.md
<input v-model="title.value" @blur="title.commit" :aria-invalid="title.errors.length > 0 || title.error !== undefined">
<p v-for="message in title.errors" :key="message" role="alert">{{ message }}</p>
```

Svelte's `useField` takes a getter of the View and wires the element through an
attachment:

<!-- prettier-ignore -->
```svelte docs-test=source:examples/notes-view-first/Svelte/src/Editor.svelte
const title = useField(() => editor, EditorFields.title, { commit: "pause" });
<!-- ... -->
<label>Title <input {@attach title.attach}></label>
```

Angular's `injectField` returns signals (`value()`, `errors()`, …) and actions.
The `[runicField]` directive from `@runic-artifex/angular/forms` wires the
element and is also the `ControlValueAccessor` and validator of a
`formControl` or `formControlName` on the same element:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Angular/src/app/bound-editor.ts
<form [formGroup]="form">
  <label>Title <input formControlName="title" [runicField]="title" /></label>
  <label>Body <textarea formControlName="body" [runicField]="body"></textarea></label>
</form>
// ...
readonly title = injectField(this.editor, this.operations.field(EditorFields.title), { commit: "pause" });
```

The View's value flows into the control without marking it dirty, `setValue`
and `reset` write through to the View, and the control has the error
`{ runic: errors }` while the member has validation messages. For Signal Forms,
`runicFieldModel(handle)` is a `WritableSignal` for `form()`, and
`validateRunicField(path, handle)` adds the field's messages as errors of kind
`runic`:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/web/angular/README.md
readonly title = injectField(this.editor, EditorFields.title);
readonly titleForm = form(runicFieldModel(this.title), path => validateRunicField(path, this.title));
```

Signal Forms does not report blur to the field, so bind
`(blur)="title.commit()"` next to `[formField]`; it also writes during IME
composition, where `[runicField]` does not. `@angular/forms` is an optional
peer dependency, needed only for `@runic-artifex/angular/forms`.

Without a framework, `bindField(element, client, field, options?)` creates the
controller, follows the client's state, writes on `input` (`change` for a
`<select>` or checkbox), commits on blur and sets `aria-invalid`:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/src/editor.ts
const title = bindField(titleInput, editor, EditorFields.title, { commit: "pause" });
const body = bindField(bodyInput, editor, EditorFields.body, { commit: "pause" });
```

`attachField(element, controller)` wires an element to a controller that the
page feeds itself. `createFieldController(field, options)` is the controller
alone, for other bindings and for tests; the page passes it the View's state
with `setSource({ state, client })` and the user's input with `inputText`,
`compositionStart` and `compositionEnd`.

## Field state

Every binding exposes the same state:

- `value`: the draft while one exists, otherwise the member's value;
- `text`: what a text input shows. A text that does not parse yet stays as
  typed, such as `1.` while the user types `1.5` into a number field;
- `editing`: a draft exists. Keep the input enabled while it is true, and
  disable the buttons that start other work instead;
- `error`: why the latest write or text failed, a `BridgeError` or a
  `FieldError`;
- `errors`: the member's validation messages, `[]` when valid;
- `conflict`: the producer's `{ value, version }` while a checked write's
  conflict keeps the draft.

A `FieldError`'s `kind` is `rejected`, `conflict`, `committed-with-error` or
`invalid-text`. `invalid-text` means the text does not parse for the field's
kind, such as `-` in a number field: it stays the draft and nothing is written
until it parses. An empty text is `null` for a nullable number, choice or
boolean. `describeBridgeError(error)` from `@runic-artifex/views` turns either
kind of error into one English sentence.

While writes are in flight, the field shows the user's draft, so a reply to an
older keystroke never replaces newer text. At most one write is in flight, and
text typed meanwhile is written next. Nothing is written during IME
composition. Once the last write settled, the field shows the View's value
with any normalization the setter applied, so normalize on commit, not on
every key.

## When fields write

The default, `commit: "input"`, writes each input, coalesced. `commit:
"pause"` writes the draft after `delay` milliseconds without input (700 by
default), at once on `commit()`, and on blur; use it where each write is an
undo step or starts work in .NET.

`commit()` resolves with the field's state once its writes settled. A command
that depends on the field, such as Save, awaits it and skips the command when
a write failed. In React, read the error from the resolved state, because the
handle belongs to an older render:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/React/src/editor.ts
const save = useCommand(async () => {
  const fields = await Promise.all([title.commit(), body.commit()]);
  return fields.every(field => field.error === undefined) ? editor.save() : undefined;
});
```

Without a framework, `commitFields(...fields)` commits every field and rejects
with the first failed field's error:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/src/editor.ts
// Save follows the fields' writes; a write that failed stops it.
await commitFields(title, body);
const outcome = await editor.save();
```

Text that waits for its pause is written when the field is disposed.

## Checked writes

`checked: true` writes with the member's generated checked write
(`write{Property}`) instead of its setter. The write is checked against the
value and version the field showed when the draft started, so a change by
another writer while the user edits is a conflict instead of being
overwritten. Checked writes go one at a time. The field reads each receipt:

| Receipt                | Field                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `applied`              | Success. The receipt's `validation`, the member's messages after the write, is `errors` when the descriptor has no `errors`.                   |
| `rejected`             | The draft stays, and `error` is a `FieldError` `rejected` with the setter's message. The next input writes again.                              |
| `conflict`             | The draft stays, `conflict` holds the producer's value, and nothing is written until `retry()` writes the draft over it or `reset()` takes it. |
| `committed-with-error` | The value was committed and the draft is dropped; `error` is a `FieldError` `committed-with-error`.                                            |

The React README shows a conflict with both choices:

<!-- prettier-ignore -->
```tsx docs-test=readme:packages/web/react/README.md
{title.conflict && <p role="alert">
  Changed elsewhere to “{title.conflict.value}”.
  <button onClick={title.retry}>Keep mine</button> <button onClick={title.reset}>Take theirs</button>
</p>}
```

`keepDraftOnError: false` shows the View's value after a failed, rejected or
conflicting write instead of the draft.

Long text does not cross whole on every key. Under the `text-splice/1`
feature, which the page and .NET negotiate on their own, setters and checked
writes of a `string` member send only the changed range, and .NET rebuilds the
value before it calls the setter. Nothing changes in application code; see
[long text](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/packages/web/views/README.md#long-text-splices).

## Validation from .NET

The page does not run validation rules. A ViewModel or nested DTO that
implements `INotifyDataErrorInfo` gets a `validation` member
(`hasErrors`, `truncated` and `errors`, each with a `path` and a `message`)
and a `{name}Errors` array per member; the field's `errors` reads them.
ReactiveUI.Validation rules work through the same path. A
`ReactiveValidationObject` is read through its `ValidationContext`:

```csharp docs-test=skip:illustrative-fragment
using ReactiveUI.Validation.Extensions;
using ReactiveUI.Validation.Helpers;

public sealed class PasswordViewModel : ReactiveValidationObject
{
    public PasswordViewModel()
    {
        // longEnough and uncommon are IObservable<bool> rules.
        this.ValidationRule(vm => vm.NewPassword, longEnough, "Use at least 12 characters.");
        this.ValidationRule(uncommon, "Choose a less common password.");
    }
}
```

A rule with a property reports at that property's path; a rule that names no
property reports at the object's path. Since SDK `0.14.0`:

- the generated Bridge observes each `ValidationContext` in the state graph,
  so a rule that names no property publishes `validation` when it changes;
- a type that implements only `IValidatableViewModel`, without
  `INotifyDataErrorInfo`, also gets `validation` (but no `{name}Errors`
  arrays); its `ValidationContext` property is not part of the contract;
- `RunicValidationMessage.MemberPaths` may index lists and dictionaries, such
  as `Items[0].Name` or `Lookup[primary].Name`;
- an empty or blank message is reported as `Invalid value.`;
- a checked write's `applied` receipt carries the property's messages as
  `validation` when the write left it invalid.

A type that implements another interface named `IValidatableViewModel` gets
warning `RUNICBRIDGE031`. Since SDK `0.14.0`, Runic is built and tested
against the first stable releases of the ReactiveUI.Validation fork:
`RunicArtifex.ReactiveUI.Validation` 9.0.0 for ReactiveUI.Primitives and
`RunicArtifex.ReactiveUI.Validation.Reactive` 9.0.0 for System.Reactive
(namespaces `ReactiveUI.Validation.Reactive.*`). The application references
the one that matches its ReactiveUI flavour; the generated Bridge needs no
further package. The
[Views package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/packages/dotnet/Runic.Application.Views/README.md#structured-validation)
and the
[validation wire format](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/specs/application/README.md#validation)
describe paths, order and limits.

## Upgrading from 0.13

`useTextField`, `injectTextField` and `createTextFieldController` keep
working, but their behaviour changed where `write` is a checked write. Before,
every resolved write counted as a success, so a `rejected` or `conflict`
receipt dropped the draft silently. Now `rejected` and `conflict` keep the
draft and set `error` to a `FieldError`, `committed-with-error` sets it after
committing, and the receipt's `validation` is `errors`. `TextFieldState` is
now `FieldState<string>` with `text`, `errors` and `conflict`, so a test that
compares the whole state sees the new members.

For generated members, move to the field API:

- a number or choice member set through a command per key or a hand-made
  computed becomes `useField(view, CounterFields.step)` or `injectField`;
- app-local adapters, such as a Reactive Forms bridge or a Svelte function
  binding, become `[runicField]`, `runicFieldModel` with
  `validateRunicField`, or Svelte's `useField`;
- a hand-written debounce or a native `change` event becomes
  `commit: "pause"` with `delay`, and `await field.commit()` before Save;
- `{name}Errors` or `validation.errors` shown next to an input by hand become
  the field's `errors`.

The [migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/docs/migration-1.0.md#fields)
lists these changes, and
[Typed domain failures](typed-failures.md) shows how Save reports its declared
failures after the fields' writes.
