# DynamicData collections

Use the [Runic Artifex fork of DynamicData](https://github.com/Runic-Artifex/DynamicData)
from nuget.org: [`RunicArtifex.DynamicData`](https://www.nuget.org/packages/RunicArtifex.DynamicData)
for the Primitives flavor, or
[`RunicArtifex.DynamicData.Reactive`](https://www.nuget.org/packages/RunicArtifex.DynamicData.Reactive)
for the System.Reactive flavor, both `10.0.0`, the fork's first stable release
(SDK `0.13.0` used `10.0.0-runic.118`; drop `--prerelease` when you move to it).
Both target .NET 10. The Primitives flavor keeps
the `DynamicData` namespaces; the System.Reactive flavor uses the
`DynamicData.Reactive.*` namespaces, such as `DynamicData.Reactive.Binding`.
Earlier previews, published only as GitHub release assets, used the IDs
`Runic.DynamicData` and `Runic.DynamicData.Reactive`. Select one flavor and
remove the equivalent upstream package. Current Runic uses ReactiveUI 26.0.1 and
Primitives 9.0.0; the fork also tests Primitives 8.4.0 used by ReactiveUI 25.

DynamicData's cache, filtering, grouping, transforms and disposal stay in .NET.
Runic exports the resulting collection through a generated, reflection-free
bridge. The [runnable example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/examples/dynamicdata/README.md)
has a 100,000-row source cache, keyed browser rendering and an independent
viewport for each presentation.

## Bind on the model context

Inject `IRunicModelContext` and obtain its sequencer from
`ReactiveSchedulers.For(context)`. Bind the model with
`RunicModelContextRegistry.Shared.Bind(context, model)` and retain the lease
until disposal. Each window owns its model context; native UI dispatch remains
the host's responsibility.

```csharp docs-test=skip:illustrative-fragment
var changes = store.Connect()
    .SortAndVirtualize(comparer, requests)
    .ObserveOn(sequencer)
    .BatchBridgeSnapshots(this);

binding = changes
    .Bind(rows, new SortAndBindOptions { ResetThreshold = int.MaxValue })
    .Subscribe();
```

`BatchBridgeSnapshots` wraps each downstream changeset delivery. Place it after
`ObserveOn` and before `Bind` or `SortAndBind`; an outer batch around
`SourceCache.Edit` ends before deferred notifications reach the collection.
Dispose the binding, viewport signal, commands and model-context lease with
the presentation. The extension is in the `Runic.Application.Views` namespace
and works with either flavor.

## Opt into collection updates

```csharp docs-test=skip:illustrative-fragment
public sealed record Row(int Id, string Label, int Value);

[RunicCollection(nameof(Row.Id))]
public ReadOnlyObservableCollection<Row> Rows { get; }
```

The property must be read-only and nonnullable, with nonnullable DTO rows.
Keys must be unique, stable and nonempty: supported key types are `int`,
`string` and `Guid`, and since SDK `0.16.0` also `long`. Initialize the collection before attaching a bridge.
Collection notifications produce indexed add, remove, replace and move
operations. Immutable replacements and direct `INotifyPropertyChanged` row
notifications serialize only changed rows. Unchanged browser rows keep their
object identity, so render with the generated key rather than the array index.

Since SDK `0.13.0` (Views protocol 4), a frame carries the collection's
indexed changes beside a `set` for each other member whose encoding changed, so
scalar changes and derived members travel in the same frame without a full
state. Since SDK `0.14.0` this includes a model that exports validation: the
frame carries the collection's indexed changes together with the `validation`
they cause, where `0.13.0` still sent a `set` of the whole field. A
`Reset`, a notification without a starting index, a row reached through more
than one path and a change of an object nested inside a row are a `set` of the
whole field. When a frame would exceed 4,096 changes, the collections with the
most changes become one `set` each until it fits. Slow host delivery retains at
most 64 pending entries or 1 MiB per route, then replaces pending work with a
recovery state. Clients re-read a snapshot after a gap or malformed frame;
repeated and stale frames have no effect.

Since SDK `0.14.0`, the Window logs event 1025
`BridgeCollectionChangedOutsideModelTurn` (a warning, once per Bridge and field)
when an observed collection changes outside the window's model turn, such as a
`Bind` without `ObserveOn` the window's scheduler. A change notification that
arrives after the window's model context closed no longer throws
`ObjectDisposedException` into the binding, which ended it. See
[state changes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/specs/application/state-changes.md)
and the .NET
[language mappings](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/specs/application/language-mappings.md#publication-units-and-change-detection).

## Bound the presented collection

Keep the large source cache shared and the viewport request and bound
collection per presentation. `SortAndVirtualize` suppresses updates outside
that viewport. The browser helper `collectionViewport` computes a fixed-height
range. Since SDK `0.10.0` it is exported from the `@runic-artifex/views` root;
the `./experimental` entry is removed:

```ts docs-test=skip:illustrative-fragment
import { collectionViewport } from '@runic-artifex/views';

const range = collectionViewport({
  totalCount,
  scrollTop,
  height,
  rowHeight: 32,
  overscan: 5,
});
await view.setViewport({ start: range.start, size: range.size });
```

Use `range.totalSize` for the scroll extent and position rendered rows at the
backend's reported start. Coalesce pending scroll requests to the most recent
range. This helper does not implement variable-height measurement or browser
rendering. The browser copies each changed field's array and checks its keys,
so a bounded viewport remains useful even when delta payloads are small.

## Query collections

A DynamicData-bound `[RunicCollection]` sends its rows to every page, so its
source must fit in memory and a page bounds its share with a viewport. Since
SDK `0.16.0`, use a `RunicQueryCollection<TRow, TKey>` instead when the list
is too large to send, such as a database table, and the page should sort,
filter and scroll it. The rows stay in an `IRunicRowSource`;
`RunicQueryableRowSource` runs over any `IQueryable`, such as Entity Framework
Core or an in-memory list, with the fields `RunicQueryFields` allows:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
public OrdersViewModel(Func<ShopContext> database, IRunicModelContext context)
{
    var fields = new RunicQueryFields<Order>()
        .AddText("customer", order => order.Customer)
        .Add("amount", order => order.Amount)
        .Add("placed", order => order.Placed)
        .AddCustom("mine", (orders, _) => orders.Where(order => order.Customer == Environment.UserName));
    Orders = new(new RunicQueryableRowSource<Order, int>(() => database().Orders, fields, order => order.Id),
        order => order.Id, new RunicQueryCollectionOptions { ModelContext = context });
}
```

- The page's state holds only `{ query, total, version }`. Each page or
  CS-WebUI client reads its own range, so scrolling one client doesn't move
  another. The query (sort and filter) is ViewModel state that every
  presentation shares.
- The collection loads pages of 100 rows outside model turns, shares and
  caches them (64 pages), and cancels loads no request waits for, so memory
  stays bounded however long the list is.
- Each connection has at most two row requests, one query change and one key
  search in flight per collection; more are `rejected` with the reason
  `busy`, and the client retries them.
- Field names, filter values and `custom` arguments come from the page:
  `RunicQueryFields` rejects anything it doesn't list as invalid input. A row
  source of your own implements `Validate` the same way.
- Call `Invalidate(key)` after a row changed in place and `Refresh()` after
  rows were added or removed.
- Keys are `string`, `Guid` or `int`. A setter, `[RunicCollection]` on the same
  property, another key type or rows that aren't DTOs are `RUNICBRIDGE060`.

On the page, the generated client has `client.queries.{name}`:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/web/views/README.md
const rows = catalog.queries.rows;           // QueryCollection<CatalogRow>
rows.setRange(500, 40);                      // placeholders now, rows when they arrive
rows.subscribe(() => render(rows.current));  // { query, total, version, start, count, rows, loading, error }
await rows.setQuery({ sort: [{ field: "label", descending: true }], filters: [{ field: "label", op: "contains", value: "9" }] });
const index = await rows.indexOf("4711");    // the key's position in the current query, or undefined
```

`createQueryViewportController` lays rows out with variable heights and
scrolls to a key. React, Vue and Svelte wrap it as `useQueryCollection`,
Angular as `injectQueryCollection`, and `@runic-artifex/views-effect` has
`queryCollectionChanges` and `queryViewportChanges`:

<!-- prettier-ignore -->
```tsx docs-test=readme:packages/web/react/README.md
const list = useQueryCollection(client.queries.rows, { estimateSize: 32 });
return <div ref={list.ref} style={{ height: 480, overflow: "auto" }}>
  <div style={{ height: list.totalSize, position: "relative" }}>
    {list.items.map(item => <div key={item.key ?? `p${item.index}`} ref={list.measure(item.index)} style={{ position: "absolute", top: item.top, width: "100%" }}>
      {item.row?.label ?? "…"}
    </div>)}
  </div>
</div>;
```

A WPF View binds `Orders.CreateView()` to a virtualizing `ItemsControl`. A
`SourceCache` can be the row source, through `RunicQueryableRowSource` over
`cache.Items.AsQueryable()`, with its changes invalidating the collection:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
_changes = cache.Connect().Subscribe(changes =>
{
    // Adds and removes move the rows after them; updates stay where they are.
    if (changes.Adds > 0 || changes.Removes > 0 || changes.Moves > 0) Rows.Refresh();
    else Rows.Invalidate(changes.Select(change => change.Key));
});
```

In tests, `QueryRowsAsync`, `SetQueryAsync` and `IndexOfAsync` send what a
page sends, and `RunicTestRowSource` serves rows with latency and records what
was loaded:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Testing/README.md
var source = new RunicTestRowSource<Order, int>(orders, fields, order => order.Id);
using var host = RunicWindowTestHost.Create(services, new OrdersViewModel(source, context));
var rows = await host.Root.QueryRowsAsync(vm => vm.Orders, 500, 40);
Assert.Equal(1, source.Loads.Count);
```

The [query collections example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.16.0/examples/query-collections)
shows 100,000 rows with sort, filter, variable heights and scrolling to a row.
See
[query collections](https://github.com/Runic-Artifex/runic-sdk/blob/v0.16.0/packages/dotnet/Runic.Application.Views/README.md#query-collections)
for every rule, including flattened trees.

## Performance evidence

The example's `--benchmark` compares the same DynamicData binding boundary
with full snapshots, batched snapshots, incremental updates and a viewport.
It reports synchronous application/encoding time, allocations and encoded
rows. It excludes native rendering, browser hydration and presentation time.
The direct collection boundary is common to Avalonia and MAUI; it is not a
measurement of those frameworks. See the example's assessment for results and
the remaining end-to-end comparison.
