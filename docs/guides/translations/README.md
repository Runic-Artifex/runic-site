# Get started with Runic Translations

Runic Translations compiles your message files into typed C# and TypeScript
APIs. This page explains the concepts and leads to the quick start for your
platform.

It covers release `0.16.0`. The Translations repository owns the
detailed guides; every link to it points at that release. Translations is
versioned on its own, so its version does not need to match the Application
SDK. Use one exact Translations version for every Translations package and tool
in a project. Since `0.8.0` versions are plain `0.y.z` until 1.0: a new minor
may contain breaking changes, listed with upgrade steps in its release notes,
and a patch only fixes or adds.

`0.16.0` has eight NuGet packages (`Runic.Translations`, `.Build`,
`.CommandLine`, `.Hosting`, `.Tooling`, `.Wpf`, `.Templates` and the
`dotnet-runic-translations` tool) and three npm packages
(`@runic-artifex/vite-plugin-runic-translations`,
`@runic-artifex/translations-svelte` and
`@runic-artifex/translations-sveltekit`). `0.16.0` is the Translations release
of the 0.24 release train. `Runic.Translations.CommandLine` `0.16` needs Runic
Command Line `0.15`, and SDK `0.24`'s `Runic.Application.Views.Translations`
needs Translations `0.16`. Of the 0.15 line, `0.15.1` fixed how external and
overlay packs are loaded
([advisory GHSA-24g5-pcc5-4fg7](https://github.com/Runic-Artifex/runic-translations-sdk/security/advisories/GHSA-24g5-pcc5-4fg7)). The VS Code and Visual Studio extensions, both named Runic DevKit
since 0.22, release from
[runic-editors](https://github.com/Runic-Artifex/runic-editors/releases/tag/v0.23.0)
(0.23.0 with this train), no longer with Translations. Of the 0.9 line, use `0.9.1`, not the deprecated `0.9.0`.

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
[RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/rmf2.md)
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
[Runic Desktop note](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/runic-desktop.md#strings-outside-the-views).

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
fallback is not silent. Since `0.14.0` a pseudo-locale such as `en-XA` or
`ar-XB` is chosen only when it is requested by its own tag: locale fallback and
negotiation of every other tag skip it, in .NET (`SetLocaleAsync`,
`LocaleNegotiation`, `SetLocaleFromPreferencesAsync`, overlay-added locales)
and on the web (`resolveLocale`, `negotiateLocale`, the SvelteKit locale
routing). Before, a Debug build with `pseudoLocales` could format `en-XA`
pseudo text for `en-US` where a Release build kept the base locale.

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

See the [Vite quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/quickstart-vite.md#svelte-without-sveltekit).

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
[Ship translations in a library](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/libraries.md),
[Catalogs from libraries](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/composition.md) and the
[`Runic.Translations.Hosting` README](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/packages/dotnet/Runic.Translations.Hosting/README.md).
Translation packs downloaded at run time use the same overlays; see
[Ship translation updates without a release](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/ota.md).

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
the editor extensions for
[VS Code](https://github.com/Runic-Artifex/runic-editors/blob/v0.23.0/vscode/README.md)
and
[Visual Studio](https://github.com/Runic-Artifex/runic-editors/blob/v0.23.0/visualstudio/README.md)
(both Runic DevKit since runic-editors 0.22), and the Editor; the
[diagnostics reference](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/diagnostics.md)
explains each one.

`runic-translations import-text` turns tables keyed by their base text into one
RMF2 group with stable generated keys:

```sh docs-test=skip:translations-repository
runic-translations import-text --project translations --group stored \
  --base locales/untranslated.json --table de=locales/de.json
```

See the
[RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/rmf2.md#import-a-text-keyed-catalog).
`runic-translations import --from resx|i18next` migrates `.resx` files and
i18next JSON; see
[Migrate from .resx](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/migrate-resx.md) and
[Migrate from i18next](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/migrate-i18next.md).

## Work with translators

Translators edit the `.rmf2` sources in the Editor or an IDE extension, or work
in a translation management system through XLIFF 2.1:
`runic-translations xliff export` and `xliff import` exchange placeholders and
plural variants, and import applies each unit on its own. An optional
`<catalog>.review.json` records review state for the tool, the Editor and the
language server, and `validate` warns with `RTR0090` when a translation
predates a change to its source. Since `0.15.0`, `review mark`, `xliff import`,
the Editor and the language server also record the source text each review
was made for in `<catalog>.review-sources.json` beside the review file; commit
it with the review file. `review mark --key` takes the dotted key
(`common.cancel`) as well as the canonical one (`common_cancel`). `runic-translations status` reports coverage
per locale, and `--min-coverage de=100,fr=80` fails CI when one lags. The
`pseudoLocales` setting in `runic.json` adds pseudo-locales such as `en-XA` to
development builds; since `0.14.0` only a request for their own tag selects
them. See
[Work with translators and translation tools](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/translators.md).

## The Translations Editor

The Translations Editor is a desktop app for translators. It opens a
`translations/` project, shows locale coverage, edits and previews messages
with the same compiler, and exports and imports XLIFF. Since `0.9.1` it also
opens every catalog of a workspace and shows library catalogs as read-only
layers next to your overrides. It is available from
source only: this release has no Editor download. See the
[Editor README](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/apps/translations-editor/README.md)
to build and launch it. Since `0.14.0` it publishes for Windows and macOS from
any build machine, and a published Editor no longer carries its smoke test.
Since `0.15.0` a stale translation's workflow panel shows the source it was
approved for ("Source when marked") next to the current one, with the changes
marked.

## Editors and the language server

`runic-translations lsp`, the language server in the project's local
`dotnet-runic-translations` tool, gives editors diagnostics, completion, hover,
navigation and formatting for `.mf2` and `.rmf2` files, and the refactorings
through standard LSP (protocol revision 2), without client code of its own.
`0.14.0` offered them to a client that sent `"runicProtocol": 2`; since
`0.15.0` every client gets revision 2:

- **F2** renames MF2 inputs and slot references in every locale's resource, as
  well as resources and locals, with `prepareRename` showing the current name.
  In a workspace with application sources, a resource rename asks whether to
  rename in resource sources only; Runic still does not update call sites.
- **Extract Group** and **Inline Resource** are `refactor.extract` and
  `refactor.inline` code actions: "Extract group 'shop' to shop/en.rmf2" on a
  group's name, and one "Inline into ../en.rmf2" per ancestor resource of the
  same locale. A client without the `delete` resource operation, such as Visual
  Studio 2026, gets Inline Resource as an edit that empties the inlined file.
- The `runic.*` refactoring commands apply their edits through
  `workspace/applyEdit`, and the server registers its file watchers with
  clients that support it (and watches itself for those that cannot).

So Neovim, Helix, JetBrains IDEs with LSP4IJ and Visual Studio 2026's LSP
client get the refactorings. Since `0.15.0` an unknown request is
`MethodNotFound` and a request that cannot be carried out `RequestFailed`, and
the server stays responsive in catalogs of 20,000 messages: it validates a
burst of edits once, in the background, and recompiles only what an edit
changed, which CI holds to budgets. See
[protocol revisions](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/language-server.md#protocol-revisions)
and
[client compatibility](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/language-server.md#client-compatibility).

**Runic DevKit** (runic-editors 0.23.0, the first release without the
Marketplace Preview label) requests protocol 2 in both editors, and works with
Translations `0.14.0` workspaces too. The extensions from runic-editors 0.21
and earlier cannot use the `0.15` language server:

- **VS Code:** F2 renames inputs (`$name`), slot references (`ref=`),
  resources and MF2 locals, and the light bulb offers **Extract group** and
  **Inline into ../en.rmf2**. The palette commands remain. When the server
  rejects a light-bulb refactoring as outdated, such as after a save's
  file-watcher event, the extension resolves it once more and then shows a
  warning instead of applying nothing.
- **Visual Studio:** the same through F2 and the light bulb, with a resource
  rename's question in an InfoBar. Visual Studio cannot delete files through
  LSP, so **Inline into ../en.rmf2 (leaves en.rmf2 empty)** empties the child
  file; once that file and the ancestor are saved, DevKit deletes it through its
  project item, so Solution Explorer and source control follow, and says so in
  the **Runic Translations** Output pane. Only the emptied file is deleted, and
  only while it is saved and empty: undo the Inline or write into it and it
  stays. When the server refuses a rename (an invalid name, a catalog that does
  not compile), Visual Studio closes the rename box without a message; DevKit
  shows the server's reason in an InfoBar, the status bar and the Output pane.
- **Visual Studio's Tools → Runic** also has **Export XLIFF…**, **Import XLIFF
  (Dry Run)…**, **Import .resx or i18next Catalog…**, **Override Library
  Message…** and translation status, and **Tools → Options → Runic DevKit**
  sets the .NET executable, the language server assembly and its trace.
- **Visual Studio asks before it starts the language server outside the
  solution** (0.23). A tool manifest in the open solution's folder starts it as
  before. For a manifest anywhere else, DevKit first asks whether you trust
  that folder, because `dotnet` uses its `global.json`, NuGet configuration
  and tool manifest. A Yes is remembered for the folder; after a No,
  **Tools → Runic → Restart Language Server** asks again. VS Code runs the
  extension only in trusted workspaces.

Install them from their Marketplaces: in VS Code
[runic-artifex.runic-devkit](https://marketplace.visualstudio.com/items?itemName=runic-artifex.runic-devkit),
and in Visual Studio 2026
[runic-artifex.runic-devkit-vs](https://marketplace.visualstudio.com/items?itemName=runic-artifex.runic-devkit-vs)
(Extensions → Manage Extensions, search for "Runic DevKit"). Both VSIX files
are also on the
[runic-editors 0.23.0 release](https://github.com/Runic-Artifex/runic-editors/releases/tag/v0.23.0).
The [VS Code](https://github.com/Runic-Artifex/runic-editors/blob/v0.23.0/vscode/README.md)
and
[Visual Studio](https://github.com/Runic-Artifex/runic-editors/blob/v0.23.0/visualstudio/README.md)
READMEs describe them. Uninstall the former **Runic** (`runic-artifex.runic`) or **Runic
MF2 Translations** extension: while both are installed, both start a language
server for the same files. Keep the project's `dotnet-runic-translations` tool
at its Translations version.

## Choose your platform

Each quick start starts from an empty folder and ends with a running app:

- **.NET**: the
  [.NET quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/quickstart-dotnet.md)
  creates a translations library with `dotnet new runic-translations-project`
  and prints the first message from a console app.
- **WPF**: the
  [WPF quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/packages/dotnet/Runic.Translations.Wpf/README.md#wpf-quick-start)
  binds messages in XAML with `{rt:Message}`, next to existing `.resx`
  resources.
- **Vite and TypeScript**: the
  [Vite quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/quickstart-vite.md)
  adds the Vite plugin, renders a message and builds on CI.
- **SvelteKit**: the
  [SvelteKit quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/quickstart-sveltekit.md)
  adds localized routes, a language switcher and server rendering per request.
- **Command line**: [translate a CLI](../command-line/README.md#translate-a-cli)
  with the `Runic.Translations.CommandLine` adapter, which translates Runic
  Command Line help, errors and faults.
- **Runic Desktop**: there is no separate adapter. Use the .NET runtime and the
  Vite plugin as above; the
  [Runic Desktop note](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/runic-desktop.md)
  explains how locale files are delivered.
- **Runic Views**:
  [Translate a Runic Views app](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/runic-views.md)
  connects the page, ViewModels and native text to one catalog. It needs
  Runic SDK `0.17` or later; SDK `0.24` needs Translations `0.16`, SDK `0.23`
  Translations `0.15.1`, SDK
  `0.22` Translations `0.14`, SDK `0.21`
  Translations `0.13`, SDK `0.20`
  Translations `0.12`, SDK `0.19` Translations `0.11`, and SDK `0.18`
  Translations `0.10`.
- **Framework text**:
  [Framework text](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/framework-text.md)
  covers both framework catalogs (`runic-command-line` and Runic SDK's
  `runic-views`), how to register and override them, what stays English, and
  the German style guide.

## Upgrading to 0.16.0

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.16.0` together, and Runic Command Line
to `0.15`, then rebuild. `0.16.0` changes no API and no generated code; the
one required change is the Command Line pairing.

- **Runic Command Line 0.15.** `Runic.Translations.CommandLine` `0.16`
  depends on `Runic.CommandLine` `[0.15.0, 0.16.0-0.0)`, so update both
  together; the adapter's `0.15.x` stays on Command Line `0.14`. Command Line
  `0.15` adds and changes no text keys, so the `runic-command-line` catalog,
  its English and German text, and your overrides and packs keep working. Help
  and usage errors change in every language: a command's and a group's help no
  longer list `--version` (`Version anzeigen` in German), which only root help
  keeps; a root command's usage error ends with root help's usage line and
  `Weitere Informationen erhalten Sie mit "<application> --help".`; and a root
  command's name is no longer suggested for a mistyped command. Update tests
  that compare such text. See
  [Command Line](../command-line/README.md#upgrading-from-014).
- **Runic SDK.** `Runic.Application.Views.Translations` `0.24.0` needs
  Translations `[0.16.0, 0.17.0)`. SDK `0.23` uses `0.15.1`.

New in `0.16.0`, without a change of yours:

- **Library catalogs in the renamed format.** The build, the `overrides` CLI,
  the language server and the Editor read a package's library catalog in the
  format of the coming Runic Artifex rename (`rax/<catalog>/rax.json` with
  `*.ramf2` sources) as well as the current one, and prefer the new one when a
  package ships both, so a library can move first. Packing, an application's
  own catalog and its override sources are unchanged. See
  [Library catalog formats](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/docs/guides/translations/libraries.md#library-catalog-formats).
- **Old-name guards.** `Runic.Translations.Build` ships the rename's guards
  (`RTR0110`, `RTR0086`, `RTR0111`). They list no name yet, so nothing reports
  them in this release.
- **`dotnet runic translations`.** From Runic SDK `0.24`, `dotnet runic
translations …` runs `runic-translations …` with the same arguments and
  exit code, and `runic-translations --extension-info` answers the core
  tool's `doctor`. The package and the command keep their names. See
  [Run under `dotnet runic`](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/tools/dotnet-runic-translations/README.md#run-under-dotnet-runic).
- **Capability matrix version 2.** `capabilities-v2.json` lists the
  implementations of the Translations contract as an open set, each with its
  status; `runic-translations schema` writes
  [`capabilities-v2.schema.json`](https://runic-artifex.eu/schemas/translations/capabilities-v2.schema.json).
  Version 1 is frozen, and its schema now accepts the language-script locales
  (`az-Arab`, `sr-Latn`, `zh-Hant`) its matrix has always listed.
- **Visual Studio's MSBuild.** `Runic.Translations.Build`'s targets no longer
  fail with `MSB4186` in a Visual Studio build, for example with
  `RunicTranslationsCldrSubset` set.

The
[0.16.0 release notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.16.0/eng/release/notes/0.16.0.md#upgrading-from-015)
list every change.

### Upgrading to 0.15.1

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.15.1` together, and Runic Command Line
to `0.14`, then rebuild. `0.15.1` is a patch of `0.15.0` that changes no API;
the steps below are those of `0.15.0`.

- **Regenerate ESM output with `0.15.1`.** `0.15.1` fixes how external and
  overlay packs are loaded. .NET applications get the fix by updating the
  packages, and code generated with `0.15.0` runs on the `0.15.1` runtime
  unchanged. Generated ESM carries its own runtime, so regenerate it with the
  `0.15.1` compiler: a build with the `0.15.1` Vite plugin or
  `dotnet-runic-translations` tool does that. A pack that fails to load is
  refused with `TranslationPackException` in .NET or an `RTR0023` result in
  ESM, so the application's fallback runs. See the
  [0.15.1 release notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.15.1.md).
- **Generated catalogs need the 0.15 runtime.** C# that
  `Runic.Translations.Build` `0.15` generates against `Runic.Translations`
  `0.15` uses RMF2 runtime ABI 5: each locale as binary data and the message
  table as DEFLATE data. Keep both packages at the same version. The `0.15`
  runtime still runs the ABI 3 and 4 code that `0.13` and `0.14` generated, so
  libraries packed with them keep working, and `.Build` `0.15` still generates
  ABI 4 for a project that references a `0.14` runtime. ESM output and packs
  stay JSON.
- **Runic Command Line 0.14.** `Runic.Translations.CommandLine` `0.15` depends
  on `Runic.CommandLine` `[0.14.0, 0.15.0-0.0)`, so update both together.
  Command Line `0.14` retires the `faults.RCLI4001` key; to change the text of
  a prompt that cannot be asked, override `diagnostics.promptRequiresTerminal`,
  `diagnostics.promptJsonOutput` and `diagnostics.promptDisabled` (input
  `prompt`) in `translations/overrides/runic-command-line/<locale>.rmf2`. See
  [Command Line](../command-line/README.md#upgrading-from-013).
- **Breaking: a message in your own catalog no longer overrides command-line
  framework text.** `0.14` deprecated this second override path, and `0.15`
  removes it: such a message has no effect, the built-in text is shown, and
  warning `RTR0107` names the key. Move each such message, unchanged, to
  `translations/overrides/runic-command-line/<locale>.rmf2` as described
  [for 0.14.0](#upgrading-to-0140), or rename it if it is your own text that
  only shares the name. See
  [Framework text](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/framework-text.md#messages-named-after-command-line-framework-keys).
- **Breaking: the language server speaks only protocol revision 2.** Use
  Runic DevKit 0.22 or later; the extensions of runic-editors 0.21 and
  earlier report a refactoring as failed although the server made the edit.
  Other LSP clients need no change and can drop `runicProtocol`.
- **Packs for releases before 0.15 need `--contract`.** Packs that the `0.15`
  compiler writes carry markup contract version 3, which runtimes before
  `0.15` refuse (`RTR0023/markup-contract-version-mismatch`). For an
  application released with `0.14` or earlier, build its packs with
  `generate --emit-json --contract <its shipped locale artifact>`. See
  [packs for a shipped release](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/ota.md#packs-for-a-shipped-release).
- **Diagnostics name a message by its logical key** (`common.cancel`) instead
  of its canonical key (`common_cancel`). IDs, locations and the structured
  key are unchanged; a check that matches the text of a diagnostic needs
  updating.
- **Runic SDK.** `Runic.Application.Views.Translations` `0.23.0` needs
  Translations `[0.15.1, 0.16.0)`; the template pins `0.15.1` for the tool,
  `Runic.Translations` and `.Build`, and the Vite plugin, and
  `dotnet runic doctor` checks for it. SDK `0.22` uses `0.14`.

New in `0.15.0`, without a change of yours:

- **Smaller generated .NET catalogs that load faster.** For the Editor's
  1,000 messages in two locales the embedded data shrinks from 79.7 to 46.1
  bytes per message, a locale is ready about 5 times sooner, a message is
  built only when it is first formatted, and a NativeAOT executable grows by
  about 130 bytes per message instead of 198.
- **Fast in large catalogs.** At 20,000 messages in 10 locales,
  `runic-translations validate` takes about 3.5 s instead of 50 s, and the
  language server answers hover and completion while you type.
- **Packages declare the catalog's languages.** A Runic Desktop application
  without `RunicApplicationLocales` gets the languages of its `runic.json`, so
  `dotnet runic package` declares them
  ([shipping](../desktop/shipping.md#infoplist)).
- **What changed in a stale translation's source**, in the Editor
  ([above](#the-translations-editor)), and dotted keys in the CLI.

The
[0.15.0 release notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.0/eng/release/notes/0.15.0.md#upgrading-from-014)
list every change.

### Upgrading to 0.14.0

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.14.0` together, then rebuild. Runic
Command Line stays at `0.13`.

- **Generated catalogs need the 0.14 runtime.** C# that
  `Runic.Translations.Build` `0.14` generates against `Runic.Translations`
  `0.14` requires RMF2 runtime ABI 4: it embeds each locale's messages as
  DEFLATE data and reads its message definitions from one message table. It
  fails with `NotSupportedException` on an earlier runtime, so reference both
  packages at the same version. The `0.14` runtime still runs the ABI 3 code
  that `0.13` generated, so libraries packed with `0.13` keep working on it.
  ESM output and external packs are unchanged.
- **Libraries packed with `Runic.Translations.Build` 0.13** depend on
  `Runic.Translations` `[0.13.0, 0.14.0-0.0)`, so an application on the
  `0.14.0` runtime gets `NU1608`. Pack a library update with `0.14.0`.
- **Language server clients opt in to protocol 2**
  ([above](#editors-and-the-language-server)). A client that does not, such as
  the editor extensions from runic-editors 0.21, gets the `0.13` behaviour.
  Move custom clients to protocol 2 during `0.14`.
- **Deprecated: framework text from your own catalog in
  `Runic.Translations.CommandLine`.** A message in your application's catalog
  named after a `runic-command-line` key, such as `help { usage = Synopsis }`,
  still overrides that command-line text in `0.14`, but the build reports it as
  warning `RTR0107`, and `TranslationCommandTextResolver` writes a trace warning
  once when it uses one. `0.15` removes this second override path. To migrate,
  move each such message, unchanged, to
  `translations/overrides/runic-command-line/<locale>.rmf2`, add
  `{ "catalog": "runic-command-line", "from": "Runic.Translations.CommandLine" }`
  to `overrides` in `runic.json`, and register `AppTextCatalog.Overlays` with a
  context-based resolver
  (`new TranslationCommandTextResolver(context, AppTextCatalog.CatalogId)`, the
  `TranslationContextBuilder` constructor, or
  `AddRunicCommandLineTranslations()`); the snapshot and manager constructors
  ignore overlays. The build then checks each override against the framework
  catalog (`RTR0103`). See
  [the second path for command-line text](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.14.0/docs/guides/translations/framework-text.md#the-second-path-for-command-line-text-deprecated).
- **Pseudo-locales** are chosen only by their own tag
  ([switching locales](#switching-locales)), so a Debug build with
  `pseudoLocales` resolves every other tag as a Release build does.
- **Runic SDK.** `Runic.Application.Views.Translations` `0.22.0` needs
  Translations `[0.14.0, 0.15.0)`; the template pins `0.14.0` for the tool,
  `Runic.Translations` and `.Build`, and the Vite plugin, and
  `dotnet runic doctor` checks for it. SDK `0.21` uses `0.13`.

New in `0.14.0`, without a change of yours:

- **Smaller NativeAOT executables.** On linux-x64 a console application with
  the Editor's catalog (872 messages in English and German) shrinks from 4.39
  MB to 3.17 MB: Hot Reload no longer links reflection in a trimmed publish
  (about 350 KB; Debug builds and `dotnet watch` still apply edited text), each
  locale's data is compressed (the Editor's catalog: 505 KB to 37 KB), and a
  message adds about 200 bytes instead of 550. The markup contract is
  compressed too, and overlays are linked only when the application creates
  one. A locale is inflated once, on its first use. In SDK 0.22, a NativeAOT
  CS-WebUI application with Runic's own text is about 350 KB smaller on
  linux-x64.
- **CLDR data as data.** The runtime's CLDR locale tables and plural rules are
  compact data instead of code, about 80 KB less in a NativeAOT executable, with
  identical results.
- **An opt-in CLDR subset.** In an application that never adds a locale of
  another language at run time,
  `<RunicTranslationsCldrSubset>true</RunicTranslationsCldrSubset>` embeds only
  the CLDR number, date, list and relative-time data of the catalog's
  languages, and a trimmed or NativeAOT publish drops the full 52 KB. A locale
  outside the subset, such as one a pack adds, formats as a locale without CLDR
  data, with lists and relative times in CLDR root's language-neutral patterns
  (`a, b, c`, `-1 d`), and is reported once (`Runic-Translations` event 4).
  `RunicTranslationsCldrLocale` items add locales. The default is unchanged. See
  [embed only your catalog's CLDR data](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/packages/dotnet/Runic.Translations.Build/README.md#embed-only-your-catalogs-cldr-data).
- **Windows fixes.** The Vite plugin updates an edited message in place again,
  a project with several `sourceRoots` attributes each resource file to its own
  root, and the tool prints paths outside the working directory with `/`.

The
[0.14.0 release notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.14.0.md#upgrading-from-013)
list every change.

### Upgrading to 0.13.0

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.13.0` together, then rebuild. Runic
Command Line stays at `0.13`. Three names changed, from the API review before
1.0:

- **`TranslationContextBuilder.Add` is now `AddCatalog`**, the name that
  `IRunicTranslationsBuilder.AddCatalog` of `Runic.Translations.Hosting`
  already has. Replace `.Add(` with `.AddCatalog(` where a
  `TranslationContext.CreateBuilder()` chain registers a catalog; the
  arguments and the behaviour are unchanged. Code compiled against 0.12 fails
  with `MissingMethodException` until it is rebuilt.
- **`RUNIC_TRANSLATIONS_EDIT_ALLOW` is no longer read.** Set
  `RUNIC_DEV_ALLOW`, which takes the same entries and which Runic SDK's Vite
  plugin also reads for Runic Inspect. When the old variable is set, the dev
  server logs a warning and ignores it.
- **`xliff import` takes the document with `--input <path>`** instead of
  `--source <path>`. `--source` still works as a hidden alias until 2.0;
  giving both is an invocation error (exit code 2).

The in-page editing API of `@runic-artifex/vite-plugin-runic-translations`
also checks `Host` itself under `server.allowedHosts: true` (IP addresses,
`localhost` and allow-listed names), and on Linux accepts a write from
loopback only from the user who runs the dev server; macOS and Windows log that
they cannot tell local users apart. Reads and allowed remote clients are
unchanged. `Runic.Application.Views.Translations` `0.21.0` needs Translations
`0.13`; SDK `0.20` uses `0.12`. The editor extensions installed from the
[runic-editors 0.21.0 release](https://github.com/Runic-Artifex/runic-editors/releases/tag/v0.21.0).

The
[0.13.0 release notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.13.0.md#upgrading-from-012)
list every change.

### Upgrading to 0.12.0

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.12.0` together, then rebuild. Runic
Command Line stays at `0.13`: `Runic.Translations.CommandLine` `0.12.0`
depends on Command Line `[0.13.0, 0.14.0-0.0)`, as `0.11.0` did. No API was
removed; the changes are in the Vite plugin's development server.

- **Edited messages update in place under `vite dev`** and the page keeps its
  state. Added, removed or renamed messages, changed inputs or markup and
  `runic.json` changes still reload the page, with the reason logged. Code that
  reads a message's text once and keeps it, outside `m.key()` calls that run
  again and outside `useMessageLocale`, keeps the old text until the next
  reload; follow the text-change channel
  (`globalThis[Symbol.for("runic.translations.text")]`) to format again. See
  [text changes during development](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/esm.md#text-changes-during-development).
  Production builds are unchanged.
- **The dev server answers `/__runic-translations/message`**, which reads a
  message in every locale and writes one locale's text back to the project's
  `.rmf2` files, source-preserving. It accepts same-origin requests from the
  same machine only; `inPageEditing: { allow: [...] }` or `RUNIC_DEV_ALLOW`
  admit other hosts, and `inPageEditing: false` turns it off. Runic SDK 0.20's
  Runic Inspect edits translations on the page through it. See
  [in-page translation editing](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/esm.md#in-page-translation-editing).
- **The editor extensions** install from the
  [runic-editors releases](https://github.com/Runic-Artifex/runic-editors/releases)
  (0.20.0 with this train), not from a Translations release. In VS Code, the
  Runic MF2 Translations extension became **Runic** (`runic.vsix`); uninstall
  `runic-artifex.runic-translations` after installing it. Both still run
  `runic-translations lsp` from the project's local `dotnet-runic-translations`
  tool, so keep that tool at the project's Translations version.
- **Libraries packed with `Runic.Translations.Build` 0.11** depend on
  `Runic.Translations` `[0.11.0, 0.12.0-0.0)`, so an application on the 0.12.0
  runtime gets `NU1608`. Pack a library update with 0.12.0.
- **Runic SDK.** `Runic.Application.Views.Translations` `0.20.0` needs
  Translations `0.12`; SDK `0.19` uses `0.11`.

New: Go to Definition on `m.key()` opens the message in the base locale's
source file through a declaration map (`messages.d.ts.map`), and message
markers tell an inspector which message an element shows; see
[editor navigation](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/esm.md#editor-navigation)
and
[message markers](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/esm.md#message-markers).
The
[language server guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/language-server.md)
describes `runic-translations lsp` for editors.

The
[0.12.0 upgrade notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.12.0.md#upgrading-from-011)
list every change.

### Upgrading to 0.11.0

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.11.0` together, then rebuild.

- **Command-line apps** that use `Runic.Translations.CommandLine`: update
  `Runic.CommandLine` (and `.Spectre`, `.Processes`, `.Testing`) to `0.13`
  together with every Translations package. The adapter depends on Command
  Line `[0.13.0, 0.14.0-0.0)`; with Command Line `0.12` it no longer restores
  without `NU1608`. See
  [Upgrading from 0.12](../command-line/README.md#upgrading-from-012).
- **Tests that compare German or English CLI output** see the rendered text
  change: `Das Argument <name> fehlt.` instead of `Das Argument name fehlt.`,
  the placeholders under `Argumente:`, the option spellings in
  `[erfordert: …]` and `[schließt aus: …]`, and no default note for flags.
- **Scripts that read the argument ID from a JSON diagnostic's `arguments`**
  read the new `binding` member instead; `arguments` now holds the
  placeholder.
- **Overrides of `runic-command-line`** need no change: Command Line `0.13`
  adds and removes no framework text key, and no message changed its inputs.
- **Runic SDK.** `Runic.Application.Views.Translations` `0.19.0` needs
  Translations `0.11`; SDK `0.18` uses `0.10`.
- **Tool.** `dotnet-runic-translations` runs on Command Line `0.13`: its help
  lists arguments by their placeholder, such as `<tag>` for
  `locale add --help`.

New: `[Command]` and `[CommandGroup]` take `LongDescriptionKey`, which the
adapter resolves through your catalog as it does `DescriptionKey`.

The
[0.11.0 upgrade notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.11.0.md#upgrading-from-010)
list every change.

### Upgrading to 0.10.0

Update every Translations package, the npm packages and the
`dotnet-runic-translations` tool to `0.10.0` together, then rebuild.

- **Command-line apps** that use `Runic.Translations.CommandLine`: update
  `Runic.CommandLine` (and `.Spectre`, `.Processes`) to `0.12` together with
  every Translations package. The adapter depends on Command Line
  `[0.12.0, 0.13.0-0.0)` and no longer restores with Command Line `0.9`; see
  [translate a CLI](../command-line/README.md#translate-a-cli).
- **Overrides of `runic-command-line`**: some messages take other inputs with
  Command Line `0.12` (for example `diagnostics.unknownCommand` takes
  `$command`, and `diagnostics.invalidChoiceHidden` takes `$help`). The build
  reports an override that no longer fits (`RTR0016`, `RTR0065`) or names a
  removed key (`RTR0103`).
- **Tests that compare German or English CLI output** see the new wording, and
  the usage line and hint after each usage error.
- **`Runic.Translations.Hosting` and `Runic.Translations.Wpf`** now depend on
  `Runic.Translations` `[0.10.0, 0.11.0-0.0)`: update `Runic.Translations` to
  the same minor, or restore reports `NU1608`.
- **Runic SDK.** `Runic.Application.Views.Translations` `0.18.0` needs
  Translations `0.10`; SDK `0.17` uses `0.9.1`.
- **Tool.** `dotnet-runic-translations --version`, the `serve` handshake and
  SARIF reports carry the package version, such as `0.10.0`, instead of `0.2`.

The
[0.10.0 upgrade notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.10.0.md#upgrading-from-09)
list every change.

### Upgrading to 0.9.1

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
[0.9.1 upgrade notes](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.9.1.md#upgrading-from-08)
list every change.

## Next steps

- [Migrating Svelte translation imports](../migrations/translations-svelte.md)
  moves an existing app from the SDK's Svelte packages to the independent
  Translations packages.
- [Translations in ViewModels](../application/guides/model-context.md#translations-in-viewmodels)
  shows how a Runic ViewModel follows locale changes.
- The
  [RMF2 guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/rmf2.md)
  covers the full message syntax, markup, documents and mounted source folders.
- The
  [ESM backend guide](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/esm.md)
  describes the generated web modules in detail.
- [Right-to-left text](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/docs/guides/translations/bidi.md)
  explains placeholder isolation and text direction.
- [Release notes for 0.14.0](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.14.0.md)
  list what changed in this release, and those for
  [0.13.0](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.13.0.md)
  and
  [0.12.0](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.15.1/eng/release/notes/0.12.0.md)
  what changed before it.
