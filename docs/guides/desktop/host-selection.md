# Choose a presentation host

The `runic-app` template (and `dnx Runic.Create`, which runs it) asks for the
host: `--host cswebui`, the default, `--host desktop` for Runic Desktop, or
`--host desktop-gtk4` for Runic Desktop with GTK 4 and WebKitGTK 6 on Linux
(`WithGtk4()` from
[`Runic.Desktop.Gtk4`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/packages/dotnet/Runic.Desktop.Gtk4/README.md);
on Windows and macOS it behaves like `desktop`). All use the same Window, Views,
and generated TypeScript clients; only `Program.cs`, the Window class, the host
packages, and the host script in `index.html` differ. Both Desktop hosts start
with `DesktopEventLoop.Run(options, ...)`, which runs the application on the
event loop each platform needs.
For a starter walkthrough, see [getting started](../application/getting-started/README.md)
and the [first Window example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/examples/first-window/README.md).

[`Runic.Application.CsWebUi`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/packages/dotnet/Runic.Application.Views.CsWebUi/README.md)
connects the generated Window and View contracts to a CS-WebUI presentation.
CS-WebUI remains a separately maintained upstream product, and applications can
also use its lower-level API directly.

`Runic.Desktop` is an independent presentation library for browser and embedded
WebView windows. Choose its embedded backend and fallback policy explicitly; its
[package guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/packages/dotnet/Runic.Desktop/README.md) documents native
prerequisites. An existing CS-WebUI project does not switch to Desktop when a provider is
installed; compare a `--host desktop` project to see the changes.

[`Runic.Application.Desktop`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/packages/dotnet/Runic.Application.Desktop/README.md)
connects generated Windows and Views to a Desktop surface. The
[ReactiveUI first-window example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/examples/first-window-desktop/README.md)
shows the browser client and scoped native Window lifetime.
