# Troubleshooting and diagnostic IDs

Runic tools and build steps report problems with a diagnostic ID, such as
`RUNICBRIDGE016` or `RTR0011`. The message says what is wrong, and most of them
link to the entry for the ID at the release tag of the package that reported
it. This page tells you which product owns an ID and where to start when
something fails without one.

## Find the reference for an ID

| Prefix                                      | Reported by                                                                                                            | Reference                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNICBRIDGE`                               | The bridge code generator and the Views build targets, during `dotnet build`                                           | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#bridge-code-generator)                    |
| `RAPPCLI`, `RAPPDEV`, `RAPPSIZE`, `RAPPPKG` | `dotnet runic` commands, such as `dev`, `doctor`, `size` and `package`                                                 | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#dotnet-runic)                             |
| `RAS`                                       | The asset packer and the Runic.Assets build targets                                                                    | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#asset-packer)                             |
| `RUNICDESK`                                 | The Runic Desktop build targets                                                                                        | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#runic-desktop-build)                      |
| `RCREATE`                                   | `dnx Runic.Create`                                                                                                     | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#runiccreate)                              |
| `RUNICPA`, `RUNICEL`                        | The privileged-action build targets of Runic.Platform and its platform packages                                        | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#privileged-actions)                       |
| `RUNICNAV`                                  | The Runic.Navigation ReactiveUI build targets                                                                          | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#navigation-reactiveui-build)              |
| `RUNICDBUS`                                 | The D-Bus source generator                                                                                             | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#d-bus-source-generator)                   |
| `RUNICP`                                    | `@runic-artifex/vite-plugin-runic`                                                                                     | [SDK diagnostics](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#vite-plugin)                              |
| `RUNICDESK1xx`, `RUNICASSETS`               | Retired experimental-API IDs, such as the native server's `RUNICDESK102` until SDK `0.15.0`; remove their suppressions | [Experimental APIs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/experimental.md)                                       |
| `RCLI`                                      | Runic Command Line and any tool built on it, including `dotnet runic`                                                  | [Command Line diagnostics](https://github.com/Runic-Artifex/runic-cli-sdk/blob/v0.11.0/docs/guides/command-line/diagnostics.md)         |
| `RTR`                                       | The Translations compiler, in the build, the tool and the editors, and `runic-translations support`                    | [Translations diagnostics](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/diagnostics.md) |

The links above are for SDK `0.15.0`, Command Line `0.11.0`
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
- **A page's calls fail with a `protocol` diagnostic after updating to SDK
  `0.13.0`.** Views protocol 4 is a strict version: a cached `0.12` page and a
  `0.13` host, or a `0.13` page and a `0.12` host, do not connect, and .NET logs
  `BridgeProtocolMismatch` (event 1018). Update every Runic NuGet and npm
  package to `0.13.0` together, rebuild so the generated clients, bridges and
  mocks are regenerated, replace copies of `runic-desktop-views.js` or
  `runic-cswebui.js` kept outside the web content, and reload open pages. An
  operation started under `0.12` and recovered after the upgrade is `unknown`.
  See the
  [migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/migration-1.0.md#from-012-to-013).
- **A script sees exit code 1 where it expected 2.** Since SDK `0.14.0` the
  SDK tools run on Runic Command Line `0.11.0`: a failure on what a command
  found, such as a missing project (`RAPPDEV1002`), exits 1, and 2 means that
  the command line itself is wrong. See
  [exit codes and JSON output](#exit-codes-and-json-output).
- **Field edits are kept with an error instead of disappearing.** Since SDK
  `0.14.0`, `useTextField`, `injectTextField` and `createTextFieldController`
  read checked-write receipts: a `rejected` or `conflict` write keeps the
  draft and sets `error`. Before, such a write dropped the draft silently. See
  [forms and validation](application/guides/forms-and-validation.md).
- **Subscribers see fewer states, or a test reads an older `snapshot`.** Since
  SDK `0.14.0`, the client notifies subscribers once per animation frame with
  the newest state. Await the call whose result you need, or read the state in
  `subscribe`; see [testing frontends](application/guides/frontend-testing.md).
- **A route stays open after its component unmounted.** Since SDK `0.14.0`,
  bindings keep a client for `keepAlive` milliseconds (2000 by default) so a
  component that mounts again takes it over. Pass `keepAlive: 0` where the
  route must close at once.
- **A test request waits 5 seconds and then answers `no-hello`.** Since SDK
  `0.14.0`, requests that arrive before the connection's `hello` are held for
  up to 5 seconds. Send the `hello` first, or advance a fake clock.
- **A CS-WebUI page no longer shows "Connection with the backend is lost".**
  Since SDK `0.14.0`, `runic-cswebui.js` installs a WebUI event callback, and
  WebUI shows its banner only without one. Show the connection state yourself,
  for example from `useBridgeConnection()`.
- **The build warns `RUNICBRIDGE033`.** Since SDK `0.14.0`, the build warns
  when the .NET SDK is older than 10.0.403 or a Bun frontend is built with a
  Bun older than 1.4.4, the versions `dotnet runic doctor` requires. Under Nix
  this includes nixpkgs' SDK 10.0.401 and Bun 1.4.2 until nixpkgs updates
  them; add the code to `NoWarn` meanwhile.
- **A build fails with `CS0619` naming a replacement.** Since SDK `0.14.0`,
  types removed in 0.9 or 0.13 fail with an error that names their
  replacement; see the
  [migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/migration-1.0.md#removed-types).
- **A Runic Desktop build fails with `RUNICDESK004` after updating to SDK
  `0.15.0`.** `Runic.Desktop` no longer carries a presentation server or
  references ASP.NET Core. Add `Runic.Desktop.NativeServer` or, for an
  application that uses ASP.NET Core itself, `Runic.Desktop.Kestrel` to the
  executable, at the same version; an executable that opens no window sets
  `RunicDesktopServer` to `None`. `RUNICDESK003` reports another value of
  `RunicDesktopServer`. Code that compiled against ASP.NET Core or
  `Microsoft.Extensions.Hosting` types through `Runic.Desktop` gets them from
  `Runic.Desktop.Kestrel`. See
  [the presentation server](desktop/host-selection.md#presentation-server).
- **A NativeAOT publish fails with `RUNICDESK005`.** The native server's
  static library, `Runic.Desktop.NativeServer.Static.<rid>`, is restored only
  for a runtime-specific restore. Publish with `-r <rid>` for a runtime
  identifier the package supports.
- **The first window fails with `native-server-unavailable`.** The native
  server has no library for the runtime identifier, or a library from
  `RunicDesktopNativeServerLibraryDirectory` or Nix's `runicServer` comes from
  another release; since SDK `0.15.0` its native interface is version 2, and
  `Runic.Desktop` accepts only the library of its own release.
- **`IConfiguration` or `IHostEnvironment` cannot be resolved on the native
  server.** `DesktopHostOptions.ConfigureServices` receives a plain service
  collection with logging there, not the ASP.NET Core host's services.
  Register what the application needs, or keep `Runic.Desktop.Kestrel`.
- **A `switch` over `BridgeConnectionState` no longer compiles.** Since SDK
  `0.15.0` the state has a fifth value, `"closed"`: the application closed the
  window. Handle it, for example with "The application closed this window.",
  as the template does.
- **A command ran on the page but nothing happened.** Since SDK `0.15.0`, .NET
  answers a `[RunicPresentationScoped]` command from an earlier presentation
  `superseded` without running it, and the call resolves without an error. The
  development client lists such calls on the DevTools dock's **Superseded
  commands** card and in the timeline of `/__runic/state`. See
  [commands scoped to their page](application/guides/pages-and-navigation.md#commands-scoped-to-their-page).
- **`vite.config.ts` fails to load: `runicDevSession` is not exported.** SDK
  `0.15.0` removed `runicDevSession()`, deprecated in `0.14.0`. A SvelteKit
  frontend uses `runic({ html: false })` and imports
  `@runic-artifex/vite-plugin-runic/client` from `src/hooks.client.ts`.
- **A Windows window shows `Loading…` first.** Since SDK `0.15.0`, a WebView2
  window that is not ready within 1.5 seconds appears with a loading surface,
  and the page follows. This is usual after a WebView2 runtime or Windows
  update. UI automation waits for the page's document or title, not only the
  window. See
  [the early first window](desktop/host-selection.md#the-early-first-window-on-windows).
- **A check for the exact type `DesktopException` misses a failed browser
  fallback.** Since SDK `0.15.0`, a chain of
  presentations that all failed throws `DesktopPresentationException`, a
  `DesktopException` with the same `Code` and `Category`, whose `Attempts`
  list each failure; the browser's exception is its `InnerException`.
- **A CS-WebUI build has no `www/` folder.** Since SDK `0.15.0`, a CS-WebUI
  project with `RunicApplicationFrontendDelivery=Embedded` embeds its frontend
  and no longer warns `RUNICBRIDGE030`. Remove the property to keep `www/`.
- **A build fails with `RAS2006`.** Since SDK `0.15.0` the build checks the
  archive that `RunicAssetsEmbeddedArchive` names before it embeds it; the
  packer's `RAS1007` above it gives the reason. Pack the archive again.
- **A publish with `-p:PublishReadyToRun=true` failed with `NETSDK1191`.**
  Fixed in SDK `0.15.0`; remove a workaround that passed the property to the
  application project only.
- **Code that handled `AdministrationErrorCategory.Unavailable` or
  `NativeFailure` misses failures.** Since SDK `0.15.0`, a missing component
  is `NotInstalled`, missing accounts and groups are `NotFound`, a timeout is
  `Unavailable`, and service state conflicts are `Conflict`; see
  [Windows administration](desktop-services.md#windows-administration).
- **Stored or compared `TimeSpan` text changed.** Since SDK `0.13.0`, a
  `TimeSpan` travels as an ISO 8601 duration, such as `"P1DT2H3M4.5S"`, not
  `"1.02:03:04.5000000"`; update code that parses or stores the text.
- **`vite dev` warns `stale-input`.** The development client of
  `@runic-artifex/vite-plugin-runic` warns once per field when script sets a
  focused `<input>` or `<textarea>` back to an earlier value while a Bridge
  request is in flight, the sign of a command per key or a copy of the state.
  Bind the field with the field API (`useField`, `injectField`, `bindField`;
  see [forms and validation](application/guides/forms-and-validation.md)), or
  turn the warning off with `runic({ staleInputWarning: false })`. It is a heuristic: an
  autocomplete library can trigger it too.
- **Linux windows mark spelling, or a language is not checked.** Since SDK
  `0.13.0`, GTK windows check `spellcheck` fields by default; set
  `DesktopWindowOptions.SpellChecking = false` for the earlier behaviour. A
  language of `DesktopHostOptions.SpellCheckingLanguages` without an installed
  dictionary reports `spell-checking-dictionary-missing`. See
  [spell checking](desktop-services.md#spell-checking).
- **A save reports `ResourceBusy` on Windows.** Since SDK `0.12.0`, a file that
  another program holds open without delete sharing is
  `NotCommitted(ResourceBusy)`, not `CommitUnknown(IOError)`: the file was not
  replaced, so try again later.
- **`dotnet runic dev` fails with `RAPPDEV1007`.** Since SDK `0.11.0`, `dev`
  waits until the development server confirms its session. With `runic()` in
  the Vite configuration, update `@runic-artifex/vite-plugin-runic` to the
  release of `dotnet runic`; an Angular frontend that declares the plugin
  needs `runicDevSessionProxy()` in its `proxyConfig`, and a SvelteKit
  frontend uses `runic({ html: false })` (since SDK `0.14.0`; `runicDevSession()`
  before, which SDK `0.15.0` removed). See
  [`RAPPDEV1007`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#rappdev1007).
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
asset packer) run on Runic Command Line, `0.11.0` since SDK `0.14.0`, and share
its exit codes: 0 for
success, 1 when the command failed or something it needs is unavailable, 2
when the command line itself is wrong, 3 for internal or host failures and 130
when cancelled. Since SDK `0.14.0`, a project, file or tool that the command
found missing or invalid exits 1, as a failed build already did; under SDK
`0.13.0` these exited 2:

| Code           | Failure                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `RAPPDEV1002`  | The project does not exist, is not a `.csproj`, or the directory has none or several                     |
| `RAPPDEV1003`  | MSBuild could not evaluate the project (`dev`, `doctor`)                                                 |
| `RAPPDEV1004`  | A required program could not be started                                                                  |
| `RAPPDEV1005`  | The project is not a Views Window project or its frontend configuration is invalid                       |
| `RAPPDEV1006`  | The Window rebuild after a C# edit failed (`dev`)                                                        |
| `RAPPDEV1008`  | `--no-restore` without installed frontend packages                                                       |
| `RAPPDEV1009`  | A Window entry page does not exist                                                                       |
| `RAPPSIZE1003` | The `size --report` file already exists                                                                  |
| `RAPPPKG1001`  | The application identity in the project is invalid, or the package icon is missing                       |
| `RAPPPKG1007`  | The Flathub sources cannot be generated; neither or both of `--git-commit` and `--git-tag` still exits 2 |
| `RAS1001`      | The packer's source directory does not exist                                                             |
| `RCREATE003`   | The `runic-create` destination is not empty and `--force` is not given                                   |

Unknown options and commands, missing arguments, invalid values and a target
of another operating system (`RAPPPKG1004`) still exit 2. Human output writes a
fault as its message without the leading code (`The selected project does not
exist.`, then the `Help for RAPPDEV1002` line), and a usage error ends with the
usage line and the help command. Scripts test the exit code or read
`fault.code` from `--format json`, which keeps every code. The Windows administration verifier keeps its documented 0/1/2.
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
- The [0.13.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/eng/release/notes/0.13.0.md#upgrading)
  list the steps for upgrading from 0.12, the
  [migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/migration-1.0.md#from-012-to-013)
  has before and after tables, and the
  [0.12.1 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/eng/release/notes/0.12.1.md#what-to-update)
  the .NET, Node and Bun versions of the security patch.
- [Support](https://docs.runic-artifex.eu/support/) explains how to report a
  problem.
