# Hosted applications

A Runic Desktop application, the **host**, can show the Windows of another Runic
Desktop application, the **guest**, in native windows of its own. Use it for a
launcher, a suite shell or an IDE-like application that runs its tools as
separate processes. Each guest keeps its own process, ViewModels, translations
and Runic version, so a guest that crashes takes only its own windows with it.
The host owns the frames, the placement and the activation. It shows the
guest's menu bar and dialogs, and it decides what the guest may do.

**Experimental since SDK `0.17.0`.** The host and guest APIs, the test host and
the [Runic host protocol](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/specs/desktop/host-protocol.md)
report [`RUNICDESK103`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/docs/experimental.md#RUNICDESK103).
They can change in a minor release, also after 1.0. Suppress the ID in the
host, the guest and their tests.

**Checked with**: Runic CI runs the
[hosted windows example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/examples/hosted-windows/README.md)
on Linux x64. A shell hosts a counter in a WebKitGTK window, and the counter's
tests run under the test host. The protocol's conformance scenarios and the
native smoke run on Windows, macOS and Linux.

## Opt in a guest

An application can be hosted only through a code path of its own, reached by a
parameter it defines. Runic has no flag or environment variable for it, so an
application without such a path cannot be hosted, and the processes it starts
never inherit the mode:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.Desktop/README.md
#pragma warning disable RUNICDESK103 // Hosted application windows are experimental.
if (args is ["hosted"])
{
    try
    {
        return RunicDesktopHost.Run(provider, new DesktopHostOptions(),
            new RunicDesktopHostOptions { Guest = RunicGuestOptions.FromStandardInput() },
            async host =>
            {
                // When the host goes away while the Window opens, the open throws; Run then returns 0.
                await using var window = await host.OpenWindowAsync<MainWindow>();
                await window.WaitForCloseAsync();
                return 0;
            });
    }
    catch (RunicHostedApplicationException error)
    {
        Console.Error.WriteLine($"Not hosted ({error.Code}): {error.Message}");
        return 1;
    }
}
```

In hosted mode the guest runs no toolkit loop and never shows a window of its
own. Its Windows, ViewModels and pages are unchanged. Their window services go
to the host: the presentation, the menu bar
(`DesktopHost.SetMenuBar`), file dialogs and message boxes
(`services.AddRunicPlatformServices()`), and the clipboard, monitors and file
launcher. The application's locale (`IRunicApplicationLocale`, after
`AddRunicWindowService`) follows the host's until the guest sets its own. Its
pages show the host's appearance. When the host goes away, the Windows close and
`Run` returns.

## Start a guest from a host

`IRunicHostedApplications`, from `RunicDesktopHost.HostedApplications` or
`services.AddRunicHostedApplications()`, starts the guest's executable directly
with the guest's parameter. It shows each guest Window in a native window of the
host:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.Desktop/README.md
#pragma warning disable RUNICDESK103 // Hosted application windows are experimental.
var applications = host.HostedApplications;
applications.WindowOpened += (_, e) => Console.WriteLine($"{e.Window.Application.Guest.Name} opened {e.Window.Type}");
await using var tool = await applications.StartAsync(
    new RunicGuestStartInfo("/opt/tool/Tool", ["hosted"]),
    new RunicHostedApplicationOptions { Policy = new ToolWindowPolicy() });
var exitCode = await tool.Exited;
```

Each `StartAsync` starts a guest process for this host session. A failed start
ends the guest's process tree and throws `RunicHostedApplicationException` with
a code such as `guest-start-timeout` or `guest-not-hostable`. When the guest
exits or crashes, the host closes its windows and completes `Exited`.
`StopAsync` asks it to shut down, and the host's own exit stops every guest.

The host's language and theme reach the guest. `IRunicApplicationLocale.SetLocaleAsync`
switches every guest with the host. `DesktopHost.SetColorSchemeAsync` applies to
the guest's windows too, because they are native windows of the host.

## Decide what a guest may do

`IRunicHostedWindowPolicy` decides each window, presentation request, menu,
dialog and window service. Every member has a default. Without a policy, every
window, menu and dialog shows unchanged. The clipboard is read and written only
for the window the user works in, and only `http`, `https` and `mailto` links
and files the user gave the guest are opened. `RunicHostedLimits` bounds the
rate of menus, dialogs, launches and announcements.

A guest words its own dialog titles and menu texts, and nothing marks them as
the guest's. A host that does not ship the guest itself can mark them, or narrow
what the guest may open. The example's shell puts the guest's name in front of
each dialog title and opens only the Runic documentation:

```csharp docs-test=source:examples/hosted-windows/Shell/CounterPolicy.cs
public sealed class CounterPolicy : IRunicHostedWindowPolicy
{
    // A guest's dialogs show over its window with the guest's own title and text, which nothing marks as the guest's: the
    // shell puts the guest's name in front of each title.
    public ValueTask<RunicHostedDialogDecision> DialogAsync(RunicHostedDialogRequest request, CancellationToken cancellationToken)
    {
        var guest = request.Window.Application.Guest.Name;
        return ValueTask.FromResult(RunicHostedDialogDecision.Apply(request.MessageBox is { } messageBox
            ? request with { MessageBox = messageBox with { Title = Mark(guest, messageBox.Title) } }
            : request with { Title = Mark(guest, request.Title) }));
    }

    // Narrower than the defaults, which open any web or mail link the user's active window asks for: the shell opens only
    // the Runic documentation, and no files. The guest sees a refusal as PermissionDenied.
    public ValueTask<RunicHostedServiceDecision> ServiceAsync(RunicHostedServiceRequest request, CancellationToken cancellationToken) =>
        ValueTask.FromResult(request.IsAllowedByDefault && (request.Kind != RunicHostedServiceKind.Launch || MayOpen(request.Uri))
            ? RunicHostedServiceDecision.Allow()
            : RunicHostedServiceDecision.Refuse("The shell opens only the Runic documentation."));
    // ...
}
```

## Test a guest

`RunicTestHost` from `Runic.Application.Testing` plays the host. It starts the
built guest with its parameter, answers its window, menu, dialog and window
service requests, and changes its locale and appearance. It needs no host
application and, for a guest that does not wait for its page to connect, no
browser:

```csharp docs-test=source:examples/hosted-windows/Counter/Tests/HostedCounterTests.cs
var start = RunicServeOnlyApplication.CreateStartInfo(typeof(HostedCounterTests).Assembly
    .GetCustomAttributes<AssemblyMetadataAttribute>().Single(attribute => attribute.Key == "CounterTool").Value!);
start.ArgumentList.Add("hosted");
return RunicTestHost.StartGuestAsync(start, options);
// ...
await using var host = await StartAsync(new RunicTestHostOptions { Locale = "de" });
var window = await host.WaitForWindowAsync(nameof(CounterWindow), Wait);

await WaitForMenuAsync(window, "Zähler", "Zurücksetzen…");
```

The example's tests also switch the host's language, answer the guest's
message boxes and check that a link reaches the host's launcher.

## Platform notes

- Hosts and guests run on Runic Desktop only. A CS-WebUI, hosted or serve-only
  application cannot host.
- Hosted windows have no installed-browser fallback, because a browser tab would
  send the user's own `127.0.0.1` cookies to the guest. On Linux the host selects
  an embedded backend: `DesktopHostOptions.Linux.EmbeddedBackend = LinuxEmbeddedBackend.Gtk3WebKit41`,
  or `WithGtk4()` from `Runic.Desktop.Gtk4`.
- **WebView2**: each guest session gets an InPrivate profile in a user data folder
  of its own, with a browser process of its own. The folder is deleted after the
  session.
- **WKWebView and WebKitGTK**: a guest session's data store lives only while one
  of its windows is open. A guest that opens a window after all its windows
  closed starts with empty cookies and storage.
- **macOS**: while a hosted window is key, the one menu bar shows the host's
  application menu and then the guest's menus.
- **Windows**: a guest runs in a kill-on-close job object, which ends it also
  when the host crashes. On Linux and macOS it leads a process group, and a guest
  whose host crashed exits when its standard input ends.

## Security

Both sides opt in. The channel is a loopback WebSocket that only the process
that started the guest can join, and web pages cannot reach it. A guest's page
gets none of the host's credentials or cookies. A guest reaches its own windows
only, and elevated or other-user guests refuse hosted mode. Any process of the
same user that knows a guest's parameter can host it, so `RunicGuestOptions.AcceptHost`
is a product filter, not a security boundary. The
[security guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/docs/security.md#hosted-application-windows)
lists what Runic enforces and what a host should keep in its policy.

The [Runic.Application.Views.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/packages/dotnet/Runic.Application.Views.Desktop/README.md#hosted-applications)
describes every option, event and limit.
