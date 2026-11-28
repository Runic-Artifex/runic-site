# Split CI across Linux and Windows runners

Since SDK `0.24.0`, a Runic application's CI can run its tests and all its web
work on Linux runners and use a Windows runner only to package. A Linux job
writes a **web bundle**: each project's built page, its generated TypeScript
clients and its Views' fingerprints. The Windows job downloads it as an
artifact and publishes from it, without Node.js, a frontend install or a Vite
build, and the publish stops when the bundle was built from other ViewModels.

The
[split CI example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.24.0/examples/split-ci)
in runic-sdk is a complete repository with this setup: a Runic Desktop
application, its headless tests, one workflow for GitHub Actions and Gitea
Actions, and one for Forgejo Actions. runic-sdk runs it against its packed
packages on every package pull request. The workflow excerpts below are from
that example.

## When this helps

This setup suits a team with many Linux runners and one or a few runners of its
target OS, such as a self-hosted Gitea with four Linux runners and one Windows
runner. When everything runs in one Windows job, every push waits for that
runner. Most of a Runic application's build runs on any OS:

| Runs on Linux                                                   | Needs the target OS                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| The .NET build, the Bridge generator and the TypeScript clients | NativeAOT (`Cross-OS native compilation is not supported.`) |
| The frontend install and build                                  | The MSIX (`makeappx`) and signing (`signtool`)              |
| The headless Window tests of the ViewModels                     | Running WPF or WebView2 code, installing the MSIX           |
| A framework-dependent or self-contained `win-x64` publish       |                                                             |

The same split works for macOS: the bundle comes from Linux, and only
`dotnet runic package macos` runs on the Mac.

## The pipeline

```text docs-test=skip:diagram
          push, pull request                       main or a tag
                 │                                       │
     ┌───────────┴───────────┐                           │
     ▼                       ▼                           │
   test                   web-bundle                     │   Linux runners, in parallel
   dotnet test            dotnet runic bundle            │
                          upload the web-bundle artifact │
     └───────────┬───────────┘                           │
                 ▼  needs: [test, web-bundle], if: a push to main or a tag
     ┌───────────┴─────────────────────┐
     ▼                                 ▼
   windows-package                   linux-package
   download web-bundle               download web-bundle
   dotnet runic package windows      dotnet runic package deb
     --frontend-bundle                 --frontend-bundle
   upload the MSIX                   upload the deb
```

The packaging jobs need every Linux job, so the Windows runner starts only when
the tests and the bundle are green. They also run only for pushes, which the
workflow takes for `main` and `v*` tags, so pull requests never wait for the
Windows runner:

<!-- prettier-ignore -->
```yaml docs-test=skip:split-ci-example
  windows-package:
    name: Package for Windows
    needs: [test, web-bundle]
    # Main and tags only. Gitea ignores environment:, so gate signing secrets by ref here as well.
    if: github.event_name == 'push'
    runs-on: ${{ vars.WINDOWS_RUNNER || 'windows-2025' }}
```

To package pull requests too, remove the `if:`. A lint job, a frontend test job
or an optional Windows test job joins the same graph: list each in the
packaging jobs' `needs:`.

## Build the web bundle on Linux

The `web-bundle` job sets up .NET and Node.js, restores the pinned
`dotnet-runic` tool, writes the bundle and uploads it:

<!-- prettier-ignore -->
```yaml docs-test=skip:split-ci-example
      - name: Restore dotnet-runic
        run: dotnet tool restore
      # Builds the application in Release, which generates the TypeScript clients, installs the frontend from its lock
      # file and builds it, then writes each project's page, clients and View fingerprints (rax.web-bundle/1).
      - name: Write the web bundle
        run: dotnet runic bundle --project src/Acme.App --output-directory "$RUNNER_TEMP/web-bundle"
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: web-bundle
          path: ${{ runner.temp }}/web-bundle
          if-no-files-found: error
          retention-days: 7
```

`dotnet runic bundle` runs `dotnet build -c Release` with
`RunicApplicationFrontendBundleDirectory`, so every project that declares
Views, the application's references included, writes its entry. It then checks
the bundle and prints one line per project: its kind, its Views, and the files,
size and SHA-256 of its page:

```text docs-test=skip:sdk-guide-excerpt
Web bundle (rax.web-bundle/1): /home/runner/work/_temp/web-bundle
  Acme.App (application): 1 View(s), 2 files, 49.9 KiB, SHA-256 38aa10cc89e9; host desktop, NODE_ENV production
```

A client library's line says `no page`.

`--format json` prints the same as `runic.application.tool.bundle/1`, and
`--property` (`-p:NAME=VALUE`) passes MSBuild properties to the build. Without
the tool, the property does the same in any build:

```sh docs-test=skip:sdk-guide-excerpt
dotnet build -c Release -p:RunicApplicationFrontendBundleDirectory=$RUNNER_TEMP/web-bundle
```

The bundle has a folder per project and a manifest, `web-bundle.json` (format
`rax.web-bundle/1`):

```text docs-test=skip:diagram
web-bundle/
  web-bundle.json         the manifest
  projects/
    Acme.App/
      www/                the frontend build's output
      clients/            the generated TypeScript clients
    Acme.Shared/          a client library: clients/ only, no page
```

For each project the manifest records its View fingerprints from the contract
IR, its host (`RUNIC_APPLICATION_HOST`), its `NODE_ENV`, its lock file's hash,
the `@runic-artifex/views` version it resolved, the hash of its page's files,
the .NET SDK and Node.js versions, and the commit. A WPF application's model
project and the application write their entries side by side. The format is in
[specs/application/web-bundle.md](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/specs/application/web-bundle.md).

Bundle the application project, not a solution that includes the test project:
the tests build the application with `RunicApplicationFrontendBuildEnabled=false`,
and a project that doesn't build its page can't write it (`RUNICBRIDGE092`). The
output folder must be new, empty, or an earlier bundle (`RAPPBUNDLE1001`).
Keep the artifact only as long as the packaging jobs may need it; the example
keeps it 7 days.

## Test on Linux

The `test` job runs `dotnet test` and starts at once, beside `web-bundle`. The
template's `--tests` project opens the Window headless with
`RunicWindowTestHost` and runs its commands through the generated Bridge, as
the page does (see [The .NET side](frontend-testing.md#the-net-side)), so it
needs no window, browser or Windows runner:

<!-- prettier-ignore -->
```yaml docs-test=skip:split-ci-example
      # The headless Window tests drive the ViewModels and generated Bridges without a window, so they need no
      # Windows runner. Keep tests of WPF or WebView2 code for an optional Windows job.
      - name: Run the tests
        run: dotnet test --project tests/Acme.App.Tests/Acme.App.Tests.csproj -c Release
```

A frontend test job ([Testing frontends](frontend-testing.md)) can download
the bundle instead of building .NET: it copies `projects/Acme.App/clients/`
into `Frontend/src/generated`, then runs `npm ci` and the tests.

Keep tests that touch WPF or WebView2 for a Windows job. For a WPF
application, keep the ViewModels and their tests in `net10.0` projects so they
run on Linux.

## Publish on Windows from the bundle

The `windows-package` job downloads the artifact and packages from it. It sets
up .NET only:

<!-- prettier-ignore -->
```yaml docs-test=skip:split-ci-example
      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
        with:
          name: web-bundle
          path: web-bundle
      - name: Restore dotnet-runic
        run: dotnet tool restore
      # NativeAOT and makeappx, with the page from the bundle: no frontend install, no Vite and no client emission, so
      # the job sets up neither Node.js nor Bun. The build first checks every View's fingerprint against the bundle
      # (RUNICBRIDGE094). Add --certificate and RUNIC_SIGNING_PASSWORD to sign.
      - name: Package the MSIX from the web bundle
        run: dotnet runic package windows --project src/Acme.App --frontend-bundle web-bundle --output-directory artifacts/msix
```

`--frontend-bundle` publishes with `RunicApplicationFrontendPrebuiltDirectory`.
Every project that declares Views finds its entry by assembly name and uses its
`www/` as its frontend output; `RunicApplicationFrontendDelivery=Embedded`
packs it into the assembly as usual. The build runs no frontend install, no
frontend build and no client emission. `dotnet runic package` also passes
`-p:NAME=VALUE` to the publish, so the job can set `Version` or
`ApplicationId` from the tag:

```sh docs-test=skip:sdk-guide-excerpt
dotnet runic package windows --frontend-bundle web-bundle -p:Version=1.4.0
```

`dotnet publish` takes the property directly:

```sh docs-test=skip:sdk-guide-excerpt
dotnet publish App -c Release -r win-x64 -p:RunicApplicationFrontendPrebuiltDirectory=web-bundle
```

Before the build uses a page, it checks the bundle against the contract IR
that the .NET generator has just written:

- The bundle must have an entry for the project whose files hash as recorded,
  so a truncated download does not publish (`RAPPPKG1008` from
  `dotnet runic package`, `RUNICBRIDGE093` from the build).
- Every View must have the same fingerprint in the bundle as in this build,
  and both must have the same Views (`RUNICBRIDGE094`).
- The page must have been built for this build's host (`RUNICBRIDGE095`).
- An optimized build warns when the page was not built with
  `NODE_ENV=production` (`RUNICBRIDGE096`).

A ViewModel that changed after the bundle was written stops the publish, with
the View and both fingerprints:

```text docs-test=skip:sdk-guide-excerpt
src/Acme.App/Acme.App.csproj : error RUNICBRIDGE094: The prebuilt frontend in web-bundle/ was built from other
ViewModels: Acme.App.CounterViewModel is B841442095549CE212F0198A1D4F9DF04546F1CBC4BA4C7B8EEC24208B170412 in this
build and C4212F571CFBD3580C1F987E71902FAE577D37C7DDBA2E243B381BD6FA230679 in the bundle. Build the bundle from the
same commit, or set RunicApplicationFrontendPrebuiltCheck=warning to publish anyway.
```

`RunicApplicationFrontendPrebuiltCheck=warning` turns `RUNICBRIDGE094` and
`RUNICBRIDGE095` into warnings; no value skips the check. Write the bundle from
the same commit, configuration and Runic release as the package.
`dotnet runic doctor --bundle web-bundle` checks a downloaded bundle offline,
without Node.js: its format, its files and hashes, and an entry for the
project.

The package is a NativeAOT MSIX, unsigned unless the job passes
`--certificate app.pfx` with the password in `RUNIC_SIGNING_PASSWORD`. See
[Ship a Desktop application](../../desktop/shipping.md#msix) for the MSIX and
[Sign with Authenticode](../../desktop/shipping.md#sign-with-authenticode) for
signing. The example's `linux-package` job packages the same bundle as a Debian
package with `dotnet runic package deb`.

## No Windows runner?

Without NativeAOT, a Linux runner can publish for Windows from the same bundle:

```sh docs-test=skip:split-ci-example
dotnet publish src/Acme.App -c Release -r win-x64 --self-contained false \
  -p:RunicApplicationFrontendPrebuiltDirectory="$PWD/web-bundle" -o out-win
```

The result is a GUI executable, `Acme.App.exe`, with `www/` from the bundle;
`--self-contained true` bundles the .NET runtime as well. NativeAOT, the MSIX and
signing with `signtool` still need Windows. The example's `ci/local-run.sh`
runs both halves this way on one Linux machine.

## WPF projects on Linux

A project of a Windows target framework, such as a WPF application or model
project on `net10.0-windows`, restores and builds on Linux only with
`EnableWindowsTargeting=true`. Without it the restore stops with
`NETSDK1100`. The property must be set before the restore imports any
package's build files, so a Runic package can't set it; put it in the
application's own `Directory.Build.props`:

```xml docs-test=skip:split-ci-example
<EnableWindowsTargeting Condition="'$(EnableWindowsTargeting)' == '' and !$([MSBuild]::IsOSPlatform('Windows'))">true</EnableWindowsTargeting>
```

`dotnet runic doctor` on Linux or macOS reports a Windows target framework
without it as its `windows-targeting` check. With the property, the Linux jobs
build the application, test its `net10.0` ViewModels and write the bundle,
with the model project's entry beside the application's
([Host Runic Views in a WPF app](../migrations/wpf-hybrid.md#split-a-wpf-free-model-project)).
The application runs only on Windows: WPF and WebView2 tests, the NativeAOT
publish, MSIX packaging and signing need the Windows runner.

## GitHub, Gitea and Forgejo

One workflow file serves GitHub Actions and Gitea Actions. Forgejo needs a
second file, because the stock artifact actions don't run there:

|                  | GitHub Actions                                         | Gitea Actions                                                                                                                  | Forgejo Actions                                                                                                                  |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Workflow file    | `.github/workflows/ci.yml`                             | `.github/workflows/ci.yml` (Gitea reads `.gitea/workflows` first, then `.github/workflows`)                                    | `.forgejo/workflows/ci.yml`; Forgejo ignores `.github/workflows` while this folder exists                                        |
| Artifact actions | `actions/upload-artifact`, `actions/download-artifact` | The same, with Gitea Runner 3.0 or later and Gitea 1.26.2 or later                                                             | `forgejo/upload-artifact@v4`, `forgejo/download-artifact@v4`: the stock v4 and later fail with `not currently supported on GHES` |
| Runner labels    | Hosted `ubuntu-24.04`, `windows-2025`                  | The labels your runners registered; the official runner has Windows builds (host mode)                                         | The labels your runners registered (`docker` by default); Windows runners are community builds                                   |
| Signing secrets  | `environment:` protection                              | `environment:` is ignored: keep the `if:` that limits packaging to `main` and tags, and use repository or organization secrets | As on Gitea                                                                                                                      |

The Forgejo file differs from the GitHub one only in the artifact steps and
the default labels:

<!-- prettier-ignore -->
```yaml docs-test=skip:split-ci-example
      - uses: forgejo/upload-artifact@16871d9e8cfcf27ff31822cac382bbb5450f1e1e # v4
        with:
          name: web-bundle
          path: ${{ runner.temp }}/web-bundle
...
    runs-on: ${{ vars.WINDOWS_RUNNER || 'windows' }}
...
      - uses: forgejo/download-artifact@d8d0a99033603453ad2255e58720b460a0555e1e # v4
        with:
          name: web-bundle
          path: web-bundle
```

Set the repository or organization variables `LINUX_RUNNER` and
`WINDOWS_RUNNER` to your runners' labels; without them the workflows use the
defaults in the table. Forgejo resolves `uses:` from its `DEFAULT_ACTIONS_URL`,
`https://data.forgejo.org` by default, which mirrors `actions/*` and
`forgejo/*` at the same commits; an instance with another value needs the same
mirrors. The example's `ci/check-workflows.mjs` keeps the two files in step
and checks that every action is pinned to a commit SHA.

## Caching

- Cache the NuGet packages folder per OS, keyed on the project files, or on
  `packages.lock.json` once you commit lock files
  (`RestorePackagesWithLockFile`, as the `runic-app` template sets, with
  `dotnet restore --locked-mode`). The runtime packs differ per OS.
- Cache the package manager's download cache, keyed on the frontend's lock
  file.
- Never cache or upload `node_modules` across operating systems: its Rolldown
  and Lightning CSS binaries are per OS. The bundle carries the built page
  instead.
- With several Gitea runners, configure one shared cache server for
  `actions/cache`; otherwise each runner keeps its own cache and most jobs
  miss.

The bundle has no cache key of its own yet, so the `web-bundle` job builds
the frontend on every run.

## Troubleshooting

| Message                                         | Meaning                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUNICBRIDGE092`                                | A project whose frontend build is off can't write its page to a bundle: bundle the application project, not a solution with the test project, and not during `dotnet runic dev` |
| `RAPPPKG1008`, `RUNICBRIDGE093`                 | The bundle is missing, has no entry for the project, or its files don't match the manifest, as after a truncated download                                                       |
| `RAPPPKG1008` (exit code 2)                     | A `-p:` value of `package` sets `Configuration`, `RuntimeIdentifier`, `PublishAot` or the prebuilt directory: use the command's own options                                     |
| `RUNICBRIDGE094`                                | A View changed after the bundle was written: write the bundle from the commit you package                                                                                       |
| `RUNICBRIDGE095`                                | The page was built for another host                                                                                                                                             |
| `RUNICBRIDGE096` (warning)                      | An optimized publish takes a page not built with `NODE_ENV=production`                                                                                                          |
| `RAPPBUNDLE1001`                                | The output folder of `dotnet runic bundle` has other files                                                                                                                      |
| `RAPPBUNDLE1002`                                | The build that writes the bundle failed; the output above names the error                                                                                                       |
| `RAPPBUNDLE1003`                                | The build passed, but the bundle is missing or doesn't check, as `dotnet runic doctor --bundle` checks it                                                                       |
| `RAPPBUNDLE1004`                                | A `-p:` value of `bundle` isn't `NAME=VALUE`, or sets `Configuration` or one of the two bundle directories                                                                      |
| `NETSDK1100`                                    | A Windows target framework on Linux without `EnableWindowsTargeting`                                                                                                            |
| `Cross-OS native compilation is not supported.` | NativeAOT for another OS: package on that OS                                                                                                                                    |
| `not currently supported on GHES`               | The stock artifact actions on Forgejo: use `.forgejo/workflows/ci.yml`                                                                                                          |

The SDK's
[diagnostics reference](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/docs/diagnostics.md)
describes each code.

## Before 0.24

Runic 0.23 can already publish a page built elsewhere, with nothing to check
it against. Upload the frontend's `dist` folder from the Linux job and, on
Windows:

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r win-x64 -p:RunicApplicationFrontendBuildEnabled=false -p:RunicApplicationFrontendOutputDirectory=<downloaded dist>
```

The properties also work as environment variables, so
`dotnet runic package windows` takes them the same way. A page built from
older ViewModels then publishes silently and fails only at run time, one
`RunicApplicationFrontendOutputDirectory` serves every project, and the 0.24
SDK needs Node.js or Bun for client emission even then. Use the bundle once
you are on 0.24.

## Further reading

- [The split CI example](https://github.com/Runic-Artifex/runic-sdk/tree/v0.24.0/examples/split-ci)
  and its
  [README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/examples/split-ci/README.md).
- [Building the frontend in another job](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/packages/dotnet/Runic.Application.Views/README.md#building-the-frontend-in-another-job)
  in the `Runic.Application.Views` README: the build properties.
- [Write a web bundle](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/tools/dotnet-runic/README.md#write-a-web-bundle)
  and
  [Package the application](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/tools/dotnet-runic/README.md#package-the-application)
  in the `dotnet-runic` README.
- [Building a Windows application on Linux or macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.24.0/docs/packaging.md#building-a-windows-application-on-linux-or-macos)
  in the SDK's packaging guide.
- [Ship a Desktop application](../../desktop/shipping.md) for every package
  format.
