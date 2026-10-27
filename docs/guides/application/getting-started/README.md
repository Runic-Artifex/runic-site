# Getting started

Create a starter app with the guided creator and run it:

```sh docs-test=commands
dnx Runic.Create@<VERSION>
cd MyApp
dotnet tool restore
dotnet runic dev
```

`dnx` ships with the .NET 10 SDK and runs the creator without installing it.
The creator asks for the project name, frontend, package manager, Window host,
Linux GTK version (for Runic Desktop) and ViewModel library, then whether to add
a test project, a Nix flake or the packaging manifests, and whether to restore
the NuGet packages. Since SDK `0.10.0` it asks on standard error, so
redirecting standard output does not turn the questions off. Pass `--yes`, set
`RUNIC_COMMANDLINE_NO_INPUT=1` or redirect standard input to use the defaults;
Escape or Ctrl+C at a question cancels with exit code 130. It installs
`Runic.Application.Templates`, runs `dotnet new runic-app`, and prints both
commands so you can recreate the project without questions:

```sh docs-test=commands
dotnet new install Runic.Application.Templates@<VERSION>
dotnet new runic-app --name MyApp --frontend svelte --package-manager bun --host desktop --linux-gtk 3 --view-models reactiveui
```

| Option              | Choices                                          | Default      |
| ------------------- | ------------------------------------------------ | ------------ |
| `--frontend`        | `react`, `vue`, `svelte`, `sveltekit`, `angular` | `react`      |
| `--package-manager` | `npm`, `pnpm`, `bun`                             | `npm`        |
| `--host`            | `desktop`, `cswebui`                             | `desktop`    |
| `--linux-gtk`       | `3`, `4` (Linux GTK version for `desktop`)       | `3`          |
| `--view-models`     | `reactiveui`, `toolkit` (CommunityToolkit.Mvvm)  | `reactiveui` |

The switches `--tests` (a TUnit test project), `--nix` (a Nix flake),
`--packaging` (the `packaging/` manifests of `dotnet runic package`, to edit
them) and `--restore` (a NuGet restore after creating the project) are off by
default. `--application-id` sets the reverse-DNS application ID, such as
`org.example.Notes`; by default it is `com.example.` and the project name's
ASCII letters and digits. The creator also takes `--force`, to create the project in a directory that is not
empty, and `--no-install`, to use the installed template instead of installing
it.

New in SDK `0.11.0`: `--frontend sveltekit`, a SvelteKit 3 frontend with
`@runic-artifex/sveltekit` and `@runic-artifex/svelte`; `--restore`,
`--application-id`, `--force` and `--no-install`. `--packaging` now copies the
manifests of `dotnet runic package` instead of `packaging/package.mjs`. New
projects write `packages.lock.json` on their first restore, which pins every
NuGet package; commit it with the frontend's lock file. Outside `Development`
they send a Content-Security-Policy without `'unsafe-eval'`.

Runic Desktop, the default host, opens a native window with the embedded
WebView and native file dialogs. CS-WebUI opens a browser window and is
supported on a best-effort basis. ReactiveUI is the primary ViewModel library;
CommunityToolkit.Mvvm has its own idiomatic path.
[Choosing a host and MVVM library](../choosing.md) explains when to pick each.

Replace `<VERSION>` with the current release from the
[package catalog](https://docs.runic-artifex.eu/packages/). You need the .NET 10
SDK and Node.js 24 with npm or pnpm, or Bun 1.4. Since SDK `0.11.0`, Node.js 26
works too; `dotnet runic doctor` warns because Node.js 24 is the certified
version. Since SDK `0.12.0`, the build tools (the Bridge generator, the asset
packer, `dotnet runic` and `Runic.Create`) roll forward to a newer major .NET,
so a machine with only a newer .NET SDK, such as .NET 11, builds the app; .NET
10 remains the tested runtime.

SDK `0.12.1` is built with .NET SDK 10.0.403 (runtime 10.0.14) for
CVE-2026-111497 in the bundled Brotli decoder. Use .NET SDK 10.0.403 or later,
Node.js 24.22.1 or 26.12.1, and Bun 1.4.4 or later, the template's default.

`dotnet runic dev` restores the .NET and frontend packages, builds the app,
starts the frontend development server, and opens the app. Since SDK `0.11.0`
it takes `--launch-profile`, `--no-build`, `-e`/`--environment NAME=VALUE` and
`-v`/`--verbosity`, and confirms that the development server on its port is the
one it started. Since SDK `0.12.0`, on macOS it and `dotnet run` start the app
from an ad-hoc signed development bundle in `obj/`, so notifications, login
startup and the URL schemes work while you develop. `dotnet runic doctor`
checks the prerequisites at any point.
The generated README describes the project layout, the ignored
`Frontend/src/generated` clients, publishing, and the project settings. The
[project creator](https://docs.runic-artifex.eu/create/) builds the command for
your choices and previews the generated files.

## Publish

```sh docs-test=commands
dotnet publish -c Release -r linux-x64
```

Use `win-x64`, `osx-arm64` or another runtime identifier for other platforms;
since SDK `0.12.0`, macOS is supported on Apple silicon (`osx-arm64`) only.
The publish folder contains the executable and a `www` folder with the built
frontend; distribute the whole folder. Since SDK `0.11.0`,
`RunicApplicationFrontendDelivery=Embedded` packs the frontend into the
application assembly instead, and `dotnet runic package` builds an installable
package for each platform. To publish self-contained or with NativeAOT, then
bundle, sign and package a Desktop app for Windows, macOS and Linux, follow [ship a Desktop application](../../desktop/shipping.md).

## Next steps

The starter uses a .NET Window and View contract with a generated TypeScript
client. The frontend owns its rendered components; .NET owns the typed model and
operation lifetime.

- [Windows and Views, step by step](../tutorial/README.md) walks through the
  generated project, then nested Views and tests.
- [Add Runic to an existing app](../existing-app.md) when you already have a
  .NET project and a frontend. Its
  [third step](../existing-app.md#3-declare-a-window-and-its-views) shows the
  `runic-view` item template, which adds a View or a Window and its ViewModel
  to a project.
- [Build a desktop app from published packages](../package-consumer.md) covers
  GTK 4, generated assets, scoped services, native ownership and shutdown.
- [Embed and serve assets](../../assets/README.md) to ship a frontend inside
  the executable or serve it from ASP.NET Core.
- [Choosing a host and MVVM library](../choosing.md) compares the hosts and
  ViewModel libraries, and the [glossary](../glossary.md) defines the terms
  the guides share.
- The [package catalog](https://docs.runic-artifex.eu/packages/) groups the
  packages by goal.
- For the smallest source example, see
  [First Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/examples/first-window/README.md).

The code blocks in these guides are checked against a pinned copy of the SDK
template and examples by
[`tests/guide-snippets.test.mjs`](../../../tests/guide-snippets.test.mjs).
