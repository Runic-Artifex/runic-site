# Migrating from the source-preview WebUI-shaped API

Runic Desktop has no public `WebUi*` identity. It models the actual ownership
graph instead of making one “window” own content, a listener, sessions, and a
platform presentation at once. Calls between the page and .NET go through
[Runic Windows and Views](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/packages/dotnet/Runic.Application.Views.Desktop/README.md)
(`Runic.Application.Views.Desktop`): ViewModel commands and operations over
the generated Bridge. This page follows SDK `0.11.0`; SDK `0.10.0` made the
low-level presentation transport of `DesktopSurface` internal.

| Source-preview API                          | Runic SDK 0.11.0                                                                | Reason                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `WebUiApplication` process globals          | immutable `DesktopHostOptions` and `await using DesktopHost`                    | configuration and shutdown belong to one host                                |
| `WebUiWindow` server/content state          | `DesktopSurface`                                                                | content, connections, requests, and sessions share one isolated namespace    |
| `WebUiWindow` browser/WebView state         | `DesktopWindow`                                                                 | closing a presentation no longer implicitly closes its surface               |
| `BindAsync`                                 | ViewModel commands and operations of a `RunicWindow<T>` over the Bridge         | the generated TypeScript client is typed, and Views report typed errors      |
| `WebUiEvent`                                | the Bridge call of a generated client; `DesktopConnectionEvent` for connections | invocations and sessions are not exposed; count pages with `ConnectionCount` |
| `WebUiResult`                               | the command's or operation's typed result                                       | the Bridge carries the ViewModel's own types                                 |
| `WebUiContent` / `WebUiFileHandler`         | `ContentResponse` / `ContentHandler`                                            | handlers receive request-scoped services and cancellation                    |
| `SetPort`, `SetPublic`, global client flags | `DesktopHostOptions` / `DesktopSecurityPolicy`                                  | live security boundaries cannot be mutated silently                          |
| `IWebUiEmbeddedHost*`                       | `IDesktopWindowHost*`                                                           | platform adapters describe presentation hosting, not WebUI compatibility     |

## Serve content

The common server-only migration is:

```csharp docs-test=source:examples/dynamicdata/Program.cs
await using var desktop = await DesktopHost.StartAsync(hostOptions);
var surfaceOptions = new DesktopSurfaceOptions { Content = new DesktopContent.Directory(Path.Combine(AppContext.BaseDirectory, "www"), "index.html") };
...
await using var surface = await desktop.CreateSurfaceAsync(surfaceOptions);
```

A Runic Views application on `RunicDesktopHost` needs no such branch to serve
without a window: since SDK `0.7.0-preview.8`, the host honours
`RUNIC_APPLICATION_SERVE_ONLY=1` as the CS-WebUI host does. It opens no window,
writes `RUNIC_APPLICATION_URL=<url>` and serves until a line is read from
standard input, as in the
[First Window on Runic Desktop](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/examples/first-window-desktop/README.md)
browser test.

`Content` takes one `DesktopContent` case: `Directory(root, entry?)` for local
files, `Html(document)`, `ExternalUrl(url)` or `Handler(contentHandler)`. Only
directory content serves local files. This form is new in Runic SDK
0.7.0-preview.1; 0.6.0-preview.1 sets `RootFolder` and a `Content`
string, or `ContentHandler`. The
[0.7 upgrade notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/eng/release/notes/0.7.0-preview.1.md#upgrading)
map each 0.6 form to its case.

## Calls between the page and .NET

Move each bound function to the ViewModel of a Runic Window, and open the
Window with `RunicDesktopHost.Run`, which creates the host and surface:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.Desktop/README.md
return RunicDesktopHost.Run(provider, options, async host =>
{
    // Stops at startup when a registration, WebView runtime or window option is missing.
    host.ValidateWindow<MainWindow>().ThrowIfInvalid();
    await using var window = await host.OpenWindowAsync<MainWindow>(new RunicWindowOptions { Width = 800, Height = 600 });
    await window.WaitForCloseAsync();
    return 0;
});

public sealed partial class MainWindow : RunicWindow<MainViewModel>;
```

The page calls the ViewModel through the TypeScript client that the build
generates for `MainViewModel`; see
[Runic Application](../../application/README.md). Code that only needs the
surface, without Views, opens a window and runs scripts on the page:

```csharp docs-test=readme:packages/dotnet/Runic.Desktop/pack/README.md
await using var window = await surface.OpenWindowAsync();
using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
Console.WriteLine(await surface.ExecuteJavaScriptAsync("return document.title;", timeout.Token));
await window.WaitForCloseAsync();
```

From SDK 0.9 code, the
[0.10.0 upgrade table](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/eng/release/notes/0.10.0.md#runic-desktop-and-gtk-4)
maps the removed surface members:

| SDK 0.9                                                                            | SDK 0.10.0                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `surface.RegisterCapability(name, handler)` and `PresentationResult`               | ViewModel commands and operations over the Bridge (`Runic.Application.Views.Desktop`)                  |
| `surface.RunJavaScriptAsync(script)`                                               | `await surface.ExecuteJavaScriptAsync(script + "; return '';")`                                        |
| `surface.NavigateAsync(url)`, `surface.SendAsync(…)`, `PresentationSession`        | No public replacement; navigate with the window's content or through Views                             |
| `surface.SubscribeConnectionEvents(invocation => …)` with `PresentationInvocation` | `surface.SubscribeConnectionEvents(connection => …)` with `DesktopConnectionEvent` (`Kind`, `Surface`) |
| `#pragma warning disable RUNICDESK101`                                             | Remove it; `ExecuteJavaScriptAsync`, `ConnectionCount` and `SubscribeConnectionEvents` are stable      |

`WaitForCloseAsync` completes when the window closes, while the platform
window loop stays responsive, including AppKit's main-thread loop on macOS.

## Security and web content

Security is intentionally stricter. The default bridge handshake requires the
surface's 256-bit bootstrap credential and a canonical same origin. Public
binding, additional origins, missing origins for non-browser clients, and
multi-client admission must be selected explicitly. Credentials never appear
in URLs and are invalidated with their surface or host.

Since SDK `0.10.0` an installed browser opens a one-time launch code instead
of the surface address, and only the browser that used it can load the
bootstrap scripts and open the Bridge. Embedded windows open links to other
sites in the default browser, never open a second WebView for `window.open`,
cancel downloads and enable developer tools only in Development, unless
`DesktopWindowOptions.WebContent` says otherwise; see
[links, new windows, downloads and developer tools](https://github.com/Runic-Artifex/runic-sdk/blob/v0.12.1/packages/dotnet/Runic.Desktop/README.md#links-new-windows-downloads-and-developer-tools).

Since SDK `0.11.0`, surface responses send `Content-Security-Policy:
frame-ancestors 'self'` (plus `AdditionalOrigins`) and
`X-Frame-Options: SAMEORIGIN`, so other origins cannot frame the application,
and a surface framed under another origin gets no Bridge credential.
WKWebView denies camera and microphone without `MediaCapture` instead of
prompting, WebKitGTK denies them while a cross-origin subframe exists, and
installed Chromium-based browsers ask the user instead of granting.
`DesktopSurfaceOptions.ContentSecurityPolicy`, and
`RunicDesktopHostOptions.ContentSecurityPolicy` for every Window of a Views
application, send a policy with the surface's pages. The Views Bridge no longer
needs `'unsafe-eval'`, and new projects send a policy without it outside
`Development`:

```csharp docs-test=template:Program.cs host=desktop
const string contentSecurityPolicy = "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
...
var hostOptions = new RunicDesktopHostOptions { ContentSecurityPolicy = developing ? null : contentSecurityPolicy };
```

Remove `'unsafe-eval'` from an existing application's policy, or add a policy.
`ExecuteJavaScriptAsync`, which the migration above uses, evaluates its script
with the `Function` constructor and still needs `'unsafe-eval'` in the policy
of the page it runs in.

Runic Desktop keeps its internal `webui-compat/52f9e75` implementation only as
protocol and differential evidence; it is not a public application protocol.
Pages can no longer call .NET functions registered on the surface, so move
those calls to Views. CS-WebUI remains the separate upstream-compatible product
for consumers that need the original WebUI-shaped .NET API.
