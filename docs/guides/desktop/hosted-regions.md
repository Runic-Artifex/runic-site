# Hosted regions

[Hosted applications](hosted-applications.md) show a guest's Windows in native
windows of the host. From SDK `0.18.0` a host can instead show a guest's Window
in a **region** of one of its own pages. An installer can show a separate check
tool as one step of its wizard, with its header, step indicator and footer in
place, one window and one taskbar entry. A dashboard can show small widgets of
other processes. A region shows the guest in one of two ways:

- **Region mode** (frame mode): the guest's page loads in a sandboxed,
  cross-origin frame from the guest's own loopback origin. Host page and guest
  page cannot read or script each other. Use it by default.
- **Component mode** (trusted component mode): the guest's Views render as a
  custom element in the host page's own document, with its theme and layout.
  Host page and guest code share one JavaScript realm. Use it only for
  applications of the same vendor.

**Experimental since SDK `0.18.0`**, as hosted applications are
([`RUNICDESK103`](https://github.com/Runic-Artifex/runic-sdk/blob/main/docs/experimental.md#RUNICDESK103)).
The page element is in `@runic-artifex/views/experimental`, and React, Vue,
Svelte and Angular wrap it as `RunicHostedRegion` in their `./experimental`
entries.

**Checked with**: Runic CI runs the
[hosted region example](https://github.com/Runic-Artifex/runic-sdk/blob/main/examples/hosted-region/README.md)
on Linux (WebKitGTK) and, as an elevated installer and check, on Windows
(WebView2). It also runs the
[hosted components example](https://github.com/Runic-Artifex/runic-sdk/blob/main/examples/hosted-components/README.md)
on the same platforms. Screen readers over a region are checked by hand.

## Show a guest's Window in a region

A guest of SDK 0.18 or later can be shown in a region without code of its own.
The host's policy decides per window:

```csharp docs-test=skip:unreleased-sdk
public ValueTask<RunicHostedWindowDecision> OpenWindowAsync(RunicHostedWindowRequest request, CancellationToken cancellationToken) =>
    ValueTask.FromResult(request.Owner is null && request.CanEmbed
        ? RunicHostedWindowDecision.Embed("check", new RunicHostedRegionOptions { Permissions = DesktopPermissionGrant.None })
        : RunicHostedWindowDecision.Refuse("The installer shows the check only in its step page."));
```

The host's page declares the region, with content for each state:

```html docs-test=skip:unreleased-sdk
<runic-hosted-region name="check">
  <p slot="waiting">Starting the system check…</p>
  <p slot="detached">The system check is not shown right now.</p>
  <p slot="ended">The system check has ended.</p>
  <p slot="fallback">The system check is not shown.</p>
</runic-hosted-region>
<script type="module">
  import { defineHostedRegion } from '@runic-artifex/views/experimental';
  defineHostedRegion();
</script>
```

- **Layout.** The engine lays the frame out, so the region follows the page's
  size, scrolling, zoom and DPI. Tab moves into the guest's page and out of it in
  document order, and screen readers read it as part of the window.
- **States.** `RunicHostedRegion` follows the region in C#: `Waiting`,
  `Loading`, `Attached`, `Detached` and `Ended`, with events for each change, the
  guest page's title and attaches and detaches.
- **Departures.** A wizard's Back and Next ask the guest first:
  `region.AsDepartureGuard()` sends the guest a close request and lets the
  departure go ahead only once the guest allowed it.
- **Focus.** A guest never takes the focus from the host's controls. The
  clipboard and launches count as the user's only after the user moved the
  focus into the region.
- **Permissions.** `RunicHostedRegionOptions.Permissions` is the frame's `allow`
  attribute and decides its camera and microphone requests.
- **Content-Security-Policy.** The frame comes from `[::1]`, which a CSP host
  source cannot name. A host page with a policy allows it with `frame-src http:`.

## Show a guest as a component

For applications of one vendor, both sides opt in. The guest allows the host
with `RunicGuestOptions.AllowComponentEmbedding` and builds its component with
the `component` target of `@runic-artifex/vite-plugin-runic`. The host's policy
decides `EmbedComponent` where the guest allows it:

```csharp docs-test=skip:unreleased-sdk
ValueTask.FromResult(request.CanEmbedComponent
    ? RunicHostedWindowDecision.EmbedComponent("indexer")
    : RunicHostedWindowDecision.Embed("indexer"));
```

The component then inherits the page's CSS custom properties and takes part in
its layout. The host page's policy must admit the guest's origin:

```text docs-test=skip:unreleased-sdk
default-src 'self'; script-src 'self' http://127.0.0.1:*; connect-src 'self' ws://127.0.0.1:*; frame-src http:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

The guest's code runs in the host page's realm and can act as the page, and the
page holds the guest's token. Embed components only of applications you would
ship as your own page.

## Elevated installers

An installer that runs as administrator can host a check tool that needs
administrator rights too. The host sets `RunicGuestStartInfo.AllowElevatedGuest`
and the guest `RunicGuestOptions.AllowElevatedHost`. In a region, the elevated
guest admits connections, its frame's included, only from processes that run
elevated, such as the installer's WebView2. On macOS an elevated guest refuses
regions and components, because Runic cannot check which process connects to
it there.

## More

The SDK's
[hosted regions guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/docs/hosted-regions.md)
covers both modes in detail, browser (serve-only) hosts, each engine's
behaviour and troubleshooting. The
[security guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/docs/security.md#hosted-windows-in-a-region)
lists what Runic enforces.
