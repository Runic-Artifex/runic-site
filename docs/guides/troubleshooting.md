# Troubleshooting and diagnostic IDs

Runic tools and build steps report problems with a diagnostic ID, such as
`RUNICBRIDGE016` or `RTR0011`. The message says what is wrong, and most of them
link to the entry for the ID at the release tag of the package that reported
it. This page tells you which product owns an ID and where to start when
something fails without one.

## Find the reference for an ID

| Prefix                                      | Reported by                                                                                           | Reference                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNICBRIDGE`                               | The bridge code generator and the Views build targets, during `dotnet build`                          | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#bridge-code-generator)                    |
| `RAPPCLI`, `RAPPDEV`, `RAPPSIZE`, `RAPPPKG` | `dotnet runic` commands, such as `dev`, `doctor`, `size` and `package`                                | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#dotnet-runic)                             |
| `RAS`                                       | The asset packer and the Runic.Assets build targets                                                   | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#asset-packer)                             |
| `RUNICDESK`                                 | The Runic Desktop build targets                                                                       | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#runic-desktop-build)                      |
| `RCREATE`                                   | `dnx Runic.Create`                                                                                    | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#runiccreate)                              |
| `RUNICPA`, `RUNICEL`                        | The privileged-action build targets of Runic.Platform and its platform packages                       | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#privileged-actions)                       |
| `RUNICNAV`                                  | The Runic.Navigation ReactiveUI build targets                                                         | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#navigation-reactiveui-build)              |
| `RUNICDBUS`                                 | The D-Bus source generator                                                                            | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#d-bus-source-generator)                   |
| `RUNICP`                                    | `@runic-artifex/vite-plugin-runic`                                                                    | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#vite-plugin)                              |
| `RUNICDESK1xx`, `RUNICASSETS`               | Retired experimental-API IDs; since SDK `0.10.0` no API is experimental, so remove their suppressions | [Experimental APIs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/experimental.md)                                       |
| `RCLI`                                      | Runic Command Line and any tool built on it, including `dotnet runic`                                 | [Command Line diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.9.1/docs/guides/command-line/diagnostics.md)          |
| `RTR`                                       | The Translations compiler, in the build, the tool and the editors, and `runic-translations support`   | [Translations diagnostics](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/diagnostics.md) |

The links above are for SDK `0.12.0`, Command Line `0.9.1`
and Translations `0.8.0`. For another release, change the tag in the
address. `dotnet runic` reports a few `RCLI8xxx` codes of its own; the SDK
diagnostics list them.

## First steps

- **An app or its build fails.** Run `dotnet runic doctor` in the project
  folder. It checks the .NET SDK, the JavaScript runtime and package manager,
  the lock file and that every Runic package belongs to one release. Add
  `--runtime <rid>` on the machine that publishes to check a publish target too;
  see [shipping](desktop/shipping.md). Since SDK `0.11.0` it also warns, without
  failing, when the frontend's `@runic-artifex/views` is from another release
  than `Runic.Application.Views` (`views-package-versions`; reinstall the
  frontend packages) and when `ApplicationId` is not a reverse-DNS name that
  every package format accepts (`application-id`).
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
- **A build fails after updating to SDK `0.11.0`.** Code that compiled against
  `0.10.0` compiles unchanged, but three new warnings fail a build with
  `TreatWarningsAsErrors`: `RUNICNAV002` (the project references both
  navigation ReactiveUI adapters; keep one), `RUNICBRIDGE029`
  (`RunicApplicationFrontendPackageManager` is not `npm`, `pnpm` or `bun`) and
  `RUNICDBUS013` (a `Deprecated` or proxy `NoReply` annotation that generated
  D-Bus code does not carry out). Fix the cause, or accept the warning for the
  project. TypeScript projects need TypeScript 5.2 or later for the
  regenerated `.d.ts` files.
- **Packaging for macOS fails after updating to SDK `0.12.0`.** Runic supports
  macOS on Apple silicon only: `dotnet runic package` refuses `osx-x64` and a
  universal bundle (`--runtime osx-arm64,osx-x64`) with `RAPPPKG1004`, and
  `dotnet runic doctor --runtime osx-x64` fails `target-rid`; publish for
  `osx-arm64`. `RAPPPKG1006` names an override that lacks a field it needs: a
  `macos/Info.plist` without `{{UsageDescriptions}}` while the project sets a
  camera or microphone usage description, or a `macos/entitlements.plist`
  without `{{Entitlements}}` that lacks a key the App Sandbox needs. See
  [shipping](desktop/shipping.md).
- **`dotnet run` on macOS starts a different process.** Since SDK `0.12.0`,
  `dotnet run`, `dotnet watch` and `dotnet runic dev` start the application
  from a signed development bundle in `obj/`, so notifications, login startup
  and open registration work. Set
  `<RunicMacDevelopmentBundle>false</RunicMacDevelopmentBundle>` to run the
  build output as before.
- **A macOS application quits differently or opens windows elsewhere.** Since
  SDK `0.12.0`, every quit, also from the Dock or a logout and with no window
  open, asks `ConfirmQuitAsync` and the close guards and cancels
  `ShutdownRequested`; an application that keeps running without a window sets
  `HandlesShutdownWithoutWindow`. Window positions are points from the
  primary screen's top-left corner; positions the application computes itself
  need flipping. See [windows on macOS](desktop-services.md#windows-on-macos).
- **A save reports `ResourceBusy` on Windows.** Since SDK `0.12.0`, a file that
  another program holds open without delete sharing is
  `NotCommitted(ResourceBusy)`, not `CommitUnknown(IOError)`: the file was not
  replaced, so try again later.
- **`dotnet runic dev` fails with `RAPPDEV1007`.** Since SDK `0.11.0`, `dev`
  waits until the development server confirms its session. With `runic()` in
  the Vite configuration, update `@runic-artifex/vite-plugin-runic` to the
  release of `dotnet runic`; an Angular frontend that declares the plugin
  needs `runicDevSessionProxy()` in its `proxyConfig`, and a SvelteKit
  frontend uses `runicDevSession()`. See
  [`RAPPDEV1007`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/docs/diagnostics.md#rappdev1007).
- **A page fails in the published application but works in `dev`.** Since SDK
  `0.11.0`, new projects send a Content-Security-Policy without
  `'unsafe-eval'` outside `Development`
  (`RunicDesktopHostOptions.ContentSecurityPolicy` in `Program.cs`), and the
  web view's console reports the violation. A page dependency that evaluates
  strings (`eval`, `new Function`) needs `'unsafe-eval'` back, and so do
  `DesktopSurface.ExecuteJavaScriptAsync` and CS-WebUI's `RunJavaScript`. The
  Views Bridge itself no longer needs it. Development servers are not covered
  by the template's policy.
- **The menu bar appears, moves or is missing.** Since SDK `0.11.0`, a
  declared menu bar is shown in Windows and GTK windows and can move into the
  Linux global menu. `MenuBarPresentation` `Page` or `None`, or
  `LinuxDesktopOptions.GlobalMenu = false`, keep the old look. A Flatpak
  without `--talk-name=com.canonical.AppMenu.Registrar` keeps the bar in the
  window and reports `global-menu-permission`; since SDK `0.12.0` the manifests
  of the template and `dotnet runic package` grant it, but a hand-written one
  still needs it; `global-menu-failed`,
  `menu-bar-failed`, `menu-bar-page-native`, `menu-radio-checked` and
  `menu-title-invalid` name other causes. See
  [menus](desktop-services.md#menus).
- **A CS-WebUI page receives no state after updating.** Since SDK `0.11.0`
  the host sends state as data; update any copy of `runic-cswebui.js` that
  the application keeps outside `www/`.
- **Remote WMI fails with an IP address.** Since SDK `0.11.0`, remote WMI
  authenticates the server with Kerberos and has no NTLM fallback: name the
  server by its DNS or NetBIOS name.

## Exit codes and JSON output

Since SDK `0.10.0` the SDK tools (`dotnet runic`, `dnx Runic.Create` and the
asset packer) run on Runic Command Line, `0.9.1` since SDK `0.12.0`, and share
its exit codes: 0 for
success, 1 when the command failed or something it needs is unavailable, 2 for
usage and validation errors, 3 for internal or host failures and 130 when
cancelled. The Windows administration verifier keeps its documented 0/1/2.
Select JSON output with `--format json`; `--output json` remains a hidden alias
for `dotnet runic`, the asset packer and the verifier until 2.0, and
`Runic.Create` keeps `--output` (`-o`) as its destination directory. Regenerate
installed completion scripts after updating. Since SDK `0.12.0` these tools,
and the Bridge generator, roll forward to a newer major .NET runtime, so a
machine with only a newer .NET SDK builds the application.

## More help

- Guides with their own troubleshooting sections:
  [embed and serve assets](assets/README.md#troubleshooting) and the
  [Translations .NET quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/quickstart-dotnet.md#troubleshooting).
- The [0.12.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/eng/release/notes/0.12.0.md#upgrading)
  list the steps for upgrading from an earlier release, and the
  [0.12.1 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/eng/release/notes/0.12.1.md#what-to-update)
  the .NET, Node and Bun versions of the security patch.
- [Support](https://docs.runic-artifex.eu/support/) explains how to report a
  problem.
