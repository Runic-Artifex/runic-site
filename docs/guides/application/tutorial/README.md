# Windows and Views, step by step

This tutorial builds on the project that `dotnet new runic-app` creates. Each
stage adds one idea: ViewModels, the Window and its Views, opening the Window,
rendering Views in the frontend, writing state from the frontend, and testing.
Every command comes from the template, and every code block is an excerpt of
the template or of an SDK example that the SDK's CI builds and runs.

> The tutorial follows the Runic SDK snapshot these guides are built from,
> with Runic Desktop and ReactiveUI, the template defaults. Words such as
> Window, View and model context are defined in the [glossary](../glossary.md).

## 1. Create the project

```sh docs-test=commands
dotnet new install Runic.Application.Templates@<VERSION>
dotnet new runic-app --name MyApp --frontend react --package-manager npm --host desktop --linux-gtk 3 --desktop-server native --view-models reactiveui
cd MyApp
dotnet tool restore
dotnet runic dev
```

Replace `<VERSION>` with the current release from the
[package catalog](https://docs.runic-artifex.eu/packages/). These are the
template defaults: React, npm, the Runic Desktop host and ReactiveUI. The
other frontends are `vue`, `svelte`, `angular` and, since SDK `0.11.0`,
`sveltekit`. [Choosing a host and MVVM library](../choosing.md) explains the
alternatives.
The app opens in a native window with a Welcome page and a Counter page. Keep
`dotnet runic dev` running; frontend edits reload in place and C# edits
rebuild and restart the app.

## 2. ViewModels own the state

`WorkspaceViewModel.cs` contains ordinary ReactiveUI ViewModels. Runic reads
their public properties as state and their commands as calls the frontend may
make. The Counter page is a read-only count, a step and a label the frontend
may set, and a command:

```csharp docs-test=template:WorkspaceViewModel.cs
public CounterViewModel() =>
    IncrementCommand = ReactiveCommand.Create(() => { Count += Step; });

// As for any MVVM View, the setter's accessibility decides what the web
// frontend may set: Count is read-only state, Step is a form field, so the
// generated client has setStep but no setCount.
public int Count
{
    get => _count;
    private set => this.RaiseAndSetIfChanged(ref _count, value);
}

public int Step
{
    get => _step;
    set => this.RaiseAndSetIfChanged(ref _step, value);
}

// A text form field: the page edits it with the same field binding as Step.
public string Label
{
    get => _label;
    set => this.RaiseAndSetIfChanged(ref _label, value);
}

public ReactiveCommand<RxVoid, RxVoid> IncrementCommand { get; }
```

ReactiveUI 26 Primitives uses `RxVoid` where System.Reactive uses `Unit`. The
workspace selects the page: its commands assign `Main`, for example
`ReactiveCommand.Create(() => { Main = counter; })`. `Main` is ViewModel
content: the frontend receives a reference to the presented ViewModel, not its
state.

```csharp docs-test=template:WorkspaceViewModel.cs
public IWorkspacePage Main
{
    get => _main;
    private set => this.RaiseAndSetIfChanged(ref _main, value);
}

public ReactiveCommand<RxVoid, RxVoid> ShowWelcomeCommand { get; }
public ReactiveCommand<RxVoid, RxVoid> ShowCounterCommand { get; }
```

Nothing here refers to Runic. The ViewModels stay testable and reusable. With
`--view-models toolkit` the same pages are CommunityToolkit.Mvvm ViewModels
with `[ObservableProperty]` and `[RelayCommand]`. To move between more pages,
with Back history, see [pages and navigation](../guides/pages-and-navigation.md).

## 3. The Window and its Views select what the frontend sees

`Views.cs` declares the contract. A Window is the root of one native or browser
window; each View selects a ViewModel that a Window can present. The same
declaration opens on every host:

```csharp docs-test=template:Views.cs
public sealed partial class WorkspaceWindow : RunicWindow<WorkspaceViewModel>;

public sealed partial class WelcomeView : ReactiveRunicView<WelcomeViewModel>;
public sealed partial class CounterView : ReactiveRunicView<CounterViewModel>;
```

The build compiles the project, inspects these partial classes and writes one
TypeScript module per ViewModel to `Frontend/src/generated`, for example
`counter.ts` with `CounterState` and a typed client. The folder is ignored by
Git and regenerated on every build. With CommunityToolkit.Mvvm the Views are
`RunicView<TViewModel>`. Since SDK `0.11.0`, `dotnet new runic-view --name
Settings` adds a `SettingsView` and its `SettingsViewModel` to the project
(`--window` declares a Window instead); register the ViewModel as in the next
step.

## 4. Register and open the Window

`WorkspaceServices.cs` registers the ViewModels with their lifetime, lets the
generated `AddRunicViews()` register the Views and Bridges, and adds the
per-window file dialogs and clipboard:

```csharp docs-test=template:WorkspaceServices.cs
services.AddRunicReactiveModelContext();
services.AddScoped<WorkspaceViewModel>();
services.AddScoped<WelcomeViewModel>();
services.AddScoped<CounterViewModel>();
// Generated by the build: the Window and View Bridges and the View locator.
services.AddRunicViews();
```

`AddRunicReactiveModelContext()` makes the commands deliver their results on
the Window's model context; [ViewModel state and threads](../guides/model-context.md)
explains it. `Program.cs` builds the services and runs the application on
Runic Desktop. The application body opens the Window, which serves the built
frontend from the `www` folder next to the executable, and waits until the user
closes it:

```csharp docs-test=template:Program.cs
var hostOptions = new RunicDesktopHostOptions { ContentSecurityPolicy = developing ? null : contentSecurityPolicy };
...
return RunicDesktopHost.Run(provider, options, hostOptions, RunAsync);
...
// The application is the same on every host: open the Window, then wait until it closes.
static async Task<int> RunAsync(IRunicWindowHost host)
{
    await using var window = await host.OpenWindowAsync<WorkspaceWindow>(new RunicWindowOptions { Width = 1000, Height = 700 });
    await window.WaitForCloseAsync();
    return 0;
}
```

`RunicDesktopHost.Run` starts the event loop the platform needs, so call it
before any `await`. With `--host cswebui` the only difference is the entry
point, `RunicCsWebUiHost.Run(provider, RunAsync)`, which opens a browser
window instead. Since SDK `0.11.0` a new project sends a
Content-Security-Policy without `'unsafe-eval'` outside `Development` through
`RunicDesktopHostOptions.ContentSecurityPolicy`; a page dependency that
evaluates strings needs `'unsafe-eval'` added back. To serve the frontend from
an embedded archive instead of a folder, set
`<RunicApplicationFrontendDelivery>Embedded</RunicApplicationFrontendDelivery>`
or see [Embed and serve assets](../../assets/README.md).

## 5. Render the Views

The frontend connects the generated clients. In React, `useView` connects a
client for the component's lifetime, `useCommand` runs a command and keeps its
pending and error state, and `ViewOutlet` renders the page that `Main`
references:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/App.tsx
const workspace = { connect: connectWorkspace };
const pages = { counter: CounterPage, welcome: WelcomePage } satisfies ViewRegistry<WorkspaceState["main"]>;

// ...
export default function App() {
  const { state, client, error: connectError } = useView(workspace);
  const connection = useBridgeConnection().state;
  const navigate = useCommand((name: "showWelcome" | "showCounter") => client?.[name]());
  const error = navigate.error ?? connectError;
```

The registry is checked against the generated union of page kinds, so adding a
View without a page is a compile error. A kind without a component renders an
English alert; since SDK `0.11.0`, `ViewOutlet`'s optional `missing` replaces
it. Each page connects the reference it receives:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/pages/CounterPage.tsx
export function CounterPage({ page }: { page: CounterPageReference }) {
  const counter = useView(page);
  const { state, client, error: connection } = counter;
  // ...
  const increment = useCommand(() => client?.increment());
```

The other frameworks follow their own idioms. Vue's `useView` from
`@runic-artifex/vue` accepts a ref or getter (`MaybeRefOrGetter`). Svelte
imports from `@runic-artifex/svelte` and passes a getter, so the
connection follows reactive state:

<!-- prettier-ignore -->
```svelte docs-test=template:frontends/svelte/src/App.svelte frontend=svelte
  const workspace = useView(() => ({ connect: connectWorkspace }));
  const connection = useBridgeConnection();
  const navigate = useCommand((name: "showWelcome" | "showCounter") => workspace.client?.[name]());
```

Angular has `injectView()`, `injectCommand()` and `ViewOutlet` from
`@runic-artifex/angular`. Before 0.7.0-preview.7 Angular's outlet was named
`RunicViewOutlet`; the old name remains a deprecated alias until the next major
release.

Since SDK `0.11.0`, `useBridgeConnection()` (React, Vue, Svelte) and
`injectBridgeConnection()` (Angular) follow the page's connection to .NET:
`connecting`, `connected`, `reconnecting` or `lost`, and since SDK `0.15.0`
`closed`, when the application closed the Window. While the Bridge
reconnects, the clients keep the last state the Window sent. Since SDK
`0.14.0` the template's App says so in a banner, and its status line shows an
error with `describeBridgeError` from `@runic-artifex/views`, which turns any
error a binding reports into one English sentence:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/App.tsx
const statusText: Record<BridgeConnectionState, string> = {
  // ...
  // The application closed the Window; a connection drop that follows is not an error.
  closed: "The application closed this window.",
};
// ...
{connection === "reconnecting" && <p role="status">Reconnecting to the .NET Window…</p>}
{connection === "lost" && <p role="alert">The connection to the .NET Window was lost. The page reconnects when the application is back.</p>}
// ...
<p role="status">{error !== undefined ? describeBridgeError(error) : statusText[connection]}</p>
```

## 6. Write state from the frontend

`Step` and `Label` have public setters, so the generated client gains
`setStep` and `setLabel`, which send the value to .NET. `Count` has a private
setter, so the frontend can only read it. Since SDK `0.14.0` the generated
module also exports `CounterFields`, one descriptor per settable member, and
the Counter page binds both fields with `useField`:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/pages/CounterPage.tsx
// Step and Label have public C# setters, so the generated CounterFields has a
// field for each; useField writes them and keeps what the user typed while the
// writes are on their way. Count's setter is private: the page only reads it.
const step = useField(counter, CounterFields.step);
const label = useField(counter, CounterFields.label);
const increment = useCommand(() => client?.increment());
const error = increment.error ?? step.error ?? label.error ?? connection;
```

The descriptor knows the member's kind, so the same call binds the number
select and the text input. `inputProps` holds the element's value and
handlers:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/pages/CounterPage.tsx
<select {...step.inputProps} disabled={!client}>
  {steps.map(value => <option key={value} value={value}>{value}</option>)}
</select>
// ...
<input {...label.inputProps} disabled={!client} />
// ...
{/* Increment waits until the Step it adds has been written. */}
<button disabled={!client || increment.pending || step.editing} onClick={() => void increment.run()}>Increment</button>
```

While its writes are on their way, a field shows what the user typed, keeps at
most one write in flight and writes nothing during IME composition; once the
last write settled it shows the View's value, with any normalization the
ViewModel applied. `editing` is true while such a draft exists. A failed write
keeps the draft and sets the field's `error`, a `BridgeError` from
`@runic-artifex/views`; a failed command is `useCommand`'s `error`. Vue and
Svelte have their own `useField` (`v-model`, `{@attach field.attach}`), and
Angular has `injectField` with the `[runicField]` directive.
[Forms and validation](../guides/forms-and-validation.md) covers the field
API, writes after a pause, checked writes and validation messages. The
[First Window example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.15.0/examples/first-window)
uses the generated client without a framework.

## 7. Test the Window and the frontend

Both halves can be tested without a browser or a native window. The
[CommunityToolkit Notes example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.15.0/examples/notes-view-first)
nests a sidebar, a document and an editor, and tests each side. Its .NET tests
drive the real ViewModels and generated Bridges through `RunicWindowTestHost`
from `Runic.Application.Testing`, with a fake clock:

```csharp docs-test=source:examples/notes-view-first/Tests/NotesWindowTests.cs
Scope = _services.CreateAsyncScope();
// Resolves the shell, its generated Bridge, the View locator and the model
// context the navigator shares from the window's scope.
Host = RunicWindowTestHost.Create<ShellViewModel>(Scope.ServiceProvider,
    new RunicWindowTestHostOptions { TimeProvider = clock });
```

A test then reads and changes typed state the way the browser would:

```csharp docs-test=source:examples/notes-view-first/Tests/NotesWindowTests.cs
var editor = await OpenEditorAsync();
editor.Set(vm => vm.Title, "Groceries").ThrowIfFailed();
editor.Set(vm => vm.Body, "Milk, eggs").ThrowIfFailed();

var save = editor.Start(vm => vm.SaveCommand);
await Assert.That(save.Admission).IsEqualTo(RunicOperationAdmissionKind.Accepted);
```

The frontend tests run the generated clients against generated typed mocks and
the mock Bridge from `@runic-artifex/views/mock`. Renaming a ViewModel member
breaks them at compile time. This one drives the editor's title field the way
its Save button does:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/test/notes.test.ts
beforeEach(() => { bridge = installMockBridge(createMockBridge()); });

test("Save follows the field's write, and a rejected write stops it", async () => {
  const editor = mockEditor(bridge, {
    state: draft,
    setters: { setTitle: (_state, title) => ({ isDirty: title !== "Untitled" }) },
    commands: { save: state => ({ isDirty: false, savedMessage: `Saved ${state.title}` }) },
  });
  const client = await connectEditor();
  const title = createFieldController(EditorFields.title, { commit: "pause" });
  const follow = client.subscribe(state => title.setSource({ state, client }));
  // As the editor's Save button does.
  const save = async () => { await commitFields(title); return client.save(); };
```

Since SDK `0.14.0` every template frontend has such a test of its own, run
with `<package manager> run test` (for example `npm run test`): Vitest renders
the page with happy-dom against the generated typed mocks, without .NET. The
generated mocks come from the build, so run `dotnet build` once first:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/App.test.tsx
const counter = mockCounter(bridge, {
  id: "2",
  state: { count: 0, step: 1, label: "Clicks" },
  commands: { increment: state => ({ count: state.count + state.step }) },
});
```

[Frontend testing](../guides/frontend-testing.md) explains these tests.

The [`Runic.Application.Testing` README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Testing/README.md)
and the [Views testing section](https://github.com/Runic-Artifex/runic-sdk/tree/v0.15.0/packages/web/views#testing)
cover the test host and the generated mocks. Since SDK `0.13.0`,
`createMockBridge({ latency: "slow", reorderRequests: true })` delays every
request, reply and push and admits requests out of order, so a test can type
into a field key by key as a user would; see
[typing in tests](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/web/views/README.md#typing-in-tests).
To test the real page against the
real ViewModels in a browser, its
[`RunicServeOnlyApplication`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Testing/README.md#the-whole-application-in-a-browser)
starts the built application in serve-only mode for any browser driver.

## Where next

- [Pages and navigation](../guides/pages-and-navigation.md) moves between
  pages with Back history and guards.
- [ViewModel state and threads](../guides/model-context.md) explains why
  commands can set state after `await`.
- [Reactive Notes](https://github.com/Runic-Artifex/runic-sdk/tree/v0.15.0/examples/notes-reactive-views)
  uses ReactiveUI routing and several Views over one model.
- [DynamicData](https://github.com/Runic-Artifex/runic-sdk/tree/v0.15.0/examples/dynamicdata)
  presents a large keyed collection through viewports.
- The [`Runic.Application.Views` package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Views/README.md)
  lists the build properties, generator diagnostics, checked writes and
  operations.
- [Forms and validation](../guides/forms-and-validation.md) binds inputs to
  settable members and shows .NET validation messages.
- [Typed domain failures](../guides/typed-failures.md) returns expected
  command failures, such as a missing title, as typed values.
- [Add Runic to an existing app](../existing-app.md) applies the same pieces to
  a project you already have.
