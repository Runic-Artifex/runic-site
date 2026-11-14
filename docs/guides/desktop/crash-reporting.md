# Crash reporting and diagnostics

Runic does not collect or upload crash reports. This guide shows what Runic
does with an exception, how an application logs the ones that end it, how to
capture a crash dump, which symbol files to keep for each release, and what
to attach to a bug report.

**Checked with**: the Linux steps (JIT and NativeAOT, `linux-x64`) were run
for this guide. The Windows and macOS steps use the vendors' documented tools
and have not been run for Runic.

## What Runic does with an exception

| Where it is thrown                                                                                               | What happens                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Bridge command, setter, checked write or operation                                                             | The page gets a bounded failure and the exception is logged ([events 1000 to 1008](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/packages/dotnet/Runic.Application.Views/README.md#logging-and-telemetry)). The application keeps running. |
| A close guard, a `DesktopWindow.StateChanged` or `FilesDropped` handler                                          | Logged (1052, 3011, 3012). The application keeps running.                                                                                                                                                                                            |
| Since SDK `0.11.0`: a `DesktopWindow.Closed` handler, a menu command target, a `MenuBarPlacementChanged` handler | Logged (3013, 3014, 3017). The application keeps running.                                                                                                                                                                                            |
| A status icon's `Activated` handler                                                                              | Rethrown on the thread pool: the process ends as for any thread-pool exception.                                                                                                                                                                      |
| The application body passed to `RunicDesktopHost.Run`                                                            | Runic closes the windows and disposes the host, then `Run` throws it. Returned from `Main`, it ends the process.                                                                                                                                     |

An exception that ends the process is not logged by Runic. The .NET runtime
prints it with its stack to standard error and ends the process: on Linux
with `SIGABRT` (exit code 134 in a shell), on Windows through Windows Error
Reporting, which records it in the Application event log. A Windows GUI
application (`WinExe`) or one started from a launcher, Finder or Explorer has
no visible standard error, so log it yourself.

On Linux, WebKitGTK renders the page in a separate web process. When that
process crashes, the window reloads its page and Runic reports
`web-process-terminated` (event 3010); the application keeps running. See
[Web process crashes on Linux](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/packages/dotnet/Runic.Desktop/README.md#web-process-crashes-on-linux);
the crash of `WebKitWebProcess` itself is in the system journal
(`coredumpctl`).

## Log the exception that ends the process

Register logging as the
[Views guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/packages/dotnet/Runic.Application.Views/README.md#logging-and-telemetry)
describes, then log from `AppDomain.UnhandledException`. It is raised for the
application body and for every other thread, before the process ends:

```csharp docs-test=skip:illustrative-fragment
var crashes = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Crash");
AppDomain.CurrentDomain.UnhandledException += (_, e) =>
{
    crashes.LogCritical(e.ExceptionObject as Exception, "The application failed.");
    Log.CloseAndFlush(); // Serilog: write buffered entries before the process ends.
};
TaskScheduler.UnobservedTaskException += (_, e) =>
    crashes.LogError(e.Exception, "A task failed and nobody awaited it.");

return RunicDesktopHost.Run(provider, options, RunAsync);
```

- Flush in the handler: the process ends when it returns, so an asynchronous
  or batching sink loses what it has not written.
- `UnobservedTaskException` does not end the process. It is raised when a
  faulted task that nobody awaited is collected, so it reports late, if at all.
- Write the log under the user's local application data, next to the
  template's `diagnostics.log` (`DiagnosticsLog.Path`, in templates since
  `0.8.0-preview.5`), in a file of its own: the template starts
  `diagnostics.log` empty at each start, so a crash line written there is gone
  after the next start.
- Exception messages can contain user data. Show the user what a report
  contains before they send it.

## Page errors in .NET logs

An error in the page, such as a `TypeError` in a click handler or a promise
nothing awaited, stays in the web view's console unless the page reports it.
Since SDK `0.16.0`, call `installErrorReporting()` from `@runic-artifex/views`
once when the page starts, before the first View connects:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
import { installErrorReporting } from "@runic-artifex/views";

installErrorReporting({
  // Optional: remove application data from messages before they leave the page.
  redact: report => ({ ...report, message: report.message.replace(/\d{12,19}/g, "[number]") }),
});
```

The page then reports uncaught errors, unhandled promise rejections and the
errors the Views runtime catches to the .NET host, which logs each as event
1150 `PageError` in the category `Runic.Application.Views.Page`
(`RunicViewsTelemetry.PageLogCategory`), with the stack last. A crash reporter
or log forwarder that reads `ILogger` picks them up beside the host's own
errors; filter or route the category on its own.

- Reports are bounded and redacted in the page: every URL loses its query and
  fragment, and `redact` can change or drop a report.
- The host treats a report as untrusted input: it cuts and cleans its texts
  and marks every stack line, so a page's text cannot pass for a line the host
  wrote. Read the text as the page's claim.
- The host logs at most 10 reports per page connection and 30 per window a
  minute, and logs event 1151 `PageErrorsSuppressed` or 1152
  `WindowPageErrorsSuppressed` once when it starts counting.
- Reporting is the Views protocol 4 feature `client-errors/1`: a page and host
  of 0.16 or later use it, and with an earlier host the page drops its
  reports.

See
[page errors](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/packages/dotnet/Runic.Application.Views/README.md#page-errors).

## Capture a crash dump

A dump holds the process memory, including the user's data. Collect one only
with the user's consent, and keep it private.

**JIT and self-contained builds.** The runtime writes a dump through its
`createdump` tool when the process crashes with these variables set:

```sh docs-test=skip:illustrative-command
export DOTNET_DbgEnableMiniDump=1
export DOTNET_DbgMiniDumpType=2   # 1 mini, 2 with heap, 3 triage, 4 full
export DOTNET_DbgMiniDumpName=/tmp/myapp-%p.dmp
```

Open it with `dotnet-dump analyze`. `%p` is the process ID; `%e` names the
executable, which is `dotnet` for `dotnet MyApp.dll`.

**NativeAOT.** The executable has no `createdump` next to it, so the variables
above only print `the createdump binary does not exist`. Use the operating
system's dumps instead:

- Linux: the core dump of `SIGABRT`, kept by `systemd-coredump`
  (`coredumpctl list`, `coredumpctl dump <pid> -o core`) or written where
  `ulimit -c` and `kernel.core_pattern` say. Alternatively, copy `createdump`
  from the same .NET runtime version next to the executable and set
  `DOTNET_DbgMiniDumpType=4`: NativeAOT supports only full dumps. Open the ELF
  core with `gdb` or `lldb` together with the executable and its `.dbg` file.
- Windows: Windows Error Reporting writes a dump when the
  `HKLM\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\<app>.exe`
  key exists (`DumpFolder`, `DumpType` 2 for a full dump). Open it in Visual
  Studio or WinDbg with the `.pdb`.
- macOS: the system writes a crash report to `~/Library/Logs/DiagnosticReports`.
  It holds the native stack, which the `.dSYM` symbolizes.

## Keep the symbols of each release

NativeAOT writes the debug symbols beside the executable: `<app>.dbg` on
Linux, `<app>.pdb` on Windows and `<app>.dSYM` on macOS. `StripSymbols`
(the default) keeps them out of the executable. Leave them out of the package,
but archive them for every release you ship: only the symbols of that exact
build match its dumps and addresses. On Linux, `readelf -n <app>` prints the
build ID that the executable and its `.dbg` share.

By default, a NativeAOT stack trace names the methods, as in
`at Program.<Main>$(String[] args) + 0x280`, without file and line. The size
options that [size reporting and tuning](size-and-tuning.md) measures change
that: with `StackTraceSupport=false` a frame is only an offset, such as
`at MyApp!<BaseAddress>+0xc4aa0`, which the archived symbols resolve:

```sh docs-test=skip:illustrative-command
addr2line -f -C -e MyApp.dbg 0xc4aa0
```

`UseSystemResourceKeys=true` replaces the .NET libraries' exception messages
with resource keys; your own messages stay.

A JIT build resolves file and line from the portable `.pdb` files next to the
assemblies. Ship them, or set `<DebugType>embedded</DebugType>` to put them
inside the assemblies.

## What to attach to a bug report

For a report to the application's developer:

- the application version and the operating system version;
- the logged exception, or the standard error output when the application was
  started from a terminal;
- page errors (event 1150), when the page installed error reporting;
- `diagnostics.log`, when the application keeps one;
- a dump, only if the developer asks and the user agrees.

For a report about Runic itself, run doctor in the application's project and
attach its output:

```sh docs-test=skip:illustrative-command
dotnet runic doctor --format json > doctor.json
```

The envelope lists every check with its result, including the WebView runtimes and the Linux
portal. It also holds absolute paths, such as the project file's, so review
it before you post it. Add the RID you publish for, NativeAOT or JIT, and the
host (`RunicDesktopHost` with GTK 3 or GTK 4, CS-WebUI or WPF).
