# Choose a presentation host

The `runic-app` template (and `dnx Runic.Create`, which runs it) asks for the
host: `--host desktop`, the default, for Runic Desktop, or `--host cswebui` for
a browser window. With `--host desktop`, `--linux-gtk 4` selects GTK 4 and
WebKitGTK 6 on Linux instead of the default GTK 3 (`WithGtk4()` from
[`Runic.Desktop.Gtk4`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop.Gtk4/README.md));
Windows and macOS are the same with either. All use the same Window declaration, Views, application body
and generated TypeScript clients; only the `Run` call in `Program.cs`, the
host package and the host script in `index.html` differ. `RunicDesktopHost.Run`
runs the application on the event loop each platform needs, and
`RunicCsWebUiHost.Run` runs the same application on CS-WebUI.
[Choosing a host and MVVM library](../application/choosing.md) compares the
hosts and their support levels. For a starter walkthrough, see
[getting started](../application/getting-started/README.md)
and the [first Window example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/examples/first-window/README.md).

[`Runic.Application.Views.Desktop`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Views.Desktop/README.md)
connects generated Windows and Views to a Runic Desktop surface. It is the
default, first-class host: native windows with the embedded WebView, an
installed browser as fallback, and per-window file dialogs, clipboard and file
launcher through `AddRunicPlatformServices()`. The
[ReactiveUI first-window example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/examples/first-window-desktop/README.md)
shows the browser client and scoped native Window lifetime.

[`Runic.Application.Views.CsWebUi`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Views.CsWebUi/README.md)
connects the same contracts to a CS-WebUI presentation, which opens a browser
window: an installed browser in app mode, then the platform WebView. It is
supported on a best-effort basis: its windows have no native owner, so the
platform services report `OwnerUnavailable`. Since SDK `0.11.0`, a CS-WebUI
window declares a menu bar with `RunicCsWebUiHostOptions.MenuBar`, which its
pages render with `createMenuBarController` (see
[menus](../desktop-services.md#menus)), and the host needs CsWebUi
`2.5.0-beta.4.8` or later. Since SDK `0.15.0`, it serves an embedded frontend
(`RunicApplicationFrontendDelivery=Embedded`) from the assembly, without
extracting it to disk, and `RunicCsWebUiHostOptions.Assets` serves another
asset source, as `RunicDesktopHostOptions.Assets` does. CS-WebUI remains a
separately maintained upstream product, and applications can also use its
lower-level API directly.

`Runic.Desktop` is an independent presentation library for browser and embedded
WebView windows. Choose its embedded backend and fallback policy explicitly; its
[package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md) documents native
prerequisites. An existing CS-WebUI project does not switch to Desktop when a provider is
installed; change its `Run` call, host package and host script, or compare a
`--host desktop` project to see the changes.

To distribute a Desktop application, see
[ship a Desktop application](shipping.md): publish modes, the WebView runtime
each platform needs, and `dotnet runic package` for MSIX on Windows, signed
and notarized bundles and Mac App Store packages on macOS, and Flatpak, AppImage, deb and rpm packages on
Linux.

## Presentation server

Runic Desktop serves each window's page from a loopback server. Since SDK
`0.15.0`, `Runic.Desktop` carries no server and no ASP.NET Core reference, and
the executable references the server it uses:

- `Runic.Desktop.NativeServer`, a native HTTP and WebSocket server written in
  Rust, which needs no ASP.NET Core. `dotnet new runic-app` and
  `dnx Runic.Create` use it for new Runic Desktop projects, and it becomes the
  default Desktop server at 1.0. A framework-dependent application then needs
  only the .NET runtime, a self-contained one carries no
  `Microsoft.AspNetCore.*` files, and a NativeAOT executable links the server
  statically and stays one file.
- `Runic.Desktop.Kestrel`, ASP.NET Core Kestrel, the server of SDK `0.14` and
  earlier, for an application that uses ASP.NET Core itself: its own
  endpoints, ASP.NET Core packages, or `IConfiguration`, `IHostEnvironment`
  and `IHostApplicationLifetime` from `DesktopHostOptions.ConfigureServices`.
  On the native server that callback receives a plain service collection with
  logging. `RunicDesktopMinimalHost` applies only to Kestrel.

The template references the native server next to the Desktop adapter:

```xml docs-test=template:RunicWindowApp.csproj
<PackageReference Include="Runic.Application.Views.Desktop" Version="<VERSION>" />
<!-- The server Runic Desktop serves the page from: the native server, without ASP.NET Core. Runic.Desktop.Kestrel
     replaces it for an application that uses ASP.NET Core itself. -->
<PackageReference Include="Runic.Desktop.NativeServer" Version="<VERSION>" />
```

`--desktop-server kestrel` creates the project with `Runic.Desktop.Kestrel`
instead:

```xml docs-test=template:RunicWindowApp.csproj desktop-server=kestrel
<!-- The server Runic Desktop serves the page from: ASP.NET Core Kestrel. -->
<PackageReference Include="Runic.Desktop.Kestrel" Version="<VERSION>" />
```

To switch later, replace one package with the other at the same version. A
library that references Runic Desktop references neither; the executable
chooses. Without a server package, an executable fails to build with
[`RUNICDESK004`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/diagnostics.md#runicdesk004).
The `RunicDesktopServer` property selects `Native` or `Kestrel` in a project
that references both, for comparing them (`Native` unless set), and `None`
declares an executable that opens no Runic Desktop window, such as a code
generator. The native server's
[README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop.NativeServer/README.md)
compares the two on size, start time and memory, and lists its runtime
identifiers and what differs from Kestrel. [Nix packaging](nix-packaging.md)
builds the native server from source.

## Fallback presentations

A window opens in the embedded WebView unless it selects a browser.
`EmbeddedThenBrowser`, Runic Desktop Views' default, falls back to one
installed browser when the WebView cannot open. Since SDK `0.15.0`,
`DesktopWindowOptions.Fallbacks` lists the presentations to try, in order:

```csharp docs-test=readme:packages/dotnet/Runic.Desktop/README.md
var window = await surface.OpenWindowAsync(new DesktopWindowOptions
{
    Browser = BrowserKind.Embedded,
    Fallbacks = [BrowserKind.ChromiumBased, BrowserKind.Firefox],
});
```

A non-empty `Fallbacks` replaces the browser of `EmbeddedThenBrowser`, and a
chain that repeats a presentation is `window-option-invalid`. Each failed
presentation is a warning (`embedded-presentation-fallback`, or
`presentation-fallback` for a browser). When none opens, `OpenWindowAsync`
throws a `DesktopPresentationException`, a `DesktopException` whose `Attempts`
list each presentation with the exception it failed with, such as
`browser-not-found`. `DesktopPresentationPreflight.Fallbacks` reports the
availability of each fallback without opening anything. A browser fallback
opens without `ConfirmCloseAsync` and permission grants; see
[window close confirmation](window-close-lifecycle.md).

## The early first window on Windows

Creating the WebView2 environment and controller usually takes well under a
second, but the first start after a WebView2 runtime or Windows update can
take tens of seconds on a cold disk. Since SDK `0.15.0`, a WebView2 window
that is not ready within 1.5 seconds appears with a loading surface: the
window's placement, size, maximized or full-screen state and icon, the title
`Loading…` until the page sets one, the background of
`DesktopWindowOptions.ColorScheme` (or the Windows app theme or high-contrast
colors), and an indeterminate progress bar. The WebView takes its place once
it exists. A start within 1.5 seconds shows the window when WebView2 is ready,
as before; a `Hidden` window stays hidden and a `Transparent` one waits for
WebView2. There is no option.

The connection timeout starts at the WebView's first navigation, so a slow
WebView2 start delays the window but does not use up `ConnectionTimeout`.
Closing the window while it loads closes it without asking `ConfirmCloseAsync`,
as no page has loaded: `OpenWindowAsync` returns the window closed (`IsOpen` is
`false`), and no fallback presentation opens. UI automation that finds the
window should wait for the page's document or title, not only the window.
