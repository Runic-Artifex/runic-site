# Choose a presentation host

The `runic-app` template (and `dnx Runic.Create`, which runs it) asks for the
host: `--host desktop`, the default, for Runic Desktop, `--host desktop-gtk4`
for Runic Desktop with GTK 4 and WebKitGTK 6 on Linux (`WithGtk4()` from
[`Runic.Desktop.Gtk4`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Desktop.Gtk4/README.md);
on Windows and macOS it behaves like `desktop`), or `--host cswebui` for a
browser window. All use the same Window declaration, Views, application body
and generated TypeScript clients; only the `Run` call in `Program.cs`, the
host package and the host script in `index.html` differ. `RunicDesktopHost.Run`
runs the application on the event loop each platform needs, and
`RunicCsWebUiHost.Run` runs the same application on CS-WebUI.
[Choosing a host and MVVM library](../application/choosing.md) compares the
hosts and their support levels. For a starter walkthrough, see
[getting started](../application/getting-started/README.md)
and the [first Window example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/first-window/README.md).

[`Runic.Application.Views.Desktop`](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views.Desktop/README.md)
connects generated Windows and Views to a Runic Desktop surface. It is the
default, first-class host: native windows with the embedded WebView, an
installed browser as fallback, and per-window file dialogs, clipboard and file
launcher through `AddRunicPlatformServices()`. The
[ReactiveUI first-window example](https://github.com/Runic-Artifex/runic-sdk/blob/main/examples/first-window-desktop/README.md)
shows the browser client and scoped native Window lifetime.

[`Runic.Application.Views.CsWebUi`](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Application.Views.CsWebUi/README.md)
connects the same contracts to a CS-WebUI presentation, which opens a browser
window: an installed browser in app mode, then the platform WebView. It is
supported on a best-effort basis: its windows have no native owner, so the
platform services report `OwnerUnavailable`. CS-WebUI remains a separately
maintained upstream product, and applications can also use its lower-level API
directly.

`Runic.Desktop` is an independent presentation library for browser and embedded
WebView windows. Choose its embedded backend and fallback policy explicitly; its
[package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/packages/dotnet/Runic.Desktop/README.md) documents native
prerequisites. An existing CS-WebUI project does not switch to Desktop when a provider is
installed; change its `Run` call, host package and host script, or compare a
`--host desktop` project to see the changes.

To distribute a Desktop application, see
[ship a Desktop application](shipping.md): publish modes, the WebView runtime
each platform needs, macOS bundles with signing and notarization, Windows
signing and installers, and Flatpak on Linux.
