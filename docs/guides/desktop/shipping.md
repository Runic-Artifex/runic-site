# Ship a Desktop application

This guide takes a Runic Desktop application (`--host desktop` or
`--host desktop-gtk4`) from `dotnet publish` to something you can hand to
users on Windows, macOS and Linux. Since SDK `0.8.0-preview.5`,
`dotnet new runic-app --packaging` (or `--packaging` with `dnx Runic.Create`)
adds packaging recipes to the project: `packaging/package.mjs` publishes the
application with NativeAOT and builds an MSIX package on Windows, a signed
`.app` in a disk image on macOS, or a Flatpak on Linux, with the platform's own
tools. There is no `dotnet runic package` command. The guide says which steps
Runic CI exercises, which ones need signing credentials or accounts that CI
does not have, and where the SDK does not help yet.

Each platform section ends with a **Checked with** note. "Runic CI" means the
SDK's
[CI workflow](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/.github/workflows/ci.yml):
its `Native` jobs run test applications that use Runic Desktop, and its
`Packaging` jobs package the
[packaging probe](https://github.com/Runic-Artifex/runic-sdk/tree/v0.8.0-preview.5/tests/native/Runic.Packaging.Probe),
a test application with the template's identity, with the template's
`package.mjs` on each platform, install the package without the maintainers'
signing credentials and open it through its URL scheme. The probe opens no
window: it records what the installed package gives it, and
[`packaging-probe-check.mjs`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/eng/ci/packaging-probe-check.mjs)
checks that record. CI does not package the template application itself or
retain the packages. "Not executed" means the step uses the platform vendor's
documented tools and has not been run for Runic.

## Before you package

### Declare the application's identity

The template's project file declares the application's identity once, and
`ApplicationIdentity` in `ApplicationIdentity.cs` reads it from the assembly
in code. `--packaging` adds the properties that only the packages read:

```xml docs-test=template:RunicWindowApp.csproj packaging=true
<RunicApplicationId>com.example.MyApp</RunicApplicationId>
<RunicApplicationName>MyApp</RunicApplicationName>
<Version>1.0.0</Version>
<!-- packaging/package.mjs reads these too. The summary software centers and the Start menu show. -->
<Description>A Runic desktop application</Description>
<PackageProjectUrl>https://example.com</PackageProjectUrl>
<!-- The MSIX package's publisher: the subject of the certificate that signs it. -->
<RunicApplicationPublisher>CN=Example</RunicApplicationPublisher>
<!-- URL schemes the application opens, separated by semicolons, such as the redirect of an OAuth sign-in. The
     packages register them; see "Package it" in the README. -->
<RunicApplicationUrlSchemes></RunicApplicationUrlSchemes>
<!-- The Explorer and taskbar icon; icons/ holds the same placeholder as SVG and PNG. -->
<ApplicationIcon>icons/icon.ico</ApplicationIcon>
```

`RunicApplicationId` is the desktop entry, icon and Flatpak ID on Linux, the
bundle identifier on macOS, and the package name and AppUserModelID on Windows.
It defaults to `com.example.` and the project name's ASCII letters and digits;
choose it before you ship, because changing it later makes the platforms see a
different application. Set it with `--application-id org.example.Notes` or in
the project file: a reverse-DNS name for a domain you control, of ASCII letters,
digits and dots, each part starting with a letter, at most 50 characters
(`package.mjs` rejects other IDs). `PackageProjectUrl` becomes the AppStream
homepage, and `Version` the package version: MSIX and `Info.plist` take its
numeric part (`1.2.3-preview.4` becomes `1.2.3.0` and `1.2.3`).

`icons/` holds a neutral placeholder icon as `icon.svg`, `icon.png` (512 px)
and `icon.ico`. Replace it as the generated README's
[Identity and icons](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/tools/Runic.Application.Templates/content/runic-app/README.md#identity-and-icons)
section describes; the packages take their icons from these files.

### Choose the publish mode

The template's `dotnet publish -c Release -r <rid>` produces a
framework-dependent build: target machines then need the .NET runtime and the
ASP.NET Core runtime, because Runic Desktop serves the page from a loopback
Kestrel listener. For a distributable application, publish either
self-contained or with NativeAOT:

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r win-x64 -p:PublishAot=true
dotnet publish -c Release -r osx-arm64 --self-contained true
```

NativeAOT gives one native executable per runtime identifier (RID); it is what
`package.mjs` publishes and what Runic CI publishes on every platform. It
cannot cross operating systems, so publish and package on Windows for `win-*`,
on macOS for `osx-*` and on Linux for `linux-*`; a CI matrix with one runner
per OS is the usual setup. Since SDK `0.8.0-preview.2`, a CI job that builds
first can publish NativeAOT with
`dotnet publish --no-build -p:PublishAot=true` after a `dotnet build` with the
same configuration, target framework and `PublishAot`: the publish reuses the
Bridge code of that build and reports
[`RUNICBRIDGE022`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/docs/diagnostics.md#runicbridge022)
when it is missing. Before publishing, ask
the CLI what the target needs on the machine that publishes:

```bash docs-test=readme:tools/dotnet-runic/README.md
dotnet runic doctor --rid linux-x64 --fail-on fail
dotnet runic doctor --rid win-x64 --aot --fail-on fail
```

The `target-rid` check reads the
[support matrix](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/eng/support.json):
for Runic Desktop every supported RID (`win-x64`, `win-arm64`, `osx-arm64`,
`linux-x64`, `linux-arm64` and the musl RIDs) is CI-verified except
`osx-x64`, which ships native support without CI coverage. Test it on a real
machine. `target-presentation`
names the WebView runtime each target needs. For size options such as
`RunicDesktopMinimalHost` and how to measure the result, see
[size reporting and tuning](size-and-tuning.md).

### Know what the publish folder contains

The template opens its Window with `RunicWindowOptions`, which serve the
frontend from a `www` folder next to the executable unless you set another
content root:

```csharp docs-test=template:Program.cs host=desktop
await using var window = await host.OpenWindowAsync<WorkspaceWindow>(new RunicWindowOptions { Width = 1000, Height = 700 });
```

Ship the executable and `www` together, or embed the frontend in the
executable with [Runic Assets](../assets/README.md) and serve it with
`Runic.Assets.Desktop`, so the package holds a single file. NativeAOT also
writes debug symbols (`.pdb` on Windows, `.dbg` on Linux, `.dSYM` on macOS).
`package.mjs` leaves them out of the package; keep them per release for
[crash analysis](crash-reporting.md).

The window icon at run time comes from `DesktopWindowOptions.IconFile`, which
an application sets through the `WindowOptions` of its `RunicDesktopHost`:
WebView2 loads an `.ico` file, and the GTK 3 host and macOS load the image
file you pass. GTK 4 windows reject `IconFile`; their icon comes from the
installed desktop entry (see [Linux](#linux)). The icon that a file manager,
Dock or launcher shows comes from the package metadata described below.

### Run the packaging recipes

`package.mjs` reads `RunicApplicationId`, `RunicApplicationName`, `Version`,
`Description`, `PackageProjectUrl`, `RunicApplicationPublisher` and
`RunicApplicationUrlSchemes` from the project file, publishes with NativeAOT,
fills the `{{...}}` fields of the manifests in `packaging/` and writes the
package to `artifacts/package/<target>/`. Run it with Node 22 or later (or
Bun) from the project directory, on the platform you package for:

```sh docs-test=template:README.md packaging=true
node packaging/package.mjs windows   # MSIX, on Windows with the Windows SDK
node packaging/package.mjs macos     # .app in a disk image, on macOS with Xcode's command line tools
node packaging/package.mjs flatpak   # Flatpak, on Linux with flatpak and flatpak-builder
```

Without signing options, the MSIX and the Flatpak are unsigned and the `.app`
is signed ad hoc: enough to install and test the package on your own machine.
The platform sections below list what each platform needs to ship it. The
manifests are yours to edit; `package.mjs` fails when a manifest uses a field
it does not fill. `--project`, `--output` and `--rid` override the project
file, the output folder and the RID (by default `osx-arm64` on macOS, and
the machine's x64 or arm64 RID on Windows and Linux).

## Windows

### Publish

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r win-x64 -p:PublishAot=true
```

Since SDK `0.7.0-preview.7`, the template's Windows builds are GUI
applications (`OutputType` `WinExe`), so no console window opens when a user
starts the application from Explorer. Desktop diagnostics, such as a missing
WebView runtime, still go to standard error, which a terminal or a redirect
(`MyApp.exe 2> errors.txt`) shows. Since `0.8.0-preview.5` the template's
`DiagnosticsLog` also writes them to `%LOCALAPPDATA%\<application ID>\diagnostics.log`;
the log starts empty at each start and keeps at most 256 KiB of diagnostics,
without arguments or data.

With NativeAOT on `win-x64` or `win-arm64`, Runic Desktop's build targets link
the WebView2 loader statically into the executable, so the publish folder
contains no `WebView2Loader.dll`
([`Runic.Desktop.targets`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/packages/dotnet/Runic.Desktop/buildTransitive/Runic.Desktop.targets)).
A JIT build (self-contained or framework-dependent) copies
`WebView2Loader.dll` next to the executable; ship it, or Desktop reports
`webview2-loader-unavailable`. The template sets the Explorer icon of the
executable with `<ApplicationIcon>icons/icon.ico</ApplicationIcon>`.

### WebView2 runtime

Runic Desktop uses the installed **evergreen** Microsoft Edge WebView2
Runtime; Windows 11 includes it. When it is missing, `DesktopHost.Validate`
and `dotnet runic doctor` report `webview2-runtime-missing`, and the
template's `EmbeddedThenBrowser` policy opens an installed browser instead.
Runic Desktop does not accept a fixed-version WebView2 runtime folder, so do
not plan to bundle one. An installer for machines that may lack the runtime
should run Microsoft's evergreen bootstrapper or standalone installer.

By default each WebView2 window gets a fresh temporary profile, so the
application never writes next to its executable and can be installed under
`Program Files` or as an MSIX package. To keep browser storage between runs,
set `DesktopWindowOptions.ProfilePath` to a per-user directory such as one
below `Environment.SpecialFolder.LocalApplicationData`.

### MSIX

`node packaging/package.mjs windows` publishes into
`artifacts/package/windows/msix/`, writes the filled
`packaging/windows/AppxManifest.xml` and the icon there, and packs it with the
Windows SDK's `makeappx pack` into
`<application ID>_<version>_<x64|arm64>.msix`. The manifest declares a
full-trust desktop application; the package name is the application ID, and
`Publisher` comes from `RunicApplicationPublisher` (or `--publisher`):

```xml docs-test=template:packaging/windows/AppxManifest.xml
<Identity Name="{{ApplicationId}}" Publisher="{{Publisher}}" Version="{{PackageVersion}}" ProcessorArchitecture="{{Architecture}}" />
<!-- ... -->
<Application Id="App" Executable="{{Executable}}.exe" EntryPoint="Windows.FullTrustApplication">
<!-- ... -->
<rescap:Capability Name="runFullTrust" />
```

Each scheme in `RunicApplicationUrlSchemes` becomes a `windows.protocol`
extension (see [Opened URLs and files](#opened-urls-and-files)). Windows
installs only signed packages, and `Publisher` must equal the subject of the
signing certificate. `package.mjs` signs the package with `signtool` when you
pass a certificate:

```powershell docs-test=skip:needs-signing-credentials
$env:RUNIC_SIGNING_PASSWORD = '<password>'
node packaging/package.mjs windows --certificate app.pfx --timestamp-url <timestamp-url>
node packaging/package.mjs windows --thumbprint <sha1> --timestamp-url <timestamp-url>
```

`--certificate` signs with a PFX file (its password in
`RUNIC_SIGNING_PASSWORD`), `--thumbprint` with a certificate from the
certificate store. Code-signing certificates issued today keep their private
key on a hardware token or a cloud signing service; such a service signs the
unsigned package with its own `signtool` options. The Microsoft Store signs
packages itself. To try a package without a code-signing certificate, sign it
with a self-signed certificate whose subject is the publisher and trust that
certificate on the test machine only, as Runic CI does.

### Identity in a package, and without one

In an MSIX package, Windows registers the AppUserModelID
`<package family name>!App`. Since `0.8.0-preview.5`, Runic's notifications
use it there and ignore the ID passed to `AddRunicPlatformServices(...)` or
`CreateNotifications(...)`. Login startup reports
`Unavailable(BackendUnavailable)` in a package, because Windows redirects a
package's writes to the `Run` key; a packaged application declares a
`windows.startupTask` extension (`uap5:StartupTask`) in its manifest instead,
which the template's manifest does not include and Runic has no API for.

An unpackaged copy (a ZIP or another installer) has no package identity.
Register its AppUserModelID yourself with a Start menu shortcut whose
`System.AppUserModel.ID` property is the application ID, and pass the same ID
to `AddRunicPlatformServices(ApplicationIdentity.Id)` for notifications.

### ZIP and other installers

- **ZIP**: archive the publish folder. Nothing needs registering.
- **Installer**: any installer that copies a folder works (for example WiX or
  Inno Setup). Add the WebView2 bootstrapper as a prerequisite for Windows 10
  machines that may not have the runtime, and a Start menu shortcut with the
  AppUserModelID described above.

The SDK provides no installer project or WebView2 bootstrapper integration.

### Sign with Authenticode

`package.mjs` signs the MSIX, not the executable inside it. For a ZIP or
another installer, sign the executable before packaging it, then sign the
installer itself. With NativeAOT the executable is the only binary you build;
JIT builds also contain your own assemblies, which you can sign the same way
(`WebView2Loader.dll` is already signed by Microsoft).

```powershell docs-test=skip:needs-signing-credentials
signtool sign /fd SHA256 /tr <timestamp-url> /td SHA256 /f <certificate.pfx> /p <password> MyApp.exe
signtool verify /pa /v MyApp.exe
```

Use the `signtool` options your certificate provider documents instead of
`/f` and `/p`.

**Checked with**: Runic CI publishes `Runic.Desktop.WebViewSmoke` on
`windows-latest` with
`dotnet publish -c Release -r win-x64 --self-contained true -p:PublishAot=true`,
asserts that no `WebView2Loader.dll` was published, copies only the `.exe` into
an empty folder and runs it with WebView2. Its `Packaging / windows` job runs
`package.mjs windows` for the probe, signs the MSIX with a self-signed
certificate trusted on the runner only, installs it with `Add-AppxPackage` and
opens its URL scheme. The probe's record shows the AppUserModelID
`org.runic.tests.PackagingProbe_<publisher hash>!App`, notifications that
report `Success` and login startup that reports
`Unavailable(BackendUnavailable)`. The same `WinExe` started outside the
package writes its diagnostic to a redirected standard error and to
`diagnostics.log`. Publicly trusted code signing, the timestamp server,
installers, Start menu shortcuts and the Microsoft Store were not executed.

## macOS

### Publish per architecture or universal

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r osx-arm64 -p:PublishAot=true -o publish/osx-arm64
dotnet publish -c Release -r osx-x64 -p:PublishAot=true -o publish/osx-x64
lipo -create -output MyApp publish/osx-arm64/MyApp publish/osx-x64/MyApp
```

`osx-arm64` is CI-verified; `osx-x64` is packaged but not run by Runic CI.
Ship one bundle per architecture, or combine the two NativeAOT executables
into a universal binary with `lipo` (the `www` folders are identical):
`node packaging/package.mjs macos --rid osx-arm64,osx-x64` publishes both and
runs `lipo`. Desktop supports macOS 15 and later, the oldest version .NET 10
supports; WKWebView is part of macOS.

Runic Desktop runs the AppKit event loop and makes the process a regular
application, so an unbundled executable already gets a Dock icon and window.
A bundle gives it an identity (bundle ID, name, version, icon), which signing,
notarization, permissions, notifications and Launch Services rely on.

### Bundle layout

`node packaging/package.mjs macos` builds this bundle in
`artifacts/package/macos/`, with the icon converted from `icons/icon.png`:

```text docs-test=skip:diagram
MyApp.app/
  Contents/
    Info.plist
    MacOS/
      MyApp
    Resources/
      icon.icns
      www/
```

Apple expects only code under `Contents/MacOS`. Since `0.8.0-preview.5`, an
application in an `.app` bundle without a `www` folder next to its executable
loads its frontend from `Contents/Resources/www`; `RunicWindowOptions.ContentRoot`
still overrides it. A bundle you build yourself needs no content-root code
either. Alternatively, embed the frontend with Runic Assets so that the bundle
holds only the executable.

### Info.plist

`package.mjs` fills `packaging/macos/Info.plist`: the bundle identifier is the
application ID, both bundle versions are the numeric part of `Version`, and
`CFBundleURLTypes` lists the schemes of `RunicApplicationUrlSchemes`:

```xml docs-test=template:packaging/macos/Info.plist
<key>CFBundleIdentifier</key><string>{{ApplicationId}}</string>
<key>CFBundleName</key><string>{{ApplicationName}}</string>
<key>CFBundleDisplayName</key><string>{{ApplicationName}}</string>
<key>CFBundleExecutable</key><string>{{Executable}}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>{{BundleVersion}}</string>
<key>CFBundleVersion</key><string>{{BundleVersion}}</string>
<key>CFBundleIconFile</key><string>icon</string>
<key>LSMinimumSystemVersion</key><string>15.0</string>
<key>NSHighResolutionCapable</key><true/>{{UrlSchemes}}
```

Runic Desktop loads the page from `http://127.0.0.1:<port>`; the bundle
declares no App Transport Security exceptions. To declare languages the
bundle supports, add `CFBundleLocalizations` (see
[right-to-left layouts](right-to-left.md)).

### Sign, notarize and staple

`package.mjs` signs the bundle with the hardened runtime
(`codesign --force --options runtime`) and `packaging/macos/entitlements.plist`,
verifies it with `codesign --verify --strict`, and puts it in a compressed disk
image (`<name>-<version>.dmg`, made with `hdiutil`) next to a link to
`/Applications`. Without `--sign` it signs ad hoc: the application runs on the
Mac that built it, and Gatekeeper blocks it elsewhere. To ship it, you need an
Apple Developer Program membership with a Developer ID Application certificate
in the keychain, and notarization credentials stored once with
`xcrun notarytool store-credentials <profile>`:

```sh docs-test=skip:needs-signing-credentials
node packaging/package.mjs macos --sign "Developer ID Application: Example Ltd (TEAMID)" --notary-profile <profile>
spctl --assess --type open --context context:primary-signature --verbose MyApp-1.0.0.dmg
```

With `--sign`, `package.mjs` adds a secure timestamp and signs the disk image
too; with `--notary-profile` it submits the disk image with
`xcrun notarytool submit --wait` and staples the ticket to it with
`xcrun stapler staple`. Use `xcrun notarytool log <submission-id>` to read why
a submission was rejected.

A NativeAOT executable generates no code at run time, so it needs no JIT
entitlement under the hardened runtime, and the template's
`entitlements.plist` is empty. A JIT build does: start from Microsoft's .NET
guidance for the hardened runtime, which includes
`com.apple.security.cs.allow-jit`. Prefer NativeAOT on macOS.

The entitlements file needs entries only for the App Sandbox (required for
the Mac App Store). The CI fixture's
[`entitlements.plist`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/tests/native/platform-sandbox/entitlements.plist)
is the tested starting point: `com.apple.security.app-sandbox`,
`com.apple.security.network.server` and `com.apple.security.network.client`
for the loopback listener and its WebSocket, and
`com.apple.security.files.user-selected.read-write` for files chosen in Runic
file dialogs.

**Checked with**: Runic CI's `Packaging / macos` job runs
`package.mjs macos` for the probe on `macos-26` (`osx-arm64`), verifies the
bundle with `codesign --verify --strict`, checks that it is signed
`(adhoc,runtime)`, lints its `Info.plist` with `plutil`, checks that the icon
and `Contents/Resources/www` are in the bundle and `www` is not in
`Contents/MacOS`, mounts the disk image and verifies the bundle and the
`Applications` link in it. It then opens the bundle with its URL; the probe's
record shows the bundle identifier and the content root
`Contents/Resources/www`. For changes that affect the native layer, Runic CI
also publishes `Runic.Platform.Runtime.Tests` (a NativeAOT application whose
native window is a Runic Desktop WKWebView), signs it ad hoc with the sandbox
entitlements and retains it as the `platform-sandbox-osx-arm64-<run>` artifact
for
[manual permission tests](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/tests/native/platform-sandbox/README.md).
Developer ID signing, notarization, stapling, universal binaries and `osx-x64`
were not executed: they need an Apple Developer account or an Intel Mac.

## Linux

### Publish and runtime dependencies

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r linux-x64 -p:PublishAot=true
```

A NativeAOT executable links against the build machine's glibc, so publish on
the oldest distribution you support. Runic Desktop does not link GTK or
WebKitGTK at build time: it loads them by library name when the first window
opens. Target machines need, from their distribution or a Flatpak runtime:

| Template host  | Libraries loaded                                     | Debian and Ubuntu packages          |
| -------------- | ---------------------------------------------------- | ----------------------------------- |
| `desktop`      | `libgtk-3.so.0`, `libwebkit2gtk-4.1.so.0`            | `libgtk-3-0`, `libwebkit2gtk-4.1-0` |
| `desktop-gtk4` | `libgtk-4.so.1` (GTK 4.12+), `libwebkitgtk-6.0.so.4` | `libgtk-4-1`, `libwebkitgtk-6.0-4`  |

When they are missing, Desktop reports `webkitgtk-runtime-missing` or
`gtk4-runtime-missing` and `webkitgtk6-runtime-missing`, and the template
falls back to an installed browser. Do not bundle GTK or WebKitGTK in a plain
folder: WebKitGTK starts helper processes from its own installation paths.
Use a Flatpak runtime that provides them, or declare them as package
dependencies.

### Desktop entry and icons

Launchers find an application through a desktop entry named after its
application ID, with icons in the hicolor theme under the same name. The
template's Flatpak recipe fills `packaging/linux/app.desktop`; `%U` passes
opened URLs to the application, and a `MimeType=x-scheme-handler/<scheme>;`
line follows for the schemes of `RunicApplicationUrlSchemes`:

```ini docs-test=template:packaging/linux/app.desktop
[Desktop Entry]
Type=Application
Name={{ApplicationName}}
Comment={{Description}}
Exec={{Executable}} %U
Icon={{ApplicationId}}
```

Install it as `share/applications/<application ID>.desktop`, and the icons as
`share/icons/hicolor/<size>x<size>/apps/<application ID>.png` and
`scalable/apps/<application ID>.svg`. GTK 4 matches windows to the entry
through its application ID, which the template passes from the project file:

```csharp docs-test=template:Program.cs host=desktop-gtk4
var options = new DesktopHostOptions { DiagnosticSink = ReportDiagnostic }.WithGtk4(ApplicationIdentity.Id);
```

Check the entry with `desktop-file-validate`.

### Flatpak

Flatpak is the Linux package the template's recipes build. It runs on the
standard `org.gnome.Platform` 50 runtime, which provides GTK 4 and WebKitGTK 6,
so create the project with `--host desktop-gtk4` for it; the GTK 3 `desktop`
host has not been tested in Flatpak. On Debian and Ubuntu,
`node packaging/package.mjs flatpak` needs these packages and the Flathub
remote, from which `flatpak-builder` installs the GNOME runtime and SDK on the
first build:

```sh docs-test=skip:illustrative-command
sudo apt-get install flatpak flatpak-builder appstream appstream-compose librsvg2-common desktop-file-utils
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

`package.mjs` publishes the application, fills the desktop entry, the AppStream
metadata `packaging/linux/app.metainfo.xml` and the `flatpak-builder` manifest
`packaging/linux/flatpak.yml`, and checks the entry with
`desktop-file-validate` and the metadata with `appstreamcli validate`. The manifest installs the published folder in
`/app/lib/<executable>/` with a launcher in `/app/bin/`, the desktop entry, the
metadata and both icons under the application ID, which is also the
manifest's `app-id`, with this runtime and these permissions:

```yaml docs-test=template:packaging/linux/flatpak.yml
runtime: org.gnome.Platform
runtime-version: '50'
sdk: org.gnome.Sdk
# ...
finish-args:
  - --share=ipc
  - --socket=wayland
  - --socket=fallback-x11
  - --device=dri
  # Runic serves the page to the WebView over loopback.
  - --share=network
```

`flatpak-builder` exports the build to the repository
`artifacts/package/flatpak/repo`, and `flatpak build-bundle` writes
`<application ID>.flatpak`. Both are unsigned unless you pass
`--gpg-sign <key id>`; install the bundle with
`flatpak install --user <application ID>.flatpak`. Before you publish, set the
license, a longer description and screenshots in the AppStream metadata; its
homepage is `PackageProjectUrl`.

Inside Flatpak the GTK 4 runner takes the application ID from `FLATPAK_ID`;
an explicit `WithGtk4(...)` ID must match it, or Desktop throws. The template
passes `RunicApplicationId`, which is the Flatpak's `app-id`. File dialogs
must go through the XDG portal: the GTK 4 template already references
`Runic.Platform.Linux.Portal` (see [desktop services](../desktop-services.md)).

The recipe packages a folder published on the build machine. Flathub builds
from source in its own sandbox and reviews a submission from your account,
which needs a manifest that builds the .NET project offline (the
`org.freedesktop.Sdk.Extension.dotnet` SDK extension and generated NuGet
sources); the SDK does not provide one.

### Nix

Since SDK `0.8.0-preview.1`, the SDK's flake builds an application in the Nix
sandbox from its lock files, with GTK and WebKitGTK as run-time dependencies,
and its NixOS and Home Manager modules install it. See
[Package a Runic application with Nix](nix-packaging.md).

### AppImage

The SDK has no AppImage recipe and Runic has not run one. Because WebKitGTK is
not bundled (see above), an AppImage can only carry the executable, `www`,
the desktop entry and icons in an AppDir and rely on the host's GTK and
WebKitGTK libraries listed in the table. Build it with `appimagetool` on the
oldest supported distribution and test it on each distribution you support.
For distribution packages (`.deb`, `.rpm`), declare the same libraries as
dependencies.

**Checked with**: Runic CI installs `libwebkit2gtk-4.1-0` and
`libwebkitgtk-6.0-4` on `ubuntu-24.04`, publishes `Runic.Desktop.Gtk4.Smoke`
with
`dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishAot=true`
and runs the executable under Xvfb, including its event-loop and no-display
paths. Its `Packaging / flatpak` job runs `package.mjs flatpak` for the probe
on `ubuntu-24.04`, installs the bundle with `flatpak install --user --bundle`,
validates the exported desktop entry and its `MimeType` line, checks the
exported SVG icon and runs the application with its URL; the probe's record
shows `FLATPAK_ID` and the content root `/app/lib/<executable>/www`. The probe
opens no window. A Runic Desktop GTK 4 window with WebKit's nested sandbox in
the same runtime is covered by the
[Flatpak sandbox fixture](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/tests/native/Runic.Desktop.Gtk4.Smoke/flatpak/README.md),
which is run by hand in the SDK's [container runner](container-automation.md),
not in CI; its README records the verified runtime commit. Repository signing,
Flathub submission, AppImage and distribution packages were not executed.

## Opened URLs and files

`RunicApplicationUrlSchemes` (for example `org.example.notes` for an OAuth
redirect to `org.example.notes:/callback`) registers each scheme in every
package: a `windows.protocol` extension in the MSIX manifest,
`CFBundleURLTypes` in `Info.plist` and `x-scheme-handler/<scheme>` in the
desktop entry. Windows and Linux start the application with the URL as its
argument; macOS sends it as an Apple event. `IDesktopOpenRequests` in
Runic.Platform delivers them to the running instance; see the SDK's
[open activation specification](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/specs/platform/open-activation.md).

File types are commented examples in each manifest, not filled in by
`package.mjs`: a `windows.fileTypeAssociation` extension,
`CFBundleDocumentTypes` with a `UTExportedTypeDeclarations` entry, and a MIME
type in the desktop entry with a shared-mime-info definition for a type of
your own. The generated README's
[Opened URLs and files](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.5/tools/Runic.Application.Templates/content/runic-app/README.md#opened-urls-and-files)
section describes them. Runic CI opens each package through a URL scheme; it
does not check file types in packages. Treat opened URLs and files as untrusted
input.

## Not provided by the SDK yet

- A `dotnet runic package` command; `package.mjs` and the platform tools are
  the supported path.
- AppImage, `.deb`, `.rpm` and Snap packages, and installer projects such as
  WiX or Inno Setup.
- A Flathub-ready manifest that builds from source.
- Fixed-version WebView2 runtimes.
- An API for the MSIX `StartupTask`, and file type registrations filled in
  from the project file.
- CI on `osx-x64`, and universal macOS binaries in CI.
- Signed, notarized or retained packages from CI.
