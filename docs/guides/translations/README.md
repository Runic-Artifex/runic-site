# Get started with Runic Translations

Runic Translations compiles your message files into typed C# and TypeScript
APIs. This page explains the concepts and leads to the quick start for your
platform.

It covers release `0.6.0-preview.5`. The Translations repository owns the
detailed guides; every link to it points at that release. Translations is
versioned on its own, so its version does not need to match the Application
SDK. Use one exact Translations version for every Translations package and tool
in a project.

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
[RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/rmf2.md)
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

On the web, import `m` and call a message function:

```ts docs-test=skip:translations-repository
import { m } from 'virtual:runic-translations/app';

m.application_title();
m.greeting({ name: 'Ada' }, { locale: 'de' });
```

## Switching locales

In .NET, `ITranslationManager.SetLocaleAsync` replaces the whole catalog
snapshot at once, so a reader never sees half of one locale and half of
another. The manager raises `LocaleChanged` after a switch, and, since
`0.6.0-preview.5`, `SnapshotPublished` after every new snapshot, including
refreshes.

On the web, the runtime's `createLocaleSource` creates a locale state with
`getLocale`, `setLocale` and `subscribe`, and the `{ locale }` option overrides
the locale for one call. On a server, `runWithLocale` gives each request its
own locale, so concurrent requests never share it. The Svelte and SvelteKit
packages connect these to components and URL routing.

## Validate your messages

`dotnet build` validates the catalog and fails on errors. For CI or a web
project, the `dotnet-runic-translations` tool validates without building:

```sh docs-test=skip:translations-repository
dotnet tool run runic-translations -- validate --project translations
```

The tool also runs `generate` to write output and `verify` to check that
committed output is current. Exit code `0` means success, `1` means catalog or
verification errors, and `2` means an invalid invocation or an operational
failure. Errors carry `RTR` IDs, which are the same in the build, the tool,
the IDE extensions and the Editor; the
[diagnostics reference](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/diagnostics.md)
explains each one.

## The Translations Editor

The Translations Editor is a desktop app for translators. It opens a
`translations/` project, shows locale coverage, edits and previews messages
with the same compiler, and exports and imports XLIFF. It is available from
source only: this preview has no Editor download. See the
[Editor README](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/apps/translations-editor/README.md)
to build and launch it.

## Choose your platform

Each quick start starts from an empty folder and ends with a running app:

- **.NET**: the
  [.NET quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/quickstart-dotnet.md)
  creates a translations library with `dotnet new runic-translations-project`
  and prints the first message from a console app.
- **WPF**: the
  [WPF quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/packages/dotnet/Runic.Translations.Wpf/README.md#wpf-quick-start)
  binds messages in XAML with `{rt:Message}`, next to existing `.resx`
  resources.
- **Vite and TypeScript**: the
  [Vite quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/quickstart-vite.md)
  adds the Vite plugin, renders a message and builds on CI.
- **SvelteKit**: the
  [SvelteKit quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/quickstart-sveltekit.md)
  adds localized routes, a language switcher and server rendering per request.
- **Runic Desktop**: there is no separate adapter. Use the .NET runtime and the
  Vite plugin as above; the
  [Runic Desktop note](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/runic-desktop.md)
  explains how locale files are delivered.

## Next steps

- [Migrating Svelte translation imports](../migrations/translations-svelte.md)
  moves an existing app from the SDK's Svelte packages to the independent
  Translations packages.
- [Translations in ViewModels](../application/guides/model-context.md#translations-in-viewmodels)
  shows how a Runic ViewModel follows locale changes.
- The
  [RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/rmf2.md)
  covers the full message syntax, markup, documents and mounted source folders.
- The
  [ESM backend guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/esm.md)
  describes the generated web modules in detail.
- [Release notes for 0.6.0-preview.5](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/eng/release/notes/0.6.0-preview.5.md)
  list what changed in this release.
