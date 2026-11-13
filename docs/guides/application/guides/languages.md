# The application's language

Since SDK `0.17.0`, one language drives every Window of a Runic application: the
page, the text references that ViewModels produce, the native menus and
dialogs, the package metadata and, with an optional package, Runic's own
messages. This guide shows the application locale, the translated template,
Runic's own text in English and German, and how to test the language.

The text itself comes from
[Runic Translations](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.10.0/docs/guides/translations/runic-views.md)
0.10.0 (SDK `0.17` used 0.9.1). The core Runic packages don't depend on it: without a catalog, nothing
changes, and Runic's own text stays English.

## Start from the template

`--translations` (since SDK `0.17.0`) creates an application that is translated
from the start. It works with every frontend and both ViewModel libraries:

```sh docs-test=commands
dotnet new install Runic.Application.Templates@<VERSION>
dotnet new runic-app --name MyApp --frontend react --package-manager npm --host desktop --linux-gtk 3 --desktop-server native --view-models reactiveui --tests --translations
```

The project gets one catalog in English and German, `Frontend/translations`,
which the page and C# share; `dotnet build` checks every translation on both
sides. ViewModels produce text references instead of sentences, the page has a
language list, every Window follows the application's language, and the tests
check the translated text. `Program.cs` starts in the language that
`RUNIC_LOCALE` names, else the best match for the operating system's
languages:

```csharp docs-test=template:Program.cs host=desktop translations=true
// The application is the same on every host: open the Window, then wait until it closes.
async Task<int> RunAsync(IRunicWindowHost host)
{
    // The application's language: RUNIC_LOCALE (RUNIC_LOCALE=de dotnet run starts in German), else the best match for
    // the operating system's languages. Save the user's choice and pass it here to keep it across starts.
    await provider.StartLanguageAsync(Environment.GetEnvironmentVariable("RUNIC_LOCALE"));
```

Try another language without changing your system with
`RUNIC_LOCALE=de dotnet runic dev`. To add a language, add it to `locales` in
`Frontend/translations/runic.json`, copy `en.rmf2` to `<locale>.rmf2` and
translate it. The page imports the catalog that the .NET build writes to
`Frontend/.runic/translations`, so build again after you edit a message.

## One locale for the application

`IRunicApplicationLocale`, which `AddRunicWindowService()` registers, sets one
language for every Window. Windows that set none of their own switch with it,
and Windows opened later start in it. `Follow` binds anything with a
`SetLocaleAsync(locale, cancellationToken)`, such as a Runic Translations
`TranslationContext`, so the C# catalog switches first. The
[multi-window example](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/examples/multi-window/README.md)
registers its catalog that way:

```csharp docs-test=source:examples/multi-window/ProjectServices.cs
// IRunicWindowService, which ProjectViewModel uses to open more Windows, find open documents and ask for an account.
// It also registers IRunicApplicationLocale, the application's language.
services.AddRunicWindowService();
// The C# side of the catalog: menus and other native text. It follows the application's language from its
// creation, before the Windows on every switch; both are singletons, so the subscription lasts as long as the
// application.
services.AddSingleton(provider =>
{
    var translations = TranslationContext.CreateBuilder().Add(ProjectTextCatalog.Registration).Build();
    provider.GetRequiredService<IRunicApplicationLocale>().Follow(translations.SetLocaleAsync);
    return translations;
});
```

At start it picks `RUNIC_LOCALE`, else the user's saved choice, else the best
match for the operating system's languages. `DesktopLanguages.Preferred`
(Runic.Platform) lists those, and `LocaleNegotiation` from Runic Translations
matches each to the catalog's languages, so `de-CH` starts in `de`:

```csharp docs-test=source:examples/multi-window/ProjectServices.cs
var chosen = Supported(requested, "RUNIC_LOCALE")
    ?? Supported(services.GetRequiredService<SettingsStore>().Load().Language, "the settings")
    ?? LocaleNegotiation.Negotiate(DesktopLanguages.Preferred, translations.SupportedLocales, ProjectTextCatalog.DefaultLocale);
await services.GetRequiredService<IRunicApplicationLocale>().SetLocaleAsync(chosen, cancellationToken);
```

A switch awaits the followers, then moves the Windows, each in a turn of its
model context, then raises `LocaleChanged`. Rebuild native text there, such as
the menu bar, a status icon or notifications; the catalog has already switched:

```csharp docs-test=source:examples/multi-window/Program.cs
locale.LocaleChanged += (_, _) => SetMenuBar();
await provider.StartLanguageAsync(Environment.GetEnvironmentVariable("RUNIC_LOCALE"));
SetMenuBar();
```

A language switch from the page, or from the menu bar, is a command of the
ViewModel. The page asks for a language; the application owns it:

```csharp docs-test=source:examples/multi-window/ProjectViewModel.cs
ChooseLanguageCommand = ReactiveCommand.CreateFromTask<string>(async (language, token) =>
{
    if (ProjectServices.SupportedLanguage(translations, language) is not { } supported) return;
    await application.SetLocaleAsync(supported, token);
    settings.Save(settings.Load() with { Language = supported });
});
```

- **A Window of its own language.** `IRunicWindowLocale.Locale` returns the
  application's locale while the Window sets none. Setting it pins the Window,
  and `null` follows the application again. Save `OwnLocale`, which is `null`
  while the Window follows, to restore a Window's language later.
- **Failures.** A Window whose update fails does not stop the switch.
  `SetLocaleAsync` then throws an `AggregateException`, and calling it again
  with the same locale retries those Windows.
- **The browser's languages.** With `client-languages/1`,
  `RunicConnection.Languages` lists the preferred languages of the browser that
  connected, so a serve-only or CS-WebUI application can choose from them.
  They are personal data: use them only to choose a language, and don't log
  them. A page opts out with `configureClientLanguages({ send: false })`.
- **C# formatting.** Set `FlowCultureFromLocale` on `RunicWindowOptions` or the
  host options, and the Window's commands, setters, validation, menu commands
  and close guard run with `CurrentCulture` and `CurrentUICulture` of its
  locale. Work started inside such a call keeps that culture; start long-lived
  timers outside it or under `ExecutionContext.SuppressFlow()`.

## The page follows the locale

A page shows the Window's locale. Text references follow it on their own; the
page's own `m.*()` messages render again when the locale resolver reads the
framework's reactive text locale: `useTextLocale()` (React, Vue, Svelte),
`textLocaleSignal()` (Angular) or `textLocales()` (Effect).
`syncDocumentLocale()` keeps `<html lang dir>` on the Window's locale; the
starter templates call it. The translated template's React page connects the
catalog like this:

<!-- prettier-ignore -->
```ts docs-test=template:translations/react/src/translations.ts frontend=react translations=true
export function startTranslations(initialLocale = navigator.language): () => void {
  const locale = createLocaleSource({ initialLocale });
  // Every catalog on the page follows the window's language, also those of component libraries.
  const stopResolver = configureSharedLocaleResolver(locale.getRequestedLocale);
  const stopText = configureTranslatedText({
    ...locale,
    resolve: (reference, language) => resolveTextReference(reference, m, { locale: language }).text,
    direction: localeDirection,
  });
  const stopDocument = syncDocumentLocale();
  return () => { stopDocument(); stopText(); stopResolver(); };
}
```

[Translated text](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/packages/dotnet/Runic.Application.Views/README.md#translated-text)
in the Views README has the table for each framework, references of several
catalogs and server rendering.

## Runic's own text

Runic shows some text of its own: the messages of the built-in validation
attributes, the errors of number, date and time fields, Linux dialog titles, the
suggested "Untitled" file name, shortcut key names, the error pages of a Runic
Desktop browser window, the Windows loading title and the standard macOS menus.
Each has a hook for your text: `RunicValidationOptions.TextFor`,
`configureFieldErrorText`, `DesktopPlatformTexts.Current` and
`DesktopHost.SetStandardMenuTitles`.

**`Runic.Application.Views.Translations`** (NuGet) and
**`@runic-artifex/views-translations`** (npm), new in SDK `0.17.0`, fill all
of them in English and German. They are a Runic Translations library catalog,
`runic-views`, so they switch with your own catalog:

```sh docs-test=commands
dotnet add package Runic.Application.Views.Translations --version <VERSION>
npm install --save-exact @runic-artifex/views-translations@<VERSION>
```

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views.Translations/README.md
services.AddRunicWindowService();
services.AddRunicTranslations(options => options.InitialLocale = settings.Language)
    .AddCatalog(AppTextCatalog.Registration, context => new AppText(context));
services.AddRunicViewsTranslations();   // Runic's own text, in the same context
```

`AddRunicViewsTranslations()` adds the catalog to the shared context, sets
`RunicValidationOptions.TextFor` unless you register your own, and keeps
`DesktopPlatformTexts` in the application's locale. On the page, register the
catalog once in `main.ts`:

<!-- prettier-ignore -->
```ts docs-test=readme:packages/dotnet/Runic.Application.Views.Translations/README.md
import { configureRunicViewsText, runicViewsCatalog } from '@runic-artifex/views-translations';

configureRunicViewsText();   // field errors, error sentences and shortcut labels in the window's language
const resolveReference = transport.createReferenceResolver([{ transport, messages: m }, runicViewsCatalog]);
```

- **Only English and German.** `ITranslationContext.SupportedLocales` lists
  the locales in which every catalog has its text, so with this package it
  lists at most `en` and `de`. Add an override file for each of your other
  languages, or a language list built from it loses them. The first Window logs
  the missing ones (event 1261).
- **Change single messages** in your `runic.json` with an `overrides` entry for
  the `runic-views` catalog.
- **Process-wide text.** Dialog titles, shortcut labels and the other
  `DesktopPlatformTexts` follow the application's locale, also in a Window with
  a locale of its own. A Windows or in-page menu bar keeps its old key names
  after a switch until you set it again in `LocaleChanged`.
- **CS-WebUI** windows keep WebUI's own English error pages.

The
[Runic.Application.Views.Translations README](https://github.com/Runic-Artifex/runic-sdk/blob/v0.18.0/packages/dotnet/Runic.Application.Views.Translations/README.md)
covers your own validation texts, the standard macOS menus, use without
dependency injection, and the keys.

## Packages declare their languages

Set `RunicApplicationLocales` in the project file, and `dotnet runic package`
declares the languages in the macOS bundle (`CFBundleLocalizations`, so AppKit's
own panels follow the user's language), the MSIX resources and the Linux desktop
entry and metainfo:

```xml docs-test=skip:project-property
<RunicApplicationLocales>en;de</RunicApplicationLocales>
```

A manifest copied into `packaging/` before SDK `0.17.0` lacks the new fields.
With the property set, packaging then fails with `RAPPPKG1006`, which names the
file and the field to add.

## Test the language

`RunicWindowTestHostOptions.Locale` starts a test Window in a locale of its own,
and `ApplicationLocale` starts the application in one for the test.
`host.ApplicationLocale.SetLocaleAsync("de")` switches it. To check the text a
user sees, resolve a reference with the application's `TranslationContext`:

```csharp docs-test=readme:packages/dotnet/Runic.Application.Views/README.md
TranslationReference status = host.Root.Snapshot().Read(vm => vm.Status);
await translations.SetLocaleAsync("de");   // de.rmf2: saved = {$title} gespeichert.
Assert.Equal("Atlas gespeichert.", translations.Resolve(status).Text);
```

The multi-window example checks that a switch in one Window reaches the
catalog, every Window and the settings:

```csharp docs-test=source:examples/multi-window/Tests/ProjectWindowTests.cs
await _services.StartLanguageAsync("en");
await Assert.That(_first.Content.Locale).IsEqualTo("en");
(await _first.Root.ExecuteAsync(vm => vm.ChooseLanguageCommand, "\"de\"")).ThrowIfFailed();

// The C# catalog switched first, then both Windows; the pages follow their Window's locale.
await Assert.That(_services.GetRequiredService<TranslationContext>().RequestedLocale).IsEqualTo("de");
await Assert.That(_first.Content.Locale).IsEqualTo("de");
await Assert.That(_second.Content.Locale).IsEqualTo("de");
```

In page tests, the mock bridge's `setWindowLocale("de")` pushes a locale, and
`InMemoryBridgeTransport.SetLanguages` sets a test connection's browser
languages. A browser test of a serve-only application runs in German with
`RUNIC_APPLICATION_SERVE_ONLY=1 RUNIC_LOCALE=de`.

## Next steps

- [App settings and desktop preferences](../samples/settings.md) saves the
  user's language and theme.
- [Forms and validation](forms-and-validation.md#locale-aware-fields) shows
  number, date and time fields in the Window's locale.
- [Right-to-left layouts](../../desktop/right-to-left.md) covers Arabic and
  Hebrew windows.
