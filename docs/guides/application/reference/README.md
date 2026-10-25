# Reference

Each package ID is also its namespace and source folder name. Before
0.7.0-preview.7 the Application packages had shorter IDs, such as
`Runic.Application` and `Runic.Application.Desktop`; the
[rename table](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views/README.md#moved-and-renamed-since-070-preview6)
lists them. Independent navigation packages use `Runic.Navigation`.

| Package                                                                                                                                                                        | Source folder                                                 | Namespace                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------- |
| [`Runic.Application.Views`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views/README.md)                                         | `packages/dotnet/Runic.Application.Views`                     | `Runic.Application.Views`                     |
| [`Runic.Application.Views.CsWebUi`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views.CsWebUi/README.md)                         | `packages/dotnet/Runic.Application.Views.CsWebUi`             | `Runic.Application.Views.CsWebUi`             |
| [`Runic.Application.Views.Desktop`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views.Desktop/README.md)                         | `packages/dotnet/Runic.Application.Views.Desktop`             | `Runic.Application.Views.Desktop`             |
| [`Runic.Application.Views.ReactiveUI`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views.ReactiveUI/README.md)                   | `packages/dotnet/Runic.Application.Views.ReactiveUI`          | `Runic.Application.Views.ReactiveUI`          |
| [`Runic.Application.Views.ReactiveUI.Reactive`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views.ReactiveUI.Reactive/README.md) | `packages/dotnet/Runic.Application.Views.ReactiveUI.Reactive` | `Runic.Application.Views.ReactiveUI.Reactive` |
| [`Runic.Application.Testing`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Testing/README.md)                                     | `packages/dotnet/Runic.Application.Testing`                   | `Runic.Application.Testing`                   |
| [`Runic.Application.Views.Wpf`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views.Wpf/README.md)                                 | `packages/dotnet/Runic.Application.Views.Wpf`                 | `Runic.Application.Views.Wpf`                 |
| [`Runic.Navigation`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Navigation/README.md)                                                       | `packages/dotnet/Runic.Navigation`                            | `Runic.Navigation`                            |
| [`Runic.Navigation.Wpf`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Navigation.Wpf/README.md)                                               | `packages/dotnet/Runic.Navigation.Wpf`                        | `Runic.Navigation.Wpf`                        |
| [`Runic.Navigation.ReactiveUI`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Navigation.ReactiveUI/README.md)                                 | `packages/dotnet/Runic.Navigation.ReactiveUI`                 | `Runic.Navigation.ReactiveUI`                 |
| [`Runic.Navigation.ReactiveUI.Reactive`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Navigation.ReactiveUI.Reactive/README.md)               | `packages/dotnet/Runic.Navigation.ReactiveUI.Reactive`        | `Runic.Navigation.ReactiveUI.Reactive`        |

- [Incremental WPF migration](../migrations/wpf-incremental.md)
- [ReactiveUI 26 capabilities and Avalonia comparison](reactiveui.md)
- [Views build targets](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views/build/Runic.Application.Views.targets), shipped in the `Runic.Application.Views` package
- [`dotnet runic`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/tools/dotnet-runic/README.md) development and doctor commands
- [`@runic-artifex/views`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/web/views/README.md): the shared browser runtime and mock Bridge for generated clients
- [React package](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/web/react/README.md), [Vue package](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/web/vue/README.md), [Svelte package](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/web/svelte/README.md) and [Angular package](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/web/angular/README.md)

The examples show complete Window composition, generated client use, browser
mount lifecycle, and frontend integration.

## Shared DTOs and serializer attributes

The bridge generates its own contract readers and writers; it does not serialize
DTOs through your `System.Text.Json` context. A public computed DTO property is
part of the bridge contract. Since SDK `0.9.0`, a DTO property with an
unconditional `[JsonIgnore]` or `[JsonExtensionData]` is not, as it is not part
of the JSON.

Use Runic's `[RunicIgnore]` to exclude a member from the bridge. For a domain
assembly that should have no Runic dependency, express computed behavior as a
method or keep it outside the transported DTO. Keep the constructor and public
contract properties aligned. The bridge honors explicit `[JsonPropertyName]`
names, with `[RunicAlias]` taking precedence, but does not inherit a JSON
context's naming defaults. Treat each consumer's generated wire contract as
explicit rather than assuming serializer configuration controls both.

The exclusion applies to unconditional `[JsonIgnore]` and
`[JsonIgnore(Condition = JsonIgnoreCondition.Always)]` throughout the
ViewModel's DTO graph, including DTOs in another assembly. Conditional ignores
remain included, and root ViewModel properties still use `[RunicIgnore]`. To
keep ignored members on the wire, as before `0.9.0`, put the assembly-level
[`RunicIncludeJsonIgnored`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.11.0/packages/dotnet/Runic.Application.Views/README.md#shared-dto-exclusions)
in the assembly declaring the ViewModel. The former `RunicBridgeJsonIgnore`
opt-in is now the default; delete it.

## Reuse domain contracts in a CLI

Keep shared domain DTOs independent of the GUI and let both hosts call the same
workflow. Runic Command Line has its own release train: use its published
`0.9.0` packages independently of Application `0.11.0`.

Since Command Line `0.6.0-preview.3`, generated result codecs preserve the
source-generated JSON context's defaults. The bridge still uses its own
contract. Explicit `[JsonPropertyName]` attributes preserve stable shared names.

Command Line `0.6.0-preview.3` adds optional declared failure data through
`CommandFailureData.Create<T>` and `CommandOutcome.FailureWithData<T>` (or
`CommandResponse.FailedWithData<T>`). The additive `fault.data` member carries
an explicit type identity and bounded JSON payload; failures keep nonzero exits,
null outer `payloadType`/`payload`, and the `runic.commandline/1` protocol.
Ordinary diagnostic sanitization remains active. Declare only domain values
intended for the consumer, such as an exact retained directory, and decode only
a recognized identity with `TryGet`. Failure data reports recovery state; it does
not make automatic retry safe.

Follow the independent
[Command Line guide](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.9.0/packages/dotnet/Runic.CommandLine/README.md)
for the owning contract and adoption instructions.
