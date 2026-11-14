# Hosted regions

[Hosted applications](hosted-applications.md) show a guest's Windows in native
windows of the host. From SDK `0.18.0` a host can instead show a guest's Window
in a **region** of one of its own pages. An installer can show a separate check
tool as one step of its wizard, with its header, step indicator and footer in
place, one window and one taskbar entry. A dashboard can show small widgets of
other processes. A region shows the guest in one of two ways:

- **Region mode** (frame mode, `region/1`): the guest's page loads in a
  sandboxed, cross-origin frame from the guest's own loopback origin. Host page
  and guest page cannot read or script each other. Use it by default.
- **Component mode** (trusted component mode, `region-component/1`): the guest's
  Views render as a custom element in the host page's own document, with its
  theme and layout. Host page and guest code share one JavaScript realm. Use it
  only for applications of the same vendor.

**Experimental since SDK `0.18.0`**, as hosted applications are: suppress
[`RUNICDESK103`](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/docs/experimental.md#RUNICDESK103).
The page element is in `@runic-artifex/views/experimental`, and React, Vue,
Svelte and Angular wrap it as `RunicHostedRegion` in their `./experimental`
entries. Host and guest both need 0.18: a guest of 0.17 cannot be shown in a
region. From SDK `0.19.0` a host can also give a region's window an
[appearance of its own](#design-and-appearance), which needs a guest of 0.19.

**Checked with**: Runic CI runs the
[hosted region example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/examples/hosted-region/README.md)
and the
[hosted components example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/examples/hosted-components/README.md)
on Linux (GTK 3 and WebKitGTK 4.1) and, as the elevated pair, on Windows x64
(WebView2). Automation checks that the guest's controls inside a region appear
in the accessibility tree. **Assistive-technology behaviour of hosted regions
(NVDA, Narrator, VoiceOver) was not checked manually for 0.18.0 or 0.19.0**: nothing yet
confirms how a screen reader reads a guest's page inside a region.

## Show a guest's Window in a region

A guest of SDK 0.18 or later can be shown in a region without code of its own:
its Window's `OpenWindowAsync` completes as soon as the host decided, and its
page loads when the host attaches the Window to a region. The host's policy
decides per window, at its open:

```csharp docs-test=skip:sdk-guide-excerpt
#pragma warning disable RUNICDESK103 // Hosted application windows are experimental.
public ValueTask<RunicHostedWindowDecision> OpenWindowAsync(RunicHostedWindowRequest request, CancellationToken cancellationToken) =>
    ValueTask.FromResult(request.Owner is null && request.CanEmbed
        ? RunicHostedWindowDecision.Embed("check", new RunicHostedRegionOptions { Permissions = DesktopPermissionGrant.None })
        : RunicHostedWindowDecision.Refuse("The installer shows the check only in its step page."));
```

`CanEmbed` is `false` for a guest of 0.17. The host's page declares the region,
with content for each state:

<!-- prettier-ignore -->
```html docs-test=skip:sdk-guide-excerpt
<runic-hosted-region name="check">
  <p slot="waiting">Starting the system check…</p>
  <p slot="detached">The system check is not shown right now.</p>
  <p slot="ended">The system check has ended.</p>
  <p slot="fallback">The system check is not shown.</p>
</runic-hosted-region>
<script type="module">
  import { defineHostedRegion } from "@runic-artifex/views/experimental";
  defineHostedRegion();
</script>
```

- **States and fallback content.** The element is `waiting` until a window is
  attached, `loading` while the guest's page loads, then `attached`,
  `detached`, `ended` or `unsupported` (no host feature, or an embedding the
  page does not know). A child whose `slot` names the state shows in that
  state, `slot="fallback"` in any other. In C#, `RunicHostedRegion.State`
  follows the same states (`Waiting`, `Loading`, `Attached`, `Detached`,
  `Ended`) with `StateChanged`, `Attached`, `Detached` (with the reason:
  `removed`, `reload`, `crashed` or `host`), `TitleChanged`,
  `DocumentEditedChanged` and `PreferredSizeChanged`;
  `IRunicHostedApplications.RegionAttached` and `RegionDetached` report every
  guest's.
- **Size.** By default (`sizing="fill"`) the page's layout sets the region's
  size and the guest's page scrolls inside it, so give the region a height,
  such as a flex item between header and footer. With
  `sizing="content-height"` the guest's content height applies, between
  `RunicHostedRegionOptions.MinimumHeight` and `MaximumHeight`. The engine lays
  the frame out, so zoom and DPI follow without reports.
- **Departures.** A departure the host decides, such as a wizard's Back or
  Next, asks the guest first: make the step's navigation entry a departure
  guard that returns `region.AsDepartureGuard().CanDepartAsync(departure, token)`,
  or call `RequestCloseAsync`. The departure goes ahead only once the guest
  allowed it and its Window closed. A page that removes or reloads the region
  without a decision in C# only detaches the Window, which attaches again when a
  region of the same name appears in the same host window (`ReattachOnReload`,
  on by default). `DetachAsync` and `MoveToAsync(window, name)` move it under the
  host's control.
- **Focus.** Tab and Shift+Tab move through the frame in document order.
  `RunicHostedRegionOptions.FocusOnAttach` and `present` move the focus into the
  region only while the host page holds none: a guest never takes the focus from
  the host's controls. The clipboard and launches count as the user's only after
  the user moved the focus into the region (Tab, Shift+Tab or a click).
- **Permissions.** `RunicHostedRegionOptions.Permissions` is the frame's `allow`
  attribute and decides its camera and microphone requests:
  `DesktopPermissionGrant.None` for none, `MediaCapture` for both. Without it,
  the frame gets what the host's own windows would. WebKitGTK denies them in a
  region.
- **Presentation.** Requests that do not apply in a region (maximize, move,
  minimize, visibility, full screen, colour scheme, the represented file) report
  `BackendUnavailable`, and a menu bar is not shown. Dialogs, context menus,
  monitors and announcements are the host window's.

What the guest should know:

- **Its page is its built content.** A guest whose Window shows a development
  server's address (`dotnet runic dev`) cannot be attached (event 2026). Develop
  the guest on its own, or in window mode, and attach its build.
- **No `frame-ancestors` of its own.** Runic sends the frame's
  `frame-ancestors`, which names only the host page's origin. A guest page whose
  policy says `frame-ancestors 'none'` blocks its own region.
- **Storage.** A region's `localStorage` and IndexedDB live in the host's web
  view profile or the user's browser, partitioned under the host page's site.
- **Title.** The page's `document.title` names the frame and reaches the host as
  `RunicHostedRegion.Title`.
- **Tests.** `RunicTestHost` plays a region host:
  `RunicTestHostOptions.EmbedWindow` chooses the windows, and
  `AttachRegionAsync(embedder)` returns the one-time frame address to load in a
  test page. The hosted region example's
  [check tests](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/examples/hosted-region/Check/Tests/HostedCheckTests.cs)
  attach a region and play the host's departures without a browser.

### The page's Content-Security-Policy

The guest's frame comes from `[::1]` (for a page on `127.0.0.1`) on a port that
changes with each run, and a CSP host source cannot name an IPv6 address. A host
page with a policy allows frames with `frame-src http:` (or `child-src`, or a
`default-src` that does); otherwise the frame is blocked and the region stays
`loading`. `<runic-hosted-region>` needs no inline styles, so `style-src 'self'`
is enough:

```text docs-test=skip:sdk-guide-excerpt
default-src 'self'; script-src 'self'; frame-src http:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

### Engines

|                                              | WebView2                         | WKWebView                          | WebKitGTK 4.1 (GTK 3)                                                | WebKitGTK 6 (`Runic.Desktop.Gtk4`) |
| -------------------------------------------- | -------------------------------- | ---------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| Files dropped onto the frame                 | To the guest                     | To the guest                       | To the guest                                                         | Discarded                          |
| Camera and microphone of the frame           | By `Permissions`                 | By `Permissions`                   | Denied; while a region is attached, the host page's own requests too | Denied                             |
| A shortcut the guest's page leaves unhandled | Runs the host window's menu item | Native key equivalents             | Native unhandled-key path                                            | —                                  |
| The frame's content process ends             | Detach `crashed`, attach again   | Detach `crashed`; the page reloads | Detach `crashed`; the page reloads                                   | Detach `reload`                    |

`Runic.Desktop.Gtk4`'s window routes nothing of a region's frame. On Linux,
prefer the GTK 3 host for an application that shows regions. Whether a region
page's `prefers-color-scheme` follows an [appearance override](#design-and-appearance)
also depends on the engine.

### Browser (serve-only) hosts

A serve-only application hosts guests only in regions of its pages in the user's
browser. `RunicHostedWindowRequest.CanOpenWindow` is `false`, so a decision
other than `Embed` or `EmbedComponent` fails the guest's open
(`hosted-window-refused`, event 2020). The guest gets no dialogs, menus, window
services or `present`. The frame is always cross-site; without IPv6, a page on
`127.0.0.1` shows the region's fallback content (`cross-site-unavailable`,
event 2026). An elevated guest refuses a browser host's page (`guest-elevated`).

## Show a guest as a component

For applications of one vendor, both sides opt in. The guest allows the host:

```csharp docs-test=skip:sdk-guide-excerpt
Guest = RunicGuestOptions.FromStandardInput() with
{
    // A filter on what the host says about itself, not a security boundary.
    AllowComponentEmbedding = host => host.Name == "Contoso Dashboard",
},
```

It also needs a **component build**: the `component` target of
`@runic-artifex/vite-plugin-runic` (`runic({ component: { entry, name } })`)
builds an ES module that defines the guest's element, next to its page, and a
mount function typed `RunicComponentMount` from
`@runic-artifex/views/component` renders the guest's view into the element.
Build the component with `vite build`; the development server serves the page
only. A guest without the build refuses a component attach
(`embedding-unsupported`).

The host's policy decides `EmbedComponent` where the guest allows it:

```csharp docs-test=skip:sdk-guide-excerpt
ValueTask.FromResult(request.CanEmbedComponent
    ? RunicHostedWindowDecision.EmbedComponent("indexer")
    : RunicHostedWindowDecision.Embed("indexer"));
```

The component then inherits the page's CSS custom properties and takes part in
its layout. It touches no history, title, global listener, `<html lang dir>` or
document stylesheet; its CSS becomes constructable stylesheets in its shadow
root, so use `:host` rather than `:root`. The build names the element
`<name>-<hash of the build>`, and the same build loaded from a second origin is
`<tag>-2`; the page takes the tag from the module's `tag` export. Components of
an embedded host come from `127.0.0.1` on a port that changes with each run, so
the host page's policy must admit that origin:

```text docs-test=skip:sdk-guide-excerpt
default-src 'self'; script-src 'self' http://127.0.0.1:*; connect-src 'self' ws://127.0.0.1:*; frame-src http:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

That admits any local server's scripts, so keep such a page free of untrusted
content. A module that the policy blocks does not load, and the region shows
its `unsupported` content. In a component, `RunicHostedRegion.IsComponent` is
`true`; `Permissions` and `sizing="content-height"` do not apply, and the guest
sends no title.

The guest's code runs in the host page's realm and can read and change the page
and use its Bridge, and the page holds the guest's token. Embed components only
of applications of your own vendor.

## Design and appearance

From SDK `0.19.0` a host can give a region's window an **appearance override**
of its own (`region-appearance/1`, part of `RUNICDESK103`). The case is an
installer whose wizard step shows a check tool, where both offer the same
design menu: Light, Dark, High contrast and System. The installer's menu
decides for both, because to the user they are one window. The
[hosted region example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/examples/hosted-region/README.md#design) has
such a menu.

The host maps each design to a `RunicHostedAppearance`. Each member that is set
replaces the host's desktop value for the region window's pages, and `null`
keeps it, so the desktop's text scale and accent colour still reach the guest.
"System" is no override: `null`, or `DesktopColorScheme.NoPreference`, which
reads as `null`.

```csharp docs-test=skip:sdk-guide-excerpt
#pragma warning disable RUNICDESK103 // Hosted application windows are experimental.
static RunicHostedAppearance? AppearanceOf(string design) => design switch
{
    "light" => new RunicHostedAppearance { ColorScheme = DesktopColorScheme.Light },
    "dark" => new RunicHostedAppearance { ColorScheme = DesktopColorScheme.Dark },
    "high-contrast" => new RunicHostedAppearance { ColorScheme = DesktopColorScheme.Light, Contrast = DesktopContrast.More },
    _ => null, // System: the desktop's appearance.
};

// The policy passes the current design when the guest's window opens, so its page starts in it.
RunicHostedWindowDecision.Embed("check", new RunicHostedRegionOptions { Appearance = AppearanceOf(design) });

// The design menu changes it later, attached or detached.
await region.SetAppearanceAsync(AppearanceOf(design), cancellationToken);
```

The guest's page receives the merged appearance as its own, before its first
content: `appearance()` and `onAppearance` from `@runic-artifex/views` report
the colour scheme, contrast and reduced motion that the host set. Runic sets
nothing on the guest page's root, so the page maps the appearance there itself
and styles from that. The same page in a window of its own then follows the
desktop with the same code:

```ts docs-test=skip:sdk-guide-excerpt
import {
  appearance,
  onAppearance,
  type Appearance,
} from '@runic-artifex/views';

const mapAppearance = (look: Appearance) => {
  document.documentElement.style.colorScheme = look.colorScheme ?? '';
  document.documentElement.dataset['contrast'] =
    look.contrast ?? 'no-preference';
  document.documentElement.toggleAttribute(
    'data-reduced-motion',
    look.reducedMotion === true,
  );
};
mapAppearance(appearance());
onAppearance(mapAppearance);
```

- **Per window.** The override applies to the region window's pages only, a
  component's included. Windows that the region window owns, the guest's other
  windows and the host's own pages keep the desktop's appearance.
- **Replaced as a whole.** `SetAppearanceAsync` replaces the override and
  `null` removes it; `RunicHostedRegion.Appearance` is the current one. Set
  while the region is detached, it applies to the next page an attach loads.
  `MoveToAsync` and re-attaching keep it.
- **Older guests.** A guest of 0.18 still shows in the region, with the
  desktop's appearance: `RunicHostedWindowRequest.CanOverrideAppearance` and
  `RunicHostedRegion.CanSetAppearance` are `false`, `SetAppearanceAsync`
  returns `false`, and the host logs event 2030 once for the window. A policy
  for which the design matters decides with `CanOverrideAppearance`.
- **Style from the appearance, not from media queries.** A host cannot set
  `prefers-contrast`, `forced-colors` or `prefers-reduced-motion` on a frame:
  style from `[data-contrast="more"]` and `[data-reduced-motion]` after the
  mapping above. `<runic-hosted-region>` sets the override's colour scheme as
  the CSS `color-scheme` of the frame, or of a component's element; whether the
  frame's `prefers-color-scheme` follows it depends on the engine (WebView2,
  Chromium and WebKitGTK 2.54 do, WKWebView and older WebKitGTK do not). A
  component shares the host page's media queries. A desktop that forces
  colours, such as a Windows contrast theme, keeps forcing them in the frame.
- **Tests.** `RunicTestHost` plays the host:
  `RunicTestHostOptions.RegionAppearance` and
  `SetRegionAppearanceAsync(window, appearance)`. The mock bridge's
  `setAppearance(value, { override })` plays such a push in page tests.

## Elevated installers

An installer that runs as administrator can host a check tool that needs
administrator rights too. The host sets `RunicGuestStartInfo.AllowElevatedGuest`
and the guest `RunicGuestOptions.AllowElevatedHost`. In a region, the elevated
guest admits connections to every listener, its frame's included, only from
processes that run elevated, such as the installer's WebView2; any other is
refused (event 2029). On macOS, where Runic cannot look up a connection's
process, an elevated guest refuses regions and components: `Embed` leaves the
window detached (event 2026, `refused`), so show fallback content that says so.

## Troubleshooting

The host logs these events (`Runic.Application.Views.Desktop`):

| Event                                           | Meaning                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026 `DesktopHostedRegionAttachFailed`          | The guest refused or failed to attach its window; the window stays open and detached, and the page shows its fallback. The reason (`refused`, `guest-elevated`, `cross-site-unavailable`, `embedding-unsupported`, `invalid-request`, `invalid-reply`, `failed`) says why. |
| 2027 `DesktopHostedRegionSameSite`              | The guest serves the frame from the host page's own loopback family (no IPv6), so the frame receives the host page's cookies. Embedded hosts only.                                                                                                                         |
| 2028 `DesktopHostedRegionFailed`                | Region handling failed with an exception.                                                                                                                                                                                                                                  |
| 2029 `DesktopHostedPeerRefused`                 | An elevated guest refused a connection from a process that does not run elevated, or whose process it cannot look up. Logged by the guest.                                                                                                                                 |
| 2030 `DesktopHostedRegionAppearanceUnavailable` | The host gave a region window an appearance override, but the guest (0.18 or older) does not apply one: the window shows the desktop's appearance. Once per window.                                                                                                        |

- **The region stays `loading`**: the host page's policy blocks the frame
  (`frame-src http:`), or the guest's page sets `frame-ancestors 'none'`.
- **The region stays `waiting`**: no window was decided for it. The guest did
  not start, its policy refused it, two host windows declared the name
  (`region-ambiguous`), or `CanEmbed` was `false`.
- **The guest's page does not follow the host's design**: it styles from
  `prefers-contrast` or `prefers-color-scheme`, which a frame cannot be given,
  maps `onAppearance` without applying `appearance()` at the start, or the
  guest is 0.18 (event 2030).
- **A component region is `unsupported`**: the page's policy does not admit
  `http://127.0.0.1:*` in `script-src` or `ws://127.0.0.1:*` in `connect-src`.
- **`native-server-unavailable`, "implements ABI 4, but Runic.Desktop needs
  ABI 5"**: `Runic.Desktop.NativeServer` is older than `Runic.Desktop`. Use the
  same version of every Runic package.

On Windows, `RUNIC_DESKTOP_REGION_TRACE=1` makes WebView2 write each region
frame's creation, navigation and process failure to standard error as
`REGION TRACE webview2: …`. It is a diagnostic aid, not an interface.

## Known issues in 0.19.0

- Assistive-technology behaviour of hosted regions (NVDA, Narrator, VoiceOver)
  was not checked manually. Automated checks cover layout, focus and Tab order,
  not how a screen reader reads a guest's page inside a region. To check it
  yourself, Tab from the host's control before the region into the guest's page
  and out to the next host control, and listen that the frame is announced by
  the guest's title.
- `Runic.Desktop.Gtk4`'s window routes nothing of a region's frame: drops onto
  it are discarded.
- On macOS an elevated guest cannot be shown in a region or as a component.
- With an appearance override, a guest page's `prefers-color-scheme` in a
  region is best effort: WKWebView and WebKitGTK before 2.54 do not follow the
  frame's `color-scheme`. Style the page from its appearance.

## More

The SDK's
[hosted regions guide](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/docs/hosted-regions.md)
covers both modes in full, and the
[0.18.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/eng/release/notes/0.18.0.md#region-mode-866-experimental)
list what each part added, and the
[0.19.0 release notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/eng/release/notes/0.19.0.md#an-appearance-override-per-hosted-region-917-experimental)
the appearance override. The security guide describes
[hosted windows in a region](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/docs/security.md#hosted-windows-in-a-region),
[components in a host page](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/docs/security.md#components-in-a-host-page)
and
[elevated hosts and guests](https://github.com/Runic-Artifex/runic-sdk/blob/v0.19.0/docs/security.md#elevated-hosts-and-guests).
