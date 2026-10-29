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
[protocol specification](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/specs/application/README.md)
is language-neutral, and its
[conformance corpus](https://github.com/Runic-Artifex/runic-sdk/tree/v0.13.0/specs/application/conformance)
lets another implementation check itself. A page and a host of different
protocol versions do not connect; the page reports a `protocol` diagnostic.

See the [first Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/examples/first-window/README.md) for the smallest
composition and [Notes examples](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/examples/notes-view-first/README.md) for
nested content, routing, and multiple Views over a ViewModel.

Navigation and model execution ownership are supplied by
[`Runic.Navigation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Navigation/README.md),
which can also serve native WPF Views without a web runtime. The model context
and registry types use the `Runic.Navigation` namespace. A native and web
presentation of the same model must share its context; presentation disposal
does not authorize disposing an application-owned model or its services. See
[incremental WPF migration](../migrations/wpf-incremental.md).

The [reactive application contracts](reactiveui-expansion.md) describe the
implemented type graph, typed operations, browser interactions and model
execution ownership. Use the [reference](../reference/README.md) for public APIs.
