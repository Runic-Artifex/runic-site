# Desktop preferences, notifications, file handoff, and clipboard

`Runic.Platform` defines typed, host-independent contracts. Select an OS provider
explicitly from `Runic.Platform.Windows`, `Runic.Platform.Linux`, or
`Runic.Platform.MacOS`. These provider packages do not discover the operating
system provider or add a generic application-host registration layer.

Factories such as `WindowsPlatformProvider.CreateNotifications(...)` and
`LinuxPlatformProvider.CreateSettings()` return services that the caller owns and
disposes. Native file dialogs, file launchers, and clipboard providers also need
a verified presentation owner. For an embedded Runic Desktop window, use the
shipped owner in `Runic.Application.Views.Desktop`: each opened Window's `Host`
is a `DesktopBridgeWindow<TViewModel>` that exposes `NativeOwner`, and
`new DesktopNativeOwner(desktopWindow)` creates one for a `DesktopWindow` opened
without Views. Pass it to the provider, for example
`LinuxPlatformProvider.CreateFileDialogs(workspace.NativeOwner)`, where
`workspace` is the opened bridge window. The owner runs provider callbacks on
the window's native thread and becomes unavailable when that window closes or is
replaced. `DesktopNativeOwner.IsAvailable` is false for any window without native
dispatch, such as an installed browser after fallback or a custom host without a
native handle. Do not retain native handles beyond the callback or send native
handles and leases to the browser. Non-Desktop hosts, such as CS-WebUI and custom window
hosts, still implement `INativePickerOwner` over their own dispatcher.

In a Runic Application Views app, `services.AddRunicPlatformServices()` does
this for you, as the template does. It registers `IFileDialogs`,
`ITextClipboard`, `IDesktopFileLauncher` and `IWindowPlatformServices` per
Window; a ViewModel takes them in its constructor, and they bind to the
Window's native owner when it opens, with the provider for the running platform
and backend. Until then, on CS-WebUI, which has no native owner, and in a
`RunicDesktopHost` run with `RUNIC_APPLICATION_SERVE_ONLY=1`, which opens no
window, they report `OwnerUnavailable`. It also registers `IDesktopSettings` once for
the application, created from the provider for the running platform; see
[App settings and desktop preferences](application/samples/settings.md).
An application that targets `net10.0-windows`, such as a WPF application, gets
an assembly of `Runic.Application.Views.Desktop` that references only
`Runic.Platform.Windows`, so it doesn't ship the Linux and macOS providers.

`AddRunicPlatformServices()` also registers one `IDesktopNotifications` for the
application, so a ViewModel takes it in its constructor without an
`OperatingSystem` branch. Pass the application ID, as in
`services.AddRunicPlatformServices("org.example.Notes")`: on Windows the
AppUserModelID your installer registers with the shell, on Linux the
reverse-DNS ID of the installed desktop entry (`org.example.Notes` for
`org.example.Notes.desktop`); macOS uses the bundle identifier. Without an ID,
the Linux portal infers the identity from the desktop session, which suits
development, and Windows requests return `Unavailable(ProviderNotConfigured)`,
as do requests through CS-WebUI's registration. Portal diagnostics of these
notifications are logged as event 2003. To compose the service yourself, call
`PlatformServices.CreateNotifications(applicationId)`. Notifications through
`AddRunicPlatformServices()` are new in SDK `0.7.0-preview.8`; see the
[Runic.Application.Views.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Application.Views.Desktop/README.md).

Create and dispose owner-bound services while the native event loop is running.
Provider shutdown drains native callbacks and resource releases; close the native
window only after that cleanup has completed.

The APIs separate picker dismissal (`PickerResult<T>`) from operation success,
unavailability, and failure (`PlatformResult<T>`). File selection returns C#
leases; saves use a staged transaction and report known or uncertain commit
outcomes. `PresentationLifetime` tracks admitted work, and the shared runtime
releases leases and provider resources during disposal.

Linux file dialogs use XDG portals by default with GTK 3 parenting.
`LinuxPlatformProvider.CreateFileDialogs(owner)` is for Linux with GTK 3
only: it parents through GTK 3 and must not be used with a GTK 4 window. GTK-native
choosers are a separate explicit compatibility choice for unsandboxed apps. GTK 4
applications should use the GTK 4 portal adapter, for example
`PortalPlatformProvider.CreateFileDialogs(Gtk4PlatformProvider.CreatePortalWindowOwner(owner))`,
and must not load GTK 3 just to open a file. Windows notifications require shell registration for the chosen
AppUserModelID. macOS notifications use the application bundle identity.

The [runtime conformance suite](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/tests/dotnet/Runic.Platform.Runtime.Tests/README.md)
checks portable ownership, cancellation, leases, and file transactions. Its
`--native-services` mode is an interactive OS smoke; portable conformance does
not certify native UI behavior. Provider READMEs record platform dependencies
and native verification status.

## Directory selection

SDK `0.7.0-preview.6` provides the
`IFileDialogs.OpenDirectoryAsync(OpenDirectoryOptions, CancellationToken)`
contract and the `platform.directories.open` capability. A successful selected
`IDirectoryLease` has `DisplayName` and `LocalPath`; keep the lease alive while
the application's C# filesystem work uses the path and dispose it afterwards.
The lease retains native access until disposal or presentation close. Native
grants and lease objects stay in C#; publish application DTOs to the frontend.

Dismissal, caller cancellation and owner closure remain different results:
`Dismissed`, `OperationCanceledException` and `Unavailable(OwnerClosed)`.
Existing file-only implementations remain compatible and return directory
selection unavailable. Treat an unavailable provider or browser-only owner as
an application state, and retain an appropriate fallback.

Use the provider matching the presentation backend; see the
[Platform contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Platform/README.md).

## Status icon, single instance and login startup

`AddRunicPlatformServices(id)` also registers `IDesktopStatusIcon` and
`IDesktopLoginStartup`, and `ApplicationInstance.ClaimAsync` makes the first
launch the primary instance. Since SDK `0.8.0-preview.1`, the status icon,
login startup and `PlatformServices.PresentAsync` work on Linux, Windows and
macOS. The
[status icon example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/examples/status-icon/README.md)
starts without a window, shows the icon with a menu, and brings its Window
forward when the application is launched again. The provider READMEs describe
each platform:
[Windows](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Platform.Windows/README.md#status-icon-and-window-presentation)
and
[macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Platform.MacOS/README.md#status-icon).
On macOS, Runic Desktop also adds the standard application, Edit, View and
Window menus unless the application supplies its own; see
[keyboard and zoom in embedded windows](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Desktop/README.md#keyboard-and-zoom-in-embedded-windows).

## Privileged actions

`IDesktopPrivilegedActions` runs a step that the application declared at build
time as a `RunicPrivilegedAction` item, a fixed program with bounded arguments,
as the administrator after the platform's authorization prompt. It is new in
SDK `0.8.0-preview.1`. Start with the
[contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Platform/README.md#privileged-actions),
then follow the provider for each platform:
[Polkit on Linux](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Platform.Linux.Polkit/README.md)
(`Runic.Platform.Linux.Polkit`),
[UAC on Windows](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Platform.Windows.Elevation/README.md)
(`Runic.Platform.Windows.Elevation`) and
[a launch daemon on macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Platform.MacOS/README.md#privileged-actions).
The [design and security review](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/specs/platform/privileged-operations.md)
records the threat model. [Nix packaging](desktop/nix-packaging.md#run-time-and-privileged-actions)
installs the Polkit policy with the application.

## Watching files

`RunicPathWatcher` in `Runic.Application.Views` watches files, symbolic links,
directory entries and a Git checkout's `HEAD`, and calls back in a turn of the
model context, so a ViewModel refreshes when they change. It is new in SDK
`0.8.0-preview.1`; see
[Watching files](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Application.Views/README.md#watching-files)
and, for tests on a fake clock,
[`RunicPathWatchTester`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.8.0-preview.1/packages/dotnet/Runic.Application.Testing/README.md#file-watchers).
