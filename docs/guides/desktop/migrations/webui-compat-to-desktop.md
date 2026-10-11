# Migrating from the source-preview WebUI-shaped API

M6 removes the transitional public `WebUi*` identity. Runic Desktop now models
the actual ownership graph instead of making one “window” own content, a
listener, sessions, and a platform presentation at once.

| Source-preview API                          | M6 API                                                       | Reason                                                                     |
| ------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `WebUiApplication` process globals          | immutable `DesktopHostOptions` and `await using DesktopHost` | configuration and shutdown belong to one host                              |
| `WebUiWindow` server/content state          | `DesktopSurface`                                             | content, capabilities, requests, and sessions share one isolated namespace |
| `WebUiWindow` browser/WebView state         | `DesktopWindow`                                              | closing a presentation no longer implicitly closes its surface             |
| `BindAsync`                                 | `RegisterCapability`                                         | capabilities are admitted explicitly and handlers are async-first          |
| `WebUiEvent`                                | `PresentationInvocation` and `PresentationSession`           | invocation and session ownership are distinct                              |
| `WebUiResult`                               | `PresentationResult`                                         | removes compatibility identity while retaining the selected wire profile   |
| `WebUiContent` / `WebUiFileHandler`         | `ContentResponse` / `ContentHandler`                         | handlers receive request-scoped services and cancellation                  |
| `SetPort`, `SetPublic`, global client flags | `DesktopHostOptions` / `DesktopSecurityPolicy`               | live security boundaries cannot be mutated silently                        |
| `IWebUiEmbeddedHost*`                       | `IDesktopWindowHost*`                                        | platform adapters describe presentation hosting, not WebUI compatibility   |

The common server-only migration is:

```csharp docs-test=source:examples/first-window-desktop/Program.cs
var hostOptions = new DesktopHostOptions { WaitForConnection = !serveOnly && !probeOwner };
...
await using var desktop = await DesktopHost.StartAsync(hostOptions);
...
await using var surface = await desktop.CreateSurfaceAsync(new DesktopSurfaceOptions
{
    Content = new DesktopContent.Directory(Path.Combine(AppContext.BaseDirectory, "www"), "index.html"),
});
```

`Content` takes one `DesktopContent` case: `Directory(root, entry?)` for local
files, `Html(document)`, `ExternalUrl(url)` or `Handler(contentHandler)`. Only
directory content serves local files. This form is new in Runic SDK
0.7.0-preview.1; 0.6.0-preview.1 sets `RootFolder` and a `Content`
string, or `ContentHandler`. The
[0.7 upgrade notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/eng/release/notes/0.7.0-preview.1.md#upgrading)
map each 0.6 form to its case.

Register capabilities on the surface, then open an optional window:

```csharp docs-test=readme:packages/dotnet/Runic.Desktop/pack/README.md
using var greeting = surface.RegisterCapability(
    "greet",
    static (invocation, _) =>
        ValueTask.FromResult<PresentationResult>($"Hello, {invocation.GetString()}!"));
await using var window = await surface.OpenWindowAsync();
await window.WaitForCloseAsync();
```

`WaitForCloseAsync` completes when the window closes, while the platform
window loop stays responsive, including AppKit's main-thread loop on macOS.
Applications built on Runic Application Views open Windows with
`RunicDesktopHost.Run` and `host.OpenWindowAsync<TWindow>()` instead, which
create the host and surface for them.

Security is intentionally stricter. The default bridge handshake requires the
surface's 256-bit bootstrap credential and a canonical same origin. Public
binding, additional origins, missing origins for non-browser clients, and
multi-client admission must be selected explicitly. Credentials never appear
in URLs and are invalidated with their surface or host.

Runic Desktop remains on the `webui-compat/52f9e75` wire profile during M6, so
existing pages using `webui.js` and generated capability functions continue to
work. CS-WebUI remains the separate upstream-compatible product for consumers
that need the original WebUI-shaped .NET API.
