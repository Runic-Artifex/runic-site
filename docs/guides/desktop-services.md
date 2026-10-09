# Desktop preferences, notifications, file handoff, and clipboard

`Runic.Platform` defines typed, host-independent contracts. Select an OS provider
explicitly from `Runic.Platform.Windows`, `Runic.Platform.Linux`, or
`Runic.Platform.MacOS`. These provider packages do not discover the operating
system provider or add a generic application-host registration layer.

Factories such as `WindowsPlatformProvider.CreateNotifications(...)` and
`LinuxPlatformProvider.CreateSettings()` return services that the caller owns and
disposes. Native file dialogs, file launchers, and clipboard providers also need
a verified presentation owner. For an embedded Runic Desktop window, use the
shipped owner in `Runic.Application.Desktop`: each opened Window exposes
`DesktopBridgeWindow<TViewModel>.NativeOwner`, and
`new DesktopNativeOwner(desktopWindow)` creates one for a `DesktopWindow` opened
without Views. Pass it to the provider, for example
`LinuxPlatformProvider.CreateFileDialogs(workspace.NativeOwner)`, where
`workspace` is the opened bridge window. The owner runs provider callbacks on
the window's native thread and becomes unavailable when that window closes or is
replaced. `DesktopNativeOwner.IsAvailable` is false for any window without native
dispatch, such as an installed browser after fallback or a custom host without a
native handle. Do not retain native handles beyond the callback or send paths and
handles to the browser. Non-Desktop hosts, such as CS-WebUI and custom window
hosts, still implement `INativePickerOwner` over their own dispatcher.

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

The [runtime conformance suite](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/tests/dotnet/Runic.Platform.Runtime.Tests/README.md)
checks portable ownership, cancellation, leases, and file transactions. Its
`--native-services` mode is an interactive OS smoke; portable conformance does
not certify native UI behavior. Provider READMEs record platform dependencies
and native verification status.

## Directory selection

Published `0.7.0-preview.5` file dialogs provide read/save file leases. They have
no directory-selection contract; a file's display name is not an exact directory
path or access grant. Apps needing folder selection on that release own an
adapter and its native lifetime, or accept a typed path.

SDK development adds the unreleased
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

This API is absent from the published catalog. Adopt a deliberately built
candidate or a release that contains it before using it; see the
[Platform contract](https://github.com/Runic-Artifex/runic-sdk/blob/d230f42e391bf778649eb827191aa56edbeb1372/packages/dotnet/Runic.Platform/README.md).
