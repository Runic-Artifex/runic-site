# Testing frontends

A Runic frontend can be tested without .NET, a native window or a browser. The
generator writes a typed mock next to each generated client, and
`@runic-artifex/views/mock` provides an in-memory Bridge that answers the
generated clients as a .NET Window does. A test installs the mock Bridge,
describes each View's state and handlers, renders the page and checks what it
shows.

> Since SDK `0.14.0`, every `runic-app` frontend has such a test. Every code
> block is an excerpt of the `runic-app` template, of the
> [Notes example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.14.0/examples/notes-view-first)
> or of a package README, at SDK `0.14.0`.

## The template's test

Run the test from the `Frontend` directory with the package manager you chose:

```sh docs-test=commands
cd Frontend
npm run test
```

The test needs `Frontend/src/generated`, which the .NET build writes, so build
the project once first. It renders the page in a simulated DOM with Vitest
5.0.3 and happy-dom 21.0.4, which the template adds as devDependencies:

```json docs-test=template:frontends/react/package.json
"test": "vitest run",
...
"happy-dom": "21.0.4",
...
"vitest": "5.0.3"
```

The test connects the page, opens the Counter, increments it and checks the
connection banner while the Bridge reconnects. This is the React version:

<!-- prettier-ignore -->
```tsx docs-test=template:frontends/react/src/App.test.tsx
test("the page connects, increments the Counter and reports a reconnect", async () => {
  // Each test installs a new Bridge; generated clients then start from a new page runtime.
  const bridge = installMockBridge(createMockBridge());
  const welcome = mockWelcome(bridge, { id: "1", state: { greeting: "Your first Runic View is ready." } });
  const counter = mockCounter(bridge, {
    id: "2",
    state: { count: 0, step: 1, label: "Clicks" },
    commands: { increment: state => ({ count: state.count + state.step }) },
  });
  mockWorkspace(bridge, {
    state: { main: welcome.reference },
    commands: { showWelcome: () => ({ main: welcome.reference }), showCounter: () => ({ main: counter.reference }) },
  });

  root = createRoot(document.body.appendChild(document.createElement("div")));
  root.render(<App />);
  await vi.waitFor(() => expect(text()).toContain("Your first Runic View is ready."));
  await vi.waitFor(() => expect(text()).toContain("Connected to the .NET Window."));

  button("Counter").click();
  // Increment is enabled once the Counter client has connected.
  await vi.waitFor(() => expect(button("Increment").disabled).toBe(false));
  button("Increment").click();
  await vi.waitFor(() => expect(document.querySelector(".count")?.textContent?.trim()).toBe("1"));

  // While the Bridge reconnects, the page keeps the last state and says so.
  bridge.disconnect();
  await vi.waitFor(() => expect(text()).toContain("Reconnecting to the .NET Window…"));
  expect(document.querySelector(".count")?.textContent?.trim()).toBe("1");
  bridge.reconnect();
  await vi.waitFor(() => expect(text()).toContain("Connected to the .NET Window."));
  expect(text()).not.toContain("Reconnecting");
});
```

The other frontends run the same steps:

- Vue: [`src/App.test.ts`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/tools/Runic.Application.Templates/content/runic-app/frontends/vue/src/App.test.ts).
- Svelte and SvelteKit:
  [`src/App.test.ts`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/tools/Runic.Application.Templates/content/runic-app/frontends/svelte/src/App.test.ts)
  and
  [`src/routes/page.test.ts`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/tools/Runic.Application.Templates/content/runic-app/frontends/sveltekit/src/routes/page.test.ts).
  Their
  [`vitest.config.ts`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/tools/Runic.Application.Templates/content/runic-app/frontends/svelte/vitest.config.ts)
  merges the Vite configuration and resolves the `browser` condition, so
  Svelte's browser build provides `mount()`.
- Angular:
  [`src/app/app.spec.ts`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/tools/Runic.Application.Templates/content/runic-app/frontends/angular/src/app/app.spec.ts).
  `run test` runs `ng test`, whose `test` target in `angular.json` uses the
  `@angular/build:unit-test` builder with Vitest. The test creates the
  component with `TestBed` and waits for Angular to render:

<!-- prettier-ignore -->
```ts docs-test=template:frontends/angular/src/app/app.spec.ts frontend=angular
// Waits until Angular has rendered the latest state.
const rendered = (check: () => void) => vi.waitFor(async () => { await fixture!.whenStable(); check(); });
```

Add your own tests next to it. The SDK's template tests run every frontend's
test after its typecheck.

## Typed mocks

For each generated client, such as `editor.ts`, the generator writes
`editor.mock.ts`, which exports `mockEditor(bridge, definition)`. The mock
takes its state, setter, command, operation and interaction types from the
client, so a renamed or retyped ViewModel member breaks the test at compile
time. It encodes typed values for the wire, such as a `bigint` as an `Int64`
string, and decodes call arguments for the handlers.

Install a new Bridge in each test, so that the generated clients start from a
new page runtime:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/test/notes.test.ts
let bridge: MockBridge;

// Each test installs a new Bridge; generated clients then start from a new page runtime.
beforeEach(() => { bridge = installMockBridge(createMockBridge()); });
```

`createMockBridge(options)` creates the producer and `installMockBridge`
installs it as the page's `__runicBridge`, before the first `connect<Name>()`
call. Without an argument, `installMockBridge()` creates one with the default
options.

A definition takes:

- `state`: the client state. Command availability (`can<Command>`) and
  execution (`is<Command>Executing`) default to available and idle. A content
  member holds another mock's `reference`.
- `id`: presents the mock as content on route `content<id>` instead of the root
  route, as the Welcome and Counter pages above.
- `setters`, `commands` and `canExecute`: handlers by client method. A handler
  receives the decoded state and arguments and returns state changes; a thrown
  error becomes the client's `BridgeError`.
- `resolveKey`: for a command with `[RunicCommandKey]`, whether .NET would find
  an object for the key.
- `operations`: handlers for `start<Command>()`. `"manual"` keeps each operation
  running until the test calls `succeed(result)`, `fail(message)`,
  `failWith(failure)`, `cancel()` or, for a stream, `emit(...items)` on
  `mock.operations.<command>[n]`.

The returned mock has `state`, `update(changes)`, which pushes a new state as a
.NET publication does, and `calls`, the requests it received.

## Failures and reconnects

`failNext(method, failure)` answers the next call of a method with a failure.
A declared failure (see [Typed domain failures](typed-failures.md)) has kind
`domain-failed` and is typed by the method; other kinds reject:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/test/notes.test.ts
editor.failNext("save", { kind: "domain-failed", failure: { $case: "titleTaken", existingTitle: "Groceries" } });
const taken = await client.save();
assert.equal(taken.ok ? "" : describeSaveFailure(taken.failure), 'Another note is already called "Groceries".');
// Unexpected failures still reject.
editor.failNext("save", { kind: "failed", message: "Disk full." });
await assert.rejects(client.save(), (error: unknown) => error instanceof BridgeError && error.kind === "failed");
```

A handler that throws `mockFailure(failure)` fails with the declared failure,
as `throw new RunicFailureException(...)` does in .NET.
`pushFailure({ message })` pushes a failure notice: the client keeps its last
state and reports the error. On the Bridge,
`bridge.failNext({ route, kind, member? }, { kind: "transport" })` rejects the
request itself, like a dropped connection.

`bridge.disconnect()` rejects further requests and reports the loss to the
page's connection listeners, so `useBridgeConnection()` and
`injectBridgeConnection()` report `reconnecting`. `bridge.reconnect()` reports
a new connection; the clients send a new `hello` and open their Views again,
as the template's test checks. `failNext` takes no `disconnected` kind,
because .NET never sends it.

## Virtual time

`bridge.sleep(ms)` resolves in virtual time, which only `bridge.advance(ms)`
moves. A handler that models latency with it keeps its call pending until the
test advances the clock:

<!-- prettier-ignore -->
```ts docs-test=source:examples/notes-view-first/Frontend/test/notes.test.ts
test("saving stays pending until the virtual clock passes the storage delay", async () => {
  mockEditor(bridge, {
    state: { ...draft, title: "Groceries", isDirty: true },
    commands: {
      save: async state => {
        await bridge.sleep(250);
        return { isDirty: false, savedMessage: `Saved ${state.title}` };
      },
    },
  });
  const client = await connectEditor();
  let saved = false;
  const save = client.save().then(() => { saved = true; });

  await bridge.advance(249);
  assert.equal(saved, false);
  await bridge.advance(1);
  await save;
```

`createMockBridge({ scheduling: "manual" })` also queues every request, reply
and push until the test calls `flush()`, `flushUntil(promise)` or
`advance(ms)`, so the test decides when the client observes each one.
`flush()` delivers everything that is due until the client is idle;
`flushUntil(promise)` flushes until the promise settles and returns its
result, and fails when it cannot settle without time passing.

## Behaviour that 0.14 tests meet

**Notifications.** Since SDK `0.14.0`, a client delivers new state to its
subscribers once per animation frame, so a burst of frames renders once.
happy-dom has animation frames, so a test double of `__runicBridge` sees
subscribers notified at the next one. The mock Bridge delivers the state of
each push to subscribers at once, and `flush()` delivers the rest, so a test
reads the result of a push right after it. An awaited call, such as
`await counter.increment()`, still resolves after its state was delivered.

**Kept clients.** Since SDK `0.14.0`, a binding (`useView`, `injectView`,
`createViewController`) does not dispose its client when its component
unmounts. It keeps it connected for `keepAlive` milliseconds (2000 by
default), and the next binding of the same connector takes it over. A test
that checks that a route closes on unmount passes `keepAlive: 0`, as
`useView(page, { keepAlive: 0 })` or `injectView(page, { keepAlive: 0 })`, or
waits for the period. See
[Client lifetime](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/packages/web/views/README.md#client-lifetime).

**Requests before `hello`.** Since SDK `0.14.0`, a request that reaches the
mock before the connection's `hello` is held up to 5 seconds and admitted
after the `hello`, as a .NET Window does; it no longer answers `no-hello` at
once. To test `no-hello`, use `scheduling: "manual"` and advance the virtual
clock past the 5 seconds. The client sends a connection's first requests,
such as `open`, right after its `hello`, so a test double of `__runicBridge`
can receive them before it answered the `hello`.

**Typing.** With the default mock, every reply arrives before the next key, so
a test that types never sees the race a real host has. Give the mock latency,
and admit requests out of order:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/web/views/README.md
const bridge = installMockBridge(createMockBridge({ latency: "slow", reorderRequests: true }));
bridge.view("person", { state: { name: "" } });
```

`latency: "slow"` delays every request, reply and push by 30 to 120 ms;
`latency` also takes milliseconds or `{ min, max }`. Replies and pushes keep
their order. `reorderRequests: true` admits requests due together newest
first, so stale edits answer `superseded`. Type key by key, as a user does:
Playwright `locator.pressSequentially(text)` or Testing Library
`await user.type(input, text)`. `fill()` and setting `value` write the whole
text at once and hide the race. Then check every character in the field and
in the mock's state. See [Forms and validation](forms-and-validation.md) for
the field bindings these tests exercise.

## The .NET side

`Runic.Application.Testing` tests the ViewModels and their generated .NET
handlers without a browser: `RunicWindowTestHost` runs a real
`WindowContentSession` over an in-memory transport, and its drivers address
members as the generated TypeScript client does. `dotnet new runic-app --tests`
adds a TUnit project that uses it.

Since SDK `0.14.0`, every driver request has an asynchronous method that does
not block a thread: `SnapshotAsync`, `SetAsync`, `ExecuteAsync`, `StartAsync`,
`ViewAsync` and others. Use them in suites that run tests in parallel.
`ExecuteAsync(command, input)` takes the command input as a .NET value instead
of JSON, and `RunicWindowTestHost.Create(services, viewModel)` creates a host
for a ViewModel the test constructed, with the Bridge and other services from
the provider:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Testing/README.md
var sidebar = await host.Root.ViewAsync<SidebarViewModel>(vm => vm.Sidebar);
(await sidebar.ExecuteAsync(vm => vm.OpenNotesCommand)).ThrowIfFailed();
var document = await host.Root.ViewAsync<DocumentViewModel>(vm => vm.Main);
var editor = await document.ViewAsync<EditorViewModel>(vm => vm.CurrentPane);
(await editor.SetAsync(vm => vm.Title, "Groceries")).ThrowIfFailed();
(await editor.ExecuteAsync(vm => vm.TagCommand, new TagInput("shopping", Pinned: true))).ThrowIfFailed();
```

The
[`Runic.Application.Testing` README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/packages/dotnet/Runic.Application.Testing/README.md)
covers hosts, deterministic time, navigation and interactions. For
operations, see [Operations and cancellation](operations-and-cancellation.md).

## Further reading

- [Testing](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/packages/web/views/README.md#testing)
  in the `@runic-artifex/views` README: every mock option.
- [The Notes example's frontend tests](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/examples/notes-view-first/Frontend/test/notes.test.ts),
  which run with `bun test`.
- [Upgrading from 0.13 to 0.14](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/docs/migration-1.0.md#from-013-to-014).
