# Port a WPF view to a web page

[Adopt Runic incrementally in WPF](wpf-incremental.md) and
[Host Runic Views in a WPF app](wpf-hybrid.md) cover adoption, the project
layout, `RunicViewHost` and close guards. This guide covers the view itself:
where each habit of a WPF view goes when the view becomes a web page that
presents the same ViewModel.

Each section pairs a WPF pattern with the Runic feature that replaces it: a
minimal before and after, what behaves differently, and the package README
section with the details. The examples are Angular; each section names the
React, Vue and Svelte equivalent. This guide follows Application SDK `0.24.0`.

Three applications ported from WPF to Angular wrote their own version of each
of these features, because nothing linked the WPF pattern to the Runic one.
Check this list before you write a queue, a guard or a test double by hand.

## Text boxes that write when they lose focus

WPF binds `TextBox.Text` with `UpdateSourceTrigger=LostFocus` by default, so
the setter runs once, when the user leaves the box:

```xml docs-test=skip:illustrative-fragment
<TextBox Text="{Binding Title}" />
<CheckBox IsChecked="{Binding Pinned}" />
```

Bind the member with `injectField` and `commit: "change"`, and wire the input
with `[runicField]` from `@runic-artifex/angular/forms`:

<!-- prettier-ignore -->
```ts docs-test=skip:illustrative-fragment
@Component({
  selector: 'editor-page',
  imports: [RunicFieldDirective],
  template: `<input [runicField]="title"> <input type="checkbox" [runicField]="pinned">`,
})
export class EditorPage {
  readonly page = input.required<EditorPageReference>();
  readonly editor = injectView(this.page);
  readonly title = injectField(this.editor, EditorFields.title, { commit: 'change' });
  readonly pinned = injectField(this.editor, EditorFields.pinned, { commit: 'change' });
}
```

What differs:

- The draft is written on `commit()`, which blur calls, so the setter runs
  once, as with `LostFocus`. There is no timer, so pass no `delay`.
- A checkbox, radio or `<select>` writes each choice at once, as WPF's
  `PropertyChanged` trigger does for those controls.
- A form's `submit()` and `commit()`, `commitAllFields()`, the flush before a
  window close or a departure, and destroying the component also write the
  draft. Write a Save button with `injectForm(...).submit(...)`, which writes
  every field before its command, instead of a queue of pending writes.
- While the user types, the field shows the draft, not the View's value, so an
  older reply never replaces newer text. A directive that keeps an input's
  value while it has focus is not needed.
- `commit: "pause"` writes after a pause in typing as well as on blur, and the
  default, `commit: "input"`, writes each input. `injectTextField` has no commit
  mode; use `injectField`.

React, Vue and Svelte: `useField(view, field, { commit: "change" })` with
`inputProps`, `v-model` or `attach`. Details:
[Angular fields](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/angular/README.md#fields),
[the field controller's options](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#fields)
and [When fields write](../guides/forms-and-validation.md#when-fields-write).

## Radio buttons with a converter

A WPF radio group binds each `RadioButton` to the same enum property through a
converter:

```xml docs-test=skip:illustrative-fragment
<RadioButton Content="Small" IsChecked="{Binding Size, Converter={StaticResource EnumToBool}, ConverterParameter=Small}" />
<RadioButton Content="Large" IsChecked="{Binding Size, Converter={StaticResource EnumToBool}, ConverterParameter=Large}" />
```

Bind one field and put `[runicField]` on each radio. The radio's `value` is
the enum member's name:

<!-- prettier-ignore -->
```ts docs-test=skip:illustrative-fragment
@Component({
  selector: 'editor-page',
  imports: [RunicFieldDirective],
  template: `
    @for (option of sizes; track option) {
      <label><input type="radio" name="size" [value]="option" [runicField]="size"> {{ option }}</label>
    }`,
})
export class EditorPage {
  readonly page = input.required<EditorPageReference>();
  readonly editor = injectView(this.page);
  readonly size = injectField(this.editor, EditorFields.size);
  readonly sizes = EditorFields.size.choices ?? [];
}
```

What differs:

- No converter: the field's `choice` kind maps the enum to its member names,
  and `choices` lists them in declaration order.
- Each radio keeps its own `value` and is checked while that is the field's
  value. Only the radio that became checked writes, also with
  `commit: "change"`.

React: spread `size.radioProps(option)` on each radio. Vue: `v-model` on each
radio. Svelte: `{@attach size.attach}` on each radio. Without a framework,
`bindField` takes the radios of a group together. Details:
[`[runicField]` and Reactive Forms](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/angular/README.md#runicfield-and-reactive-forms)
and [the field controller](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#fields).

## `INotifyDataErrorInfo` and `Validation.Errors`

A WPF view shows the errors that the ViewModel's `INotifyDataErrorInfo`
reports through `Validation.Errors`:

```xml docs-test=skip:illustrative-fragment
<TextBox x:Name="TitleBox" Text="{Binding Title}" />
<TextBlock Text="{Binding (Validation.Errors)[0].ErrorContent, ElementName=TitleBox}" />
```

The Bridge reads the same `INotifyDataErrorInfo`. A field's `errors` signal
holds its member's messages:

<!-- prettier-ignore -->
```html docs-test=skip:illustrative-fragment
<input [runicField]="title">
@for (message of title.errors(); track message) { <p role="alert">{{ message }}</p> }
```

What differs:

- The state has a `{member}Errors` array for each member, such as
  `titleErrors`, and `validation`, with every error's `path` and `message`,
  also for nested objects and list items. A lookup of messages by property
  name is not needed.
- `[runicField]` sets `aria-invalid` while the member has errors.
  `injectForm(...).valid()` is false while any of its fields has errors.
- The Bridge runs no validation rules; it reports what the ViewModel's
  `GetErrors` returns. A ViewModel that uses ReactiveUI.Validation is read
  through its `ValidationContext`.

React, Vue and Svelte: `useField(...).errors`. Details:
[Structured validation](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#structured-validation)
and [Validation from .NET](../guides/forms-and-validation.md#validation-from-net).

## `IDataErrorInfo`

The Bridge does not read `IDataErrorInfo`, so its errors never reach the page.
Implement `INotifyDataErrorInfo` instead, for example with CommunityToolkit's
`ObservableValidator`, or use ReactiveUI.Validation. Both are read as in the
section above. Details:
[Structured validation](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#structured-validation).

## Buttons bound to commands

A WPF button binds a command, and `CanExecute` enables it:

```xml docs-test=skip:illustrative-fragment
<Button Command="{Binding RefreshCommand}" Content="Refresh" />
<Button Command="{Binding ArchiveCommand}" CommandParameter="{Binding Id}" Content="Archive" />
```

`injectCommands(view)` makes a handle for each command of the View:

<!-- prettier-ignore -->
```ts docs-test=skip:illustrative-fragment
@Component({
  selector: 'orders-page',
  template: `
    <button (click)="commands.refresh.run()"
      [disabled]="!orders.state()?.canRefresh || commands.refresh.pending()">Refresh</button>
    <button (click)="commands.archive.run(row().id)">Archive</button>`,
})
export class OrdersPage {
  readonly page = input.required<OrdersPageReference>();
  readonly orders = injectView(this.page);
  readonly commands = injectCommands(this.orders);
}
```

What differs:

- `CanExecute` of a command without a parameter is state, `canRefresh`; bind
  `disabled` to it yourself. A command with a parameter has the query
  `canArchive(id)` on the client instead.
- Each handle has its own `pending`, `error` and `failure`. `run()` never
  rejects; a failed run ends in `error`. Before the View connected it resolves
  to `undefined`.
- The names and arguments come from the generated client, so setters,
  `canX(input)`, `startX` and commands that explicit publication left out are
  not offered.
- Runs are independent. Don't queue commands so that each waits for the
  previous one to complete: a command whose completion waits for a later
  command then never completes.

React, Vue and Svelte: `useCommands(view)`. Details:
[Angular commands](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/angular/README.md#commands)
and [Command handles](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#command-handles).

## Dialogs that answer an interaction

A WPF view answers a ReactiveUI `Interaction` in its code-behind, often with a
dialog:

```csharp docs-test=skip:illustrative-fragment
this.WhenActivated(d => d(ViewModel!.ConfirmDiscard.RegisterHandler(context =>
{
    var answer = MessageBox.Show($"Discard the changes to {context.Input.ItemName}?", "Discard", MessageBoxButton.YesNo);
    context.SetOutput(answer == MessageBoxResult.Yes);
})));
```

A page that renders the dialog in its own template uses `injectInteraction`.
`request()` is the oldest open request, a handle `{ input, respond }`:

<!-- prettier-ignore -->
```ts docs-test=skip:illustrative-fragment
@Component({
  selector: 'edit-page',
  template: `
    @if (discard.request(); as request) {
      <app-confirm [text]="request.input.itemName" (yes)="request.respond(true)" (no)="request.respond(false)" />
    }`,
})
export class EditPage {
  readonly page = input.required<EditPageReference>();
  readonly view = injectView(this.page);
  readonly discard = injectInteraction(this.view, 'confirmDiscard');
}
```

What differs:

- Each open request is its own handle, and its `respond` answers that request
  only. A second click, or an answer after .NET stopped waiting, is ignored, so
  it never answers the next request.
- .NET can stop waiting: the command that asked was cancelled, the deadline
  passed or the window closed. The request then ends and `request()` moves on,
  so the dialog closes.
- The handler exists only while the View is connected. A request before that is
  answered by the ViewModel's .NET fallback handler, or fails closed without
  one.
- To await a dialog service instead, register a handler with
  `client.interactions.<name>.handle(...)`.

React, Vue and Svelte: `useInteraction(view, name)`. Details:
[A dialog in the template](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/angular/README.md#a-dialog-in-the-template)
and [Interactions as state](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#interactions-as-state).

## ViewModels that keep WPF-only members

A ported ViewModel still has the members its XAML bound to, some with WPF
types, while the page may read one computed record. Explicit publication
publishes only the members marked `[RunicInclude]`:

```csharp docs-test=skip:illustrative-fragment
[assembly: RunicPublication(RunicPublicationMode.Explicit)]

public sealed partial class ImportResultViewModel : ObservableObject
{
    [RunicInclude] public ResultPage Page => BuildPage();

    // Kept for the native view and the tests; not published.
    public ICollectionView Imported { get; }

    [RelayCommand]
    [property: RunicInclude]
    private Task ExportAsync() => ...;
}
```

What differs:

- The generator never inspects a member that is left out, so a WPF-typed
  member needs no `[RunicIgnore]`, and a member added later stays on .NET until
  someone marks it.
- On a CommunityToolkit `[RelayCommand]` method or `[ObservableProperty]`
  field, write `[property: RunicInclude]`.
- `[RunicPublication]` on a class wins over the assembly's, so one ViewModel can
  keep the default with `RunicPublicationMode.Implicit`.
- Changing the mode changes the generated contract. Rebuild the .NET
  application and the frontend together.

The page is unchanged; only the generated client has fewer members. Details:
[Which members are published](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#which-members-are-published).

## A fake ViewModel for view tests

A WPF view can be tested with a fake ViewModel behind an interface. The ports
rebuilt that seam with injection tokens, wrapper components and hand-written
doubles that filled every `…Errors: []` member.

The generator writes a typed mock next to each client, such as
`editor.mock.ts` with `mockEditor`:

```ts docs-test=skip:illustrative-fragment
beforeEach(() => {
  bridge = installMockBridge(createMockBridge());
});

test('saving clears the dirty flag', async () => {
  mockEditor(bridge, {
    state: { title: 'Groceries', isDirty: true },
    commands: { save: () => ({ isDirty: false }) },
  });
  // Render the component as in production; injectView connects to the mock.
});
```

What differs:

- The mock is typed from the generated client, so a renamed or retyped
  ViewModel member breaks the test at compile time.
- It fills `validation`, every `{member}Errors`, `can…` (available) and
  `is…Executing` (idle), so a test states only the ViewModel's own state.
- The component needs no test seam: the mock Bridge answers the generated
  client as the .NET Window does.

The mock is the same for every framework. Details:
[Testing](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#testing)
and [Typed mocks](../guides/frontend-testing.md#typed-mocks).

## `ContentRendered` and a `Closing` handler

A WPF view's code-behind knows when it rendered and when its window closes:

```csharp docs-test=skip:illustrative-fragment
ContentRendered += (_, _) => viewModel.OnShown();
Closing += (_, e) => e.Cancel = !viewModel.CanClose();
```

The ports wrote a paint acknowledgement and a close handshake between the page
and .NET, about 700 lines of TypeScript and C#. Runic has both in the
`presented/1` feature:

```csharp docs-test=skip:illustrative-fragment
Page = result;
if (!await RunicPresentation.WaitForPresentedAsync(result, TimeSpan.FromSeconds(2)))
    logger.LogDebug("No page showed the result in time.");
```

What differs:

- `WaitForPresentedAsync` completes with `true` once a page rendered the state
  that includes every change made before the call, and with `false` at the
  timeout. A hidden or minimized page reports after its next timer.
- When the application closes the window, each page delivers its pending
  states, renders them, acknowledges and reports the connection state
  `closed`. The page writes nothing for this.
- A Runic Window guards a user close with `GuardClose` and `CanCloseAsync`. A
  WPF window that hosts the page keeps `GuardWindowClose` on its
  `NavigationHost`. A Runic Window with a close drain stays open until its
  accepted work has ended.

The page side is the same for every framework. Details:
[Waiting until the page shows a state](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#waiting-until-the-page-shows-a-state),
[Presented states and window close](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#presented-states-and-window-close),
[Guarding a user close](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#guarding-a-user-close)
and
[Closing after the Window's work has drained](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#closing-after-the-windows-work-has-drained).

## A double-clicked Next

In WPF the UI thread showed the next wizard page before it handled the next
click, so a double-clicked Next advanced once. A web page sends both clicks
before the next page arrives. Mark the command `[RunicPresentationScoped]` and
renew the presentation when the page changes:

```csharp docs-test=skip:illustrative-fragment
[RelayCommand]
[RunicPresentationScoped]
private void Next()
{
    Step++;
    RunicPresentation.Renew(this);
}
```

The page is unchanged: `commands.next.run()`.

What differs:

- The page sends the epoch of the state it showed when the user clicked. The
  second Next was clicked on the first page, whose epoch `Renew` ended, so it
  does not run.
- A superseded call resolves with the current state, without an error, as if it
  had run. `injectCommand` and `injectCommands` show no error; a caller that
  must know compares the state it got.
- A new page in a navigation region begins a new epoch without `Renew`. Call
  `Renew` where the page changes without a new presentation, such as Next and
  Back.
- Setters, checked writes and operation starts are not scoped.

The page side is the same for every framework. Details:
[Commands scoped to their page](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#commands-scoped-to-their-page)
and
[Scoped commands](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#scoped-commands).

## A `ContentControl` with a `DataTemplate` per ViewModel

A WPF content area picks a template by the ViewModel's type:

```xml docs-test=skip:illustrative-fragment
<ContentControl Content="{Binding Main.Current}">
  <ContentControl.Resources>
    <DataTemplate DataType="{x:Type vm:OrdersViewModel}"><local:OrdersView /></DataTemplate>
    <DataTemplate DataType="{x:Type vm:SettingsViewModel}"><local:SettingsView /></DataTemplate>
  </ContentControl.Resources>
</ContentControl>
```

On the web, `ViewOutlet` picks a component from a registry by the page
reference's kind. Narrow the slot's `TContent` to an interface that only that
slot's ViewModels implement, such as `NavigationRegion<IMainPage>`, so the
registry lists only them:

```ts docs-test=skip:illustrative-fragment
const pages = {
  orders: OrdersPage,
  settings: SettingsPage,
} satisfies ViewRegistry<ShellState['main']>;
// <runic-view-outlet [content]="shell.state()?.main" [registry]="pages" [missing]="missingView" />
// <ng-template #missingView let-page><p role="alert">{{ missingText(page.kind) }}</p></ng-template>
```

**Cost.** A content slot's union lists every presented ViewModel that is
assignable to `TContent`, so a broad `TContent` makes an exhaustive registry
impractical.

What differs:

- `ViewRegistry` checks at compile time that the registry has a component for
  every kind in the slot's union. A cast that skips the check hides a kind with
  no component.
- A kind without a component renders an English alert in a development build;
  a production build renders nothing and reports it. The `missing` template
  replaces that alert.
- A `NavigationRegion<object>` slot is error `RUNICBRIDGE008`. A ViewModel that
  a slot admits but has no View is warning `RUNICBRIDGE013`.
- ViewModels that publish the same members can share one component through a
  `[RunicSharedClient]` interface and `registryEntries`.

React, Vue and Svelte: `ViewOutlet` and their `ViewRegistry`. Details:
[Content slots](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#content-slots),
[Angular outlet](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/angular/README.md#outlet)
and
[Shared clients](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#shared-clients).

## Bindings through nested ViewModels

A WPF binding path walks through nested ViewModels:

```xml docs-test=skip:illustrative-fragment
<MenuItem Header="Open log" Command="{Binding Header.Menu.OpenLogCommand}" />
```

On the web, each presented View is its own connection. A child ViewModel with
a View of its own is a page reference in its parent's state, and the
component that renders it calls `injectView` for it. When the child has no page
of its own, forward its commands on the parent ViewModel instead:

```csharp docs-test=skip:illustrative-fragment
public sealed partial class ShellViewModel : ObservableObject
{
    [RelayCommand]
    private void OpenLog() => Header.Menu.OpenLogCommand.Execute(null);
}
```

<!-- prettier-ignore -->
```html docs-test=skip:illustrative-fragment
<button (click)="commands.openLog.run()">Open log</button>
```

**Cost.** Each nested View is one more connection, and it opens only after its
parent's state has arrived.

What differs:

- A component per level, each with its own `injectView` and "not connected"
  state, follows from presenting each level as a View. Forwarding keeps the
  menu in the shell's one connection.
- A forwarding command like the one above is always available. Give it a
  `CanExecute` of its own when the child's command can be unavailable.
- Each `injectView` connects its reference and releases it when the
  component goes away.

React, Vue and Svelte: `useView` per presented View. Details:
[Connecting a View](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/angular/README.md#connecting-a-view)
and
[Windows, Views, and composition](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#windows-views-and-composition).

## A view that ran in the application's process

A WPF view could not lose its ViewModel. A page can lose its connection to the
.NET host, and the ports polled `isConnected()` every second. Follow the
connection instead:

```ts docs-test=skip:illustrative-fragment
readonly connection = injectBridgeConnection({ lostAfter: 5_000 });
// @if (connection.state() === "lost") { <p role="alert">The application stopped responding.</p> }
// @if (connection.state() === "closed") { <p role="status">The application closed this window.</p> }
```

What differs:

- The state is `connecting`, `connected`, `reconnecting`, `lost` or `closed`.
  `lost` follows `lostAfter` milliseconds without a connection and is not
  terminal: it becomes `connected` again when the host comes back.
- `closed` means the application closed the window, so the page can say so
  instead of showing a lost connection.
- Runic Desktop and CS-WebUI report a dropped connection within about 250 ms.

React, Vue and Svelte: `useBridgeConnection`. Details:
[Angular connection state](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/angular/README.md#connection-state)
and
[Connection state](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/web/views/README.md#connection-state).

## A ViewModel library that several applications share

A WPF solution can share a library of ViewModels and their XAML views between
applications. To share their web clients too, the library declares the Views
and generates their TypeScript as a module that other frontends import:

```xml docs-test=skip:illustrative-project-setting
<PropertyGroup>
  <RunicApplicationFrontendClientLibrary>true</RunicApplicationFrontendClientLibrary>
  <RunicApplicationFrontendGeneratedDirectory>../shared-ui/src/generated</RunicApplicationFrontendGeneratedDirectory>
</PropertyGroup>
```

```csharp docs-test=skip:illustrative-fragment
// In the library.
public sealed partial class AboutDialogView : RunicView<AboutDialogViewModel>;
```

```ts docs-test=skip:illustrative-fragment
// A component in the shared frontend package.
import type { AboutDialogPageReference } from './generated/runic-clients.js';
```

What differs:

- The generated directory gets `runic-clients.ts`, which exports every client,
  shared client and named type and `runicClientContracts`, and `runic-mocks.ts`,
  which exports the mocks.
- A client library builds and copies no frontend by default, and an
  application that references it does not copy its frontend to its web root.
- A client library without a View is `RUNICBRIDGE006`.
- An application that presents the library's ViewModels needs their C#
  Bridges, which a View declared in a referenced library does not give it. So
  each application still declares its own Views for those ViewModels and
  generates its own clients for them. Importing the library's clients in the
  application instead is tracked in
  [runic-sdk#1318](https://github.com/Runic-Artifex/runic-sdk/issues/1318).

Details:
[Build properties](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#build-properties).

## Next steps

- [Host Runic Views in a WPF app](wpf-hybrid.md) presents the ported page in
  the WPF window, next to the native views.
- [Forms and validation](../guides/forms-and-validation.md) covers fields,
  forms and checked writes in all frameworks.
- [Pages and navigation](../guides/pages-and-navigation.md) covers regions,
  guards and scoped commands.
- [Testing frontends](../guides/frontend-testing.md) covers the typed mocks.
