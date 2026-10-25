# Migrating Svelte translation imports

Runic Translations now owns its Svelte integrations independently of the SDK.
Use the published Translations `0.8.0` package family; its version does
not need to match Application SDK `0.11.0`. Existing applications can
keep their current SDK release while migrating localization. See the
[Translations SvelteKit quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.8.0/docs/guides/translations/quickstart-sveltekit.md).

| Current import                                     | Independent Translations import                    |
| -------------------------------------------------- | -------------------------------------------------- |
| `@runic-artifex/svelte`                            | `@runic-artifex/translations-svelte`               |
| `@runic-artifex/svelte/translations`               | `@runic-artifex/translations-svelte`               |
| `@runic-artifex/svelte/translations/testing`       | `@runic-artifex/translations-svelte/testing`       |
| `@runic-artifex/svelte/inline`                     | `@runic-artifex/translations-svelte/inline`        |
| `@runic-artifex/sveltekit/translations`            | `@runic-artifex/translations-sveltekit`            |
| `@runic-artifex/sveltekit/translations/navigation` | `@runic-artifex/translations-sveltekit/navigation` |

Since Translations `0.8.0` each package has one import path per export. An
application on Translations `0.7` moves
`@runic-artifex/translations-svelte/translations` and
`@runic-artifex/translations-sveltekit/translations` imports to the package
root, and their `/translations/testing` and `/translations/navigation`
subpaths to `/testing` and `/navigation`. The SvelteKit exports lose their
`Runic` prefix: `createRunicLocaleRouting`, `createRunicLocaleHandle` and
`createRunicLocaleReroute` become `createLocaleRouting`, `createLocaleHandle`
and `createLocaleReroute`, with the option types renamed the same way. The
Vite plugin requires Vite 8.3.3 or a later 8.x, and the Svelte package Svelte
5.57.1 or later.

The root `@runic-artifex/svelte` import becomes Views-only; since SDK `0.9.0`
it also replaces the removed `@runic-artifex/svelte/views` entry. The root
`@runic-artifex/sveltekit` import and its `/page-options` subpath also remain
SDK-owned. Do not mix the independent packages with an older SDK
Translations integration; upgrade the translation packages as one product
family and run the application's normal build and tests.
