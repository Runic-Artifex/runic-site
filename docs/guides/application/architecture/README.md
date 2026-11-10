# Window and View architecture

A Runic Window is an explicit .NET composition boundary. Its generic ViewModel
is scoped to that logical window. Views are explicit partial types that select
content contracts and carry a typed `DataContext`; they are created within the
window's dependency-injection scope.

The generated C# attachment connects the host to those contracts, while the
build emits ordinary TypeScript clients. The frontend chooses components and
controls rendering. It opens and closes a presentation of each View it shows,
so the .NET content session can track the logical View lifetime independently
from the ViewModel scope.

Commands and property writes are typed. Checked writes carry receipts and
version conflicts; callers should await pending writes before issuing a command
that depends on the updated value. Accepted operations remain owned by .NET
through a browser reload, and a reconnect receives a fresh state.
Since SDK `0.11.0`, a call's reply reaches the page after the state frames the
call produced on every View of the window, and every Bridge input is bounded by
the window's `MaximumInputBytes`, 1 MiB by default.

Since SDK `0.13.0`, the page and .NET speak Views protocol 4, the protocol that
1.0 keeps. Each connection starts with a `hello` handshake that names both
protocol versions, then sends requests to one endpoint and receives pushes on
one channel. `open` and `close` read a View's state and register its
presentation. After that, frames carry a `set` for each member whose value
changed, beside keyed-collection and text changes, so a change sends only what
differs. A reply names the `revision` of the first state that includes its
effects instead of repeating the state, and the client resolves the call once
its route reached that revision. Setter edits are numbered per route and
member: .NET skips an edit older than one it applied and answers `superseded`,
and the page shows the latest pending value until its revision arrives.
Operations outlive their route, so a page that left can still watch, cancel or
stream one the window still knows. The canonical form is RFC 8785 (JCS), and
`TimeSpan` values are ISO 8601 durations. The
[protocol specification](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/specs/application/README.md)
is language-neutral, and its
[conformance corpus](https://github.com/Runic-Artifex/runic-sdk/tree/v0.17.0/specs/application/conformance)
lets another implementation check itself. A page and a host of different
protocol versions do not connect; the page reports a `protocol` diagnostic.

Since SDK `0.14.0`, `hello` and its reply list the features each side
implements (`features`, named `{name}/{version}`); a feature is in use when
both list it, so a `0.13` page and a `0.14` host still connect with whole
values. The first feature, `text-splice/1`, sends a long `string` member's
setters, checked writes and frame changes as splices of the changed
characters: a keystroke in a 100,000-character member sends about 130 bytes
instead of about 100 KB, and .NET still calls the setter with the whole value.
A page also sends its first requests, such as `open`, with its `hello` instead
of waiting for the reply; the host holds requests that arrive before the
`hello` succeeded, up to 5 seconds and 64 per connection. On the page, the
client applies each frame when it arrives and notifies subscribers once per
animation frame with the newest state; on the host, notification frames of a
route are at least 8 ms apart, and the last change is always published.

Since SDK `0.15.0`, two more features are negotiated the same way.
`presentation-epoch/1` numbers each presentation of a route: `open` and
`snapshot` replies and `state` pushes carry its `epoch`, a command marked
`[RunicPresentationScoped]` carries the epoch of the state the page showed,
and .NET answers a command from an earlier epoch `superseded` without running
it. `presented/1` adds a `present` push, which asks the page to report once it
painted a state, and a `closing` push, which tells the page that the
application closes its window; the page then reports its connection as
`closed`. A `0.14` page and a `0.15` host still connect and behave as in
`0.14`. See
[commands scoped to their page](../guides/pages-and-navigation.md#commands-scoped-to-their-page)
and the specification's
[presentation epochs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/specs/application/README.md#presentation-epochs)
and
[presented states and window close](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/specs/application/README.md#presented-states-and-window-close).

Since SDK `0.16.0`, eleven more features are negotiated in `hello`; a page and
a host of different releases use only what both list, so a `0.15` page and a
`0.16` host still behave as in `0.15`:

- `request-session/1`: every request names its page's random session, so a
  page never acts for another connection of the window. Each connection also
  gets a window key that no later connection reuses. See
  [request sessions](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/specs/application/README.md#request-sessions).
- `view-requests/1`: the page registers handlers and receives `view-request`
  pushes; see [ask the page to act](../samples/prompts.md#ask-the-page-to-act).
- `validation-pending/1`: `validation.pending` lists the paths whose
  validation is still running.
- `field-flush/1`: the window asks its pages to write their drafts before a
  departure guard runs.
- `field-paths/1`: a write names a path below a member, such as a row's cell
  or a nested object's member; see
  [editable rows](../guides/forms-and-validation.md#editable-rows-and-nested-fields).
- `translation-text/1`: the window's `locale` push and the `text` of
  validation errors.
- `query-collections/1`: `query-rows`, `query-set` and `query-index`, and the
  `busy` rejection; see
  [query collections](../guides/dynamicdata.md#query-collections).
- `blobs/1`: the upload grant in the `hello` reply; blob and upload content
  travels over HTTP, not the Bridge. See
  [blobs and uploads](../samples/files.md#blobs-and-uploads).
- `region-collections/1`: `region` select and close requests; see
  [document tabs](../guides/pages-and-navigation.md#document-tabs).
- `navigation-path/1`: `navigation` requests, `navigation-path` pushes and the
  path in the `hello` reply; see
  [Back and the URL](../guides/pages-and-navigation.md#back-and-the-url).
- `client-errors/1`: the page reports its errors for the .NET log; see
  [page errors in .NET logs](../../desktop/crash-reporting.md#page-errors-in-net-logs).

The specification's [features](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/specs/application/README.md#features) section lists each feature
with its conformance set.

See the [first Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/examples/first-window/README.md) for the smallest
composition and [Notes examples](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/examples/notes-view-first/README.md) for
nested content, routing, and multiple Views over a ViewModel.

Navigation and model execution ownership are supplied by
[`Runic.Navigation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/packages/dotnet/Runic.Navigation/README.md),
which can also serve native WPF Views without a web runtime. The model context
and registry types use the `Runic.Navigation` namespace. A native and web
presentation of the same model must share its context; presentation disposal
does not authorize disposing an application-owned model or its services. See
[incremental WPF migration](../migrations/wpf-incremental.md).

The [reactive application contracts](reactiveui-expansion.md) describe the
implemented type graph, typed operations, browser interactions and model
execution ownership. Use the [reference](../reference/README.md) for public APIs.
