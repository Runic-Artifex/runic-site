# Ship a Desktop application

This guide takes a Runic Desktop application (`--host desktop`, with
`--linux-gtk 3` or `4`) from `dotnet publish` to something you can hand to
users on Windows, macOS and Linux. Since SDK `0.11.0`,
`dotnet runic package <target>` publishes the application with NativeAOT and
packages it with the platform's own tools: an MSIX package on Windows, an
`.app` in a disk image on macOS, and a Flatpak, AppImage, Debian package or rpm
on Linux. `dotnet runic package flathub` writes a manifest for a Flathub
submission. `dotnet new runic-app --packaging` (or `--packaging` with
`dnx Runic.Create`) copies the command's built-in manifests to `packaging/`,
where you edit them. The guide says which steps Runic CI exercises, which ones
need signing credentials or accounts that CI does not have, and where the SDK
does not help yet. The SDK's
[packaging guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/docs/packaging.md)
lists each format's tools, and the
[dotnet-runic README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/tools/dotnet-runic/README.md#package-the-application)
has every option, manifest field and `RAPPPKG` code.

From SDK `0.8.0-preview.5` to `0.10.0`, `--packaging` wrote a
`packaging/package.mjs` script instead. `dotnet runic package` does not run it,
and an existing project keeps it unchanged. The command reads the manifests in
`packaging/`, and a manifest that uses a field the command does not fill fails
with `RAPPPKG1006`: replace the old manifests with those of a new
`--packaging` project, or delete them to use the built-in ones.

Each platform section ends with a **Checked with** note. "Runic CI" means the
SDK's
[CI workflow](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/.github/workflows/ci.yml):
its `Native` jobs run test applications that use Runic Desktop, and its
`Packaging` jobs run `dotnet runic package` for the
[packaging probe](https://github.com/Runic-Artifex/runic-sdk/tree/v0.13.0/tests/native/Runic.Packaging.Probe),
a test application with the template's identity, on each platform, install the
package without the maintainers' signing credentials and open it through its
URL scheme. The probe opens no window: it records what the installed package
gives it, and
[`packaging-probe-check.mjs`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/eng/ci/packaging-probe-check.mjs)
checks that record. CI does not package the template application itself or
retain the packages. "Not executed" means the step uses the platform vendor's
documented tools and has not been run for Runic.

## Before you package

### Declare the application's identity

The template's project file declares the application's identity once, and
`ApplicationIdentity` in `ApplicationIdentity.cs` reads it from the assembly
in code. `--packaging` adds the properties that only the packages read:

```xml docs-test=template:RunicWindowApp.csproj packaging=true
<ApplicationId>com.example.MyApp</ApplicationId>
<ApplicationTitle>MyApp</ApplicationTitle>
<Version>1.0.0</Version>
<!-- dotnet runic package reads these too. The summary software centers and the Start menu show. -->
<Description>A Runic desktop application</Description>
<PackageProjectUrl>https://example.com</PackageProjectUrl>
<!-- The MSIX package's publisher: the subject of the certificate that signs it. -->
<RunicApplicationPublisher>CN=Example</RunicApplicationPublisher>
<!-- URL schemes the application opens, separated by semicolons, such as the redirect of an OAuth sign-in. The
     packages register them; see "Package it" in the README. -->
<RunicApplicationUrlSchemes></RunicApplicationUrlSchemes>
<!-- File types the application opens, separated by semicolons: an extension with its dot, optionally with its MIME
     type, such as .notes=application/x-example-notes. The packages declare each as the application's own type. -->
<RunicApplicationFileTypes></RunicApplicationFileTypes>
<!-- Hosts whose https links the application opens, separated by semicolons, such as notes.example.org: Windows app
     URI handlers and macOS universal links, which also need a file on each host; see the README. -->
<RunicApplicationWebLinkHosts></RunicApplicationWebLinkHosts>
<!-- true when the application serves D-Bus activation on Linux (PortalApplication.ExportApplicationAsync): the
     desktop entry sets DBusActivatable=true and the Flatpak exports a D-Bus service file. -->
<RunicApplicationDBusActivatable>false</RunicApplicationDBusActivatable>
<!-- The Explorer and taskbar icon; icons/ holds the same placeholder as SVG and PNG. -->
<ApplicationIcon>icons/icon.ico</ApplicationIcon>
```

`ApplicationId` is the desktop entry, icon and Flatpak ID on Linux, the
bundle identifier on macOS, and the package name and AppUserModelID on Windows.
It defaults to `com.example.` and the project name's ASCII letters and digits;
choose it before you ship, because changing it later makes the platforms see a
different application. Set it with `--application-id org.example.Notes` or in
the project file: a reverse-DNS name for a domain you control, of ASCII letters,
digits and dots, each part starting with a letter, at most 50 characters.
`dotnet runic package` rejects other IDs with `RAPPPKG1001`, and since SDK
`0.11.0` `dotnet runic doctor` warns about them in its `application-id`
check. `PackageProjectUrl` becomes the AppStream homepage, and `Version` the
package version: MSIX and `Info.plist` take its numeric part
(`1.2.3-preview.4` becomes `1.2.3.0` and `1.2.3`), and deb and rpm sort a
prerelease before its release (`1.2.3~preview.4`).

`icons/` holds a neutral placeholder icon as `icon.svg`, `icon.png` (512 px)
and `icon.ico`. Replace it as the generated README's
[Identity and icons](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/tools/Runic.Application.Templates/content/runic-app/README.md#identity-and-icons)
section describes; the packages take their icons from these files.
`RunicPackageIcon` names another 512 px PNG (an `icon.svg` beside it is the
scalable icon on Linux), `RunicPackageName` the deb and rpm package name (the
lower-cased assembly name by default), `PackageLicenseExpression` the rpm
`License`, and `RunicPackagingDirectory` another folder for the manifests.

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

Self-contained and NativeAOT builds embed the .NET runtime they were built
with. After a .NET security release, such as runtime 10.0.14 that SDK `0.12.1`
requires, rebuild and republish them, including packages from
`dotnet runic package`.

NativeAOT gives one native executable per runtime identifier (RID); it is what
`dotnet runic package` publishes and what Runic CI publishes on every platform.
It cannot cross operating systems, so publish and package on Windows for
`win-*`, on macOS for `osx-*` and on Linux for `linux-*`; a CI matrix with one
runner per OS is the usual setup. `dotnet runic package` refuses a target or
RID of another operating system with `RAPPPKG1004`. Since SDK
`0.8.0-preview.2`, a CI job that builds first can publish NativeAOT with
`dotnet publish --no-build -p:PublishAot=true` after a `dotnet build` with the
same configuration, target framework and `PublishAot`: the publish reuses the
Bridge code of that build and reports
[`RUNICBRIDGE022`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/docs/diagnostics.md#runicbridge022)
when it is missing. Before publishing, ask
the CLI what the target needs on the machine that publishes:

```bash docs-test=readme:tools/dotnet-runic/README.md
dotnet runic doctor --runtime linux-x64 --fail-on fail
dotnet runic doctor --runtime win-x64 --aot --fail-on fail
```

The `target-rid` check reads the
[support matrix](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/eng/support.json):
for Runic Desktop every supported RID (`win-x64`, `win-arm64`, `osx-arm64`,
`linux-x64`, `linux-arm64` and the musl RIDs) is CI-verified. Since SDK
`0.12.0`, Runic supports macOS on Apple silicon only: `osx-x64` is
unsupported, so `--runtime osx-x64` fails `target-rid` (it was a warning),
and `dotnet runic package` refuses it with `RAPPPKG1004`. `target-presentation`
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
executable. Since SDK `0.11.0`, one property does that without code:

```xml docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
<PropertyGroup>
  <RunicApplicationFrontendDelivery>Embedded</RunicApplicationFrontendDelivery>
</PropertyGroup>
```

The build then packs the frontend into the application assembly with
[Runic Assets](../assets/README.md), the build and publish output have no
`www`, and `RunicDesktopHost` and the WPF `RunicViewHost` serve it, so a
single-file or NativeAOT executable carries its frontend. `Files` stays the
default; another value, or the CS-WebUI host, warns with `RUNICBRIDGE030` and
builds as `Files`. `dotnet runic dev` still serves the live frontend. See
[ship the frontend inside the executable](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Application.Views/README.md#ship-the-frontend-inside-the-executable).
NativeAOT also writes debug symbols (`.pdb` on Windows, `.dbg` on Linux,
`.dSYM` on macOS). `dotnet runic package` leaves them out of the package; keep
them per release for [crash analysis](crash-reporting.md).

Since SDK `0.11.0`, asset archives leave out `.git` and `.env*` files at any
depth, and source maps warn with `RAS1005`; `RunicAssetsDefaultExcludes=false`
packs them again. New projects also send a Content-Security-Policy without
`'unsafe-eval'` outside `Development`
(`RunicDesktopHostOptions.ContentSecurityPolicy`); test the published
application with it, because a page dependency that evaluates strings fails
under it.

The window icon at run time comes from `DesktopWindowOptions.IconFile`, which
an application sets through the `WindowOptions` of its
`RunicDesktopHostOptions`:
WebView2 loads an `.ico` file, and the GTK 3 host and macOS load the image
file you pass. GTK 4 windows reject `IconFile`; their icon comes from the
installed desktop entry (see [Linux](#linux)). The icon that a file manager,
Dock or launcher shows comes from the package metadata described below.

### Run dotnet runic package

`dotnet runic package` reads the identity properties above from the project
file, publishes with NativeAOT, fills the `{{...}}` fields of its manifests and
writes the package to `artifacts/package/<target>/`. Run it from the project
directory, on the platform you package for:

```sh docs-test=template:README.md packaging=true
dotnet runic package windows    # MSIX, on Windows with the Windows SDK
dotnet runic package macos      # .app in a disk image, on macOS with Xcode's command line tools
dotnet runic package flatpak    # Flatpak, on Linux with flatpak-builder
dotnet runic package appimage   # AppImage, on Linux with appimagetool
dotnet runic package deb        # Debian package, on Linux with dpkg-deb
dotnet runic package rpm        # rpm, on Linux with rpmbuild (also on Debian and Ubuntu)
```

Without signing options, the MSIX, Flatpak, AppImage, deb and rpm are unsigned
and the `.app` is signed ad hoc: enough to install and test the package on your
own machine. Runic signs nothing for you; the platform sections below list what
each platform needs to ship it. A missing tool stops the command before it
builds anything (`RAPPPKG1002`, which names the package that provides it).
`--project` (`-p`), `--configuration` (`-c`), `--runtime` (`-r`, the host's
architecture by default) and `--output-directory` (`-o`) override the
project, the configuration, the RID and the output folder. `--format json`
reports what was written as the `runic.application.tool.package/1` payload,
with each package's `signing` (`none`, `adhoc`, `test` or `identity`) and its
warnings, such as `RAPPPKG2001` for an unsigned package.

The command has a built-in copy of each manifest: `windows/AppxManifest.xml`,
`macos/Info.plist`, `macos/entitlements.plist`, `linux/app.desktop`,
`linux/app.metainfo.xml`, `linux/app.service` and `linux/flatpak.yml`. A file
with the same path in `packaging/` replaces the built-in one; a manifest you
delete falls back to the default.

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
([`Runic.Desktop.targets`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Desktop/buildTransitive/Runic.Desktop.targets)).
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

`dotnet runic package windows` publishes into
`artifacts/package/windows/msix/`, writes the filled `AppxManifest.xml` and
the icon there, and packs it with the Windows SDK's `makeappx pack` into
`<application ID>_<version>_<x64|arm64>.msix`. The command finds `makeappx`
and `signtool` on `PATH` or in the newest Windows SDK folder. The manifest
declares a full-trust desktop application; the package name is the
application ID, and `Publisher` comes from `RunicApplicationPublisher` (or
`--publisher`):

```xml docs-test=template:packaging/windows/AppxManifest.xml
<Identity Name="{{ApplicationId}}" Publisher="{{Publisher}}" Version="{{PackageVersion}}" ProcessorArchitecture="{{Architecture}}" />
<!-- ... -->
<Application Id="App" Executable="{{Executable}}.exe" EntryPoint="Windows.FullTrustApplication">
<!-- ... -->
<rescap:Capability Name="runFullTrust" />
```

The `{{Extensions}}` field declares the URL schemes, file types and app URI
handlers of the project file and the login startup task (see
[Opened URLs and files](#opened-urls-and-files)). Windows installs only signed
packages, and `Publisher` must equal the subject of the signing certificate.
The command signs the package with `signtool` when you pass a certificate:

```powershell docs-test=skip:needs-signing-credentials
$env:RUNIC_SIGNING_PASSWORD = '<password>'
dotnet runic package windows --certificate app.pfx --timestamp-url <timestamp-url>
dotnet runic package windows --thumbprint <sha1> --timestamp-url <timestamp-url>
```

`--certificate` signs with a PFX file (its password in
`RUNIC_SIGNING_PASSWORD`, which the command never prints), `--thumbprint`
with a certificate from the certificate store or a hardware token. Code-signing
certificates issued today keep their private key on a hardware token or a cloud
signing service; such a service signs the unsigned package with its own
`signtool` options. The Microsoft Store signs packages itself. To try a package
without a code-signing certificate, sign it with a self-signed certificate
whose subject is the publisher and trust that certificate in
`Cert:\LocalMachine\TrustedPeople` on the test machine only, as Runic CI does;
the payload then reports `"signing": "test"`.

### Identity in a package, and without one

In an MSIX package, Windows registers the AppUserModelID
`<package family name>!App`. Since `0.8.0-preview.5`, Runic's notifications
use it there and ignore the ID passed to `AddRunicPlatformServices(...)` or
`CreateNotifications(...)`. Since SDK `0.11.0`, the manifest declares a
`desktop:StartupTask` (`TaskId="LoginStartup"`, off until the application turns
it on), and Runic's login startup drives it in the package; before, it reported
`Unavailable(BackendUnavailable)` there. A packaged application passes
`DesktopPlatformServices.GetLaunch(args)` to `ApplicationInstance.ClaimAsync`,
because its protocol and file activations do not arrive in `args`; see
[desktop services](../desktop-services.md#status-icon-single-instance-and-login-startup).

An unpackaged copy (a ZIP or another installer) has no package identity.
Register its AppUserModelID yourself with a Start menu shortcut whose
`System.AppUserModel.ID` property is the application ID, and pass the same ID
to `AddRunicPlatformServices(ApplicationIdentity.Id)` for notifications.

### ZIP and other installers

- **ZIP**: archive the publish folder. Nothing needs registering; to open URL
  schemes and file types, the application registers them itself with
  `IDesktopOpenRegistration` (see
  [desktop services](../desktop-services.md#opened-urls-file-types-and-web-links)).
- **Installer**: any installer that copies a folder works (for example WiX or
  Inno Setup). Add the WebView2 bootstrapper as a prerequisite for Windows 10
  machines that may not have the runtime, and a Start menu shortcut with the
  AppUserModelID described above.

The SDK provides no installer project or WebView2 bootstrapper integration.

### Sign with Authenticode

`dotnet runic package windows` signs the MSIX, not the executable inside it.
For a ZIP or another installer, sign the executable before packaging it, then
sign the installer itself. With NativeAOT the executable is the only binary you
build; JIT builds also contain your own assemblies, which you can sign the same
way (`WebView2Loader.dll` is already signed by Microsoft).

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
`dotnet runic package windows` for the probe with a self-signed certificate
trusted on the runner only, installs the MSIX with `Add-AppxPackage` and opens
its URL scheme. The probe's record shows the AppUserModelID
`org.runic.tests.PackagingProbe_<publisher hash>!App`, notifications that
report `Success`, a protocol activation, and the startup task turned on and
off again. The job then opens two of the package's files at once, which reach
one process. The same `WinExe` started outside the package writes its
diagnostic to a redirected standard error and to `diagnostics.log`. Publicly
trusted code signing, the timestamp server, app URI handlers, installers, Start
menu shortcuts and the Microsoft Store were not executed.

## macOS

### Publish for Apple silicon

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r osx-arm64 -p:PublishAot=true -o publish/osx-arm64
```

Since SDK `0.12.0`, Runic supports macOS 15 and later on Apple silicon
(`osx-arm64`) only; macOS 15 is the oldest version .NET 10 supports, and
WKWebView is part of macOS. Intel Macs (`osx-x64`) are not a Runic target:
`dotnet runic package macos` refuses `--runtime osx-x64`, and the universal
bundles that `--runtime osx-arm64,osx-x64` made with `lipo` in `0.11.0`, with
`RAPPPKG1004`. A plain `dotnet publish -r osx-x64` is not checked.

Runic Desktop runs AppKit's own run loop (`[NSApp run]`) and makes the process
a regular application, so an unbundled executable already gets a Dock icon and
window. A bundle gives it an identity (bundle ID, name, version, icon), which
signing, notarization, permissions, notifications and Launch Services rely on.

### Development bundle

Since SDK `0.12.0`, `dotnet run`, `dotnet watch` and `dotnet runic dev` on
macOS start the application from an ad-hoc signed development bundle in
`obj/<configuration>/<framework>/runic-macos/<AssemblyName>.app` instead of the
bare build output. Its `Info.plist` comes from the project, so notifications,
login startup, open registration and the URL schemes and file types work while
you develop; file types are declared with the `Alternate` rank and none is
exported. The bundle is signed without the hardened runtime, so the debugger,
hot reload and the JIT work, and `AppContext.BaseDirectory` stays the build
output. It has the shipped application's bundle identifier, so macOS keeps one
set of permissions for both. Set
`<RunicMacDevelopmentBundle>false</RunicMacDevelopmentBundle>` to run the build
output directly, as before; launch profiles with `commandName: Executable` and
IDEs that start the output themselves are unaffected. Universal links and the
data-protection keychain need entitlements an ad-hoc signature cannot carry:
test them in a package built with `--sign` and `--provisioning-profile`. See
[Runic.Platform.MacOS: Development bundle](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/packages/dotnet/Runic.Platform.MacOS/README.md#development-bundle).

### Bundle layout

`dotnet runic package macos` builds this bundle in `artifacts/package/macos/`,
named after `ApplicationTitle`, with an `.icns` icon made from the 512 px PNG
with `sips` and `iconutil`:

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
either. An application that embeds its frontend
(`RunicApplicationFrontendDelivery=Embedded`) has no `www` folder, and the
bundle holds only the executable.

Since SDK `0.12.0`, `Contents/MacOS` holds only Mach-O files: the executable
and any native library or helper tool the project publishes. Every other
published file or directory, such as configuration or data, moves to
`Contents/Resources`, with a relative symbolic link in its place in
`Contents/MacOS`, so code that reads it next to the executable
(`AppContext.BaseDirectory`) still finds it; code that enumerates
`Contents/MacOS` sees the links.

### Info.plist

The command fills `macos/Info.plist`: the bundle identifier is the application
ID, both bundle versions are the numeric part of `Version`, `CFBundleURLTypes`
lists the schemes of `RunicApplicationUrlSchemes`, and the document types come
from `RunicApplicationFileTypes`. Since SDK `0.12.0`, `{{ApplicationCategory}}`
adds `LSApplicationCategoryType` from `RunicMacApplicationCategory`, and
`{{UsageDescriptions}}` adds `NSCameraUsageDescription` and
`NSMicrophoneUsageDescription` from `RunicMacCameraUsageDescription` and
`RunicMacMicrophoneUsageDescription`:

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
<key>NSHighResolutionCapable</key><true/>{{ApplicationCategory}}{{UrlSchemes}}{{DocumentTypes}}{{UsageDescriptions}}
```

An `Info.plist` override in `packaging/macos/` from `0.11.0` keeps working
until the project sets a camera or microphone usage description: then it needs
`{{UsageDescriptions}}`, or the command fails with `RAPPPKG1006` rather than
ship a bundle that cannot use the device. Add `{{ApplicationCategory}}` too
when you set `RunicMacApplicationCategory`.

Runic Desktop loads the page from `http://127.0.0.1:<port>`; the bundle
declares no App Transport Security exceptions. To declare languages the
bundle supports, add `CFBundleLocalizations` (see
[right-to-left layouts](right-to-left.md)).

### File types and camera access

Since SDK `0.12.0`, an extension in `RunicApplicationFileTypes` that has a
system type, such as `.txt` (`public.plain-text`), `.md`
(`net.daringfireball.markdown`) or `.png` (`public.png`), names that type with
the `Alternate` rank: Finder offers the application under _Open With_ without
making it the default or the owner of every such file. Before, every extension
was exported as `<ApplicationId>.<extension>` with the `Owner` rank. Any other
extension is still the application's own type, exported with `Owner`. Two
properties adjust it:

| Property                      | Default     | Purpose                                                                                                                                                                |
| ----------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RunicMacFileTypeHandlerRank` | `Alternate` | `Default` asks to be the default application for the types the application does not own.                                                                               |
| `RunicMacFileTypeIdentifiers` | none        | `.extension=identifier` pairs, separated by `;`, for types another application or the system declares that the built-in list does not know, such as `.log=public.log`. |

A page that calls `getUserMedia` in a window with
`DesktopPermissionGrant.MediaCapture` needs the application's own camera or
microphone access. Set `RunicMacCameraUsageDescription` and
`RunicMacMicrophoneUsageDescription` to the text macOS shows when it first
asks; each adds the usage description to `Info.plist` and the
`com.apple.security.device.camera` or `device.audio-input` entitlement,
sandboxed or not. Without them WKWebView rejects `getUserMedia` with
`NotAllowedError` and macOS never asks. The SDK's
[packaging guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/docs/packaging.md#file-types)
lists the system types the command knows.

### Sign, notarize and staple

The command signs the bundle with the hardened runtime
(`codesign --force --options runtime`) and `macos/entitlements.plist`; since
SDK `0.12.0` it first signs each nested library and executable the same way,
deepest first, and verifies the bundle with `codesign --verify --deep --strict`.
It puts it in a compressed disk
image (`<name>-<version>.dmg`, made with `hdiutil`) next to a link to
`/Applications`. Without `--sign` it signs ad hoc: the application runs on the
Mac that built it, and Gatekeeper blocks it elsewhere. To ship it, you need an
Apple Developer Program membership with a Developer ID Application certificate
in the keychain, and notarization credentials stored once with
`xcrun notarytool store-credentials <profile>`:

```sh docs-test=skip:needs-signing-credentials
dotnet runic package macos --sign "Developer ID Application: Example Ltd (TEAMID)" --notary-profile <profile>
spctl --assess --type open --context context:primary-signature --verbose MyApp-1.0.0.dmg
```

With `--sign`, the command adds a secure timestamp and signs the disk image
too; with `--notary-profile` it submits the disk image with
`xcrun notarytool submit --wait` and staples the ticket to it with
`xcrun stapler staple`. Use `xcrun notarytool log <submission-id>` to read why
a submission was rejected. In CI, import the certificate into a temporary
keychain first, and keep the certificate and the notarization key in your CI
system's secrets.

A NativeAOT executable generates no code at run time, so it needs no JIT
entitlement under the hardened runtime, and the built-in
`entitlements.plist` holds only the `{{Entitlements}}` field, which the command
fills with what the options and properties below need. A JIT build needs
more: start from Microsoft's .NET guidance for the hardened runtime, which
includes `com.apple.security.cs.allow-jit`. Prefer NativeAOT on macOS.

### App Sandbox and the Mac App Store

Since SDK `0.12.0`, `--sandbox`, or `<RunicMacSandbox>true</RunicMacSandbox>`
in the project, signs the bundle for the App Sandbox. Sandboxing stays opt-in.
The command fills the entitlements Runic Desktop needs into `{{Entitlements}}`:
`com.apple.security.app-sandbox`, `network.server` and `network.client` for
the loopback page server and the bridge's WebSocket,
`files.user-selected.read-write` for files chosen in file dialogs, and
`files.bookmarks.app-scope` for bookmarks across launches. An
`entitlements.plist` override without `{{Entitlements}}` must list them
itself: one that lacks a required key, repeats a key or turns the sandbox off
fails with `RAPPPKG1006`. A window that sets
`DesktopWebContentPolicy.AllowDownloads` also needs
`com.apple.security.files.downloads.read-write` in the override; Runic does
not add it. In the sandbox, privileged actions and volume management are not
available, and a document cannot create sibling files such as lock files.

For the Mac App Store, add `RunicMacApplicationCategory` (a
`public.app-category.*` identifier, which App Store Connect requires), a
1024 px `RunicPackageIcon`, an **Apple Distribution** certificate for `--sign`
and a Mac App Store provisioning profile for the `ApplicationId`.
`--provisioning-profile <file>` embeds it as
`Contents/embedded.provisionprofile` and adds its application and team
identifiers to the entitlements; a profile for another application is
`RAPPPKG1006`. `--pkg` also writes `<name>-<version>.pkg` with `productbuild`,
which installs the bundle in `/Applications`, and `--installer-sign` signs it
with your installer certificate:

```sh docs-test=skip:needs-signing-credentials
dotnet runic package macos --sandbox \
  --sign "Apple Distribution: Example Ltd (TEAMID)" \
  --provisioning-profile Notes_Mac_App_Store.provisionprofile \
  --pkg --installer-sign "3rd Party Mac Developer Installer: Example Ltd (TEAMID)"
```

Upload the `.pkg` with Apple's Transporter app; Runic uploads nothing. Outside
the App Store, `--pkg` with a **Developer ID Installer** identity writes an
installer package that `--notary-profile` notarizes and staples like the disk
image. A `.pkg` without `--installer-sign` is unsigned and warns with
`RAPPPKG2001`. The SDK's
[packaging guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/docs/packaging.md#app-sandbox-and-the-mac-app-store)
covers export compliance and the details.

**Checked with**: Runic CI's `Packaging / macos` job runs
`dotnet runic package macos` for the probe on `macos-26` (`osx-arm64`),
verifies the bundle with `codesign --verify --deep --strict`, checks that it
and its nested code are signed `(adhoc,runtime)`, lints its `Info.plist` with
`plutil`, checks the document type's rank, checks that the icon
and `Contents/Resources/www` are in the bundle and `www` is not in
`Contents/MacOS`, mounts the disk image and verifies the bundle and the
`Applications` link in it. It then opens the bundle with its URL; the probe's
record shows the bundle identifier and the content root
`Contents/Resources/www`. The job also starts the probe with `dotnet run` and
checks its development bundle's identifier, URL scheme, `Alternate` file type
rank and ad-hoc signature, and packages a sandboxed Runic Desktop fixture
(`RunicMacSandbox`) with `--pkg`, ad-hoc signed and with an unsigned installer
package: it checks the bundle's entitlements and application category, expands
the `.pkg`, and runs the fixture in the sandbox to save and reopen a document
outside its container. For changes that affect the native layer, Runic CI
also publishes `Runic.Platform.Runtime.Tests` (a NativeAOT application whose
native window is a Runic Desktop WKWebView), signs it ad hoc with the sandbox
entitlements and retains it as the `platform-sandbox-osx-arm64-<run>` artifact
for
[manual permission tests](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/tests/native/platform-sandbox/README.md).
Developer ID and Apple Distribution signing, provisioning profiles,
notarization, stapling, App Store Connect validation and universal links were
not executed: they need an Apple Developer account.

## Linux

### Publish and runtime dependencies

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r linux-x64 -p:PublishAot=true
```

A NativeAOT executable links against the build machine's glibc, so publish on
the oldest distribution you support. Runic Desktop does not link GTK or
WebKitGTK at build time: it loads them by library name when the first window
opens. Target machines need, from their distribution or a Flatpak runtime:

| Template option | Libraries loaded                                     | Debian and Ubuntu packages          |
| --------------- | ---------------------------------------------------- | ----------------------------------- |
| `--linux-gtk 3` | `libgtk-3.so.0`, `libwebkit2gtk-4.1.so.0`            | `libgtk-3-0`, `libwebkit2gtk-4.1-0` |
| `--linux-gtk 4` | `libgtk-4.so.1` (GTK 4.12+), `libwebkitgtk-6.0.so.4` | `libgtk-4-1`, `libwebkitgtk-6.0-4`  |

When they are missing, Desktop reports `webkitgtk-runtime-missing` or
`gtk4-runtime-missing` and `webkitgtk6-runtime-missing`, and the template
falls back to an installed browser. Do not bundle GTK or WebKitGTK in a plain
folder: WebKitGTK starts helper processes from its own installation paths.
Use a Flatpak runtime that provides them, or declare them as package
dependencies, as the deb and rpm do.

Since SDK `0.11.0`, `Runic.Desktop` depends on `Runic.Platform.Linux.DBus`
and Tmds.DBus.Protocol on every OS, for the Linux global menu, so a JIT
build ships those two managed assemblies on Windows and macOS too, unused
there.

### Desktop entry and icons

Launchers find an application through a desktop entry named after its
application ID, with icons in the hicolor theme under the same name. Every
Linux target fills `linux/app.desktop`; `%U` passes opened URLs to the
application, and the `{{MimeTypes}}` and `{{DBusActivatable}}` fields add a
`MimeType=` line for the URL schemes and file types and `DBusActivatable=true`
when the project declares them:

```ini docs-test=template:packaging/linux/app.desktop
[Desktop Entry]
Type=Application
Name={{ApplicationName}}
Comment={{Description}}
Exec={{Executable}} %U
Icon={{ApplicationId}}
```

The packages install it as `share/applications/<application ID>.desktop`, and
the icons as `share/icons/hicolor/512x512/apps/<application ID>.png` and
`scalable/apps/<application ID>.svg`. GTK 4 matches windows to the entry
through its application ID, which the template passes from the project file:

```csharp docs-test=template:Program.cs host=desktop linux-gtk=4
var options = new DesktopHostOptions { DiagnosticSink = ReportDiagnostic }.WithGtk4(ApplicationIdentity.Id);
```

The command checks the entry with `desktop-file-validate` and the AppStream
metadata `linux/app.metainfo.xml` with `appstreamcli` where they are
installed. Before you publish a Linux package, set the license, a longer
description and screenshots in the metadata; its homepage is
`PackageProjectUrl`.

### Flatpak

The Flatpak runs on the standard `org.gnome.Platform` 50 runtime, which
provides GTK 4 and WebKitGTK 6, so create the project with
`--host desktop --linux-gtk 4` for it; the GTK 3 host has not been tested in
Flatpak. On Debian and Ubuntu, `dotnet runic package flatpak` needs these
packages and the Flathub remote, from which `flatpak-builder` installs the
GNOME runtime and SDK on the first build:

```sh docs-test=skip:illustrative-command
sudo apt-get install flatpak flatpak-builder appstream appstream-compose librsvg2-common desktop-file-utils
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

The command publishes into `flatpak-source/`, fills the desktop entry, the
metadata and the `flatpak-builder` manifest `linux/flatpak.yml`, and builds
with `flatpak-builder --install-deps-from=flathub`. The manifest installs the
published folder in `/app/lib/<executable>/` with a launcher in `/app/bin/`,
the desktop entry, the metadata, both icons, and the file types' MIME
definitions and the D-Bus service file when the project has them, under the
application ID, which is also the manifest's `app-id`, with this runtime and
these permissions:

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
  # The Linux global menu: KDE Plasma's menu registrar (Runic.Desktop, global-menu-permission).
  - --talk-name=com.canonical.AppMenu.Registrar
```

Since SDK `0.11.0`, a GTK window can move its menu bar into KDE Plasma's
global menu. In a Flatpak this needs the finish argument
`--talk-name=com.canonical.AppMenu.Registrar`, which the built-in manifest and
the Flathub manifest grant since SDK `0.12.0`. Without it the bar stays in the
window and the application reports `global-menu-permission`: add it to a
`packaging/linux/flatpak.yml` from `0.11.0` or a hand-written manifest if the
application declares a menu bar; see [menus](../desktop-services.md#menus).

`flatpak-builder` exports the build to the repository
`artifacts/package/flatpak/repo`, and `flatpak build-bundle` writes
`<application ID>.flatpak`. Both are unsigned unless you pass
`--gpg-sign <key id>`; install the bundle with
`flatpak install --user <application ID>.flatpak`.

Inside Flatpak the GTK 4 runner takes the application ID from `FLATPAK_ID`;
an explicit `WithGtk4(...)` ID must match it, or Desktop throws. The template
passes `ApplicationId`, which is the Flatpak's `app-id`. File dialogs
must go through the XDG portal: the GTK 4 template already references
`Runic.Platform.Linux.Portal` (see [desktop services](../desktop-services.md)).
Since SDK `0.11.0`, a Flatpak without Secret Service permission stores secrets
through the Secret portal.

### Flathub

The Flatpak target packages a folder published on the build machine. Flathub
builds from source in its own sandbox, without network access, and reviews a
submission from your account. Since SDK `0.11.0`, `dotnet runic package
flathub` writes that source-build manifest: `<ApplicationId>.yml` on the GNOME
runtime with the .NET and, for a frontend, Node.js SDK extensions, a `git`
source at your commit or tag, the desktop entry and metadata, and
`nuget-sources.json` and `npm-sources.json` with every package of your
committed lock files. It runs on any OS; `--build` then builds the manifest
offline on Linux, as Flathub's builders do, and writes a bundle to try:

```bash docs-test=readme:tools/dotnet-runic/README.md
dotnet runic package flathub --git-url https://github.com/example/notes.git --git-tag v1.2.0   # Flathub manifest, on any OS
```

The project needs a NuGet lock file for the NativeAOT restore whose
`RuntimeIdentifiers` list `linux-x64` and `linux-arm64`, and npm with its
`package-lock.json` for the frontend. A missing commit or tag, lock file, hash
or RID is `RAPPPKG1007`. Generate the manifest again whenever a lock file
changes, and submit it as Flathub's submission guide describes; Runic submits
nothing. The SDK's
[packaging guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/docs/packaging.md#flathub)
lists the lock file settings and the review's expectations.

### AppImage, deb and rpm

Since SDK `0.11.0`, `dotnet runic package appimage`, `deb` and `rpm` build the
other Linux formats. None of them bundles GTK or WebKitGTK: they use the target
system's libraries listed above.

- **AppImage**: needs `appimagetool` on `PATH` and the matching AppImage
  runtime (`runtime-x86_64` or `runtime-aarch64` from the type2-runtime
  releases) beside it, or named by `RUNIC_APPIMAGE_RUNTIME`, so packaging
  downloads nothing. On a machine without FUSE 2, set
  `APPIMAGE_EXTRACT_AND_RUN=1`. It writes
  `<ApplicationTitle>-<version>-<arch>.AppImage`. An AppImage registers no URL
  schemes or file types by itself and is not D-Bus activatable, because it has
  no fixed path. Document the WebKitGTK package your users need, and sign it
  with `appimagetool --sign` or a detached GPG signature.
- **deb**: needs `dpkg-deb`. The package installs the publish folder in
  `/usr/lib/<application ID>/` with a `/usr/bin/<assembly name>` link, the
  desktop entry, icons, metadata, MIME definitions and, with
  `RunicApplicationDBusActivatable`, the D-Bus service file. It depends on
  `libgtk-3-0t64 | libgtk-3-0, libwebkit2gtk-4.1-0`, or on
  `libgtk-4-1, libwebkitgtk-6.0-4` for GTK 4. A deb is not signed itself:
  publish it in an apt repository signed with your key.
- **rpm**: needs `rpmbuild` (`rpm-build` on Fedora, `rpm` on Debian and
  Ubuntu) and stages the same tree. It requires only `webkit2gtk4.1`, or
  `webkitgtk6.0` for GTK 4, with automatic dependencies off, because the
  executable loads GTK with `dlopen`. Sign it with `rpmsign --addsign`.

The SDK's packaging guide also has a Snap recipe, which repacks the deb; Snap
is not a `dotnet runic package` target.

### Nix

Since SDK `0.8.0-preview.1`, the SDK's flake builds an application in the Nix
sandbox from its lock files, with GTK and WebKitGTK as run-time dependencies,
and its NixOS and Home Manager modules install it. Since SDK `0.12.0` it also
installs the project's file types and URL schemes in the desktop entry, as the
deb and rpm do. See [Package a Runic application with Nix](nix-packaging.md).

**Checked with**: Runic CI installs `libwebkit2gtk-4.1-0` and
`libwebkitgtk-6.0-4` on `ubuntu-24.04`, publishes `Runic.Desktop.Gtk4.Smoke`
with
`dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishAot=true`
and runs the executable under Xvfb, including its event-loop and no-display
paths. Its `Packaging` jobs run `dotnet runic package` for the probe on
`ubuntu-24.04`. The `flatpak` job installs the bundle with
`flatpak install --user --bundle`, validates the exported desktop entry with
its `MimeType` and `DBusActivatable` lines, checks the exported MIME
definition, D-Bus service file and SVG icon, and runs the application with its
URL; the probe's record shows `FLATPAK_ID` and the content root
`/app/lib/<executable>/www`. The `appimage` job extracts and runs the AppImage
with its URL. The `deb` job installs the package with its dependencies on
Ubuntu and opens its URL through the registered handler, and the `rpm` job
builds on Ubuntu and installs and opens the rpm in a Fedora container. The
`flathub` job generates the manifest of a fixture, builds it offline with
`--build`, installs the bundle and runs it. The probe opens no window. A Runic
Desktop GTK 4 window with WebKit's nested sandbox in the same runtime is
covered by the
[Flatpak sandbox fixture](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/tests/native/Runic.Desktop.Gtk4.Smoke/flatpak/README.md),
which is run by hand in the SDK's [container runner](container-automation.md),
not in CI; its README records the verified runtime commit. Repository signing,
Flathub submission, D-Bus activation from GNOME and KDE, and the Snap recipe
were not executed.

## Opened URLs and files

`RunicApplicationUrlSchemes` (for example `org.example.notes` for an OAuth
redirect to `org.example.notes:/callback`) registers each scheme in every
package: a `windows.protocol` extension in the MSIX manifest,
`CFBundleURLTypes` in `Info.plist` and `x-scheme-handler/<scheme>` in the
desktop entry. Windows and Linux start the application with the URL as its
argument; macOS sends it as an Apple event. `IDesktopOpenRequests` in
Runic.Platform delivers them to the running instance; see the SDK's
[open activation specification](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/specs/platform/open-activation.md).

Since SDK `0.11.0`, the packages are also filled from these properties:

- `RunicApplicationFileTypes` lists file types, such as
  `.notes=application/x-example-notes;.md`: an extension with its dot and,
  optionally, its MIME type. `Info.plist` declares each as a document type:
  since SDK `0.12.0`, a system type such as Markdown with the `Alternate` rank,
  and the application's own types with an exported type identifier
  `<ApplicationId>.<extension>` (see
  [file types and camera access](#file-types-and-camera-access)). The MSIX manifest declares a `uap3:FileTypeAssociation` with
  `MultiSelectModel="Player"`, so files the user opens together reach one
  process; read them with `DesktopPlatformServices.GetLaunch(args)`. The
  desktop entry lists a MIME type for each, whose shared-mime-info definition
  the Linux packages install.
- `RunicApplicationWebLinkHosts` lists hosts, such as `notes.example.org`,
  whose `https` links open the application; pass the same hosts as
  `DesktopOpenOptions.WebLinkHosts`. On Windows the MSIX manifest declares a
  `uap3:AppUriHandler` for each, and each host serves
  `/.well-known/windows-app-web-link` naming the package family. On macOS these
  are universal links, which need the
  `com.apple.developer.associated-domains` entitlement, a provisioning profile
  embedded as `Contents/embedded.provisionprofile` and an
  `apple-app-site-association` file on each host. An ad-hoc signature cannot
  carry the entitlement, so the command does not add it: add it to your
  `macos/entitlements.plist` before you sign.
- `RunicApplicationDBusActivatable` set to `true` adds `DBusActivatable=true`
  to the desktop entry and a D-Bus service file to the Flatpak, deb and rpm.
  GNOME and KDE then start the application through the session bus and deliver
  later opens to the running process, which serves the activation after
  claiming its instance:
  `await DesktopPlatformServices.ExportApplicationAsync(ApplicationIdentity.Id, instance)`.

The generated README's
[Opened URLs and files](https://github.com/Runic-Artifex/runic-sdk/blob/v0.13.0/tools/Runic.Application.Templates/content/runic-app/README.md#opened-urls-and-files)
section has the exact files each host serves. An application without a
package, such as a ZIP, registers its schemes and file types itself with
`IDesktopOpenRegistration`. Runic CI opens each package through a URL scheme
and the MSIX with two files at once; universal links, app URI handlers and
D-Bus activation from a desktop are manual checks. Treat opened URLs and files
as untrusted input.

## Not provided by the SDK yet

- Installer projects such as WiX or Inno Setup, and a Snap target (the
  packaging guide has a recipe).
- Fixed-version WebView2 runtimes.
- Intel Macs (`osx-x64`) and universal macOS bundles, which are not Runic
  targets since SDK `0.12.0`; an upload to App Store Connect.
- Signed, notarized or retained packages from CI, and a Flathub submission.
