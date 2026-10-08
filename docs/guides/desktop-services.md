# Desktop preferences, notifications, file handoff, and clipboard

`Runic.Platform` defines typed, host-independent contracts. Select an OS provider
explicitly from `Runic.Platform.Windows`, `Runic.Platform.Linux`, or
`Runic.Platform.MacOS`. These provider packages do not discover the operating
system provider or add a generic application-host registration layer.

Factories such as `WindowsPlatformProvider.CreateNotifications(...)` and
`LinuxPlatformProvider.CreateSettings()` return services that the caller owns and
disposes. Native file dialogs, file launchers, and clipboard providers also need
a verified presentation owner. For an embedded Runic Desktop window, use the
shipped owner (unreleased; `Runic.Application.Desktop` 0.7.0-preview.3): each
opened Window exposes `DesktopBridgeWindow<TViewModel>.NativeOwner`, and
`new DesktopNativeOwner(window)` creates one for a `DesktopWindow` opened without
Views. Pass it to the provider, for example
`LinuxPlatformProvider.CreateFileDialogs(window.NativeOwner)`. The owner runs
provider callbacks on the window's native thread and becomes unavailable when
that window closes or is replaced. It is unavailable for installed-browser
presentations. Do not retain native handles beyond the callback or send paths
and handles to the browser.

Create and dispose owner-bound services while the native event loop is running.
Provider shutdown drains native callbacks and resource releases; close the native
window only after that cleanup has completed.

The APIs separate picker dismissal (`PickerResult<T>`) from operation success,
unavailability, and failure (`PlatformResult<T>`). File selection returns C#
leases; saves use a staged transaction and report known or uncertain commit
outcomes. `PresentationLifetime` tracks admitted work, and the shared runtime
releases leases and provider resources during disposal.

Linux file dialogs use XDG portals by default with GTK3 parenting. GTK-native
choosers are a separate explicit compatibility choice for unsandboxed apps. GTK4
applications should use the GTK4 portal adapter and must not load GTK3 just to
open a file. Windows notifications require shell registration for the chosen
AppUserModelID. macOS notifications use the application bundle identity.

The [runtime conformance suite](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.2/tests/dotnet/Runic.Platform.Runtime.Tests/README.md)
checks portable ownership, cancellation, leases, and file transactions. Its
`--native-services` mode is an interactive OS smoke; portable conformance does
not certify native UI behavior. Provider READMEs record platform dependencies
and native verification status.
