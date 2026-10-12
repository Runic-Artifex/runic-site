# Troubleshooting and diagnostic IDs

Runic tools and build steps report problems with a diagnostic ID, such as
`RUNICBRIDGE016` or `RTR0011`. The message says what is wrong, and most of them
link to the entry for the ID at the release tag of the package that reported
it. This page tells you which product owns an ID and where to start when
something fails without one.

## Find the reference for an ID

| Prefix                                     | Reported by                                                           | Reference                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNICBRIDGE`                              | The bridge code generator, during `dotnet build`                      | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.8/docs/diagnostics.md#bridge-code-generator)                     |
| `RAPPCLI`, `RAPPDEV`, `RAPPSUP`, `RTKSIZE` | `dotnet runic` commands, such as `dev`, `doctor` and `size`           | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.8/docs/diagnostics.md#dotnet-runic)                              |
| `RAS`                                      | The asset packer that the Runic.Assets build runs                     | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.8/docs/diagnostics.md#asset-packer)                              |
| `RCREATE`                                  | `dnx Runic.Create`                                                    | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.8/docs/diagnostics.md#runiccreate)                               |
| `RUNICWPF`                                 | The compiler, for an experimental API                                 | [Experimental APIs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.8/docs/experimental.md)                                        |
| `RCLI`                                     | Runic Command Line and any tool built on it, including `dotnet runic` | [Command Line diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.6.0-preview.5/docs/guides/command-line/diagnostics.md)          |
| `RTR`                                      | The Translations compiler, in the build, the tool and the editors     | [Translations diagnostics](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.7/docs/guides/translations/diagnostics.md) |

The links above are for SDK `0.7.0-preview.8`, Command Line `0.6.0-preview.5`
and Translations `0.6.0-preview.7`. For another release, change the tag in the
address. `dotnet runic` reports a few `RCLI8xxx` codes of its own; the SDK
diagnostics list them.

## First steps

- **An app or its build fails.** Run `dotnet runic doctor` in the project
  folder. It checks the .NET SDK, the JavaScript runtime and package manager,
  the lock file and that every Runic package belongs to one release. Add
  `--rid <rid>` on the machine that publishes to check a publish target too;
  see [shipping](desktop/shipping.md).
- **A command-line tool reports `RCLI5000`.** The command failed
  unexpectedly, and the exception is hidden. For a tool built on Runic Command
  Line, set `RUNIC_COMMANDLINE_DEBUG=1` and run it again to see the exception
  on stderr. `dotnet runic` always prints it.
- **A translated description shows English.** Its `DescriptionKey` did not
  resolve. Set `RUNIC_COMMANDLINE_DEBUG=1` to list each one as an `RCLI0023`
  warning; see [translate a CLI](command-line/README.md#translate-a-cli).
- **The bridge or the frontend build fails.** `RUNICBRIDGE016` reports a
  frontend install or build command that failed; its own output, printed
  above the error, names the cause.

## More help

- Guides with their own troubleshooting sections:
  [embed and serve assets](assets/README.md#troubleshooting) and the
  [Translations .NET quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.7/docs/guides/translations/quickstart-dotnet.md#troubleshooting).
- [Release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.8/eng/release/notes/0.7.0-preview.7.md#upgrading)
  list the steps for upgrading from an earlier preview.
- [Support](https://docs.runic-artifex.eu/support/) explains how to report a
  problem.
