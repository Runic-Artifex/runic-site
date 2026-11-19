# Debugging an application

A Runic application has two halves to debug: the .NET Window with its
ViewModels, and the page that renders them in a web engine. This guide shows
how to debug both under `dotnet runic dev`, from your IDE's .NET debugger to
the browser's developer tools, and how the development tools of SDK `0.22.0`
connect a click in the page to the C# that runs for it.

> Adapted from the SDK's
> [debugging guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/debugging.md)
> at SDK `0.22.0`. Each section links the README that describes its tool in
> full.

| You want to…                                                                     | Use                                                                        |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Stop on a breakpoint in a ViewModel                                              | [Your IDE's .NET debugger](#the-net-debugger-in-your-ide)                  |
| Inspect the page's DOM, console, network and scripts                             | [The browser's developer tools](#the-browsers-developer-tools-per-engine)  |
| Stop on C# and `Frontend/src` breakpoints in one Visual Studio session           | [Runic DevKit's Debug the Window](#visual-studio)                          |
| Stop on a breakpoint in the frontend's sources from your IDE                     | [JavaScript debuggers](#javascript-debuggers-in-your-ide)                  |
| See each Bridge call with the C# that ran, and open it in the editor             | [The dock](#the-dock)                                                      |
| Click an element and see its commands, state and texts                           | [Runic Inspect](#runic-inspect)                                            |
| See the same in the developer tools of Chrome, Edge or the Windows Window        | [The Runic DevTools extension](#the-runic-devtools-extension)              |
| See a component's View and field state in React DevTools or Vue DevTools         | [Framework DevTools](#react-devtools-and-vue-devtools)                     |
| See View clients and states readably in the console                              | [Custom object formatters](#custom-object-formatters)                      |
| Time C# handlers, or follow a click into the ViewModel's HTTP and database calls | [Performance panel and traces](#performance-panel-async-stacks-and-traces) |
| See Bridge errors before you build                                               | [Analyzers](#bridge-errors-while-you-type)                                 |

**"DevTools" means two things.** The portal, like the SDK's READMEs, says
**the browser's developer tools** for the engine's own tools (F12, Inspect,
Safari's Web Inspector) and **the dock** for the Vite DevTools dock
(`DevTools()` from `@vitejs/devtools`) with its Runic panel. They are separate:
the dock is part of the page under `vite dev`, and the browser's developer
tools belong to the engine.

Everything here is for development and costs nothing in production; see
[in production](#in-production).

## The .NET debugger in your IDE

`dotnet runic dev` builds the application, starts the frontend's development
server, and runs the Window under `dotnet watch`, which restarts it after a C#
edit. A debugger attached to that Window ends at each restart. To debug C#, let
the IDE start the Window instead:

1. Run `dotnet runic dev --no-window`. It serves only the frontend and prints
   `[dev] Ready` when the page can load.
2. Start the Window with the IDE's debugger (F5) from a launch profile with
   `DOTNET_ENVIRONMENT=Development`.

The IDE's build keeps the development page that `dev` wrote, so frontend edits
still reach the Window while you debug. `dev` does not restart the Window
behind the debugger: apply C# edits with the IDE's Hot Reload, and restart the
Window after a change Hot Reload cannot apply, such as a new ViewModel member.
To keep `dev` starting the Window, attach to the process that
`[dev] Window started: process <pid>` names instead (`--no-dotnet-watch` keeps
it from restarting).

[Debug the Window in your IDE](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/tools/dotnet-runic/README.md#debug-the-window-in-your-ide)
has the details and the snippets for a project that did not come from the
template.

### Visual Studio

Projects from `dotnet new runic-app` have `Properties/launchSettings.json`.
Visual Studio lists its profiles next to the Start button:

- **`<Project>`** starts the Window with `DOTNET_ENVIRONMENT=Development`: the
  browser's developer tools on the page and detailed Bridge errors.
  `dotnet run` uses it too.
- **`<Project> (CS-WebUI script debugging)`** (CS-WebUI, since 0.22) also
  opens the DevTools Protocol endpoint of the Window's Chrome or Edge on
  `http://127.0.0.1:9225/`. Any local process can attach to it while the
  Window runs
  ([CS-WebUI pages in a JavaScript debugger](#cs-webui-pages-in-a-javascript-debugger)).

**Runic DevKit for Visual Studio** (preview, Visual Studio 2026 on Windows x64;
see its
[README](https://github.com/Runic-Artifex/runic-editors/blob/v0.22.0/visualstudio/README.md))
adds the `dotnet runic dev` loop to Visual Studio. Install it from the Visual
Studio Marketplace: in **Extensions → Manage Extensions**, search for **Runic
DevKit**, or open
[runic-artifex.runic-devkit-vs](https://marketplace.visualstudio.com/items?itemName=runic-artifex.runic-devkit-vs),
and restart Visual Studio. `runic-devkit-vs.vsix` is also on the
[runic-editors 0.22.0 release](https://github.com/Runic-Artifex/runic-editors/releases/tag/v0.22.0).
Its commands
are in **Tools → Runic** and in the Runic tool window (**View → Other Windows →
Runic**):

- **Debug the Window** debugs the C# code and the page in one session, with
  breakpoints in `Frontend/src` and in your ViewModels. It starts
  `dotnet runic dev --no-window` if it does not run yet, waits for
  `[dev] Ready`, builds the project, and starts the Window under the .NET
  debugger with the session file's `window.environment` and a DevTools Protocol
  port: a free loopback port for WebView2 (Runic Desktop), 9225 for CS-WebUI.
  When the page answers on that port, it attaches Visual Studio's JavaScript
  debugger over the "JavaScript and TypeScript (Chrome DevTools/V8 Inspector)"
  connection. If the page does not appear within three minutes of the Window
  running, the .NET debugger stays attached and the **Runic SDK** Output pane
  says why.
- **Attach to the Page (JavaScript)** attaches the JavaScript debugger alone to
  a page that already runs with an endpoint: one of the session file's
  `debugEndpoints`, or a Window that Debug the Window started. With several, it
  asks which one.
- **F5 asks first.** When F5 or Ctrl+F5 starts a Runic project and no
  `dotnet runic dev --no-window` runs for it, a message asks whether to start
  it. F5 runs a launch profile, so it debugs only the .NET code: use Debug the
  Window for page breakpoints.
- **The dev session.** Start dotnet runic dev, Start dotnet runic dev
  --no-window and Stop dotnet runic dev run `dev` with its output in the
  **Runic SDK** Output pane and its diagnostics in the Error List. The tool
  window's Dev Session section shows each project's `dev` state, server, pages,
  debug endpoints and generated clients; its ViewModels section opens the C#
  members, and Run dotnet runic doctor puts failing checks into the Error List.
  When DevKit starts `dev` with its own Window, it passes `--debug-endpoint` to
  `dotnet-runic` 0.22 and later, so a CS-WebUI Window opens its port; a `dev`
  that you start in a terminal opens none.
- **Stopping `dev`.** With `dotnet-runic` 0.22, Stop dotnet runic dev asks `dev`
  to stop on its standard input ([below](#the-ide-contract)), so the session
  file says `stopped` and the development pages leave `www/`; after 10 seconds
  it ends the process tree. When a `dev` was killed, DevKit touches its
  project's `obj/runic/dev-stopped` once, so the next F5 builds and puts the
  production frontend back.

Page breakpoints need:

- Visual Studio's **JavaScript diagnostics** component
  (`Microsoft.VisualStudio.Component.JavaScript.Diagnostics`). Since 0.22 the
  template's `.vsconfig` names it next to the .NET desktop development
  workload, and Visual Studio offers to install a missing one when it opens the
  project. For another project, copy `.vsconfig` from a new one next to its
  solution.
- A Visual Studio that does not run as administrator: WebView2 ignores the port
  in an elevated process.
- `@runic-artifex/vite-plugin-runic` 0.22 or later, whose development source
  maps have absolute `sources`
  ([below](#the-development-servers-source-maps)). With an older plugin,
  breakpoints in `.tsx`, `.vue` and `.svelte` files stay unbound.

If Visual Studio's JavaScript debugger does not attach ("Value cannot be null.
Parameter name: source", or the attach never finishes), close Visual Studio,
delete the solution's `.vs` folder and open it again. DevKit stops waiting for
an attach after 60 seconds.

**The `(WebView2 script debugging)` profile is gone** (0.22). Under F5, Visual
Studio's JavaScript adapter (`jsWebView2Debugging`) started the Window without
the profile's environment variables, so the Window ran outside Development,
Runic cleared `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, and the adapter stopped
the Window after about 20 seconds. Delete that profile, the entry with
`"jsWebView2Debugging": true`, from an existing project's
`Properties/launchSettings.json`, keep `<Project>`, and use Debug the Window
instead.

Without the extension, run `dotnet runic dev --no-window` in the Developer
PowerShell and press F5 for the .NET code. For the page, start the Window with
a DevTools Protocol port and use Debug > Attach to Process with the connection
type above
([CS-WebUI pages](#cs-webui-pages-in-a-javascript-debugger) shows the steps).
Without `dev`, F5 builds the production frontend and the Window shows that.
Since 0.22, F5 also builds again after a frontend-only edit and after `dev`
stops: the Runic Views build targets give Visual Studio's fast up-to-date check
the frontend's files and `obj/runic/dev-stopped`. See the template README's
[Debug it in your IDE](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/tools/Runic.Application.Templates/content/runic-app/README.md#debug-it-in-your-ide).

### Rider

Rider lists the same launch profiles next to its Run button. Run
`dotnet runic dev --no-window` in Rider's terminal, or add it to the run
configuration's "Before launch" list as an external tool, and debug the
`<Project>` profile. Without `dev`, the Window shows the production frontend.

### VS Code

`dotnet new runic-app --editor vscode` adds `.vscode/` with tasks and
configurations for the C# extension (`ms-dotnettools.csharp`; C# Dev Kit is
not needed):

| Configuration                             | What it does                                                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Window`                                  | Runs the `runic: dev --no-window` task until `[dev] Ready`, builds, and starts the Window under the debugger.                                                                                              |
| `Attach to the Window (dotnet runic dev)` | Runs the `runic: dev` task and attaches to the Window process.                                                                                                                                             |
| `Window + WebView2 (Windows)`             | Runic Desktop on Windows: the Window with WebView2's endpoint on port 9222, and VS Code's JavaScript debugger attached to the page, so breakpoints in `Frontend/src` stop too.                             |
| `Window + WebKitGTK (Linux)`              | Runic Desktop on Linux (preview, since 0.21): the same with WebKitGTK, through `dotnet runic dev`'s CDP adapter on port 9222.                                                                              |
| `Attach to the page (JavaScript)`         | VS Code's JavaScript debugger on port 9222 alone: the Window that `dotnet runic dev` started on Linux, or a WebView2 Window started with the port on Windows.                                              |
| `Window in Chrome`                        | Every OS (since 0.21): runs `dotnet runic dev --browser` and opens the Window's page in Chrome under VS Code's JavaScript debugger ([the page in Chrome](#the-page-in-chrome-dotnet-runic-dev---browser)). |

The tasks put `dev`'s failures (`RAPPDEV` codes) and build errors in the
Problems panel. VS Code builds from other vendors, such as VSCodium, cannot run
Microsoft's .NET debugger; use netcoredbg there.

**Runic DevKit for VS Code** (`runic-artifex.runic-devkit`, from
[runic-editors](https://github.com/Runic-Artifex/runic-editors/blob/v0.22.0/vscode/README.md))
adds a Dev Session view that follows `dotnet runic dev`, F5 of the Window
without a `launch.json`, doctor results, and a ViewModels tree that opens the
C# members. Install it from the VS Code Marketplace
([runic-artifex.runic-devkit](https://marketplace.visualstudio.com/items?itemName=runic-artifex.runic-devkit),
with the Preview label, since runic-editors 0.22.0); the template's
`.vscode/extensions.json` names it:

```sh docs-test=skip:sdk-guide-excerpt
code --install-extension runic-artifex.runic-devkit
```

`runic-devkit.vsix` is also on the
[runic-editors 0.22.0 release](https://github.com/Runic-Artifex/runic-editors/releases/tag/v0.22.0);
VSCodium, Cursor and other editors that use Open VSX install it from there,
since Runic DevKit is not on Open VSX. With `dotnet-runic` 0.22, its `dev` task passes
`--debug-endpoint` to a `dev` with its Window, and **Stop dotnet runic dev**
asks `dev` to stop on its standard input.

Until 0.21 the extension was **Runic** (`runic-artifex.runic`, `runic.vsix`).
Runic DevKit installs next to it and to the older Runic MF2 Translations
extension, offers to uninstall both on activation, and then needs a window
reload: while both are installed, both register the same commands and start a
language server for the same files. See
[Moving from Runic or Runic MF2 Translations](https://github.com/Runic-Artifex/runic-editors/blob/v0.22.0/vscode/README.md#moving-from-runic-or-runic-mf2-translations).

### The IDE contract

IDE tasks and extensions read `dotnet runic dev` through stable lines and a
session file, described in the
[IDE contract](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/tools/dotnet-runic/README.md#ide-contract):

- **Lines:** `[dev] Window started: process <pid>` (the process to attach to),
  `[dev] Ready`, `[dev] Window exited: process <pid>`, the `[dev] Evaluating`
  and `[dev] Reloading` prefixes that the template's tasks wait on, and with
  `--browser` `[dev] Browser: Window serves at <url>`. A failure is one line in
  MSBuild's form, `<project> : error RAPPDEV1007: <message>`, which
  `$msCompile` matches.
- **Stopping `dev`.** Ctrl+C or SIGINT/SIGTERM stops the frontend and the
  Window, marks the session file `"stopped"`, deletes `dev-frontend` and
  `dev-pages/`, and touches `obj/runic/dev-stopped`, which Visual Studio's fast
  up-to-date check reads, so the next F5 builds the production frontend again.
  An IDE that can't send Ctrl+C, such as Visual Studio on Windows, sets
  `RUNIC_DEV_STOP_ON_INPUT=1` and redirects `dev`'s standard input (since
  0.22): `dev` then stops the same way at a line `stop` or at the end of the
  input. The processes `dev` starts get an input of their own, and without the
  variable `dev` doesn't read its input. A `dev` killed by force does none of
  this; an older `dev` ignores the variable, so keep the forced stop as the
  fallback.
- **Session file:** `obj/runic/dev-session.json`
  (`runic.application.tool.dev-session/1`), rewritten on each change. `state`
  is `starting`, `ready` or `stopped`. A `dev` that was killed leaves its last
  state, so a reader trusts `starting` and `ready` only while a process with
  `processId` runs and started at `processStartedAt` (to within a second). The
  file also lists the development server's URL, the pages, the Window's
  process and owner (`dev`, or `ide` with `--no-window`), `debugEndpoints`
  (WebView2's DevTools Protocol endpoint when the environment opens one,
  on Linux `"engine": "webkitgtk", "protocol": "cdp"` for the CDP adapter, and
  since 0.22 `"engine": "chromium"` for a CS-WebUI Window's browser),
  `unavailableDebugEndpoints` (one that the engine will not open, with a
  `reason`), `browser` (the address that `--browser` serves the Window at),
  `devtoolsExtension` and `devtoolsExtensionId` (the
  [Runic DevTools extension](#the-runic-devtools-extension)), and `sourceMap`,
  the Bridge source map that the page's tools read (format
  `runic.views.bridge-sources/1` since 0.21).
  See the
  [session file](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/tools/dotnet-runic/README.md#session-file).

## The browser's developer tools per engine

A Runic Desktop window has the browser's developer tools in the window (F12,
Inspect Element, Safari's Web Inspector) only when `DOTNET_ENVIRONMENT` (or
else `ASPNETCORE_ENVIRONMENT`) is `Development`, which `dotnet runic dev` and
the template's launch profiles set. `DesktopWebContentPolicy.DevTools`
overrides it per window; see
[links, new windows, downloads and developer tools](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/dotnet/Runic.Desktop/README.md#links-new-windows-downloads-and-developer-tools).

That setting covers only the tools in the window. A **remote debugging
endpoint** that a variable in the Window process's environment asks for is the
engine's own: WebView2's `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` and
WebKitGTK's `WEBKIT_INSPECTOR_SERVER` and `WEBKIT_INSPECTOR_HTTP_SERVER`.
`DevTools = false` does not close WebKitGTK's (WebKitGTK 2.54.0, GTK 3 and
GTK 4) and is not documented to close WebView2's. Outside Development the GTK 3
and GTK 4 hosts therefore remove both WebKit variables from the process's
environment before their first web view, and since 0.21 the WebView2 host
removes `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` before it creates its WebView2
environment, also when `DevTools` is `true`, so a release opens no such
endpoint
([release builds](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/security.md#release-builds)).
Arguments that the application passes in `DesktopWindowOptions.BrowserArguments`
are not changed. To debug a release build's page that way, run it with
`DOTNET_ENVIRONMENT=Development`.

| Engine            | Where                                                              | Open                                                                                                                                                   | Debugger and automation                                                                                                                |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| WebView2          | Windows                                                            | F12, Ctrl+Shift+I, Inspect from the page's context menu, Open DevTools in the window's system menu (Alt+Space), or `DesktopWindow.OpenDevToolsAsync()` | A DevTools Protocol endpoint on request (below); DevTools extensions in Development (below)                                            |
| WKWebView         | macOS 13.3 and later                                               | Safari ▸ Develop ▸ your Mac ▸ the window's page (turn on "Show features for web developers" in Safari's Advanced settings)                             | Safari's Web Inspector only; no DevTools Protocol endpoint                                                                             |
| WebKitGTK         | Linux (GTK 3 and GTK 4)                                            | Inspect Element from the page's context menu (WebKit's Web Inspector, docked or detached)                                                              | A DevTools Protocol endpoint for JavaScript debuggers under `dotnet runic dev` (preview, below), and WebKit's remote inspector         |
| Installed browser | CS-WebUI's default, and Runic Desktop's fallback without a WebView | The browser's own F12                                                                                                                                  | The browser's own rules: Runic's policy does not apply; a Chromium browser's DevTools Protocol endpoint on request (since 0.22, below) |

- **WebView2 endpoint.** WebView2 opens a Chrome DevTools Protocol endpoint
  when the Window starts with
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`. The
  template's `Window + WebView2 (Windows)` VS Code configuration sets it, Runic
  DevKit's Debug the Window in Visual Studio adds it with a free port, or pass
  it with
  `dotnet runic dev -e WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`.
  `dev` then lists `http://127.0.0.1:9222/` under `debugEndpoints` in the
  session file. VS Code's JavaScript debugger (`msedge` with `useWebView`),
  Visual Studio's, `edge://inspect` and agents attach to it.
- **Not when elevated.** WebView2 Runtime 150 and later ignores that variable
  in an elevated process. When `dev` runs as administrator, its Window does
  too, so `dev` lists the endpoint under `unavailableDebugEndpoints` with
  `"reason": "elevated"` and prints a `[dev] Debugging:` hint. F12 still works;
  for the endpoint, run `dev` and your IDE without elevation.
- **WebView2 DevTools window.** While a window's developer tools are on, its
  system menu (Alt+Space, or a right click on the title bar) has **Open
  DevTools** (since 0.21), and `await window.OpenDevToolsAsync()` opens the
  same Edge DevTools window from code, for example from a development-only menu
  item of your own. It returns `false` where the developer tools are off, as in
  production, and on WKWebView, WebKitGTK and installed browsers.
- **WebView2 DevTools extensions** (since 0.21). In Development a WebView2
  window loads unpacked browser extensions, such as React Developer Tools,
  Vue.js devtools or the [Runic DevTools extension](#the-runic-devtools-extension),
  so their panels appear in its DevTools window and their hooks run in the
  page. `dotnet runic dev` adds the Runic DevTools extension itself
  (`--no-devtools-extension` leaves it out). List other extension folders (each holds a `manifest.json`) in
  `DesktopHostOptions.DevToolsExtensions`, or for one session in
  `RUNIC_DESKTOP_DEVTOOLS_EXTENSIONS`, separated by `;`:

  ```powershell docs-test=skip:sdk-guide-excerpt
  dotnet runic dev -e RUNIC_DESKTOP_DEVTOOLS_EXTENSIONS="C:\Tools\react-devtools-extension;C:\Tools\vue-devtools"
  ```

  Outside Development the list is ignored and WebView2's extensions stay off,
  also those a development run installed into the same profile. Extensions are
  installed into the window's WebView2 profile before its first page loads, so
  every window of that profile runs them. When a folder leaves the list, the
  next Development run removes the extension Runic installed from it; Runic
  never removes one it did not install. A folder WebView2 rejects is reported
  as `devtools-extension-failed`, and the window opens without it. WebView2's
  extension support does not cover every Chrome extension API, so not every
  panel works. WKWebView, WebKitGTK and installed browsers ignore the list.

- **WKWebView** makes the page inspectable (`isInspectable`) in Development;
  macOS before 13.3 decides that itself.
- **WebKitGTK.** `DevTools` controls WebKit's developer extras on both GTK
  hosts (and their side panels), so Inspect Element and the Web Inspector work
  in the window under `dotnet runic dev`. Since 0.21, `dev` also opens the page
  to JavaScript debuggers on port 9222 through WebKit's remote inspector; see
  [on Linux: the CDP adapter](#on-linux-the-cdp-adapter-preview). A
  `WEBKIT_INSPECTOR_SERVER` or `WEBKIT_INSPECTOR_HTTP_SERVER` you set yourself,
  with `-e` or in `dev`'s environment, is used as it is; outside Development
  Runic clears both (above).
- **Do not set `WEBKIT_INSPECTOR_HTTP_SERVER` on WebKitGTK 2.54.2 or
  earlier**, releases without the fix for
  [WebKit bug 330602](https://bugs.webkit.org/show_bug.cgi?id=330602) (fixed in
  2.54.3 and 2.56; the 2.55 development releases count as unfixed). Their HTTP
  inspector accepts connections with any website's `Origin` and `Host`, so
  while the port is open, any web page you visit can drive the Window's page
  and, through it, the Bridge. `dev` warns about such a variable of your own,
  and `dotnet runic dev --webkit-inspector` refuses these releases.

**For agents.** Where a DevTools Protocol endpoint is open (WebView2 above, or
a Chromium browser started with remote debugging),
`chrome-devtools-mcp --browser-url=http://127.0.0.1:9222` or Playwright's
`connectOverCDP` attaches to the Window's page. In the page,
`globalThis[Symbol.for("runic.vite.inspect")].describe(element)` returns Runic
Inspect's overview as data (see [Runic Inspect](#runic-inspect)). On Linux,
`dev`'s endpoint translates what JavaScript debuggers use, not the page
automation these tools drive, so they are not supported there; on macOS there
is no endpoint. With [`--browser`](#the-page-in-chrome-dotnet-runic-dev---browser)
the page runs in a Chromium browser on every OS.

## JavaScript debuggers in your IDE

Breakpoints in `Frontend/src` stop in your IDE through the development server's
source maps when its JavaScript debugger reaches the page:

| OS      | Route                                                                                                           | VS Code configuration                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Windows | WebView2's DevTools Protocol endpoint on port 9222 ([above](#the-browsers-developer-tools-per-engine))          | `Window + WebView2 (Windows)`, `Attach to the page (JavaScript)`; in Visual Studio, Runic DevKit's [Debug the Window](#visual-studio) |
| Linux   | `dotnet runic dev`'s CDP adapter for WebKitGTK on port 9222 (preview, since 0.21)                               | `Window + WebKitGTK (Linux)`, `Attach to the page (JavaScript)`                                                                       |
| Any     | A CS-WebUI Window's Chrome or Edge on its DevTools Protocol endpoint (since 0.22)                               | An `attach` configuration of your own ([below](#cs-webui-pages-in-a-javascript-debugger))                                             |
| Any     | The Window's page in Chrome or Edge with `dotnet runic dev --browser` (since 0.21); the only IDE route on macOS | `Window in Chrome`                                                                                                                    |

### On Linux: the CDP adapter (preview)

Since 0.21, `dotnet runic dev` on Linux serves the Window's WebKitGTK pages to
JavaScript debuggers on port 9222, as WebView2 does on Windows. It starts the
Window with WebKit's remote inspector server (`WEBKIT_INSPECTOR_SERVER`) on a
loopback port and translates between the Chrome DevTools Protocol and the
WebKit Inspector Protocol. VS Code's JavaScript debugger attaches with the
template's `Attach to the page (JavaScript)` (`"type": "msedge"` with
`"useWebView": true`, or `"type": "chrome"`, and `webRoot` set to the frontend
directory): breakpoints, stepping, conditions, logpoints, exceptions, the
console, the page's variables and hover, also in code that runs while the page
loads, after a reload or an HMR update, and across a Window restart under
`dotnet watch`. `Window + WebKitGTK (Linux)` starts the Window under the .NET
debugger with `dotnet runic dev --no-window` and attaches it too. It works on
GTK 3 (WebKitGTK 4.1) and GTK 4 (WebKitGTK 6.0), X11 and Wayland.

`[dev] Debugging:` and the session file's `debugEndpoints` name the port,
next to WebKit's `inspector://` address, which GNOME Web (Epiphany) opens while
no debugger is attached.

- **Options.** `--no-debug-endpoint` opens neither. `--webkit-inspector`
  opens WebKit's own Web Inspector over HTTP for any browser instead of the
  adapter, on WebKitGTK 2.54.3 or later within 2.54, or 2.56 or later; WebKit
  serves either the socket or the HTTP inspector, never both.
- **Port 9222 taken.** `dev` moves the adapter to a free port and names it;
  change the attach configuration's `port`. Since 0.22 it also names what
  holds 9222 when it is your process (another `dev` session and its directory,
  or the command line), and warns when the project's `.vscode/launch.json` has
  a JavaScript attach configuration on 9222, such as the template's
  `Attach to the page (JavaScript)`, which would debug the other program's
  page. Under `--no-window`, whose IDE compound attaches to 9222, `dev` stops
  with `RAPPDEV1017` and names what holds the port, often another `dev`
  session.
- **No answer after attaching** (0.22). When the Window's page does not answer
  the debugger's first command within 5 seconds, as once right after WebKit's
  Web Inspector opened in the Window, `dev` prints a `[dev] Debugging:` line,
  sends the command once more if that is harmless, and then fails it with an
  error instead of the attach ending in silence.
- **Fixed in 0.22.** After a reload, a Vite page reload or a Window restart,
  js-debug no longer leaves the page stopped at the start of a module: the
  adapter sends its reply to `Debugger.resume`, a step, `Debugger.pause`,
  `Page.reload` or `Page.navigate` before the events that follow it, as
  Chromium does. After a Window restart, the debugger's commands wait until
  its breakpoints are set on the new page. The adapter also lets WebKit
  continue from a stop at the adapter's own breakpoint that the debugger had
  just turned off, instead of leaving the page stopped.
- **Not supported.** Setting a variable to an object or a `const`, restarting
  a frame, and the Elements, Network and other panels of a Chrome DevTools
  window on this endpoint. Rider's JavaScript debugger attaches to such ports
  too; that is not verified yet. The adapter stays a preview until its CI job
  has run through a release.
- **Reporting a problem.** `RUNIC_DEV_CDP_TRACE=<file>` writes the adapter's
  traffic, which contains the page's data, to a file only you can read. Script
  sources and other strings longer than 4096 characters keep only their first
  200 characters unless `RUNIC_DEV_CDP_TRACE_SOURCES=1`, which keeps them
  whole: on a page with about 4,000 modules, such a trace reached 723 MB in
  five minutes. The trace never shrinks or rotates; delete it when you are
  done.

See the dotnet-runic README's
[Debug the page's JavaScript on Linux](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/tools/dotnet-runic/README.md#debug-the-pages-javascript-on-linux-preview).

### Who can reach the Linux endpoints

Both endpoints listen on loopback only, and both can script the Window's page
and, through it, the Bridge:

- **Runic's CDP adapter.** It refuses requests that carry an `Origin` or a
  `Host` other than an IP address or `localhost`, so web pages in a browser
  cannot reach it. Loopback admits every local user, so `dev` also closes each
  connection whose other end belongs to another user (it reads
  `/proc/net/tcp`) and reports it in a `[dev]` line. The adapter connects only
  to a WebKit inspector port of the same user, and `dev` warns when another
  user holds 9222.
- **WebKit's `inspector://` port.** It is WebKit's, so `dev` cannot filter its
  clients. Any local user can connect to it and script the Window, also while
  a debugger is attached: WebKit serves one client and lets a new one take its
  place (WebKitGTK 2.54).

**On a machine that you share with other users, run `dev` with
`--no-debug-endpoint`**, which opens neither. See the
[security guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/security.md#development-server).

### The page in Chrome (`dotnet runic dev --browser`)

Since 0.21, `dotnet runic dev --browser` serves the Window without a native
window (its serve-only mode, `RUNIC_APPLICATION_SERVE_ONLY=1`), and your IDE's
JavaScript debugger opens its page in Chrome or Edge at
`http://127.0.0.1:9224/`, which `dev` redirects to the Window's own address
(it changes with every start and carries the Window's credential, so `dev`
prints neither). This works the same on Windows, Linux and macOS, so it is the
IDE route to breakpoints in `Frontend/src` on macOS, where WKWebView has no
DevTools Protocol endpoint. The template's `Window in Chrome` configuration
(`--editor vscode`) runs it with a `runic: dev --browser` task: breakpoints
through the development server's source maps, stepping, conditions, logpoints,
exceptions, the console, reloads and HMR. Other IDEs open the same address from
their own JavaScript debug configuration, such as Rider's "JavaScript Debug".

- **Not the Window's engine.** The page runs on Chromium, so check WebKit- or
  WebView2-specific behaviour in the Window. It has no native window features:
  file dialogs, menus and the window's commands report `OwnerUnavailable`, and
  there is no side panel.
- **One browser.** The Window admits the first browser that connects. After
  `dotnet watch` restarts the Window, open the address again (or reload).
  Attach the .NET debugger to the process that `[dev] Window started` names, as
  without `--browser`.
- **Who can follow the redirect.** The address redirects only navigations
  that the browser starts itself (no `Origin`, a `Sec-Fetch-Site` of `none` or
  `same-origin`, an IP or `localhost` `Host`), so a web page cannot use it. On
  Linux it answers only the user who runs `dev`; macOS and Windows cannot tell
  a loopback connection's user, so there another local user's process can
  follow it first. On a shared machine, use `--browser` on Linux only.
- **Limits.** `--browser` cannot be combined with `--no-window` or
  `--webkit-inspector`, and opens no `debugEndpoints`: the debugger owns the
  browser it launched. Without a free loopback port it fails with
  `RAPPDEV1016`.

See the dotnet-runic README's
[Debug the page in Chrome](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/tools/dotnet-runic/README.md#debug-the-page-in-chrome---browser).

### The development server's source maps

Breakpoints in `Frontend/src` bind through the source maps that the frontend's
development server sends with each module. Since 0.22, `runic()`
(`@runic-artifex/vite-plugin-runic`) makes their `sources` absolute file
paths, such as `/home/me/App/Frontend/src/App.tsx` or
`C:/Users/me/App/Frontend/src/App.tsx`, where Vite 8 writes paths relative to
each module. A JavaScript debugger then finds your files without a web root.
Visual Studio's needs that: it attaches to the page over the DevTools Protocol
with no web root, and with relative paths breakpoints in `.tsx`, `.vue` and
`.svelte` files stayed unbound. VS Code's JavaScript debugger, the developer
tools of Chrome, Edge and WebView2, and Runic Inspect read the absolute paths
as they read Vite's.

Only `vite dev` changes: `vite build` and `vite preview` keep Vite's relative
paths, so no path of the build machine reaches a published map. The Angular
CLI's development server (`--frontend angular` without
`--angular-build vite`) writes maps of its own, which `runic()` does not reach;
use a debugger configuration with a web root there, or the Vite build of the
Angular frontend.

### CS-WebUI pages in a JavaScript debugger

Since 0.22, a CS-WebUI Window that runs in an installed Chrome, Edge or other
Chromium browser can open that browser's Chrome DevTools Protocol endpoint on
127.0.0.1, so an IDE's JavaScript debugger attaches to the page you are using:
breakpoints, stepping, the console and the page's variables. Visual Studio
debugs CS-WebUI pages only this way. Runic.Desktop adds
`--remote-debugging-port` to the browser's command line only when all of these
hold:

- the Window runs in **Development** and the window's `WebContent` policy does
  not set `DevTools = false`;
- **`RUNIC_WEBUI_REMOTE_DEBUGGING_PORT`** asks for it: `0` for a free port, or
  a fixed one;
- the browser is Chromium-based and runs with its own profile directory (the
  generated one, or `ProfilePath`); Firefox and the platform WebView fallback
  open no endpoint;
- the application's own browser arguments do not name
  `--remote-debugging-port`. If they do, theirs applies as written, and Runic
  adds no second one.

Any local process can attach to the endpoint, so it opens only when you or your
IDE ask for it: a terminal `dotnet runic dev` opens none. It also exists only in
untrimmed builds: a trimmed or NativeAOT publish turns the
`Runic.Desktop.WebUiRemoteDebugging` feature switch off, so the trimmer removes
the endpoint and its HTTP client, and such a build opens no endpoint even in
Development.

| Start                                                                                                       | Port             | Where to find it                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `dotnet runic dev` in a terminal                                                                            | None             | `[dev] Debugging:` says how to ask for one                                                                                     |
| `dotnet runic dev --debug-endpoint` (for an IDE to pass when it starts `dev`)                               | A free one (`0`) | `[dev] Debugging:` and the session file's `debugEndpoints` (`"engine": "chromium"`), while the browser runs                    |
| `dotnet runic dev --no-window`, then the IDE starts the Window with the session file's `window.environment` | 9225             | `debugEndpoints`, for the session; if something holds 9225, `dev` warns and lists it under `unavailableDebugEndpoints` instead |
| The template's `<Project> (CS-WebUI script debugging)` profile                                              | 9225             | The profile, and the Window's warning if it had to use another port                                                            |
| `dotnet runic dev -e RUNIC_WEBUI_REMOTE_DEBUGGING_PORT=<port>`                                              | Yours            | `[dev] Debugging:` and `debugEndpoints` once the Window confirms it                                                            |

A fixed port is reported only once `/json/version` answers on 127.0.0.1 and,
on Linux, no other user listens there; a taken one becomes a free port, with a
warning. `--no-debug-endpoint` wins over `--debug-endpoint`, and `--browser`
sets no port either.

**Visual Studio.** With Runic DevKit, Debug the Window starts the Window with
port 9225 and attaches to it, and Attach to the Page (JavaScript) attaches to a
Window that already runs with the port ([Visual Studio](#visual-studio)).
Without the extension, start the Window with the `(CS-WebUI script debugging)`
profile or with `dotnet runic dev --debug-endpoint`, then use Debug > Attach to
Process with the connection type "JavaScript and TypeScript (Chrome
DevTools/V8 Inspector)", the endpoint as the connection target, and the
"JavaScript and TypeScript" code type.

**VS Code.** Attach js-debug to the port. Give the address as `127.0.0.1`:
js-debug's default, `localhost`, can resolve to `[::1]`, where another user
can listen beside the browser.

```jsonc docs-test=skip:sdk-guide-excerpt
{
  "name": "Attach to the CS-WebUI page",
  "type": "chrome", // or "msedge" for Edge
  "request": "attach",
  "address": "127.0.0.1",
  "port": 9225, // or the port that [dev] Debugging: names
  "webRoot": "${workspaceFolder}/Frontend",
}
```

The gate is the environment, not the build: a Release build started in
Development with the variable opens the port too. The variable is inherited by
the processes the application starts, and a browser whose Window process died
keeps the endpoint open until you close that browser window. **On a shared
machine, run `dotnet runic dev --no-debug-endpoint`.** See
[CS-WebUI pages in a JavaScript debugger](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/debugging.md#cs-webui-pages-in-a-javascript-debugger)
and the
[security guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/security.md#development-server).

## The dock

Under `dotnet runic dev`, a page built with Vite shows the dock, the Vite
DevTools dock: a small bar at the edge of the window, when
`Frontend/vite.config.ts` registers `DevTools()`. Since SDK `0.20.0`,
`dotnet new runic-app` registers it for React, Vue, Svelte, SvelteKit, and
Angular with `--angular-build vite`; the Angular CLI runs no Vite plugins and
has no dock. To turn it off, delete the `DevTools(),` line.

Its **Runic** panel shows:

- **Bridge calls**, newest first, with the C# that ran and how long the page
  waited:

  ```text docs-test=skip:sdk-guide-excerpt
  command EditorViewModel.save → SaveAsync() 23 ms
  C# 21 ms · revision 4 · EditorViewModel.cs:42
  ```

  `C# <n> ms` is .NET's own timing of the handler. **Open** opens the handler
  (the `[RelayCommand]` method, a setter) in your editor: the one
  `LAUNCH_EDITOR` names, else a running VS Code, Rider, or other editor Vite
  recognizes.

- **Failures**: a failed call shows .NET's exception with a button per stack
  frame in your ViewModels; the **Last failure** card links the same frames.
  .NET sends the detail only in Development; see
  [failure detail in development](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/dotnet/Runic.Application.Views/README.md#failure-detail-in-development).
- **Connection**, each View's **state** as a tree, and **superseded
  commands**.

Under `dev` the dock loads from the development server's origin, not the
Window's. Since 0.22 the Window answers the dock's `/__devtools/embedded.js`
with a module that imports the script from the server, so the page runs it
once, and redirects the dock's other `/__devtools/` and `/__devtools-assets/`
requests to the server, so the dock's connection and icon come from there. The
same Development-only fallback forwards a `GET` or `HEAD` that neither `www/`
nor the application's `Resources` answer, such as a file of Vite's
`publicDir` or `<img src="brand/logo.svg">`, to the development server instead
of answering 404 (CS-WebUI redirects it). It does not forward the server's own
endpoints (`/__runic/`, `/__open-in-editor`, `/@fs/`, other first segments
starting with `__` or `@`), and a trimmed or NativeAOT publish removes it
(`Runic.Application.DevelopmentServerForwarding`). A Window that an IDE starts
under `dotnet runic dev --no-window` does not get the server's address yet, so
it still answers 404 for these paths.

The first time a page opens the dock, it asks for the **one-time code** that
Vite DevTools prints in the `dotnet runic dev` output. Keep that check on: it
keeps other pages of this machine out of the dock. See
[Bridge call timeline in the dock](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/web/vite-plugin-runic/README.md#bridge-call-timeline-in-the-dock).

The handlers and locations come from the **development source map** that each
build writes, `obj/<Configuration>/<TargetFramework>/runic-bridge/sources.json`,
from the assembly's portable PDB; `dev` passes its path to the development
server. The generated clients link into it too: Go to Definition on
`client.increment()` in a tsserver-based editor opens the C# handler. See
[source map and open in editor](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/web/vite-plugin-runic/README.md#source-map-and-open-in-editor).

## Runic Inspect

Press **Alt+Shift+X** in the page to turn on Runic Inspect, then click an
element (the click does not reach the page's handler). Esc turns it off. The
overview shows:

- the element's **component** and the components around it, with a link to
  its source (React, Vue, Svelte, Angular);
- the **commands** it calls, with their C# handlers, file and line, and
  availability (`canSave`), found in the component's source **before the first
  click** ("from the source, not called yet") and learned from the calls it
  makes;
- the **ViewModel members** it sets and the state it shows, with current
  values;
- its recent **Bridge calls**;
- **texts** from the ViewModel (text references) and the **messages** of
  `m.*()` calls it shows, with catalog, key, locale, and `.rmf2` file and line.
  **Edit** changes a message's text in every locale in place, without a reload
  (`@runic-artifex/vite-plugin-runic-translations` 0.12 or later).

Runic Inspect is plain DOM, so it works in every engine: WebView2, WKWebView,
WebKitGTK and an installed browser. Under `dotnet runic dev`, where the
window's document is the .NET host's page, it asks the Vite server for the
source map, the handler analysis, message sources, and opening, over the
development client's HMR connection, with the same access rules as the HTTP
endpoints. Under the Angular CLI, `runicDevSessionProxy()` answers the source
map, handler analysis and open requests over HTTP.

**What opens in the editor.** Only a location in a file the source map lists
(your C#), a frontend file that Vite serves to the page, or the `.rmf2`/`.mf2`
source that Runic Translations names for a message. Nothing else, unlike
Vite's `/__open-in-editor`.

**From another machine.** Runic Inspect's data is loopback-only by default.
`runic({ allow })` or `RUNIC_DEV_ALLOW` (addresses, CIDR networks such as a
Tailscale network, host names) lets other machines read the source map,
handler analysis and development state and edit translations; prefer addresses
and networks over host names, which are only as trustworthy as the resolver.
Opening in the editor always stays loopback-only, because it launches the
editor on the development machine: such a page shows locations without links.

**Who else can reach the development server** (since 0.21):

- `/__runic/state` and `/__runic/diagnostics` answer only loopback and the
  allowed machines, as the source map does, and `/__runic/state` refuses pages
  of another origin. Runic's HMR events are ignored from other clients, and the
  development state is sent only to admitted ones. A tool that read
  `/__runic/state` from another machine needs that machine in the allow list.
- With `server.allowedHosts: true`, where Vite answers any host name, Runic's
  endpoints and HMR connections check `Host` themselves: IP addresses,
  `localhost` and the allowed host names. Runic Translations' in-page editing
  does the same (Translations 0.13).
- Loopback admits every account on the machine. On Linux, opening in the
  editor and Runic Translations' writes accept a loopback client only when it
  belongs to the user who runs the dev server. macOS and Windows cannot tell
  local users apart, and the dev server logs that at start: on a shared
  machine, run it only for projects the other accounts may see.

See
[Runic Inspect](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/web/vite-plugin-runic/README.md#runic-inspect),
[edit a translation on the page](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/web/vite-plugin-runic/README.md#edit-a-translation-on-the-page),
and
[Runic Inspect from another machine](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/web/vite-plugin-runic/README.md#runic-inspect-from-another-machine).
`runic({ inspect: false })` turns it off.

## The Runic DevTools extension

Since 0.21, `dotnet-runic` ships an unpacked Chrome DevTools extension
(Manifest V3) that shows Runic Inspect's data inside the browser's own
developer tools. It has no Chrome Web Store listing; you load it from the
tool's folder.

- The **Runic** panel (a tab next to Elements and Console) lists the page's
  **Views**: each route with its C# ViewModel, revision and state, and its
  recent **Bridge calls** (the last 50) with kind, outcome, time, the C# member
  and, from a .NET host in Development, the C# handler's name and duration. A C#
  location opens in the editor through the development server, with Runic
  Inspect's rules. **Pause** stops the refresh.
- The **Runic** pane of the Elements panel (next to Styles) describes the
  selected element (`$0`) as Runic Inspect does: its component, ViewModels,
  bound members, commands with their C# handlers, recent calls and texts.

`dotnet runic dev` prints `[dev] DevTools extension: <folder>` when the page
has a development server, and the session file has the folder as
`devtoolsExtension`. It is the `devtools-extension` folder beside the tool, and
it changes with the tool's version.

- **In the Window on Windows**, `dotnet runic dev` loads it by default: in
  Development it appends the folder to the Window's
  [`RUNIC_DESKTOP_DEVTOOLS_EXTENSIONS`](#the-browsers-developer-tools-per-engine),
  after any folders you list there, unless it is listed already. Open the
  Window's DevTools (F12, or **Open DevTools** in its system menu) and choose
  the **Runic** panel. `dotnet runic dev --no-devtools-extension` leaves it
  out; with `--no-window`, the session file's `window.environment` carries the
  variable for your IDE's launch. Outside Development `dev` sets nothing and the
  host ignores the list.
- **In Chrome or Edge**, open `chrome://extensions` (`edge://extensions`), turn
  on **Developer mode**, choose **Load unpacked** and select that folder, then
  reopen the page's developer tools. After a tool update, load the new folder
  and remove the old entry. `dotnet runic dev --browser` prints the folder and
  this hint: load it once in the Chrome window that the IDE's launch opens,
  which keeps its profile between launches. Branded Chrome ignores
  `--load-extension`, so the template's `Window in Chrome` configuration passes
  none; with Chromium or Chrome for Testing as `runtimeExecutable`, add
  `"runtimeArgs": ["--load-extension=<folder>"]`.
- **WKWebView and WebKitGTK** load no extensions: use Runic Inspect and the
  dock there.

Its ID is always `cddbfcinbkaindmfgcfdgapddkjeadgh` (the manifest's public
`key` fixes it, whatever folder you load), so an allowlist can name it; the
session file has it as `devtoolsExtensionId`. It is not signed or published,
and its version is the tool's. It needs no permissions besides DevTools and
sends nothing anywhere: it reads the page through Runic Inspect's `snapshot()`
and `describe($0)`, which exist only under the development client, so it shows
data only where Runic Inspect runs (vite-plugin-runic 0.21 or later), and on a
production build its panes say so. See
[the Runic DevTools extension](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/debugging.md#the-runic-devtools-extension).

## React DevTools and Vue DevTools

Since 0.21, the development builds of the framework bindings show Runic's state
in the framework's own DevTools:

- **React DevTools.** The hooks label their values in a component's **hooks**
  pane: `useView` and `useSuspenseView` show the View
  (`EditorViewModel · editor · rev 12`), `useField` and `useTextField` the
  field's state (`title = "Draft" · editing · 1 error`), `useCommand`,
  `useOperation` and `useLatestOperation` their status (`running 40%`,
  `failed: …`), and `useBridgeConnection` the connection. React computes a
  label only while React DevTools shows the component.
- **Vue DevTools.** A **Runic Views** inspector lists the page's Views with
  their revision, presentations, state and last 20 calls (outcome, duration,
  C# handler, error), and the timeline has a **Runic Bridge calls** layer. It
  needs `@vue/devtools-api` 8, a new optional peer dependency of
  `@runic-artifex/vue` (`npm install -D @vue/devtools-api`), and loads only when
  Vue DevTools is on the page.

They work wherever the framework's DevTools reach the page: an installed
browser with the DevTools extension, a WebView2 window in Development with
[DevTools extensions](#the-browsers-developer-tools-per-engine), and
`vite-plugin-vue-devtools`, which runs inside the page, in every engine. See
[React DevTools and Vue DevTools](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/debugging.md#react-devtools-and-vue-devtools).

## Custom object formatters

In development, `@runic-artifex/views` registers custom object formatters
(since 0.21), so the console and the Sources panel's scope and watch views show
Runic objects readably instead of closures and proxies:

| Object                                                        | Header                                               | Expanded                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| A View client (`await connectEditor()`, `view.client`)        | `EditorViewModel · editor · rev 12`                  | view model, route, contract, revision, presentations, the state, the client |
| Its state (`client.snapshot`, a hook's or composable's state) | `EditorViewModel state · rev 12 {title: "Draft", …}` | each member                                                                 |
| A field controller's state (`controller.current`)             | `title = "Draft" · editing · 1 error`                | value, text, editing, errors, conflict, validating                          |

Turn them on once per browser profile: in Chromium's DevTools (Chrome, Edge,
WebView2), **Settings** › **Preferences** › **Console** › **Enable custom
formatters**; in Firefox, **Settings** › **Advanced settings** › **Enable
custom formatters**. Then reopen DevTools. WebKit's Web Inspector (WKWebView,
WebKitGTK, Safari) has no custom formatters. See
[custom object formatters](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/debugging.md#custom-object-formatters).

## Performance panel, async stacks and traces

The [tracing guide](tracing.md) covers these in full:

- **Performance panel.** In a Chromium engine (WebView2, Chrome, Edge), record
  with "Show custom tracks" on. The **Runic** track group has a **Bridge
  calls** track and, under `dotnet runic dev`, a **C# handlers** track with the
  handler's duration measured in .NET. Other engines list the same calls in the
  dock without the tracks.
- **Async stacks.** A breakpoint after a reply, such as in a state subscriber,
  shows a `Runic command EditorViewModel.save` async stack segment back to the
  click that made the call (Chromium).
- **One trace from the page to .NET.** With `OTEL_EXPORTER_OTLP_ENDPOINT` set
  in the shell that runs `dotnet runic dev`, the page's span for a call, the
  `runic.bridge.*` span, and the ViewModel's own spans form one trace in a
  local OTLP viewer such as the Aspire dashboard. `dev` starts no container or
  viewer: start the one you want yourself.

## Bridge errors while you type

Since SDK `0.20.0`, `Runic.Application.Views` ships Roslyn analyzers for the
Bridge rules that the source alone shows, so Visual Studio, Rider, and VS
Code's C# extension report them as you type, with the generator's ID, message
and help link, instead of only after a build. Code fixes rename a command (or
its `[RelayCommand]` method), make a setter private, or make a class public.
The generator still checks everything at build time. See
[errors and warnings while you type](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/diagnostics.md#errors-and-warnings-while-you-type),
and [troubleshooting](../../troubleshooting.md) for which product owns a
diagnostic ID.

With `TreatWarningsAsErrors`, `RUNICBRIDGE` warnings fail the build like other
warnings. Keep one a warning with `WarningsNotAsErrors`, hide it with `NoWarn`,
or fix the declaration.

## In production

None of this ships:

- `vite build` replaces the development client with an empty module: no dock,
  no Runic Inspect, no translation editor, no OTLP export. Its output is
  byte-identical with and without them.
- `@runic-artifex/views` has a development build, which `vite dev`,
  `ng serve` and Vitest resolve, and a production build without call
  reporting, `console.createTask` or trace context. `bun build` bundles the
  development build unless you pass `--production` or set
  `NODE_ENV=production`; the Views MSBuild targets set `NODE_ENV=production`
  for a Release build and `dotnet publish`. See the
  [development build](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/packages/web/views/README.md#development-build).
- `@runic-artifex/react` and `@runic-artifex/vue` have the same two builds
  (since 0.21): only the development build labels hooks for React DevTools,
  adds the Vue DevTools inspector and imports `@vue/devtools-api`. Custom
  object formatters, and Runic Inspect's `snapshot()` that the Runic DevTools
  extension reads, exist only in development.
- The source map stays in `obj`: it is not in generated TypeScript, build or
  publish output, or a package. Shipped Runic JavaScript has no source map
  comment.
- Outside Development, a Runic Desktop window has no developer tools in the
  window, no Open DevTools item and no browser extensions, replies carry no
  handler timing, and failures carry no exception detail. Since 0.21 no host
  opens a remote debugging endpoint that the environment asks for: see
  [the browser's developer tools per engine](#the-browsers-developer-tools-per-engine).
  The Linux CDP adapter and `--browser` exist only in `dotnet runic dev`.
  Do not ship with `DOTNET_ENVIRONMENT=Development`; see the
  [security guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.22.0/docs/security.md#release-builds)
  and [shipping](../../desktop/shipping.md).
- Since 0.22 a trimmed or NativeAOT publish turns off three development-only
  feature switches, so the trimmer removes their code:
  `Runic.Application.DevelopmentServerForwarding` (the development server
  fallback of [the dock](#the-dock)), `Runic.Desktop.WebUiRemoteDebugging`
  (the CS-WebUI endpoint) and
  `Runic.Application.Views.Desktop.DevelopmentAssets` (`dev`'s live frontend
  directory). Only the publish turns them off: a project that sets
  `PublishAot` or `PublishTrimmed` keeps them in `dotnet build`, `dotnet run`,
  `dotnet runic dev` and IDE debugging.

## Troubleshooting

- **No DevTools Protocol endpoint on Windows.** `dev` or your IDE runs
  elevated, and `dev` printed a `[dev] Debugging:` hint; the session file lists
  the endpoint under `unavailableDebugEndpoints`. Run both without elevation.
  Without that hint, check that `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` reaches
  the Window: set it in the launch profile, with `dotnet runic dev -e`, or in
  the environment `dev` runs in.
- **Windows Defender Firewall asks about `node.exe` or `bun.exe` on the first
  `dev`.** Vite 8 checks that the port is free by listening on it briefly on
  all interfaces before it binds the `127.0.0.1` that `dev` passes. Nothing is
  served on that short listen. Cancel or deny the prompt: the development
  server stays on loopback.
- **`RAPPDEV1004: Could not start 'npm ci'` on Windows.** Fixed in 0.22:
  `dotnet runic` finds programs through `PATH` and `PATHEXT` and starts batch
  files such as `npm.cmd` through `cmd.exe`. Update the tool.
- **F12 does nothing.** The Window does not run in Development: start it with
  `dotnet runic dev` or a launch profile that sets
  `DOTNET_ENVIRONMENT=Development`. On macOS, use Safari's Develop menu
  instead, and on Linux Inspect Element from the page's context menu.
- **The breakpoint never binds, or the debugger detaches.** `dotnet watch`
  restarted the Window after a C# edit. Use `dotnet runic dev --no-window` and
  F5. On Linux, VS Code's JavaScript debugger stays attached across the
  restart; with `--browser`, open the address again.
- **No JavaScript debugger endpoint on Linux.** `dev` printed no
  `[dev] Debugging: JavaScript debuggers attach …` line: it ran with
  `--no-debug-endpoint`, `--webkit-inspector` or `--browser`,
  `WEBKIT_INSPECTOR_HTTP_SERVER` is set, or the application runs on CS-WebUI
  only. When the attach fails although the line is there, close GNOME Web's
  inspector (WebKit serves one client at a time) and check the line's port:
  another program had 9222, and `dev` took another. `dev` names that program
  when it is yours and warns when `.vscode/launch.json` attaches to 9222: set
  the configuration's `port` to the one `dev` names, or stop the other program
  and restart `dev`. Under `--no-window`, `dev` stops with `RAPPDEV1017`
  instead.
- **The JavaScript debugger attaches on Linux but nothing loads.** `dev`
  printed `[dev] Debugging: the Window's page did not answer …`. Close WebKit's
  Web Inspector (Inspect Element) and any `inspector://` page, then attach
  again. To report it, run `dev` with `RUNIC_DEV_CDP_TRACE=<file>`.
- **Breakpoints in `.tsx`, `.vue` or `.svelte` files stay hollow in Visual
  Studio.** Update `@runic-artifex/vite-plugin-runic` to 0.22, and check that
  the Window loads the page from the development server (start
  `dev --no-window` first).
- **"Could not read source map" for `inspect-frameworks.js`.** Update
  `@runic-artifex/vite-plugin-runic` to 0.21: a doc comment in 0.20's file read
  as a source map comment.
- **The Runic DevTools panel is empty or says the page has no Runic Inspect.**
  The page is a production build, runs `runic({ inspect: false })`, or uses
  vite-plugin-runic older than 0.21. Reopen developer tools after loading the
  extension.
- **Console shows closures instead of Views.** Turn on **Enable custom
  formatters** in DevTools' settings and reopen DevTools.
- **F5 shows the production page.** `dotnet runic dev --no-window` was not
  running when the IDE built. Start it first and wait for `[dev] Ready`.
- **`obj/runic/dev-session.json` stays `starting` on Windows.** Fixed in 0.22:
  `dev` retries replacing the session file and the frontend marker while
  another process holds them open, and otherwise warns and writes them again on
  its next change or heartbeat.
- **The dock asks for a code.** Enter the one-time code that Vite DevTools
  printed in the `dotnet runic dev` output.
- **No dock.** The Vite configuration does not register `DevTools()`, or the
  frontend runs on the Angular CLI.
- **No C# handler in the dock, or Runic Inspect shows no C# location.** The
  project has not been built since the ViewModel changed, the build has no
  portable PDB, or `runic({ sourceMap: false })` is set. The overview's notes
  say which. Locations without links mean the page was opened from another
  machine.
- **A command shows only after its first click.** The handler calls the client
  in another file (a store, a service, a custom hook); the overview names the
  import.
- **No messages in Runic Inspect.** The Translations Vite plugin is older than
  0.12, or the component does not render again on a text change
  (`useTextLocale`, `textLocaleSignal`).
- **No C# handlers track, or no page spans in the trace.** See the
  [tracing guide's troubleshooting](tracing.md#troubleshooting).
- **A Bridge error appears only after building.** The rule depends on more than
  the source; the analyzers leave it to the generator.
