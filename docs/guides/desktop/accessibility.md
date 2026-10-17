# Accessible Desktop views

A Runic Desktop window shows the View in the platform's web engine, and the
engine gives the page to the platform's accessibility API: WebKitGTK to AT-SPI
(Orca) on Linux, WebView2 to UI Automation (Narrator, NVDA) on Windows and
WKWebView to the macOS accessibility API (VoiceOver). Semantic HTML works on
all three: native controls, labels, headings, landmarks and a `<title>`, which
names the window. This guide covers where the engines differ.

## What each host exposes

SDK CI opens one page on each host and reads and changes it through the
platform API from a separate process, as a screen reader does; on macOS
VoiceOver itself runs and its speech is checked. See the
[Runic.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Desktop/README.md#accessibility)
for the details.

| Page                                         | WebKitGTK (Orca)    | WebView2 (Narrator, NVDA) | WKWebView (VoiceOver)                              |
| -------------------------------------------- | ------------------- | ------------------------- | -------------------------------------------------- |
| `<input type="range">`: value, range, change | Yes                 | Yes                       | Yes                                                |
| `<input type="number">`                      | Text only, no range | Yes                       | Value only, no range                               |
| ARIA spin button the page changes            | Yes                 | Yes                       | Yes, read as a percentage without `aria-valuetext` |
| `<select size>`: selection, change           | Yes                 | Yes                       | Yes                                                |
| ARIA list box: selection; change by the page | Yes                 | Yes                       | Selection; change not checked                      |
| Focus changes                                | Yes                 | Yes                       | Yes                                                |
| `aria-live`, `role="status"`                 | Silent              | Yes                       | Yes                                                |
| `AnnounceAsync`                              | Yes                 | Yes                       | Yes                                                |
| Window name from `<title>`                   | Yes                 | Yes                       | Yes                                                |

## Status messages: live regions or `AnnounceAsync`

A message that appears without moving focus, such as "Saved" or an error, is
an `aria-live` region or `role="status"` on the web. WebKitGTK sends no event
for it, so Orca stays silent ([runic-sdk #318](https://github.com/Runic-Artifex/runic-sdk/issues/318)).
Ask the screen reader from the backend instead; every embedded window offers it:

```csharp docs-test=skip:illustrative-fragment
await platform.AnnounceAsync("Saved 3 files");                        // polite
await platform.AnnounceAsync("Disk full", DesktopAnnouncementPriority.Assertive);
```

`platform` is the ViewModel's `DesktopWindowPlatformServices`; a Runic Window
can also call `PlatformServices.AnnounceAsync(window, message)`. Send each
message one way: on WebView2 and WKWebView a live region is also spoken, so a
message sent both ways is heard twice. An installed browser, used as a
fallback, cannot announce (`window-capability-unavailable`); keep a live
region for that case only.

## WebKitGTK pitfalls

- A `ul` or `ol` without list markers (`list-style: none`, Tailwind's base
  styles) is not a list for Orca. Add `role="list"`.
- A list item whose only content is a button can crash the page when Orca
  focuses the button
  ([runic-sdk #342](https://github.com/Runic-Artifex/runic-sdk/issues/342)).
  Give such items `display: contents` and `aria-setsize`/`aria-posinset`:

  ```html docs-test=skip:illustrative-fragment
  <ul role="list">
    <li style="display: contents" aria-setsize="2" aria-posinset="1">
      <button>Changes</button>
    </li>
    <li style="display: contents" aria-setsize="2" aria-posinset="2">
      <button>History</button>
    </li>
  </ul>
  ```

- Orca does not read the page when the window opens; it says the window title.
  Give the page a `<title>`, a `main` landmark and headings, so H and D reach
  the content.
- With GTK 4, start Orca before the application: a page whose web process
  started before the screen reader reports no value, selection or focus changes
  ([runic-sdk #395](https://github.com/Runic-Artifex/runic-sdk/issues/395)).

## Range and spin controls

Prefer `<input type="range">`: every host exposes its value, minimum and
maximum, and reports a change. For a count that buttons change, use an ARIA
spin button and keep its value attributes current; every host reports the new
value of the focused spin button:

```html docs-test=skip:illustrative-fragment
<span
  role="spinbutton"
  tabindex="0"
  aria-label="Restore points to keep"
  aria-valuenow="5"
  aria-valuemin="1"
  aria-valuemax="50"
  aria-valuetext="5 restore points"
  >5</span
>
```

Handle Arrow Up and Down, Page Up and Down, Home and End on it, as the
[WAI-ARIA spin button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/)
describes; VoiceOver's increment arrives as an arrow key. Add
`aria-valuetext`, updated with the value: VoiceOver otherwise reads an ARIA spin
button's value as a percentage of its range. WebKit exposes
`<input type="number">` without its range, and WebKitGTK as a plain entry, so
use a spin button where the range matters.

## Selection

A `<select>` (with `size` for a visible list) needs nothing more. For a custom
list box, give the container `role="listbox"` and a name, each item
`role="option"`, and set `aria-selected="true"` on the selected option only,
with `aria-activedescendant` or a roving `tabindex` for the focused one.
WebKitGTK and WebView2 report the change when the page moves `aria-selected`;
on macOS only `<select>` was checked.

## Focus after navigation

Runic Views do not move focus when a navigation region shows another page.
Move it yourself, to the new page's heading or to the first thing to read:

```svelte docs-test=skip:illustrative-fragment
<script>
  let { title } = $props();
  let heading = $state();
  $effect(() => {
    title;
    heading?.focus();
  });
</script>

<h1 tabindex="-1" bind:this={heading}>{title}</h1>
```

A result that appears after an action, such as a validation error, can take
focus the same way. Do not move focus for routine updates; announce them.

## Keyboard

Every action needs a keyboard path in DOM order; avoid positive `tabindex`.
Use `<button>` and `<a href>` rather than clickable `div`s, and `<dialog>` with
`showModal()` for modal dialogs, which keeps focus inside and closes with
Escape. Runic Desktop keeps Tab inside the page on WebKitGTK and provides the
browser's zoom keys on every host; see
[Keyboard and zoom in embedded windows](https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Desktop/README.md#keyboard-and-zoom-in-embedded-windows).
