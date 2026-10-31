# Right-to-left layouts

A Runic window shows a web page, and the WebView mirrors the layout and
orders mixed-direction text once the page says which language and direction
it uses. Runic does not set them for you: the page chooses its `lang` and
`dir`. Native pieces around the page, such as the window frame, menus, dialogs
and notifications, follow each platform's own rules, which this guide lists
with what the application can and cannot change.

**Checked with**: Runic CI runs the GTK 4 smoke with an Arabic process locale
(`--rtl`, Linux x64 and arm64): the page reads `ar-EG` and lays out right to
left, GTK 4's direction is right to left, and the override below works. The
Windows and macOS rows have not been run.

## Set the page's language and direction

Set both on the root element whenever the language changes. With
[Runic Translations](../translations/README.md), the generated runtime's
`localeDirection` gives the direction of any locale tag:

```ts docs-test=skip:translations-repository
import {
  getLocale,
  localeDirection,
} from 'virtual:runic-translations/app/runtime';

const locale = getLocale();
document.documentElement.lang = locale;
document.documentElement.dir = localeDirection(locale);
```

It decides by the locale's script: `ar`, `he`, `fa`, `ur`, `pa-PK` and
`ku-Arab` are right-to-left; `ku`, `he-Latn` and `sd-Deva` are not. Without
Translations, apply the same rule with `new Intl.Locale(tag).maximize().script`
and CLDR's right-to-left scripts (Arabic, Hebrew, Syriac, Thaana, N'Ko, Adlam
and others). In .NET, `CultureInfo.TextInfo.IsRightToLeft` answers the same
question, but it is always `false` with `InvariantGlobalization`.

Then let CSS follow the direction:

- Use logical properties (`margin-inline-start`, `padding-inline-end`,
  `inset-inline-start`, `text-align: start`) instead of left and right, and
  flex or grid layouts, which mirror on their own.
- Mirror icons that point somewhere, such as back arrows, with
  `:dir(rtl)`; leave logos, media controls and clocks alone.
- Wrap values of the other direction in right-to-left text, such as file
  names, paths and identifiers, in `<bdi>`, or in the isolates U+2068 and
  U+2069 in plain text (`isolateBidi` in
  `@runic-artifex/translations-svelte/testing`). Translations does
  not isolate message inputs for you.
- Use `dir="auto"` on inputs and on text the user wrote.

## Where the language comes from

Prefer the application's own language setting, for example a ViewModel's
state, to `navigator.language`, which each WebView takes from somewhere else:

| WebView            | `navigator.language`                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebKitGTK (Linux)  | The process locale, from `LANGUAGE`, `LC_ALL`, `LC_MESSAGES` and `LANG`, for example `ar-EG`. Under the `C` locale it is `C`, which is not a language tag, so guard against it. |
| WebView2 (Windows) | The Windows display language.                                                                                                                                                   |
| WKWebView (macOS)  | The user's preferred languages for the application.                                                                                                                             |

Since SDK `0.11.0`, `DesktopWindowOptions.Language`, a BCP 47 tag such as
`ar-EG`, sets WebView2's language and WebKitGTK's preferred languages: their
built-in text, such as the context menu and form validation messages,
`navigator.language` and `Accept-Language`, also under the `C` locale.
WebView2 takes the closest language it ships, such as `ar` for `ar-EG`, and
windows sharing a `ProfilePath` must use the same language. WKWebView and
installed browsers ignore it. The page still sets its own `lang`.

## Native pieces

| Piece                           | Linux                                                                 | Windows                                                | macOS                                                              |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Window frame and GTK header bar | GTK's direction, from the process locale, or `LayoutDirection`        | Mirrored with `LayoutDirection`                        | AppKit's direction for the application                             |
| Menu bar and context menus      | GTK's direction, or `LayoutDirection`; a global menu is the desktop's | Mirrored with `LayoutDirection`                        | AppKit's direction; standard menu titles from `StandardMenuTitles` |
| Status icon menu                | Drawn by the panel, in the session's language                         | Mirrored with `DesktopStatusIconState.LayoutDirection` | AppKit's direction for the application                             |
| Message boxes                   | GTK 3: the window's direction; GTK 4: the application's language      | The window's direction                                 | The application's language                                         |
| File dialogs                    | Drawn by the desktop portal, in the session's language                | Windows display language                               | AppKit's direction for the application                             |
| Notifications                   | Drawn by the notification server                                      | Windows display language                               | Drawn by the system                                                |

Since SDK `0.11.0`, `DesktopWindowOptions.LayoutDirection` (`Default`,
`LeftToRight` or `RightToLeft`, from `Runic.Platform`) sets the direction of a
window's native parts; `Default` keeps the platform's. `RightToLeft` mirrors
the Windows frame, its caption buttons, system menu, menu bar and context menus
([#389](https://github.com/Runic-Artifex/runic-sdk/issues/389)); the WebView2
page is not mirrored and sets its own `dir`. On Linux it sets the direction of
the GTK window, its header bar with GTK 4, and Runic's menu bar and context
menus. macOS and installed browsers ignore it, and `Validate` reports each
option a presentation ignores. Choose it with the application's language, as
in the
[Runic.Desktop README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.15.0/packages/dotnet/Runic.Desktop/README.md#right-to-left-languages):

```csharp docs-test=skip:illustrative-fragment
var culture = CultureInfo.CurrentUICulture;
var window = await surface.OpenWindowAsync(new DesktopWindowOptions
{
    LayoutDirection = culture.TextInfo.IsRightToLeft ? DesktopLayoutDirection.RightToLeft : DesktopLayoutDirection.LeftToRight,
    Language = culture.Name,
});
```

Both options change nothing unless set.

On Linux, GTK 4 takes its direction from the script of the process locale's
language, and GTK 3 from its own translation for the locale, which on Ubuntu
comes with the `language-pack-gnome-*` packages. A user whose session is
Arabic gets a mirrored header bar; an application that only switches its page
to Arabic does not. An application whose language differs from the session's
can set `LayoutDirection` on its windows, or GTK 4's default direction for
every widget itself; GTK applies it on its own thread:

```csharp docs-test=skip:illustrative-fragment
GLib.Functions.IdleAdd(GLib.Constants.PRIORITY_DEFAULT, () =>
{
    Gtk.Widget.SetDefaultDirection(Gtk.TextDirection.Rtl);
    return false;
});
```

On macOS, AppKit mirrors an application only for a language the bundle
declares: list it in `CFBundleLocalizations` in `Info.plist`, or ship an
`<language>.lproj` folder. See [Ship a Desktop application](shipping.md) for
the bundle.

Text you pass to native pieces, such as notification titles, window titles,
menu items and message boxes, is shown as given. Isolate embedded values of the other
direction there as well.
