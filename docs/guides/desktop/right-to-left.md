# Right-to-left layouts

A Runic window shows a web page, and the WebView mirrors the layout and
orders mixed-direction text once the page says which language and direction
it uses. Runic does not set them for you: the page chooses its `lang` and
`dir`. Native pieces around the page, such as the window frame, menus, dialogs
and notifications, follow each platform's own rules, which this guide lists
with what the application can and cannot change.

**Checked with**: Runic CI runs the GTK 4 smoke with an Arabic process locale
(`--rtl`, Linux x64 and arm64): the page reads `ar-EG`, lays out right to
left, and GTK's direction is right to left. The Windows and macOS rows below
have not been run.

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
  `@runic-artifex/translations-svelte/translations/testing`). Translations does
  not isolate message inputs for you.
- Use `dir="auto"` on inputs and on text the user wrote.

## Where the language comes from

Prefer the application's own language setting, for example a ViewModel's
state, to `navigator.language`, which each WebView takes from somewhere else:

| WebView            | `navigator.language`                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebKitGTK (Linux)  | The process locale, from `LANGUAGE`, `LC_ALL`, `LC_MESSAGES` and `LANG`, for example `ar-EG`. Under the `C` locale it is `C`, which is not a language tag, so guard against it. |
| WebView2 (Windows) | The Windows display language. Runic sets no WebView2 `Language`.                                                                                                                |
| WKWebView (macOS)  | The user's preferred languages for the application.                                                                                                                             |

## Native pieces

| Piece                           | Linux                                                                      | Windows                                                                      | macOS                                                         |
| ------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Window frame and GTK header bar | GTK's direction, from the process locale when GTK has a translation for it | Not mirrored ([#389](https://github.com/Runic-Artifex/runic-sdk/issues/389)) | AppKit's direction for the application                        |
| Menu bar                        | None                                                                       | None                                                                         | AppKit's direction; Runic's default items have English titles |
| Status icon menu                | Drawn by the panel, in the session's language                              | Not mirrored (#389)                                                          | AppKit's direction for the application                        |
| File dialogs                    | Drawn by the desktop portal, in the session's language                     | Windows display language                                                     | AppKit's direction for the application                        |
| Notifications                   | Drawn by the notification server                                           | Windows display language                                                     | Drawn by the system                                           |

On Linux, GTK reads its direction from its own translation for the process
locale. A user whose session is Arabic gets a mirrored header bar; an
application that only switches its page to Arabic does not. On an Ubuntu
image without GTK's translations (the `language-pack-gnome-*` packages), GTK
stays left to right.

On macOS, AppKit mirrors an application only for a language the bundle
declares: list it in `CFBundleLocalizations` in `Info.plist`, or ship an
`<language>.lproj` folder. See [Ship a Desktop application](shipping.md) for
the bundle.

Text you pass to native pieces, such as notification titles, window titles
and menu items, is shown as given. Isolate embedded values of the other
direction there as well.
