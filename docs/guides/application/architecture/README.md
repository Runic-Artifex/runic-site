# Window and View architecture

A Runic Window is an explicit .NET composition boundary. Its generic ViewModel
is scoped to that logical window. Views are explicit partial types that select
content contracts and carry a typed `DataContext`; they are created within the
window's dependency-injection scope.

The generated C# attachment connects the host to those contracts, while the
build emits ordinary TypeScript clients. The frontend chooses components and
controls rendering. It reports View mount and unmount so the .NET content session
can track the logical View lifetime independently from the ViewModel scope.

Commands and property writes are typed. Property writes carry receipts and version
conflicts; callers should await pending writes before issuing a command that depends
on the updated value. Accepted operations remain owned by .NET through a browser
reload, and a reconnect receives a fresh snapshot.

See the [first Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.5/examples/first-window/README.md) for the smallest
composition and [Notes examples](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.5/examples/notes-view-first/README.md) for
nested content, routing, and multiple Views over a ViewModel.

Navigation and model execution ownership are supplied by
[`Runic.Navigation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.5/packages/dotnet/Runic.Navigation/README.md),
which can also serve native WPF Views without a web runtime. The model context
and registry types use the `Runic.Navigation` namespace. A native and web
presentation of the same model must share its context; presentation disposal
does not authorize disposing an application-owned model or its services. See
[incremental WPF migration](../migrations/wpf-incremental.md).

The [reactive application contracts](reactiveui-expansion.md) describe the
implemented type graph, typed operations, browser interactions and model
execution ownership. Use the [reference](../reference/README.md) for public APIs.
