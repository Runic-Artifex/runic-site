# Desktop preferences, notifications, file handoff, and clipboard

`Runic.Platform` defines typed, host-independent contracts. Select an OS provider
explicitly: `WindowsPlatformProvider` from `Runic.Platform.Windows`,
`MacOSPlatformProvider` from `Runic.Platform.MacOS`, or, on Linux,
`PortalApplication` from `Runic.Platform.Linux.Portal`. These provider packages
do not discover the operating system provider or add a generic
application-host registration layer.

Factories such as `WindowsPlatformProvider.CreateNotifications(...)` and
`new PortalApplication(applicationId).CreateSettings()` return
application-scoped services that the caller owns and disposes. Native file
dialogs, file launchers, and the clipboard belong to a window, and Runic's hosts
create them. For an embedded Runic Desktop window, each opened Window's `Host`
is a `DesktopBridgeWindow<TViewModel>` that exposes `NativeOwner`, and
`new DesktopNativeOwner(desktopWindow)` creates one for a `DesktopWindow` opened
without Views. Pass it to `DesktopPlatformServices.ForWindow(owner)` in
`Runic.Application.Views.Desktop`, for example
`DesktopPlatformServices.ForWindow(workspace.NativeOwner)`, where `workspace` is
the opened bridge window, to get that window's services. The owner runs provider callbacks on
the window's native thread and becomes unavailable when that window closes or is
replaced. `DesktopNativeOwner.IsAvailable` is false for any window without native
dispatch, such as an installed browser after fallback or a custom host without a
native handle. Do not retain native handles beyond the callback or send native
handles and leases to the browser. Before SDK `0.9.0`, the providers had
owner-scoped factories such as `LinuxPlatformProvider.CreateFileDialogs(owner)`.

In a Runic Application Views app, `services.AddRunicPlatformServices()` does
this for you, as the template does. It registers `IFileDialogs`,
`ITextClipboard`, `IDesktopFileLauncher` and `IWindowPlatformServices` per
Window; a ViewModel takes them in its constructor, and they bind to the
Window's native owner when it opens, with the provider for the running platform
and backend. Until then, on CS-WebUI, which has no native owner, and in a
`RunicDesktopHost` run with `RUNIC_APPLICATION_SERVE_ONLY=1` or
`RunicDesktopHostOptions.ServeOnly`, which opens no window, they report
`OwnerUnavailable`; the application's own services work without a window (see
[without a window](#without-a-window)). It also registers `IDesktopSettings` once for
the application, created from the provider for the running platform; see
[App settings and desktop preferences](application/samples/settings.md).
An application that targets `net10.0-windows`, such as a WPF application, gets
an assembly of `Runic.Application.Views.Desktop` that references only
`Runic.Platform.Windows`, so it doesn't ship the Linux and macOS providers.

Since SDK `0.11.0`, `AddRunicPlatformServices()` also registers the window
services `IDesktopClipboard`, `IDesktopMonitors` and `IDesktopMessageBoxes`,
and the application services for network status, global shortcuts and file
bookmarks, plus open registration when you pass an application ID; see
[more platform services](#more-platform-services). It registers them with
`TryAdd`, so a service you registered first wins. CS-WebUI registers
unavailable ones. `DesktopServiceStatus.Get(service)` tells whether an
application-scoped service can be used at all, for example to decide whether to
offer a feature; the result of each request still reports what happened.

`AddRunicPlatformServices()` also registers one `IDesktopNotifications` for the
application, so a ViewModel takes it in its constructor without an
`OperatingSystem` branch. Pass the application ID, as in
`services.AddRunicPlatformServices("org.example.Notes")`: on Windows the
AppUserModelID your installer registers with the shell, on Linux the
reverse-DNS ID of the installed desktop entry (`org.example.Notes` for
`org.example.Notes.desktop`); macOS uses the bundle identifier. Since
`0.8.0-preview.5`, an application installed from an MSIX package uses its
package's AppUserModelID and ignores the ID (see
[identity in a package](desktop/shipping.md#identity-in-a-package-and-without-one)).
Without an ID,
the Linux portal infers the identity from the desktop session, which suits
development, and Windows requests return `Unavailable(ProviderNotConfigured)`,
as do requests through CS-WebUI's registration. Portal diagnostics of these
notifications are logged as event 2003. To compose the service yourself, call
`DesktopPlatformServices.CreateNotifications(applicationId)`. Notifications through
`AddRunicPlatformServices()` are new in SDK `0.7.0-preview.8`; see the
[Runic.Application.Views.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Views.Desktop/README.md).

Since SDK `0.11.0`, `DesktopNotificationActivation.IsTrusted` is `true` when
the provider matched the activation to a notification the application showed.
On Linux any process on the session bus can send an activation, so one that
matches no notification of the running process, such as one that arrives after
a restart, is untrusted and keeps its link only for `http`, `https` or `mailto`.
Check the identifiers of an activation with `IsTrusted == false` against the
application's own state before acting on it.

Create and dispose owner-bound services while the native event loop is running.
Provider shutdown drains native callbacks and resource releases; close the native
window only after that cleanup has completed.

The APIs separate picker dismissal (`PickerResult<T>`) from operation success,
unavailability, and failure (`PlatformResult<T>`). File selection returns C#
leases; saves use a staged transaction and report known or uncertain commit
outcomes. The shared runtime tracks admitted work and releases leases and
provider resources during disposal. Since SDK `0.11.0`, `PlatformResult<T>`
has `Succeeded`, `TryGetValue(out T value)` and `Match`, and
`PickerResult<T>` has `TryGetValue` and `Match`, for code that needs only the
value; see the
[Platform contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md).
Since SDK `0.12.0`, a save lease writes as often as the application saves, and
document leases keep working on an opened file; see [documents](#documents).

Linux file dialogs use XDG portals, parented to the window by the host with the
window's GTK version: `Runic.Platform.Linux` serves GTK 3 windows and
`Runic.Platform.Linux.Gtk4` GTK 4 windows, and a GTK 4 process never loads
GTK 3. Windows notifications require shell registration for the chosen
AppUserModelID. macOS notifications use the application bundle identity.

The [runtime conformance suite](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/tests/dotnet/Runic.Platform.Runtime.Tests/README.md)
checks portable ownership, cancellation, leases, and file transactions. Its
`--native-services` mode is an interactive OS smoke; portable conformance does
not certify native UI behavior. Provider READMEs record platform dependencies
and native verification status.

## Without a window

Since SDK `0.14.0`, the application has platform services of its own that need
no window: `IApplicationPlatformServices` in `Runic.Platform`. Its
`FileLauncher` opens URIs and files, reveals files and offers the application
chooser, and its `MessageBoxes` show message boxes, before the first window
opens, while every window is closed, behind a status icon and for Windows served
to a browser. `AddRunicPlatformServices()` registers it as the one instance of
`DesktopPlatformServices.ForApplication()`; CS-WebUI registers
`ApplicationPlatformServices.Unavailable(ProviderNotConfigured)`. A service
without a window of its own, such as a help link handler or a background
download, takes it in its constructor:

```csharp docs-test=readme:packages/dotnet/Runic.Platform/README.md
public sealed class Downloads(IApplicationPlatformServices platform)
{
    public ValueTask<PlatformResult<PlatformUnit>> ShowAsync(string file) =>
        platform.FileLauncher.LaunchAsync(file, DesktopFileOperation.Reveal);
}
```

Code that runs before the container exists, such as a fatal start-up error,
calls `ForApplication()` directly. A box without a window asks for
`OwnerPolicy.PreferOwner`; with the default `RequireOwner` it reports
`OwnerUnavailable`:

```csharp docs-test=readme:packages/dotnet/Runic.Platform/README.md
var platform = DesktopPlatformServices.ForApplication();   // or IApplicationPlatformServices from the container
await platform.MessageBoxes.ShowAsync(new DesktopMessageBox("The settings cannot be read.")
{
    Detail = error.Message, Kind = DesktopMessageBoxKind.Error, OwnerPolicy = OwnerPolicy.PreferOwner,
});
```

Windows uses the shell and a task dialog on an STA thread of the application's
own, Linux the OpenURI portal without a parent window and a GTK dialog once the
toolkit's loop runs (`BackendUnavailable` before), and macOS NSWorkspace and an
application-modal `NSAlert` on the main thread. Prefer a window's own
`FileLauncher` while that window is shown, so the desktop can place an
application chooser over it. Replace `Process.Start` with `UseShellExecute`,
`xdg-open` or a P/Invoked `MessageBoxW` with these services.

Development builds of 0.14 had `DesktopPlatformServices.OpenUriAsync(uri)` for
this; 0.14.0 does not ship it. Use
`DesktopPlatformServices.ForApplication().FileLauncher.LaunchUriAsync(uri)` or
`IApplicationPlatformServices` instead, with the launcher's URI policy and
`PlatformResult`.

Since SDK `0.14.0`, a window shown in an installed browser after an
embedded-window fallback can still import and export files. Ask for its dialogs
with `OwnerPolicy.PreferOwner`: an owned window shows its owned dialog as
before, and the browser presentation shows an unowned one. The capability
`platform.dialogs.owned` is available for owned dialogs and
`platform.dialogs.unowned` while `PreferOwner` shows unowned ones; the file
capabilities, such as `platform.files.open`, then describe the unowned dialogs
and can be `Available`. `RequireOwner`, the default, still reports
`OwnerUnavailable`, and so does a Window served under serve-only mode or on
CS-WebUI, whose browser may run on another computer. Such a window's launcher
and `PreferOwner` message boxes go through the application's services. File
dialogs also take a title (`OpenFileOptions.Title`, `OpenDirectoryOptions.Title`
and `SaveFileOptions.Title`); macOS, whose panels show no title, shows it as the
panel's message:

```csharp docs-test=readme:packages/dotnet/Runic.Platform/README.md
var options = new OpenFileOptions(OwnerPolicy.PreferOwner) { Title = "Import backup", Filters = [backups] };
if (await files.OpenFileAsync(options) is PickerResult<IReadFileLease>.Selected(var backup))
    await using (backup) { /* restore */ }
```

An application that serves its Windows to a browser on purpose, such as for a
`--browser` command, sets `RunicDesktopHostOptions.ServeOnly = true` (since SDK
`0.14.0`), the same mode as `RUNIC_APPLICATION_SERVE_ONLY=1` without an
environment variable that child processes inherit. `RunicDesktopHost.Run`
then starts no window toolkit loop, since SDK `0.15.0` also on macOS, where
the process then has no Dock icon and gets no open-document or open-URL
events. The application's launcher opens the served page:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.Desktop/README.md
return RunicDesktopHost.Run(provider, new DesktopHostOptions().WithGtk4(),
    new RunicDesktopHostOptions { ServeOnly = true }, async host =>
{
    await using var window = await host.OpenWindowAsync<MainWindow>();
    await DesktopPlatformServices.ForApplication().FileLauncher.LaunchUriAsync(RunicDesktopHost.GetSurface(window)!.Url);
    await window.WaitForCloseAsync();
    return 0;
});
```

See the
[Platform contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md)
for each platform's behaviour.

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

Since SDK `0.14.0`, the Linux portal dialogs check the FileChooser portal's
version when a Window creates them: without a portal on the session bus, or
with one older than version 3, `platform.directories.open` and
`platform.directories.openMultiple` report `BackendUnavailable` before the
first pick instead of `Available` until a pick fails. A later pick checks
again. A custom `INativeDirectoryPicker` reports the same through
`IsDirectorySelectionAvailable` (default `true`).

Since SDK `0.11.0`, `IFileDialogs.OpenDirectoriesAsync` selects several
directories (`IDirectoryLeaseList`). File dialog filters take
`FileDialogFilter.MimeTypes` on macOS and Linux, a selection reports the
filter the user chose as `SelectedFilter`, and `ShowFilterChoice` adds the
filter pop-up to a macOS panel.

Runic's hosts use the provider matching the presentation backend; see the
[Platform contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md).

## Documents

Since SDK `0.12.0`, `IFileDialogs.OpenDocumentAsync(OpenFileOptions)` and
`SaveDocumentAsync(SaveFileOptions)` (Save As) return an `IDocumentFileLease`
for an editor that keeps working on the file the user chose. Each
`OpenReadAsync` reads the current file, and `BeginWriteAsync` saves back to it
as often as the application saves, on Ctrl+S and autosave. This works on
Windows, on Linux with GTK and the FileChooser portal (through document portal
views, also in a Flatpak), and on macOS, including the App Sandbox. The
`platform.files.openDocument` capability reports whether a window's dialogs
return documents; code that compares a whole capability snapshot's key set
updates it.

Every save lease now writes repeatedly, including the one `SaveFileAsync`
returns: a new write begins once the previous commit finished, whatever its
outcome, or its transaction was disposed, and is `Failed(ResourceBusy)` only
while one is open. A commit compares the file with the content the application
last saw, the selection or the last committed write or document read, so
`NotCommitted(Conflict)` means another program changed it. On Windows, a target
another program holds open without delete sharing is now
`NotCommitted(ResourceBusy)` instead of `CommitUnknown(IOError)`. In the macOS
App Sandbox, selections now save through item replacement, so
`platform.files.save` is available there.

`ISaveFileLease.CreateBookmarkAsync` returns a bookmark of a dialog lease's
file, and `IDesktopFileBookmarks.OpenDocumentAsync(bookmark)` reopens it as a
document lease, for recent files; on macOS these are `NSURL` bookmarks,
security-scoped in the App Sandbox. A custom `IPickerBackend` reports
`SupportsDocumentAccess`, `false` by default. See
[open and save files](application/samples/files.md#keep-working-on-a-document)
and
[document apps](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md#document-apps).

## Status icon, single instance and login startup

`AddRunicPlatformServices(id)` also registers `IDesktopStatusIcon` and
`IDesktopLoginStartup`, and `ApplicationInstance.ClaimAsync` makes the first
launch the primary instance. Since SDK `0.8.0-preview.1`, the status icon,
login startup and `DesktopPlatformServices.PresentAsync` work on Linux, Windows and
macOS. The
[status icon example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/examples/status-icon/README.md)
starts without a window, shows the icon with a menu, and brings its Window
forward when the application is launched again. Since SDK `0.10.0`, status
icon menus and the Runic Desktop menu bar share one menu model in
`Runic.Platform`: `DesktopMenuEntry` is the open base (keep a default arm when
you switch over it), `DesktopMenuItem(Title, CommandId)` the command item,
`DesktopMenu` a submenu and `DesktopMenuSeparator` a separator; an activation
reports `CommandId`. Command ids are 1–64 ASCII letters, digits, `.`, `_` or
`-`, and ids starting with `runic.` are reserved. Since SDK `0.14.0`, the
`Runic.Platform` analyzer warns with `RUNICPLAT001` when the two strings of
`new DesktopMenuItem(title, commandId)` look swapped, such as
`new DesktopMenuItem("file.new", "New Window")`, a call converted from the
older `DesktopMenuCommand(id, label)` order; its code fix swaps them and names
both arguments. Since SDK `0.8.0-preview.2`, a
termination signal (Ctrl+C, SIGTERM from `systemctl --user stop` or a logout,
SIGHUP) ends a windowless application instead of leaving it running until
SIGKILL. To shut down in order, as the example does, set
`DesktopHostOptions.HandlesShutdownWithoutWindow = true` and end the
application loop when `ShutdownRequested` is cancelled; without it, a signal
that arrives while no window is open ends the process at once. Since SDK
`0.12.0` this also applies to quitting on macOS; see
[quitting on macOS](#quitting-reopening-and-the-dock-menu-on-macos). See
[Runic.Desktop](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md).
The provider READMEs describe
each platform:
[Windows](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform.Windows/README.md#status-icon-and-window-presentation)
and
[macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform.MacOS/README.md#status-icon).
On macOS, Runic Desktop also adds the standard application, Edit, View and
Window menus unless the application supplies its own; see
[keyboard and zoom in embedded windows](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#keyboard-and-zoom-in-embedded-windows).
Since SDK `0.11.0`, `DesktopHostOptions.StandardMenuTitles`
(`DesktopStandardMenuTitles`) translates the titles of those standard menus,
and a status icon menu may repeat a command id with different
`CommandParameter`s, which the activation reports.

Since SDK `0.11.0`, `ApplicationInstance.ClaimAsync(applicationId, args)`
(and an overload with `ApplicationInstanceOptions`) takes `Main`'s arguments
directly. An application installed from an MSIX package passes
`DesktopPlatformServices.GetLaunch(args)` to the overload that takes an
`ApplicationLaunch` instead, because Windows delivers its protocol and file
activations outside `args`.

Since SDK `0.8.0-preview.3`, a command line can hand its work to the running
instance, such as a windowless application behind the status icon, and print
its reply. Every process of the application claims with
`ApplicationInstanceOptions { ReplyToLaunches = true }`: the later launch reads
the messages and exit status from `ApplicationInstanceClaim.Forwarded.Reply`
(`IForwardedLaunchReply`), and the running instance answers through
`ApplicationLaunch.Reply` (`IApplicationLaunchReply`). An instance claimed
without the option, or by an earlier SDK, refuses such a launch, and the claim
fails with `ResourceBusy`. See
[single instance and replies to later launches](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform.Runtime/README.md#single-instance-and-replies-to-later-launches).

Since SDK `0.8.0-preview.4`, with `ApplicationInstanceOptions.ForwardOnly` a
command line never becomes the instance; without one, the claim is
`NotRunning`. Work given the launch reply's `CancelRequested` stops on Ctrl+C
but outlives a lost SSH session, which cancels `Disconnected` instead.

## Quitting, reopening and the Dock menu on macOS

Since SDK `0.12.0`, Runic Desktop owns the AppKit application on macOS:
`DesktopEventLoop.Run` creates `NSApp` with Runic's application delegate and
runs `[NSApp run]` instead of polling, so Runic's main-thread work also runs
while a menu tracks or a modal panel is open. Every quit takes one path, also
with no window open: Command and Q (`DesktopQuitSource.Menu`), Quit in the Dock
or a script's quit event (`Dock`), and logging out, restarting or shutting down
(`System`). Runic asks `DesktopHostOptions.ConfirmQuitAsync` first, then each
window's close guard in turn; when all agree, `host.ShutdownRequested` is
cancelled and the remaining windows close. A refusal keeps the application
running and cancels a logout. Before, the Dock, scripts and logout ended the
process from AppKit and skipped the close guards.

- An application that keeps running without a window sets
  `HandlesShutdownWithoutWindow` and ends on `ShutdownRequested`; otherwise a
  quit with no surface terminates the process once `ShutdownRequested` is
  cancelled. Move save prompts to `ConfirmQuitAsync` or the close guards. With
  `HandleShutdownSignals`, Ctrl+C, SIGTERM and SIGHUP ask `ConfirmQuitAsync`
  too (`Signal`) on every platform.
- `DesktopHost.ReopenRequested` (`HasVisibleWindows`) occurs when the user
  clicks the Dock icon or opens the running application again.
  `DesktopHostOptions.MacOS` (`MacOSDesktopOptions`) takes a `DockMenu`, whose
  commands run through `host.MenuCommands`.
- An application that set `NSApp.delegate` itself passes its delegate as
  `MacOSDesktopOptions.ForwardingApplicationDelegate` instead, which receives
  every message Runic's delegate doesn't handle.
- `MacOSPlatformProvider.CreateOpenRequests` works on any thread and after the
  first window or status icon; Runic keeps up to 64 earlier open events.
- `DesktopEventLoop.InvokeOnMainThreadAsync` runs AppKit calls on the main
  thread while `DesktopEventLoop.Run` runs, for an application without a
  window, such as one behind a status icon. It throws
  `InvalidOperationException` before `Run` and
  `PlatformNotSupportedException` on Windows and Linux; GTK 4 has no
  equivalent.

Events 3018 to 3020 log a quit, a `ConfirmQuitAsync` that threw and a
`ReopenRequested` handler that threw. See
[quitting, reopening and the Dock menu on macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#quitting-reopening-and-the-dock-menu-on-macos)
and
[native work without a window on macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#native-work-without-a-window-on-macos).

## Menus

Since SDK `0.11.0`, a declared `DesktopHostOptions.MenuBar` is shown natively
on every embedded host: in the macOS application menu bar, in the Windows
window (with access keys, Alt and F10) and above the page in GTK 3 and GTK 4
windows. Before, Windows and GTK reported `menu-bar-unsupported`. The client
area shrinks by the bar's height, and declared shortcuts run their items when
the page does not call `preventDefault()` on the key. Windows and Linux bars
have no standard menus, and Windows menus stay light in dark mode.
`DesktopWindowOptions.MenuBarPresentation` chooses per window:

- `Native`, the default, shows the bar natively.
- `Page` leaves the bar to the page, which renders it with its own menubar
  component.
- `None` shows no bar.

The host matches the items' shortcuts with all three. `MenuBarPlacement`
(`None`, `Window`, `Global` or `Page`) and `MenuBarPlacementChanged` report
where the bar is, and `TryExecuteMenuItemAsync(item)` runs an item through the
same command path as the bar. On macOS the shared application menu bar keeps
the declared menus with `Page` and `None` too (`menu-bar-page-native`). In a
Runic Application Views app, the Window's root ViewModel runs the items through
`IRunicMenuCommandSource`; see
[menu bar commands](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Views/README.md#menu-bar-commands).

On Linux a GTK window moves its bar into the desktop's global menu, on X11
(KDE Plasma; Xfce, MATE and Budgie with vala-panel-appmenu) and on KDE Plasma
Wayland. GNOME, wlroots compositors and COSMIC keep the bar in the window.
`LinuxDesktopOptions.GlobalMenu = false` (on `DesktopHostOptions.Linux`)
always keeps it in the window. A Flatpak needs
`--talk-name=com.canonical.AppMenu.Registrar` in its finish arguments, or the
bar stays in the window and KDE Plasma reports `global-menu-permission`. Any
process on the session bus can choose an enabled item of the exported menu, as
with status icons, so don't bind destructive actions to menu items without a
confirmation. To keep the pre-0.11 look, set `MenuBarPresentation` to `Page`
or `None`, or `GlobalMenu` to `false`. See
[menu bar and keyboard shortcuts](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#menu-bar-and-keyboard-shortcuts).

`DesktopWindow.ShowContextMenuAsync(items, options)`, and
`IWindowPlatformServices.ShowContextMenuAsync` for a ViewModel, show a native
context menu at the pointer or at a page point (`DesktopContextMenuOptions`)
and return the chosen `DesktopMenuItem`, or `null`, on macOS, Windows, GTK 3,
GTK 4 and WPF. The page asks through an ordinary command from its
`contextmenu` handler.

For `Page`, and for CS-WebUI windows (`RunicCsWebUiHostOptions.MenuBar`),
`createMenuBarController()` from `@runic-artifex/views` follows the window's
declared bar as headless state for the application's own menubar component;
`useMenuBar` (React, Vue, Svelte) and `injectMenuBar` (Angular) wrap it. Runic
ships no menubar component; see
[in-page menu bar](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/web/views/README.md#in-page-menu-bar).

Menu problems are reported as the diagnostics `menu-radio-checked`,
`menu-bar-page-native`, `menu-bar-failed`, `menu-title-invalid`,
`global-menu-failed` and `global-menu-permission`.

## Opened URLs, file types and web links

Since SDK `0.11.0`, an application can register what it opens and receive more
kinds of activation:

- `IDesktopOpenRegistration`
  (`DesktopPlatformServices.CreateOpenRegistration(applicationId)`) registers
  URL schemes and file types for the current user, for an application that
  installs itself, such as a ZIP. It never makes the application the default
  and never replaces another application's entry. A packaged application
  declares them in its package instead; see
  [opened URLs and files](desktop/shipping.md#opened-urls-and-files).
- `DesktopOpenOptions.WebLinkHosts` turns `https` links to the application's
  own hosts into open requests: universal links on macOS, app URI handlers on
  Windows.
- `DesktopPlatformServices.ExportApplicationAsync(applicationId, instance)`
  serves D-Bus activation on Linux, for a desktop entry with
  `DBusActivatable=true`.
- `DesktopPlatformServices.GetLaunch(args)` reads an MSIX package's protocol
  and file activations, and MSIX login startup uses the manifest's
  `StartupTask`.
- `IDesktopFileBookmarks` (`DesktopPlatformServices.CreateFileBookmarks()`)
  keeps access to a file across launches, as a recent-files list needs: a
  security-scoped bookmark in the macOS App Sandbox, elsewhere the path. Since
  SDK `0.12.0` it reopens a bookmark as a document lease; see
  [documents](#documents).

Treat every opened URL and file as untrusted input. See
[opening files and URLs](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md#opening-files-and-urls).

## More platform services

SDK `0.11.0` adds these services. Each reports `Unavailable` where the platform
or host has no backend; the
[Platform contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md)
has the per-platform details.

- **Message boxes.** `IWindowPlatformServices.MessageBoxes`
  (`IDesktopMessageBoxes.ShowAsync(DesktopMessageBox)`) shows a native message
  box owned by the window: a task dialog, an `NSAlert` sheet,
  `GtkMessageDialog` or `GtkAlertDialog` (GTK 4.10 and later). Use one where
  the page cannot answer; keep ordinary prompts in the page.
- **Network status.** `IDesktopNetworkStatus` reads and watches
  `DesktopNetworkState`: `IsAvailable`, `Connectivity` and `IsMetered`. It is
  the operating system's view, not a promise that a server answers.
- **Clipboard formats.** `IDesktopClipboard`, an `ITextClipboard`, reads and
  writes HTML, RTF, PNG images and file lists, and watches which formats are
  there, never the content.
- **Badges and progress.** `IWindowPlatformServices.SetBadgeAsync` and
  `SetProgressAsync` use the Windows taskbar button, the macOS Dock and the
  Unity launcher API on Linux, which needs the application ID.
- **Global shortcuts.** `IDesktopGlobalShortcuts` binds named actions to keys
  that work while another application has the focus. `BindAsync` reports each
  as `Bound`, `Unbound`, `Conflict` or `Refused`. Windows and macOS refuse some
  keys, such as F12 and ⌘Q; on Linux the GlobalShortcuts portal lets the user
  choose the keys. `shortcutFromEvent` in `@runic-artifex/views` records a key
  on a settings page.
- **Monitors and full screen.** `IDesktopMonitors`, also
  `IWindowPlatformServices.Monitors`, lists and watches the monitors;
  `DesktopWindowOptions.MonitorId`, `DesktopWindow.MoveToMonitorAsync` and
  `SetFullScreenAsync` place a window. On Wayland, GTK windows cannot be moved
  to a monitor except by a full-screen placement. Since SDK `0.12.0`, macOS
  positions, monitor bounds and work areas are points from the primary
  screen's top-left corner, as on Windows and Linux; see
  [windows on macOS](#windows-on-macos).
- **Window positions on X11.** Since SDK `0.13.0`, a GTK 4 window that opens
  at a position, such as a restored `DesktopWindowPlacement`, carries it in its
  `WM_NORMAL_HINTS` when it is first shown, as GTK 3 does, so the window manager
  keeps it, and a maximized placement restores to its saved position and size.
  `DesktopWindowState.X` and `Y` and the placement's position are the top-left
  corner of the window manager's frame, also under KWin, where each save and
  restore used to move the window by the frame. Saved placements need nothing.
  On Wayland the position is still ignored and reported as `null`.
- **Dragging out.** `IWindowPlatformServices.StartDragAsync(DesktopDragData)`
  starts a native drag of files, text or URIs from a page's `dragstart` and
  returns the drop's effect. The paths come from the application, never the
  page.
- **Trash and volumes.** `IDesktopTrash.MoveAllToTrashAsync` trashes several
  items with progress; `ListAsync`, `RestoreAsync` and `EmptyAsync` work on
  Windows and unsandboxed Linux, and report `Unavailable` on macOS.
  `IDesktopVolumes` unlocks BitLocker, APFS and LUKS volumes and mounts them
  with `DesktopVolumeMountOptions`.
- **Secret storage.** `IDesktopSecretStore.GetBytesAsync` and `SetBytesAsync`
  store binary secrets up to 64 KiB. `DesktopSecretStoreOptions`
  (`AllowUserInteraction`, `RequireEncryption`, `UseDataProtectionKeychain`)
  goes to the new `CreateSecretStore(options)` overloads. On Linux a Flatpak or
  Snap without Secret Service permission now stores secrets through the Secret
  portal instead of reporting `Unavailable`. Any process of the same user on the
  session bus can read every Secret Service item.

## Spell checking

Since SDK `0.13.0`, every embedded window checks spelling in the fields that the
HTML `spellcheck` attribute selects: text areas, text inputs and
`contenteditable` elements, unless they or an ancestor have
`spellcheck="false"`. WebView2 and WKWebView did so before; GTK 3 and GTK 4
windows now turn on WebKitGTK's checker. The languages belong to the
application, because WebKitGTK and macOS check spelling per process:

```csharp docs-test=readme:packages/dotnet/Runic.Desktop/README.md
var options = new DesktopHostOptions { SpellCheckingLanguages = ["de-CH", "en"] };
// Later, when the open document's language changes:
await host.SetSpellCheckingLanguagesAsync(["fr-CA"]);
```

The tags are BCP 47; an invalid one makes `StartAsync` throw
`ArgumentException`. A word is correct when one of the languages accepts it,
and the page's `lang` attribute chooses no dictionary.

- **Linux** selects installed hunspell dictionaries through enchant: `de-CH`
  uses `de_CH` or `de`, never another region. Without languages, those of
  `LANGUAGE`, `LC_ALL`, `LC_MESSAGES` and `LANG` apply. Install dictionaries with
  the distribution's packages, or with Nix through `spellingDictionaries`; see
  [package a Desktop app with Nix](desktop/nix-packaging.md#spell-checking).
- **macOS** sets `NSSpellChecker`'s language for one language and identifies
  each paragraph's language automatically for several or none.
- **Windows** ignores the languages, because WebView2 has no setting for them
  and checks in `DesktopWindowOptions.Language`; `Validate` warns with
  `window-option-unsupported`.

A language without a dictionary is not checked and is reported once as the
window diagnostic `spell-checking-dictionary-missing`; a failure to apply new
languages to an open window is `spell-checking-languages-failed`.
`DesktopWindowOptions.SpellChecking = false` keeps the native checker off in one
window, for an editor that draws its own marks, and restores the behaviour of
Linux windows before `0.13.0`. An element with its own `spellcheck="true"` is
still checked. Editors such as ProseMirror that replace text nodes around a
checked word can lose WebKitGTK's mark; see
[spell checking](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#spell-checking)
in the `Runic.Desktop` README.

## Windows on macOS

SDK `0.12.0` changes and adds these window features:

- **Coordinates.** `MoveAsync`, `X` and `Y` of `DesktopWindowOptions`,
  `DesktopWindowState` and `DesktopWindowPlacement`, and
  `DesktopMonitor.Bounds` and `WorkArea` measure the top-left corner in points
  from the primary screen's top-left corner, and `ResizeAsync` keeps the
  top-left corner. Saved placements need nothing: one without
  `DesktopWindowPlacement.Origin` was saved by `0.11` and opens where it did.
  Flip positions that the application computes from `NSScreen` or `NSWindow`
  frames, or set `Origin = DesktopCoordinateOrigin.BottomLeft` on the
  placement.
- **Title bar and drag regions.** `DesktopWindowOptions.MacOS`
  (`MacOSWindowOptions`) with `TitleBar` `Hidden` or `Transparent` lays the
  title bar over the page and keeps the traffic lights, which
  `TrafficLightPosition` moves. Such a window, and a frameless one, moves by
  CSS `app-region: drag` and `no-drag`, as in Electron. Frameless, kiosk and
  non-resizable frameless windows now take keyboard input.
- **Light and dark.** `DesktopWindowOptions.ColorScheme` and
  `DesktopWindowHostOptions.ColorScheme` (`DesktopColorScheme`) force an
  embedded window light or dark on macOS and Windows (WebView2 runtime 114 or
  later, also in the WPF `RunicWebView`); the page's `prefers-color-scheme`
  follows. GTK windows ignore it, and `Validate` warns with
  `color-scheme-unsupported`.
- **Documents.** `DesktopWindow.SetRepresentedFileAsync` and
  `SetDocumentEditedAsync` show the title bar's proxy icon and the
  unsaved-changes dot. `DesktopHost.NoteRecentDocumentAsync`,
  `ClearRecentDocumentsAsync` and `MacOSDesktopOptions.OpenRecentMenu` keep
  Open Recent and the Dock's recent documents. They do nothing on Windows and
  Linux.
- **Downloads.** With `DesktopWebContentPolicy.AllowDownloads`, a macOS window
  downloads to the user's Downloads folder, never replacing a file, and marks
  each download with the quarantine attribute. With downloads refused, the
  default, an attachment WebKit could show is cancelled, as on Linux. A
  sandboxed application that allows downloads adds
  `com.apple.security.files.downloads.read-write` to its entitlements.

See the Runic.Desktop README:
[title bar and drag regions](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#title-bar-and-drag-regions-on-macos),
[light and dark windows](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#light-and-dark-windows),
[coordinates](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#coordinates)
and
[document apps on macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#document-apps-on-macos).

## Privileged actions

`IDesktopPrivilegedActions` runs a step that the application declared at build
time as a `RunicPrivilegedAction` item, a fixed program with bounded arguments,
as the administrator after the platform's authorization prompt. It is new in
SDK `0.8.0-preview.1`. Start with the
[contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md#privileged-actions),
then follow the provider for each platform:
[Polkit on Linux](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform.Linux.Polkit/README.md)
(`Runic.Platform.Linux.Polkit`),
[UAC on Windows](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform.Windows.Elevation/README.md)
(`Runic.Platform.Windows.Elevation`) and
[a launch daemon on macOS](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform.MacOS/README.md#privileged-actions).
Since SDK `0.8.0-preview.4`, `RunicPrivilegedCommand` items declare commands of
one action, which share its authorization, with an argument pattern per
position:

```xml docs-test=readme:packages/dotnet/Runic.Platform/README.md
<RunicPrivilegedCommand Include="activate" Action="org.example.app.system"
                        Arguments="switch|boot;/nix/store/[a-z0-9]{32}-nixos-system-[A-Za-z0-9._+-]+" />
<RunicPrivilegedCommand Include="rollback" Action="org.example.app.system" />
<RunicPrivilegedCommand Include="gc" Action="org.example.app.system"
                        Arguments="[1-9][0-9]{0,2}" MinimumArguments="0" />
```

The request and the privileged program check each position; see
[commands under one action](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform/README.md#commands-under-one-action).

The [design and security review](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/specs/platform/privileged-operations.md)
records the threat model. [Nix packaging](desktop/nix-packaging.md#run-time-and-privileged-actions)
installs the Polkit policy with the application.

## Windows administration

`Runic.Platform.Administration.Windows` administers Windows machines without a
window, a Runic host or dependency injection: construct a capability client,
such as `WindowsServiceClient`, `WindowsProcessClient` or
`WindowsFirewallClient`, and call it. It needs Windows x64. Since SDK
`0.15.0` it adds:

- `WindowsLocalGroupClient` (namespace `Accounts`), which adds, removes and
  enumerates the members of local groups on the local or a remote computer.
  Groups and members are an `AccountReference.Name` or an
  `AccountReference.Sid`, so the well-known SID `S-1-5-32-544` addresses
  Administrators in every UI language, and "already a member" and "not a
  member" are results, not failures.
- `WindowsDnsResolverClient` (namespace `Dns`), which queries one chosen DNS
  server by IP address, bypassing the resolver cache, hosts file and DNS
  suffixes, and returns the response code and typed answer records.
- `WindowsProcessClient.CloseOrKillAsync`, which asks a process's windows to
  close and terminates it after a timeout, `TerminateAsync`,
  `StartAndWaitAsync` (optionally elevated through the `runas` verb),
  `FindByImagePath` and `ProcessSnapshot.ImagePath`.
- `WindowsServiceClient.StopWithDependentsAsync`, `ServiceSnapshot.ExecutablePath`,
  `WindowsSystemInformationClient.GetActiveConsoleUser()`,
  `DomainMembership.DnsDomainName` and `ForestName`, and
  `WindowsDomainClient.DiscoverControllerAsync` with NetBIOS names.
- `WindowsFirewallClient.DeleteAllAsync(name)`, which deletes every rule of a
  name as `netsh advfirewall firewall delete rule` does, and
  `FirewallClientOptions.WriteWhenLocalPolicyOverridden`, an explicit opt-in
  to write local rules while Group Policy overrides them, which is refused by
  default.

A failure reports its `AdministrationErrorCategory` in `WindowsAdministrationException.Category`.
Since SDK `0.15.0`, a component that is not installed or registered, such as
the Group Policy Management Console or a WMI provider's namespace, is
`NotInstalled` instead of `Unavailable`, which now means only that an installed
machine, endpoint or service cannot be reached. Missing accounts and local
groups are `NotFound`, a timeout is `Unavailable`, and a service with running
dependents, or one that is not running or cannot accept the control now, is
`Conflict`, where these were `NativeFailure`. Code that matched the old
categories matches the new ones; the
[migration guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/docs/migration-1.0.md#windows-administration-1)
lists the native codes. The
[package README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Platform.Administration.Windows/README.md)
lists every client, its scope and the rights it needs.

## Watching files

`RunicPathWatcher` in `Runic.Application.Views` watches files, symbolic links,
directory entries and a Git checkout's `HEAD`, and calls back in a turn of the
model context, so a ViewModel refreshes when they change. It is new in SDK
`0.8.0-preview.1`; see
[Watching files](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Views/README.md#watching-files)
and, for tests on a fake clock,
[`RunicPathWatchTester`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Application.Testing/README.md#file-watchers).

Since SDK `0.8.0-preview.4`, `RunicWatchTarget.Files(path, pattern)` also
reports writes to and replacement of each matching entry, which `Directory`
does not.

## Screen-reader announcements

Since SDK `0.8.0-preview.4`, a ViewModel takes `DesktopWindowPlatformServices`
and calls `AnnounceAsync(message, priority)` to have the screen reader speak a
status, such as "Saved", without moving focus; Orca hears no live regions in
WebKitGTK. A browser or serve-only mode reports `OwnerUnavailable`, and WebView2
and WKWebView also speak live regions, so send each message one way. See
[Accessibility](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#accessibility).

Since SDK `0.11.0`, `IWindowPlatformServices.AnnounceAsync(message,
PlatformAnnouncementPriority)` (`Polite` or `Assertive`) is part of the window
services, on Runic Desktop and WPF windows; WPF now returns `Success` instead
of `Unavailable`. On Windows, while the page has the keyboard focus, the
announcement goes through a hidden live region in the page, so NVDA says it.
See [accessible Desktop views](desktop/accessibility.md).
