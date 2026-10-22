# Troubleshooting and diagnostic IDs

Runic tools and build steps report problems with a diagnostic ID, such as
`RUNICBRIDGE016` or `RTR0011`. The message says what is wrong, and most of them
link to the entry for the ID at the release tag of the package that reported
it. This page tells you which product owns an ID and where to start when
something fails without one.

## Find the reference for an ID

| Prefix                           | Reported by                                                                                           | Reference                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNICBRIDGE`                    | The bridge code generator and the Views build targets, during `dotnet build`                          | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#bridge-code-generator)                              |
| `RAPPCLI`, `RAPPDEV`, `RAPPSIZE` | `dotnet runic` commands, such as `dev`, `doctor` and `size`                                           | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#dotnet-runic)                                       |
| `RAS`                            | The asset packer and the Runic.Assets build targets                                                   | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#asset-packer)                                       |
| `RUNICDESK`                      | The Runic Desktop build targets                                                                       | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#runic-desktop-build)                                |
| `RCREATE`                        | `dnx Runic.Create`                                                                                    | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#runiccreate)                                        |
| `RUNICPA`, `RUNICEL`             | The privileged-action build targets of Runic.Platform and its platform packages                       | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#privileged-actions)                                 |
| `RUNICDBUS`                      | The D-Bus source generator                                                                            | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#d-bus-source-generator)                             |
| `RUNICP`                         | `@runic-artifex/vite-plugin-runic`                                                                    | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/diagnostics.md#vite-plugin)                                        |
| `RUNICDESK1xx`, `RUNICASSETS`    | Retired experimental-API IDs; since SDK `0.10.0` no API is experimental, so remove their suppressions | [Experimental APIs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/docs/experimental.md)                                                 |
| `RCLI`                           | Runic Command Line and any tool built on it, including `dotnet runic`                                 | [Command Line diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.8.0/docs/guides/command-line/diagnostics.md)                    |
| `RTR`                            | The Translations compiler, in the build, the tool and the editors, and `runic-translations support`   | [Translations diagnostics](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.7.0-preview.4/docs/guides/translations/diagnostics.md) |

The links above are for SDK `0.10.0`, Command Line `0.8.0`
and Translations `0.7.0-preview.4`. For another release, change the tag in the
address. `dotnet runic` reports a few `RCLI8xxx` codes of its own; the SDK
diagnostics list them.

## First steps

- **An app or its build fails.** Run `dotnet runic doctor` in the project
  folder. It checks the .NET SDK, the JavaScript runtime and package manager,
  the lock file and that every Runic package belongs to one release. Add
  `--runtime <rid>` on the machine that publishes to check a publish target too;
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
  above the error, names the cause. `RUNICBRIDGE022` means that
  `dotnet publish --no-build` found no Bridge code from an earlier build:
  build first with the same configuration, target framework and `PublishAot`.
  Since SDK `0.10.0`, `RUNICBRIDGE026` means the frontend declares
  dependencies but has no lock file for its package manager: commit the lock
  file, or set `RunicApplicationFrontendAllowUnlockedInstall=true`.

## Exit codes and JSON output

Since SDK `0.10.0` the SDK tools (`dotnet runic`, `dnx Runic.Create` and the
asset packer) run on Runic Command Line `0.8.0` and share its exit codes: 0 for
success, 1 when the command failed or something it needs is unavailable, 2 for
usage and validation errors, 3 for internal or host failures and 130 when
cancelled. The Windows administration verifier keeps its documented 0/1/2.
Select JSON output with `--format json`; `--output json` remains a hidden alias
for `dotnet runic`, the asset packer and the verifier until 2.0, and
`Runic.Create` keeps `--output` (`-o`) as its destination directory. Regenerate
installed completion scripts after updating.

## More help

- Guides with their own troubleshooting sections:
  [embed and serve assets](assets/README.md#troubleshooting) and the
  [Translations .NET quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.7.0-preview.4/docs/guides/translations/quickstart-dotnet.md#troubleshooting).
- [Release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.10.0/eng/release/notes/0.10.0.md#upgrading)
  list the steps for upgrading from an earlier release.
- [Support](https://docs.runic-artifex.eu/support/) explains how to report a
  problem.
