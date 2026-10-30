# Package a Runic application with Nix

Since SDK `0.8.0-preview.1`, the Runic SDK's flake exports a builder for Runic
applications, a development shell, and NixOS and Home Manager modules that
install them. This guide follows `0.12.0` and summarizes the SDK's
[Nix packaging guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/nix/README.md),
which has every argument and option.

`buildRunicApplication` wraps nixpkgs' `buildDotnetModule`. It restores NuGet
packages and the frontend's packages from lock files, builds in the Nix sandbox
without network access, and installs the desktop entry, icons and Polkit policy.
It is verified on `x86_64-linux`, under JIT and NativeAOT. For working on the
SDK itself, see [NixOS development](nixos-development.md); for other platforms
and Linux formats, see [Ship a Desktop application](shipping.md).

## Start from the template

`dotnet new runic-app --nix` (or `--nix` with `dnx Runic.Create`) adds a
`flake.nix` that uses the builder. It turns on `RestorePackagesWithLockFile`
for `linux-x64` and keeps a separate `packages.aot.lock.json` for NativeAOT.
Write both lock files, commit them, and add the project to Git before the first
build, because a flake sees only the files Git tracks:

```sh docs-test=readme:tools/Runic.Application.Templates/content/runic-app/README.md
dotnet restore
dotnet restore -p:PublishAot=true
# ...
git init && git add -A
nix build                # or nix build .#native-aot
result/bin/RunicWindowApp
```

With `--tests`, also run `dotnet restore RunicWindowApp.Tests`.

Since SDK `0.12.0`, a NixOS machine without a .NET SDK can create the project
with the flake's `create` app. It runs `Runic.Create` of the tag's version with
the .NET 10 SDK, Node, pnpm and Bun from nixpkgs; its arguments follow `--`, as
they do for `dnx Runic.Create`:

```sh docs-test=skip:release-tag-pin
nix run github:Runic-Artifex/runic-sdk/v0.14.0#create -- MyApp --frontend react --nix
cd MyApp
git init && git add -A
nix develop              # the .NET SDK, Node and the package manager, from the new flake
```

The app downloads `Runic.Create` and the template from nuget.org, so it needs
the network, and installs the template into `~/.templateengine`, as
`dotnet new install` does. Without `--yes` it asks its questions as
`dnx Runic.Create` does.

After changing a package reference, restore both again, or the build fails
with `NU1004`. With pnpm or Bun, the frontend's packages are one fixed-output
download whose hash in `flake.nix` starts as `lib.fakeHash`: the first
`nix build` fails and reports the real hash. Replace it, and update it whenever
the lock file changes.

The package installs the desktop entry `share/applications/<ID>.desktop`, named
after `ApplicationId` in the project file, with the icons from `icons/`
under the same name. `flake.nix` repeats the ID; change it there too when you
change `ApplicationId`. Since SDK `0.12.0`, the entry's `Exec=` passes the
files and URLs the desktop opens (`%U`); see
[file types and URL schemes](#file-types-and-url-schemes).

## A flake for an existing application

Every function of `runic-sdk.lib` takes the consumer's nixpkgs first. Pin the
SDK input to the release your packages use:

```nix docs-test=skip:release-tag-pin
inputs = {
  nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  runic-sdk = {
    url = "github:Runic-Artifex/runic-sdk/v0.14.0";
    inputs.nixpkgs.follows = "nixpkgs";
  };
};
...
packages.x86_64-linux.default = runic-sdk.lib.buildRunicApplication pkgs {
  pname = "my-app";
  version = "1.0.0";
  src = ./.;
  projectFile = "MyApp/MyApp.csproj";
  nugetLockFiles = [ ./MyApp/packages.lock.json ];
  frontend = {
    directory = "MyApp/Frontend";
    packageManager = "npm";
  };
  nativeAot = true;
  executables = [ "MyApp" ];
```

The SDK guide's full example also installs a desktop entry and an icon.
`overlays.default` adds `pkgs.buildRunicApplication` for package files that
`callPackage` loads. Arguments of `buildDotnetModule` pass through; the Runic
ones choose the host's run-time libraries (`host`: `desktop`, `desktop-gtk4`
or `cswebui`), NativeAOT, desktop items and icons.

Tests that reject VSTest options, such as TUnit's, run with `testRunner`:

```nix docs-test=readme:nix/README.md
testProjectFile = "MyApp.Tests/MyApp.Tests.csproj";
nugetLockFiles = [ ./MyApp/packages.lock.json ./MyApp.Tests/packages.lock.json ];
doCheck = true;
testRunner = "Microsoft.Testing.Platform";
```

`completions` installs the bash, zsh and fish scripts a command-line program
prints:

```nix docs-test=readme:nix/README.md
meta.mainProgram = "my-app";
completions = { };                                # my-app completion bash, zsh, fish
completions.command = [ "--completions" ];        # my-app --completions bash, ...
```

## File types and URL schemes

Since SDK `0.12.0`, the build reads `ApplicationId`, `ApplicationTitle`,
`RunicApplicationFileTypes` and `RunicApplicationUrlSchemes` from the project
and installs them as `dotnet runic package` does in a deb or rpm, so no
builder argument repeats them:

```xml docs-test=readme:nix/README.md
<ApplicationId>org.example.Notes</ApplicationId>
<RunicApplicationFileTypes>.notes=application/x-example-notes</RunicApplicationFileTypes>
<RunicApplicationUrlSchemes>org.example.notes</RunicApplicationUrlSchemes>
```

The file types' shared-mime-info definitions go to
`$out/share/mime/packages/<ApplicationId>.xml`. The desktop entry named after
`ApplicationId` (or, without one, every entry the package installs) gets their
MIME types and `x-scheme-handler/<scheme>` in `MimeType=`, and `%U` in `Exec=`
when it has no field code. NixOS and Home Manager build the MIME database of
the profile the package is installed in, so a file manager offers the
application for its file types. A file type or scheme that the package command
rejects (`RAPPPKG1001`) fails the build. A project with neither builds as
before.

A definition by extension cannot say that a type is a ZIP file
(`sub-class-of`) or how to recognise its content (`magic`). Since SDK
`0.14.0`, a package that installs its own definition in `postInstall`, at the
same path, keeps it; the build only adds its types to the desktop entry, and
fails, naming the type, when the definition lacks a type of
`RunicApplicationFileTypes`. Before, the build replaced it, so an application
that installed its definition in `postFixup` to come after the builder moves
it to `postInstall`:

```nix docs-test=readme:nix/README.md
postInstall = ''
  install -Dm644 ${./packaging/linux/org.example.Notes.xml} \
    $out/share/mime/packages/org.example.Notes.xml
'';
```

## NuGet and frontend packages

`nugetLockFiles` reads the committed `packages.lock.json` files at evaluation
time, and each locked package is a fixed-output download from nuget.org. The
build restores in locked mode for `linux-x64`, so each lock file needs that
runtime's section. A NativeAOT restore adds the compiler packages, so keep a
second lock file for it, as the template does:

```xml docs-test=readme:nix/README.md
<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
<RuntimeIdentifiers>linux-x64</RuntimeIdentifiers>
<NuGetLockFilePath Condition="'$(PublishAot)' == 'true'">packages.aot.lock.json</NuGetLockFilePath>
```

Packages from another feed, or a project without lock files, use nixpkgs'
`deps.json` through `nugetDeps`.

`dotnetTools` restores local .NET tools offline, each by the hash of its
package, for build steps that run one:

```nix docs-test=readme:nix/README.md
dotnetTools = {
  manifest = "MyApp/.config/dotnet-tools.json";
  hashes.dotnet-runic-translations = "sha256-/sG0ngRIx6fh0LLQzBNvpCk6N1kYB1NYhhKpI6NjDPY=";
};
```

The frontend's packages are installed in a separate derivation from its
`package.json` and lock file only: npm through `importNpmLock` (no hash needed)
or `fetchNpmDeps`, pnpm through `fetchPnpmDeps`, and Bun through
`bun install --frozen-lockfile` in a fixed-output derivation. The build passes
them to the Runic MSBuild targets with
`RunicApplicationFrontendNodeModulesDirectory`, so the frontend builds without
installing.

Since SDK `0.14.0`, every package has `fixedOutputHashes`, a program that
prints the hashes of `frontend.hash`, for each system it names, and of
`dotnetTools.hashes` in one run, ready to paste, instead of one failed build
per out-of-date hash:

```console docs-test=readme:nix/README.md
$ nix run .#default.fixedOutputHashes
```

When `src` is a path or a filtered path, the frontend's download is now named
after a digest of its lock files, so a lock file that changes under the
previous hash is downloaded again and `nix build` reports its new hash; the
first build after the update downloads the frontend's packages once more. Under
any other `src`, a stale Bun hash still fails with `frontend.hash is out of
date`. In `0.8.0-preview.4` every Bun hash changed once: set it to
`lib.fakeHash` and copy the reported hash. See
[fixed-output hashes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/nix/README.md#fixed-output-hashes). `hash` can also take one per system:

```nix docs-test=readme:nix/README.md
frontend = {
  packageManager = "bun";
  hash = {
    x86_64-linux = "sha256-...";
    aarch64-linux = lib.fakeHash;
  };
};
```

## Run time and privileged actions

GTK, WebKitGTK and GLib are loaded with `dlopen`, so they are run-time
dependencies, never bundled. The program in `bin` is a binary wrapper that sets
their library paths, schemas and GIO modules. Run the application through it:
the program behind it finds no WebKitGTK, and Runic Desktop then reports
`webkitgtk-runtime-missing` and opens a browser instead. The wrapper also sets
`RUNIC_APPLICATION_EXECUTABLE`, so login startup writes the wrapper into the
autostart entry.

Since SDK `0.12.1`, the wrapper of a self-contained or NativeAOT application
also puts OpenSSL on the library path. Built with nixpkgs' binary .NET SDK,
such as `dotnetCorePackages.sdk_10_0-bin`, such an application aborted at
start with "No usable version of libssl was found"; with nixpkgs' source-built
SDK nothing changes.

`withSpeechSynthesis = false` loads a WebKitGTK without the Web Speech API's
speech synthesis, 72.6 MiB smaller; screen readers still work, but it
compiles from source for hours, so build it on your own cache.

The policy of the application's
[privileged actions](https://github.com/Runic-Artifex/runic-sdk/blob/v0.14.0/packages/dotnet/Runic.Platform.Linux.Polkit/README.md)
is installed in `$out/share/polkit-1/actions`. The build exports
`RunicApplicationInstallPrefix` as `$out`, so an action can name the installed
program, and fails when a policy names a program outside the package:

```xml docs-test=readme:nix/README.md
<RunicPrivilegedAction Include="org.example.app.activate"
                       Program="$(RunicApplicationInstallPrefix)/bin/MyApp"
                       Verb="activate" ... />
```

### Spell checking

Since SDK `0.13.0`, GTK windows check spelling with the hunspell dictionaries
that enchant finds. `spellingDictionaries` adds the share directories of the
given packages to the wrapper's `XDG_DATA_DIRS`, ahead of the user's:

```nix docs-test=readme:nix/README.md
runic-sdk.lib.buildRunicApplication pkgs {
  # ...
  host = "desktop-gtk4";
  spellingDictionaries = with pkgs.hunspellDicts; [ de_CH en_US ];
};
```

Ship the dictionaries of the languages the application sets with
`DesktopHostOptions.SpellCheckingLanguages`; a user's own, such as those of
`environment.systemPackages` on NixOS, are found too. A language without a
dictionary is reported as `spell-checking-dictionary-missing` and not checked.
Only the `desktop` and `desktop-gtk4` hosts accept the argument; see
[spell checking](../desktop-services.md#spell-checking).

## NixOS and Home Manager modules

`nixosModules.runic-applications` and `homeManagerModules.runic-applications`
install applications as `programs.runic.applications.<name>`, with an optional
systemd user service that starts the application with the graphical session,
for example for an application with a status icon:

```nix docs-test=readme:nix/README.md
{
  imports = [ runic-sdk.nixosModules.runic-applications ];
  programs.runic.applications.my-app = {
    package = my-app.packages.x86_64-linux.default;
    userService = {
      enable = true;
      arguments = [ "--tray" ];
    };
  };
}
```

The NixOS module also registers the Polkit policy and enables pkexec. polkitd
reads only the system's policies, so an application with privileged actions
needs the package in the system profile, also with Home Manager. A launch from
the desktop entry reaches the running instance when the application claims a
single instance.

## Development shell

`lib.mkDevShell` gives a shell with the .NET SDK, Node, the package managers,
Clang and zlib for NativeAOT, and the run-time environment of the chosen hosts:

```nix docs-test=readme:nix/README.md
devShells.x86_64-linux.default = runic-sdk.lib.mkDevShell pkgs {
  hosts = [ "desktop" ];
  packageManagers = [ "bun" ];
};
```

With the `cswebui` host the shell adds Chromium and sets
`CSWEBUI_BROWSER_PATH`, so CS-WebUI windows open in that Chromium and fall back
to no other browser. WebUI itself never read `WEBUI_BROWSER_PATH`. Run headless
CS-WebUI in a shell without the Desktop libraries.

**Checked with**: SDK CI's `nix flake check` builds the status-icon example
under JIT and NativeAOT and the privileged-actions smoke with its policy. A
NixOS VM test installs them through the NixOS module and checks the desktop
entry, the user service, `pkaction` and pkexec. The template's `--nix` projects
are built for npm, pnpm, Bun and NativeAOT against a published release. Since
SDK `0.12.0`, a flake check also compares a project's installed MIME
definitions and `MimeType=` with the package command's expected output, and
another builds the `create` app's wrapper.
