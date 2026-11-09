# Get started with Runic Translations

Runic Translations compiles your message files into typed C# and TypeScript
APIs. This page explains the concepts and leads to the quick start for your
platform.

It covers release `0.9.1`. The Translations repository owns the
detailed guides; every link to it points at that release. Translations is
versioned on its own, so its version does not need to match the Application
SDK. Use one exact Translations version for every Translations package and tool
in a project. Since `0.8.0` versions are plain `0.y.z` until 1.0: a new minor
may contain breaking changes, listed with upgrade steps in its release notes,
and a patch only fixes or adds.

Use `0.9.1`, not `0.9.0`. Only `Runic.Translations` and
`Runic.Translations.Build` `0.9.0` reached NuGet, and both are deprecated: a
library packed with that `Runic.Translations.Build` cannot be pushed to
nuget.org. `0.9.1` is the first complete release of the 0.9 features. It has
eight NuGet packages (`Runic.Translations`, `.Build`, `.CommandLine`,
`.Hosting`, `.Tooling`, `.Wpf`, `.Templates` and the
`dotnet-runic-translations` tool) and three npm packages
(`@runic-artifex/vite-plugin-runic-translations`,
`@runic-artifex/translations-svelte` and
`@runic-artifex/translations-sveltekit`); `Runic.Translations.Hosting` is new.

## How it works

You write messages in plain text files, one per locale. A compiler checks them
and generates code: a typed C# class for .NET and ES modules with type
declarations for the web. Your application calls generated members such as
`text.Messages.application_title` or `m.application_title()`, so a missing
message or a wrong input is a build error, not a blank label at run time. At
run time a translation manager holds the current locale and switches it as one
step.

The compiler is the same .NET tool everywhere. MSBuild runs it for .NET
projects, and a Vite plugin runs it for web projects, so both sides read the
same files and agree on every message.

## Project layout

A translations project is a `translations/` directory with one configuration
file and one message file per locale:

```text docs-test=skip:translations-repository
translations/
├── runic.json
├── en.rmf2
└── de.rmf2
```

`runic.json` names the catalog, the generated C# class and the locales. This is
the configuration from the Vite quick start:

```json docs-test=skip:translations-repository
{
  "schemaVersion": 1,
  "catalog": "app",
  "code": { "namespace": "Example", "className": "AppText" },
  "baseLocale": "en",
  "locales": ["en", "de"]
}
```

- `catalog` names the catalog. Web code imports it as
  `virtual:runic-translations/app`.
- `code` sets the namespace and class name of the generated C#.
- `baseLocale` is the locale that defines every message and its inputs.

## Message files

Message files are named `{locale}.rmf2`. RMF2 groups messages into named blocks;
each message body is a [MessageFormat 2](https://messageformat.unicode.org/)
pattern. This example comes from the SvelteKit quick start:

```rmf2 docs-test=skip:translations-repository
home {
  title = Welcome to Runic
  greeting = Hello, {$name}!
}
```

The German file has the same keys with German text. Groups join their names
with an underscore, so `home.greeting` becomes `home_greeting` in code.
`{$name}` is an input that the caller must pass. A message can also choose
text by a value, for example for plurals:

```rmf2 docs-test=skip:translations-repository
checkout {
  items =
    .input {$count :integer}
    .match $count
    one {{One item}}
    * {{{$count} items}}
}
```

The base locale decides which inputs a message has. A translation may use
fewer of them or select on them differently, but it cannot add new ones.
Messages may also contain markup for links, actions and icons, which the
application binds to typed slots. Runic implements a bounded profile of
MessageFormat 2, not every Unicode MF2 feature; the
[RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/rmf2.md)
lists what is supported.

## What gets generated

For **C#**, the source generator in `Runic.Translations.Build` creates two
types during `dotnet build`. With `className` set to `AppText` they are:

- `AppTextCatalog`, which creates a translation manager with
  `CreateManagerAsync`.
- `AppText`, whose `Messages` property is the readable surface. A message
  without inputs is a property, such as `text.Messages.home_title`; a message
  with inputs is a method, such as `text.Messages.home_greeting(name)`.

The generated C# is not a file you copy or commit. It needs no reflection and
works with NativeAOT.

For **TypeScript and JavaScript**, the compiler emits an ES module package. Its
`m` namespace has one function per message, with type declarations for the
exact keys and inputs. The runtime module exports the catalog's `locales`,
`baseLocale` and a `Locale` type. A server module adds request-scoped locales
for server rendering. With the Vite plugin you import these modules as
`virtual:runic-translations/app`, `/runtime` and `/server`, and the plugin
writes their declarations to `.runic/translations/virtual.d.ts`.

## Use it in an application

In .NET, create the manager once at startup and read messages through the
generated class. This example comes from the `Runic.Translations` package:

```csharp docs-test=skip:translations-repository
using Example.Translations;
using Runic.Translations;

ITranslationManager manager = await AppTextCatalog.CreateManagerAsync(
    initialLocale: "en");
var text = new AppText(manager);

Console.WriteLine(text.Messages.application_title);

await manager.SetLocaleAsync("de");
Console.WriteLine(text.Messages.application_title);
```

Share one manager and one `AppText` across the application, for example as
singletons in your service container, so every window uses the same locale.
When libraries bring catalogs of their own, use one `TranslationContext`
instead; see [Libraries and composition](#libraries-and-composition). In
a Runic application, ViewModels that show translated text refresh it when the
locale changes; see
[translations in ViewModels](../application/guides/model-context.md#translations-in-viewmodels).

C# code outside the Views, such as a tray menu, can use the frontend's catalog
through a `RunicTranslationProject` item, also outside the project's directory.
The generated catalog loads each locale on first use. See the
[Runic Desktop note](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/runic-desktop.md#strings-outside-the-views).

On the web, import `m` and call a message function:

```ts docs-test=skip:translations-repository
import { m } from 'virtual:runic-translations/app';

m.application_title();
m.greeting({ name: 'Ada' }, { locale: 'de' });
```

## Switching locales

In .NET, `ITranslationManager.SetLocaleAsync` replaces the whole catalog
snapshot at once, so a reader never sees half of one locale and half of
another. The manager raises `LocaleChanged` after a switch and
`SnapshotPublished` after every new snapshot, including refreshes. Since
`0.8.0`, `SnapshotPublished` is part of `ITranslationManager`, which replaces
`ITranslationSnapshotNotifier`; a custom manager raises it.

Since `0.9.1` a requested tag matches a declared locale through CLDR likely
subtags and parent locales: `zh-TW` resolves to `zh-Hant` and `de-CH` to
`de-DE`, but never to a locale of another script. Numbers and dates follow the
requested regional locale and its native digits, so a user who asks for
`de-CH` and gets `de` text sees Swiss numbers. `SetLocaleFromPreferencesAsync`
(.NET) and `negotiateLocale` (web) take an ordered list of preferences.
Snapshots and events report `RequestedLocale` and `LocaleResolution`, so a
fallback is not silent.

To follow the user's display language, pass `CultureInfo.CurrentUICulture.Name`.
Since `0.7.0-preview.2`, an empty locale, the name of the invariant culture
that `LANG=C` selects, follows the catalog's `unsupportedLocale` policy like any
locale the catalog lacks: it selects the base locale, or throws only with
`exact`. Regenerate ESM output to get the same behavior on the web.

On the web, the runtime's `createLocaleSource` creates a locale state with
`getLocale`, `setLocale` and `subscribe`, and the `{ locale }` option overrides
the locale for one call. On a server, `runWithLocale` gives each request its
own locale, so concurrent requests never share it. The Svelte and SvelteKit
packages connect these to components and URL routing.

`useMessageLocale` makes `m.*()` calls in a Svelte app without SvelteKit follow
a locale it owns, such as a ViewModel's setting, without `{#key locale}`. Call
it once in the root component:

```svelte docs-test=skip:translations-repository
<script lang="ts">
  import { useMessageLocale } from '@runic-artifex/translations-svelte';
  import { configureLocaleResolver } from 'virtual:runic-translations/app/runtime';

  let locale = $state('en'); // or a ViewModel's state, such as settings.state?.locale
  useMessageLocale(configureLocaleResolver, () => locale);
</script>
```

See the [Vite quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/quickstart-vite.md#svelte-without-sveltekit).

## Libraries and composition

Since `0.9.1` a component library can ship its own catalog, and an application
switches its own catalog and every library catalog to one locale at once.

- **Library.** A catalog with `"visibility": "public"` exposes
  `XCatalog.Registration`, and library code creates its text class from an
  `ITranslationContext`: `new GridText(context)`. With
  `<RunicTranslationsPackCatalog>true</RunicTranslationsPackCatalog>` the
  package also ships the catalog's sources, so applications can override its
  text. An npm library declares its catalog in `package.json`, and the Vite
  plugin's `dependencies: "auto"` finds it.
- **Application.** `TranslationContext` holds one requested locale for every
  catalog, and `SetLocaleAsync` switches them together. An application lists
  library catalogs under `"overrides"` in `runic.json` and writes
  `translations/overrides/<catalog>/<locale>.rmf2`; the build checks these
  overrides against the library's catalog and can add locales the library
  lacks.
- **Dependency injection.** The new `Runic.Translations.Hosting` package
  registers the context with Microsoft.Extensions.DependencyInjection. The
  application and each library add their catalogs independently:

```csharp docs-test=skip:translations-repository
services.AddRunicTranslations(options => options.InitialLocale = settings.Language)
    .AddCatalog(AppTextCatalog.Registration, context => new AppText(context));
```

The context is a singleton by default, for desktop applications, or one per
scope with `options.Lifetime = ServiceLifetime.Scoped`, for web requests. See
[Ship translations in a library](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/libraries.md),
[Catalogs from libraries](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/composition.md) and the
[`Runic.Translations.Hosting` README](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/packages/dotnet/Runic.Translations.Hosting/README.md).
Translation packs downloaded at run time use the same overlays; see
[Ship translation updates without a release](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/ota.md).

## Validate your messages

`dotnet build` validates the catalog and fails on errors. For CI or a web
project, the `dotnet-runic-translations` tool validates without building:

```sh docs-test=skip:translations-repository
dotnet tool run runic-translations -- validate --project translations
```

The tool also runs `generate` to write output and `verify` to check that
committed output is current. Since `0.8.0` it uses the exit codes of every Runic
tool: `0` success, `1` a command failure such as a `verify` difference or an
I/O error, `2` an invalid invocation or translation diagnostics, `3` an
internal failure and `130` cancelled. Keep `Runic.Translations.Build` on the
same release as the tool, because it reads these codes. `--format json` writes
one `runic.commandline/1` response; `--runic-output` is a hidden alias until
2.0. The tool also reads `@file` response files. Errors carry `RTR` IDs, which
are the same in the build, the tool,
the Runic MF2 Translations extensions for
[VS Code](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/tools/vscode-runic-translations/README.md)
and
[Visual Studio](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/tools/visualstudio-runic-translations/README.md),
and the Editor; the
[diagnostics reference](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/diagnostics.md)
explains each one.

`runic-translations import-text` turns tables keyed by their base text into one
RMF2 group with stable generated keys:

```sh docs-test=skip:translations-repository
runic-translations import-text --project translations --group stored \
  --base locales/untranslated.json --table de=locales/de.json
```

See the
[RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/rmf2.md#import-a-text-keyed-catalog).
`runic-translations import --from resx|i18next` migrates `.resx` files and
i18next JSON; see
[Migrate from .resx](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/migrate-resx.md) and
[Migrate from i18next](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/migrate-i18next.md).

## Work with translators

Translators edit the `.rmf2` sources in the Editor or an IDE extension, or work
in a translation management system through XLIFF 2.1:
`runic-translations xliff export` and `xliff import` exchange placeholders and
plural variants, and import applies each unit on its own. An optional
`<catalog>.review.json` records review state for the tool, the Editor and the
language server, and `validate` warns with `RTR0090` when a translation
predates a change to its source. `runic-translations status` reports coverage
per locale, and `--min-coverage de=100,fr=80` fails CI when one lags. The
`pseudoLocales` setting in `runic.json` adds pseudo-locales such as `en-XA` to
development builds. See
[Work with translators and translation tools](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/translators.md).

## The Translations Editor

The Translations Editor is a desktop app for translators. It opens a
`translations/` project, shows locale coverage, edits and previews messages
with the same compiler, and exports and imports XLIFF. Since `0.9.1` it also
opens every catalog of a workspace and shows library catalogs as read-only
layers next to your overrides. It is available from
source only: this release has no Editor download. See the
[Editor README](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/apps/translations-editor/README.md)
to build and launch it.

## Choose your platform

Each quick start starts from an empty folder and ends with a running app:

- **.NET**: the
  [.NET quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/quickstart-dotnet.md)
  creates a translations library with `dotnet new runic-translations-project`
  and prints the first message from a console app.
- **WPF**: the
  [WPF quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/packages/dotnet/Runic.Translations.Wpf/README.md#wpf-quick-start)
  binds messages in XAML with `{rt:Message}`, next to existing `.resx`
  resources.
- **Vite and TypeScript**: the
  [Vite quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/quickstart-vite.md)
  adds the Vite plugin, renders a message and builds on CI.
- **SvelteKit**: the
  [SvelteKit quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/quickstart-sveltekit.md)
  adds localized routes, a language switcher and server rendering per request.
- **Command line**: [translate a CLI](../command-line/README.md#translate-a-cli)
  with the `Runic.Translations.CommandLine` adapter, which translates Runic
  Command Line help, errors and faults.
- **Runic Desktop**: there is no separate adapter. Use the .NET runtime and the
  Vite plugin as above; the
  [Runic Desktop note](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/runic-desktop.md)
  explains how locale files are delivered.
- **Runic Views**:
  [Translate a Runic Views app](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/runic-views.md)
  connects the page, ViewModels and native text to one catalog. It needs
  runic-sdk `0.17`, which is not released yet; until then the guide describes
  unreleased APIs.

## Upgrading to 0.9.1

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.9.1` together, then rebuild. If you
already updated `Runic.Translations` or `Runic.Translations.Build` to `0.9.0`,
update them as well and pack your libraries again. A web build regenerates its
whole output folder; never mix generated files from two releases. What
application code usually touches:

- **Formatted output.** Dates use the local time zone instead of UTC
  (`timeZone=utc` keeps UTC), percentages and numbers use the locale's
  patterns and native digits (`-u-nu-latn` requests Latin digits), relative
  time follows CLDR, and catalogs with a right-to-left locale isolate
  placeholders with invisible Unicode characters. Update snapshot tests of
  formatted text.
- **Locale negotiation** follows CLDR, so a tag that fell back to the default
  locale may now match a declared one.
- **Generated .NET code.** `SourceHash` and `Rmf2MarkupContract` are static
  properties instead of constants. Text classes gain a constructor that takes
  an `ITranslationContext`, so register them with a factory rather than
  `AddSingleton<AppText>()`.
- **Web.** `m` is a module namespace object that bundlers tree-shake, and a
  catalog without its own resolver follows the shared locale.
- **Translator workflow.** XLIFF export writes profile 3 and review files
  `/2`. The new QA warnings `RTR0094` to `RTR0098` and `RTR0090` can fail
  builds that treat warnings as errors; fix the messages or set their policy
  in `runic.json`.
- **Command Line.** `Runic.Translations.CommandLine` depends on Runic Command
  Line `[0.9.1, 0.10)` and resolves locale-first; see
  [translate a CLI](../command-line/README.md#translate-a-cli).

The
[0.9.1 upgrade notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/eng/release/notes/0.9.1.md#upgrading-from-08)
list every change.

## Next steps

- [Migrating Svelte translation imports](../migrations/translations-svelte.md)
  moves an existing app from the SDK's Svelte packages to the independent
  Translations packages.
- [Translations in ViewModels](../application/guides/model-context.md#translations-in-viewmodels)
  shows how a Runic ViewModel follows locale changes.
- The
  [RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/rmf2.md)
  covers the full message syntax, markup, documents and mounted source folders.
- The
  [ESM backend guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/esm.md)
  describes the generated web modules in detail.
- [Right-to-left text](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/docs/guides/translations/bidi.md)
  explains placeholder isolation and text direction.
- [Release notes for 0.9.1](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.9.1/eng/release/notes/0.9.1.md)
  list what changed in this release.
