# Windows and Views, step by step

This tutorial builds on the project that `dotnet new runic-app` creates. Each
stage adds one idea: ViewModels, the Window and its Views, opening the Window,
rendering Views in the frontend, writing state from the frontend, and testing.
Every command comes from the template, and every code block is an excerpt of
the template or of an SDK example that the SDK's CI builds and runs.

> **Unreleased.** The tutorial follows the SDK's `main` branch, which becomes
> Runic SDK 0.7.0-preview.1. Differences from the published 0.6.0-preview.1
> are marked where they occur.

## 1. Create the project

```sh docs-test=commands
dotnet new install Runic.Application.Templates@<VERSION>
dotnet new runic-app --name MyApp --frontend react --package-manager npm --host cswebui --view-models toolkit
cd MyApp
dotnet tool restore
dotnet runic dev
```

Replace `<VERSION>` with the current release from the
[package catalog](https://docs.runic-artifex.eu/packages/). These are the
template defaults: React, npm, the CS-WebUI host and CommunityToolkit.Mvvm. The app opens with a Welcome page and a Counter page.
Keep `dotnet runic dev` running; frontend edits reload in place and C# edits
rebuild and restart the app.

## 2. ViewModels own the state

`WorkspaceViewModel.cs` contains ordinary CommunityToolkit.Mvvm ViewModels.
Runic reads their public properties as state and their commands as calls the
frontend may make. The Counter page is one property and one command:

```csharp docs-test=template:WorkspaceViewModel.cs
public sealed partial class CounterViewModel : ObservableObject, IWorkspacePage
{
    private int _count;
    public int Count { get => _count; private set => SetProperty(ref _count, value); }

    [RelayCommand]
    private void Increment() => Count++;
}
```

The workspace selects the page. `Main` is ViewModel content: the frontend
receives a reference to the presented ViewModel, not its state.

```csharp docs-test=template:WorkspaceViewModel.cs
public IWorkspacePage Main
{
    get => _main;
    private set => SetProperty(ref _main, value);
}

[RelayCommand]
private void ShowWelcome() => Main = _welcome;

[RelayCommand]
private void ShowCounter() => Main = _counter;
```

Nothing here refers to Runic. The ViewModels stay testable and reusable.

## 3. The Window and its Views select what the frontend sees

`Views.cs` declares the contract. A Window is the root of one native or browser
window; each View selects a ViewModel that a Window can present:

```csharp docs-test=template:Views.cs
public sealed partial class WorkspaceWindow(CsWebUiBridgeWindow<WorkspaceViewModel> host)
    : CsWebUiWindow<WorkspaceViewModel>(host);

public sealed partial class WelcomeView : RunicView<WelcomeViewModel>;
public sealed partial class CounterView : RunicView<CounterViewModel>;
```

The build compiles the project, inspects these partial classes and writes one
TypeScript module per ViewModel to `Frontend/src/generated`, for example
`counter.ts` with `CounterState` and a typed client. The folder is ignored by
Git and regenerated on every build.

With `--host desktop` the Window wraps a Runic Desktop window instead and
exposes it as `Presentation`:

```csharp docs-test=template:Views.cs host=desktop
public sealed partial class WorkspaceWindow(DesktopBridgeWindow<WorkspaceViewModel> host)
    : RunicWindow<WorkspaceViewModel>(host.ViewModel), IAsyncDisposable
{
    public DesktopWindow Presentation => host.Presentation;
    public ValueTask DisposeAsync() => host.DisposeAsync();
}
```

## 4. Register and open the Window

`Program.cs` registers the ViewModels with their lifetime and lets the generated
`AddRunicViews()` register the Views and Bridges:

```csharp docs-test=template:Program.cs
var services = new ServiceCollection();
services.AddScoped<WorkspaceViewModel>();
services.AddScoped<WelcomeViewModel>();
services.AddScoped<CounterViewModel>();
services.AddRunicViews();
```

The CS-WebUI host then opens the built frontend from the `www` folder next to
the executable:

```csharp docs-test=template:Program.cs
await using (var window = provider.OpenWindow<WorkspaceWindow, WorkspaceViewModel>(host => new WorkspaceWindow(host)))
{
    window.SetRootFolder(Path.Combine(AppContext.BaseDirectory, "www"));
    window.Show("index.html");
    WebUiApplication.Wait();
}
```

The Runic Desktop host passes the same folder as typed surface content:

```csharp docs-test=template:Program.cs host=desktop
await using var window = await provider.OpenDesktopWindowAsync<WorkspaceWindow, WorkspaceViewModel>(
    desktop,
    new DesktopSurfaceOptions { Content = new DesktopContent.Directory(Path.Combine(AppContext.BaseDirectory, "www"), "index.html") },
    host => new WorkspaceWindow(host),
```

`DesktopContent` is new in 0.7. In 0.6.0-preview.1 the same window sets
`RootFolder` and `Content = "index.html"`. To serve the frontend from an
embedded archive instead of a folder, see
[Embed and serve assets](../../assets/README.md).

## 5. Render the Views

The frontend connects the generated clients. In React, `useView` connects a
client for the component's lifetime, `useCommand` runs a command and keeps its
pending and error state, and `ViewOutlet` renders the page that `Main`
references:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/App.tsx
const workspace = { connect: connectWorkspace };
const pages = { counter: CounterPage, welcome: WelcomePage } satisfies ViewRegistry<WorkspaceState["main"]>;

export default function App() {
  const { state, client, error: connection } = useView(workspace);
  const navigate = useCommand((name: "showWelcome" | "showCounter") => client?.[name]());
```

The registry is checked against the generated union of page kinds, so adding a
View without a page is a compile error. Each page connects the reference it
receives:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/pages/CounterPage.tsx
export function CounterPage({ page }: { page: CounterPageReference }) {
  const { state, client, error: connection } = useView(page);
  const increment = useCommand(() => client?.increment());
  const error = increment.error ?? connection;
```

The other frameworks follow their own idioms. Vue's `useView` from
`@runic-artifex/vue` accepts a ref or getter (`MaybeRefOrGetter`). Svelte
imports from `@runic-artifex/svelte/views` and passes a getter, so the
connection follows reactive state:

<!-- prettier-ignore -->
```svelte docs-test=template:frontends/svelte/src/App.svelte frontend=svelte
  const workspace = useView(() => ({ connect: connectWorkspace }));
  const navigate = useCommand((name: "showWelcome" | "showCounter") => workspace.client?.[name]());
```

Angular has `injectView()`, `injectCommand()` and `RunicViewOutlet` from
`@runic-artifex/angular`.

The command helpers (`useCommand`, `injectCommand`) and the React and Vue
`ViewOutlet` are new in 0.7. Svelte's `ViewOutlet`, Angular's
`RunicViewOutlet` and `ViewRegistry` are already in 0.6.0-preview.1; 0.6
React and Vue projects select the page component themselves, and 0.6 projects
call the client methods directly in `try`/`catch`.

## 6. Write state from the frontend

The [First Window example](https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/first-window)
extends the counter with a writable step. A public setter makes a property
writable from the frontend:

```csharp docs-test=source:examples/first-window/CounterViewModel.cs
[ObservableProperty] private int step = 1;

[RelayCommand]
private void Increment() => Count += Step;
```

The generated client gains `setStep`, which sends the value to .NET. The
example uses the client without a framework:

<!-- prettier-ignore -->
```ts docs-test=source:examples/first-window/Frontend/src/app.ts
step.addEventListener("blur", async () => {
  try {
    await counter.setStep(Number(step.value));
    status.textContent = "Step updated.";
  } catch (error) {
    status.textContent = String(error);
```

A rejected write or command rejects with the `BridgeError` from
`@runic-artifex/views`.

## 7. Test the Window and the frontend

Both halves can be tested without a browser or a native window. The
[CommunityToolkit Notes example](https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/notes-view-first)
nests a sidebar, a document and an editor, and tests each side. Its .NET tests
drive the real ViewModels and generated Bridges through `RunicWindowTestHost`
from `Runic.Application.Testing`, with a fake clock:

```csharp docs-test=source:examples/notes-view-first/Tests/NotesWindowTests.cs
_host = new RunicWindowTestHost<ShellViewModel>(
    window.GetRequiredService<ShellViewModel>(),
    window.GetRequiredService<Func<IBridgeTransport, WindowContentSession, ShellViewModel, IDisposable>>(),
    new RunicWindowTestHostOptions
    {
        ViewLocator = window.GetRequiredService<IRunicViewLocator>(),
        TimeProvider = _clock,
    });
```

A test then reads and changes typed state the way the browser would:

```csharp docs-test=source:examples/notes-view-first/Tests/NotesWindowTests.cs
var editor = await OpenEditorAsync();
editor.Set(vm => vm.Title, "Groceries").EnsureOk();
editor.Set(vm => vm.Body, "Milk, eggs").EnsureOk();

var save = editor.Start(vm => vm.SaveCommand);
Assert.Equal("accepted", save.Admission);
```

The frontend tests run the generated clients against generated typed mocks and
the mock Bridge from `@runic-artifex/views/mock`. Renaming a ViewModel member
breaks them at compile time:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/test/notes.test.ts
beforeEach(() => { bridge = installMockBridge(createMockBridge()); });

test("a rejected field write stops the save that follows it", async () => {
  const editor = mockEditor(bridge, {
    state: draft,
    setters: { setTitle: (_state, title) => ({ isDirty: title !== "Untitled" }) },
    commands: { save: state => ({ isDirty: false, savedMessage: `Saved ${state.title}` }) },
  });
  const client = await connectEditor();
```

`RunicWindowTestHostOptions`, the typed `Root` driver and the generated
`*.mock.ts` files are new in 0.7. In 0.6 the test host takes the root route
name and exchanges JSON; see the
[`Runic.Application.Testing` README](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Testing/README.md)
and the [Views testing section](https://github.com/Runic-Artifex/runic-sdk/tree/main/packages/web/views#testing).

## Where next

- [Reactive Notes](https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/notes-reactive-views)
  uses ReactiveUI routing and several Views over one model.
- [DynamicData](https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/dynamicdata)
  presents a large keyed collection through viewports.
- The [`Runic.Application` package guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views/README.md)
  lists the build properties, generator diagnostics, checked writes and
  operations.
- [Typed domain failures](../guides/typed-failures.md) returns expected
  command failures, such as a missing title, as typed values.
- [Add Runic to an existing app](../existing-app.md) applies the same pieces to
  a project you already have.
