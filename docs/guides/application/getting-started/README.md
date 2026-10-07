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
and ViewModel library. It installs `Runic.Application.Templates`, runs
`dotnet new runic-app`, and prints both commands so you can recreate the
project without questions:

```sh docs-test=commands
dotnet new install Runic.Application.Templates@<VERSION>
dotnet new runic-app --name MyApp --frontend svelte --package-manager bun --host desktop --view-models reactiveui
```

| Option              | Choices                                         | Default   |
| ------------------- | ----------------------------------------------- | --------- |
| `--frontend`        | `react`, `vue`, `svelte`, `angular`             | `react`   |
| `--package-manager` | `npm`, `pnpm`, `bun`                            | `npm`     |
| `--host`            | `cswebui`, `desktop`                            | `cswebui` |
| `--view-models`     | `toolkit` (CommunityToolkit.Mvvm), `reactiveui` | `toolkit` |

Replace `<VERSION>` with the current release from the
[package catalog](https://docs.runic-artifex.eu/packages/). You need the .NET 10
SDK and Node.js 24 with npm or pnpm, or Bun 1.4.

`dotnet runic dev` restores the .NET and frontend packages, builds the app,
starts the frontend development server, and opens the app. The CS-WebUI host
uses an installed browser's app mode, falling back to the platform WebView; the
Runic Desktop host opens a native window with the embedded WebView.
`dotnet runic doctor` checks the prerequisites at any point. The generated
README describes the project layout, the ignored `Frontend/src/generated`
clients, publishing, and the project settings. The
[project creator](https://docs.runic-artifex.eu/create/) builds the command for
your choices and previews the generated files.

## Publish

```sh docs-test=commands
dotnet publish -c Release -r linux-x64
```

Use `win-x64`, `osx-arm64` or another runtime identifier for other platforms.
The publish folder contains the executable and a `www` folder with the built
frontend; distribute the whole folder.

## Next steps

The starter uses a .NET Window and View contract with a generated TypeScript
client. The frontend owns its rendered components; .NET owns the typed model and
operation lifetime.

- [Windows and Views, step by step](../tutorial/README.md) walks through the
  generated project, then nested Views and tests.
- [Add Runic to an existing app](../existing-app.md) when you already have a
  .NET project and a frontend.
- [Embed and serve assets](../../assets/README.md) to ship a frontend inside
  the executable or serve it from ASP.NET Core.
- [Host selection](../../desktop/host-selection.md) compares CS-WebUI and Runic
  Desktop for native windows and platform services.
- The [package catalog](https://docs.runic-artifex.eu/packages/) groups the
  packages by goal.
- For the smallest source example, see
  [First Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.1/examples/first-window/README.md).

The code blocks in these guides are checked against a pinned copy of the SDK
template and examples by
[`tests/guide-snippets.test.mjs`](../../../tests/guide-snippets.test.mjs).
