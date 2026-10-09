# Migrating Svelte translation imports

Runic Translations now owns its Svelte integrations independently of the SDK.
Use the published Translations `0.6.0-preview.5` package family; its version does
not need to match Application SDK `0.7.0-preview.6`. Existing applications can
keep their current SDK release while migrating localization. See the
[Translations SvelteKit quick start](https://github.com/Runic-Artifex/runic-translations-sdk/blob/v0.6.0-preview.5/docs/guides/translations/quickstart-sveltekit.md).

| Current import                                     | Independent Translations import                                 |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `@runic-artifex/svelte`                            | `@runic-artifex/translations-svelte`                            |
| `@runic-artifex/svelte/translations`               | `@runic-artifex/translations-svelte/translations`               |
| `@runic-artifex/svelte/translations/testing`       | `@runic-artifex/translations-svelte/translations/testing`       |
| `@runic-artifex/svelte/inline`                     | `@runic-artifex/translations-svelte/inline`                     |
| `@runic-artifex/sveltekit/translations`            | `@runic-artifex/translations-sveltekit/translations`            |
| `@runic-artifex/sveltekit/translations/navigation` | `@runic-artifex/translations-sveltekit/translations/navigation` |

`@runic-artifex/svelte/views` remains an SDK import. The root
`@runic-artifex/svelte` import becomes Views-only. The root
`@runic-artifex/sveltekit` import and its `/page-options` subpath also remain
SDK-owned. Do not mix the independent preview packages with an older SDK
Translations integration; upgrade the translation packages as one product
family and run the application's normal build and tests.
