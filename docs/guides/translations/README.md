# Get started with Runic Translations

Runic Translations compiles your message files into typed C# and TypeScript
APIs. This page explains the concepts and leads to the quick start for your
platform.

It covers release `0.8.0`. The Translations repository owns the
detailed guides; every link to it points at that release. Translations is
versioned on its own, so its version does not need to match the Application
SDK. Use one exact Translations version for every Translations package and tool
in a project. Since `0.8.0` versions are plain `0.y.z` until 1.0: a new minor
may contain breaking changes, listed with upgrade steps in its release notes,
and a patch only fixes or adds.

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
[RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/rmf2.md)
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
singletons in your service container, so every window uses the same locale. In
a Runic application, ViewModels that show translated text refresh it when the
locale changes; see
[translations in ViewModels](../application/guides/model-context.md#translations-in-viewmodels).

C# code outside the Views, such as a tray menu, can use the frontend's catalog
through a `RunicTranslationProject` item, also outside the project's directory.
The generated catalog loads each locale on first use. See the
[Runic Desktop note](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/runic-desktop.md#strings-outside-the-views).

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

See the [Vite quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/quickstart-vite.md#svelte-without-sveltekit).

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
[VS Code](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/tools/vscode-runic-translations/README.md)
and
[Visual Studio](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/tools/visualstudio-runic-translations/README.md),
and the Editor; the
[diagnostics reference](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/diagnostics.md)
explains each one.

`runic-translations import-text` turns tables keyed by their base text into one
RMF2 group with stable generated keys:

```sh docs-test=skip:translations-repository
runic-translations import-text --project translations --group stored \
  --base locales/untranslated.json --table de=locales/de.json
```

See the
[RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/rmf2.md#import-a-text-keyed-catalog).

## The Translations Editor

The Translations Editor is a desktop app for translators. It opens a
`translations/` project, shows locale coverage, edits and previews messages
with the same compiler, and exports and imports XLIFF. It is available from
source only: this release has no Editor download. See the
[Editor README](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/apps/translations-editor/README.md)
to build and launch it.

## Choose your platform

Each quick start starts from an empty folder and ends with a running app:

- **.NET**: the
  [.NET quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/quickstart-dotnet.md)
  creates a translations library with `dotnet new runic-translations-project`
  and prints the first message from a console app.
- **WPF**: the
  [WPF quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/packages/dotnet/Runic.Translations.Wpf/README.md#wpf-quick-start)
  binds messages in XAML with `{rt:Message}`, next to existing `.resx`
  resources.
- **Vite and TypeScript**: the
  [Vite quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/quickstart-vite.md)
  adds the Vite plugin, renders a message and builds on CI.
- **SvelteKit**: the
  [SvelteKit quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/quickstart-sveltekit.md)
  adds localized routes, a language switcher and server rendering per request.
- **Command line**: [translate a CLI](../command-line/README.md#translate-a-cli)
  with the `Runic.Translations.CommandLine` adapter, which translates Runic
  Command Line help, errors and faults.
- **Runic Desktop**: there is no separate adapter. Use the .NET runtime and the
  Vite plugin as above; the
  [Runic Desktop note](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/runic-desktop.md)
  explains how locale files are delivered.

## Upgrading to 0.8.0

Update every Translations package and the `dotnet-runic-translations` tool to
`0.8.0` together, then rebuild; the build regenerates catalog code into the
new `Runic.Translations.Generated` namespace. What application code usually
touches:

- **MSBuild names** start with `Runic`, such as `RunicTranslationProject`,
  `RunicTranslationsEmitEsm` and `RunicTranslationsXamlCatalog`. An old name
  fails the build with `RTR0086`, which names the replacement.
- **npm packages** have one import path per export.
  `@runic-artifex/translations-svelte/translations` and `/translations/testing`
  become the package root and `/testing`;
  `@runic-artifex/translations-sveltekit/translations` and
  `/translations/navigation` become the root and `/navigation`. The SvelteKit
  exports lose their `Runic` prefix: `createLocaleRouting`,
  `createLocaleHandle`, `createLocaleReroute`. The Vite plugin needs Vite
  8.3.3 or a later 8.x, the Svelte package Svelte 5.57.1, and the Vite plugin
  and SvelteKit package Node 24.18 or later 24.x, or Node 26.
- **WPF.** `TranslationSource` takes the generated `text.Messages`
  (`IReadableMessages`) instead of `object`.
- **The tool** selects JSON with `--format json`, uses the exit codes above and
  reports its own fault codes in the JSON response. `init --class` is
  `--class-name`, as in the templates, whose camelCase aliases are removed.
  `runic-translations support preview|collect|remove` replaces
  `dotnet runic support --mode …`, which forwards to it.
- **Command Line.** `Runic.Translations.CommandLine` and the tool depend on
  Runic Command Line `[0.9.0, 0.10)`; see
  [translate a CLI](../command-line/README.md#translate-a-cli).
  `Runic.Translations.Tooling` no longer depends on Command Line.

The
[0.8.0 upgrade tables](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/eng/release/notes/0.8.0.md#upgrading)
list every change.

## Next steps

- [Migrating Svelte translation imports](../migrations/translations-svelte.md)
  moves an existing app from the SDK's Svelte packages to the independent
  Translations packages.
- [Translations in ViewModels](../application/guides/model-context.md#translations-in-viewmodels)
  shows how a Runic ViewModel follows locale changes.
- The
  [RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/rmf2.md)
  covers the full message syntax, markup, documents and mounted source folders.
- The
  [ESM backend guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/esm.md)
  describes the generated web modules in detail.
- [Release notes for 0.8.0](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/eng/release/notes/0.8.0.md)
  list what changed in this release.
