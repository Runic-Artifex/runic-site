# Product and architecture guides

These guides are published on the [documentation site](https://docs.runic-artifex.eu/guides/)
under the same paths; for example, `application/tutorial/README.md` is
`/guides/application/tutorial/`. The [SDK contributor guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/CONTRIBUTING.md)
describes workspace commands.

- [Getting started](application/getting-started/README.md), [Windows and Views, step by step](application/tutorial/README.md) and [adding Runic to an existing app](application/existing-app.md).
- [Runic Application Views](application/README.md) and [application architecture](application/architecture/README.md).
- [First Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/examples/first-window/README.md), [CommunityToolkit Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/examples/notes-view-first/README.md), and [Reactive Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.3/examples/notes-reactive-views/README.md).
- [Desktop native services](desktop-services.md), [host selection](desktop/host-selection.md), and [window close lifecycle](desktop/window-close-lifecycle.md).
- [Runic Translations guides](https://github.com/Runic-Artifex/runic-translations-sdk/tree/main/docs/guides/translations).
- [Migrating Svelte translation imports](migrations/translations-svelte.md).
- [Embed and serve assets](assets/README.md) with Runic Assets.

Code blocks tagged `docs-test` are checked against the pinned SDK snapshot by
[`tests/guide-snippets.test.mjs`](../tests/guide-snippets.test.mjs); every block
in a quickstart guide must be tagged. Shared build commands and ownership come
from the root contributor guide.
Translations owns its versioned schemas and protocol inputs in its repository.
