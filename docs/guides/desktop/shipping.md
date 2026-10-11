# Ship a Desktop application

This guide takes a Runic Desktop application (`--host desktop` or
`--host desktop-gtk4`) from `dotnet publish` to something you can hand to
users on Windows, macOS and Linux. Runic has no packaging command yet: you
publish with the .NET SDK, then bundle, sign and package with each platform's
own tools. The guide says which steps Runic CI exercises, which ones need
signing credentials that CI does not have, and where the SDK does not help yet.

Each platform section ends with a **Checked with** note. "Runic CI" means the
`Native` jobs of the SDK's
[CI workflow](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/.github/workflows/ci.yml)
run that step for test applications that use Runic Desktop. They do not
package the template application or produce signed installers. "Not executed"
means the step uses the platform vendor's documented tools and has not been
run for Runic.

## Before you package

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

NativeAOT gives one native executable per runtime identifier (RID) and is what
Runic CI publishes on every platform. It cannot cross operating systems, so
publish on Windows for `win-*`, on macOS for `osx-*` and on Linux for `linux-*`;
a CI matrix with one runner per OS is the usual setup. Before publishing, ask
the CLI what the target needs on the machine that publishes:

```bash docs-test=readme:tools/dotnet-runic/README.md
dotnet runic doctor --rid linux-x64 --fail-on fail
dotnet runic doctor --rid win-x64 --aot --fail-on fail
```

The `target-rid` check reads the
[support matrix](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/eng/support.json):
`win-x64`, `osx-arm64` and `linux-x64` are CI-verified for Desktop, while
`win-arm64`, `osx-x64`, `linux-arm64` and the musl RIDs ship native support
without CI coverage. Test those on a real machine. `target-presentation`
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
Leave them out of the package but keep them per release for crash analysis.

The window icon at run time comes from `DesktopWindowOptions.IconFile`, which
an application sets through the `WindowOptions` of its `RunicDesktopHost`:
WebView2 loads an `.ico` file, and the GTK 3 host and macOS load the image
file you pass. GTK 4 windows reject `IconFile`; their icon comes from the
installed desktop entry (see [Linux](#linux)). The icon that a file manager,
Dock or launcher shows comes from the package metadata described below.

## Windows

### Publish

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r win-x64 -p:PublishAot=true
```

The template project is a console application (`OutputType` `Exe`), so
Windows opens a console window next to the app when a user starts it from
Explorer. Set `<OutputType>WinExe</OutputType>` for the build you ship; the
template's diagnostics written to standard error are then not visible, so log
them to a file if you need them.

With NativeAOT on `win-x64` or `win-arm64`, Runic Desktop's build targets link
the WebView2 loader statically into the executable, so the publish folder
contains no `WebView2Loader.dll`
([`Runic.Desktop.targets`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Desktop/buildTransitive/Runic.Desktop.targets)).
A JIT build (self-contained or framework-dependent) copies
`WebView2Loader.dll` next to the executable; ship it, or Desktop reports
`webview2-loader-unavailable`. Set the Explorer icon of the executable with
the standard `<ApplicationIcon>app.ico</ApplicationIcon>` project property.

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
`Program Files`. To keep browser storage between runs, set
`DesktopWindowOptions.ProfilePath` to a per-user directory such as one below
`Environment.SpecialFolder.LocalApplicationData`.

### Package

- **ZIP**: archive the publish folder. Nothing needs registering.
- **Installer**: any installer that copies a folder works (for example WiX or
  Inno Setup). Add the WebView2 bootstrapper as a prerequisite for Windows 10
  machines that may not have the runtime, and a Start menu shortcut to the
  executable.
- **MSIX**: package the publish folder with `makeappx pack` and an
  `AppxManifest.xml` that declares a full-trust desktop application
  (`EntryPoint="Windows.FullTrustApplication"` and the `runFullTrust`
  capability). The manifest's `Publisher` must equal the subject of the
  signing certificate.

The SDK provides no installer project, MSIX manifest or WebView2 bootstrapper
integration.

### Sign with Authenticode

Sign the executable before packaging it, then sign the installer or MSIX
itself. With NativeAOT the executable is the only binary you build; JIT builds
also contain your own assemblies, which you can sign the same way
(`WebView2Loader.dll` is already signed by Microsoft).

```powershell docs-test=skip:needs-signing-credentials
signtool sign /fd SHA256 /tr <timestamp-url> /td SHA256 /f <certificate.pfx> /p <password> MyApp.exe
signtool verify /pa /v MyApp.exe
```

Code-signing certificates issued today keep their private key on a hardware
token or a cloud signing service; use the `signtool` options your provider
documents instead of `/f` and `/p`.

**Checked with**: Runic CI publishes `Runic.Desktop.WebViewSmoke` on
`windows-latest` with
`dotnet publish -c Release -r win-x64 --self-contained true -p:PublishAot=true`,
asserts that no `WebView2Loader.dll` was published, copies only the `.exe` into
an empty folder and runs it with WebView2. The artifact is unsigned and not
retained. `WinExe`, the installers, MSIX and `signtool` were not executed.

## macOS

### Publish per architecture or universal

```sh docs-test=skip:illustrative-command
dotnet publish -c Release -r osx-arm64 -p:PublishAot=true -o publish/osx-arm64
dotnet publish -c Release -r osx-x64 -p:PublishAot=true -o publish/osx-x64
lipo -create -output MyApp publish/osx-arm64/MyApp publish/osx-x64/MyApp
```

`osx-arm64` is CI-verified; `osx-x64` is packaged but not run by Runic CI.
Ship one bundle per architecture, or combine the two NativeAOT executables
into a universal binary with `lipo` (the `www` folders are identical). The
SDK has no universal-binary support of its own. Desktop supports macOS 15 and
later, the oldest version .NET 10 supports; WKWebView is part of macOS.

Runic Desktop runs the AppKit event loop and makes the process a regular
application, so an unbundled executable already gets a Dock icon and window.
A bundle gives it an identity (bundle ID, name, version, icon), which signing,
notarization, permissions and Launch Services rely on.

### Bundle layout

```text docs-test=skip:diagram
MyApp.app/
  Contents/
    Info.plist
    MacOS/
      MyApp
    Resources/
      MyApp.icns
      www/
```

Apple expects only code under `Contents/MacOS`. Put the frontend under
`Contents/Resources` and point the content root there on macOS, or embed the
frontend with Runic Assets so that the bundle holds only the executable:

```csharp docs-test=skip:illustrative-fragment
var root = OperatingSystem.IsMacOS()
    ? Path.Combine(AppContext.BaseDirectory, "..", "Resources", "www")
    : Path.Combine(AppContext.BaseDirectory, "www");
```

### Info.plist

The SDK's CI fixture
([`Info.plist`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/tests/native/platform-sandbox/Info.plist))
uses the bundle identifier, name, executable, package type, version and
`NSHighResolutionCapable`. For a shipped application, also set the
user-visible version, the minimum macOS version and the icon:

```xml docs-test=skip:illustrative-project-setting
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.example.myapp</string>
  <key>CFBundleName</key><string>MyApp</string>
  <key>CFBundleExecutable</key><string>MyApp</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleIconFile</key><string>MyApp</string>
  <key>LSMinimumSystemVersion</key><string>15.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
```

Runic Desktop loads the page from `http://127.0.0.1:<port>`. The CI fixture
declares no App Transport Security exceptions.

### Sign with the hardened runtime

Notarization requires a Developer ID Application certificate, the hardened
runtime (`--options runtime`) and a secure timestamp. Sign nested code first
and the bundle last; a NativeAOT build has a single executable, so signing the
bundle covers it:

```sh docs-test=skip:needs-signing-credentials
codesign --force --options runtime --timestamp --entitlements MyApp.entitlements \
  --sign "Developer ID Application: Example Ltd (TEAMID)" MyApp.app
codesign --verify --strict --verbose=2 MyApp.app
```

A NativeAOT executable generates no code at run time, so it needs no JIT
entitlement under the hardened runtime. A JIT build does: start from
Microsoft's .NET guidance for the hardened runtime, which includes
`com.apple.security.cs.allow-jit`. Prefer NativeAOT on macOS.

The entitlements file is optional outside the App Sandbox. For a sandboxed
application (required for the Mac App Store), the CI fixture's
[`entitlements.plist`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/tests/native/platform-sandbox/entitlements.plist)
is the tested starting point: `com.apple.security.app-sandbox`,
`com.apple.security.network.server` and `com.apple.security.network.client`
for the loopback listener and its WebSocket, and
`com.apple.security.files.user-selected.read-write` for files chosen in Runic
file dialogs.

### Notarize and staple

```sh docs-test=skip:needs-signing-credentials
ditto -c -k --keepParent MyApp.app MyApp.zip
xcrun notarytool submit MyApp.zip --keychain-profile <profile> --wait
xcrun stapler staple MyApp.app
spctl --assess --type execute --verbose MyApp.app
```

Create the keychain profile once with `xcrun notarytool store-credentials`.
Staple the `.app`, then distribute it as a ZIP or inside a signed and
notarized disk image. Use `xcrun notarytool log <submission-id>` to read why a
submission was rejected.

**Checked with**: for changes that affect the native layer, Runic CI publishes
`Runic.Platform.Runtime.Tests` (a NativeAOT application whose native window is
a Runic Desktop WKWebView) on `macos-26` with
`dotnet publish -c Release -r osx-arm64 --self-contained true -p:PublishAot=true`,
copies the fixture `Info.plist` into `RunicPlatform.app/Contents`, signs it
ad hoc with the sandbox entitlements
(`codesign --force --deep --sign - --entitlements ...`), verifies it with
`codesign --verify --deep --strict` and retains it as the
`platform-sandbox-osx-arm64-<run>` artifact. That bundle keeps the publish
folder in `Contents/MacOS` and is only for
[manual permission tests](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/tests/native/platform-sandbox/README.md).
The example Info.plist parses with Python's `plistlib`. Developer ID signing,
the hardened runtime, `notarytool`, `stapler`, `lipo`
and `osx-x64` were not executed: they need an Apple Developer account or an
Intel Mac.

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
application ID, with icons in the hicolor theme under the same name:

```ini docs-test=skip:illustrative-fragment
[Desktop Entry]
Type=Application
Name=MyApp
Exec=myapp
Icon=com.example.MyApp
Categories=Utility;
```

Install it as `share/applications/com.example.MyApp.desktop`, and the icons
as `share/icons/hicolor/<size>x<size>/apps/com.example.MyApp.png` (or
`scalable/apps/com.example.MyApp.svg`). With GTK 4, pass the same ID to
`WithGtk4("com.example.MyApp")` so the desktop can match windows to the entry.
Check the entry with `desktop-file-validate`.

### Flatpak

Flatpak is the Linux path the SDK has tested. Its
[sandbox fixture](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/tests/native/Runic.Desktop.Gtk4.Smoke/flatpak/README.md)
runs a NativeAOT GTK 4 application on the standard `org.gnome.Platform` 50
runtime, which provides GTK 4 and WebKitGTK 6, with WebKit's own nested
sandbox enabled. Use `--host desktop-gtk4` for Flatpak. The fixture is a test
application, not a packaging recipe, but its
[`install.sh`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/tests/native/Runic.Desktop.Gtk4.Smoke/flatpak/install.sh)
shows the parts an application needs:

- The executable and `www` under `/app` (the fixture uses `/app/lib/runic/`
  and a launcher script in `/app/bin/`).
- `runtime=org.gnome.Platform/x86_64/50` and `sdk=org.gnome.Sdk/x86_64/50` in
  the metadata, and a desktop entry under `/app/share/applications/`.
- The finish arguments
  `--socket=wayland` (or `--socket=x11`), `--share=network` for Runic's
  loopback bridge, and `--device=dri`.

Inside Flatpak the GTK 4 runner takes the application ID from `FLATPAK_ID`;
an explicit `WithGtk4(...)` ID must match it, or Desktop throws. File dialogs
must go through the XDG portal: the GTK 4 template already references
`Runic.Platform.Linux.Portal` (see [desktop services](../desktop-services.md)).
Publish to Flathub or your own repository with a `flatpak-builder` manifest
that installs the published files with the same layout and finish arguments,
and sign the repository with `flatpak build-export --gpg-sign=<key-id>`.

The SDK provides no `flatpak-builder` manifest, AppStream metadata or
repository signing. The GTK 3 `desktop` host has not been tested in Flatpak.

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
paths. The artifact is unsigned and not retained. The Flatpak fixture is run
by hand in the SDK's
[container runner](container-automation.md), not in CI; its README records the
verified runtime commit. The example desktop entry passes
`desktop-file-validate`. `flatpak-builder`, repository signing, AppImage and
distribution packages were not executed.

## Not provided by the SDK yet

- A packaging command; `dotnet publish` plus platform tools is the supported
  path for now.
- Installers, MSIX manifests, `.app` bundle generation, Info.plist and
  entitlements templates, `flatpak-builder` manifests, AppStream metadata and
  AppImage recipes.
- Fixed-version WebView2 runtimes.
- A `WinExe` setting for Windows release builds in the template.
- Universal macOS binaries, and CI on `osx-x64`, `win-arm64`, `linux-arm64`
  and musl.
- Signed or notarized CI artifacts, and a published unsigned artifact for
  Windows and Linux.
