# Product and architecture guides

These guides are published on the [documentation site](https://docs.runic-artifex.eu/guides/)
under the same paths; for example, `application/tutorial/README.md` is
`/guides/application/tutorial/`. The [SDK contributor guide](https://github.com/Runic-Artifex/runic-sdk/blob/main/CONTRIBUTING.md)
describes workspace commands.

## Start here

Pick the page for what you are building. Each one explains the concepts it
needs and leads on from there:

- **A desktop app with a web frontend:** [getting started](application/getting-started/README.md).
- **An existing WPF app:** [adopt Runic incrementally in WPF](application/migrations/wpf-incremental.md).
- **A command-line tool:** [get started with Runic Command Line](command-line/README.md).
- **Translations for .NET or the web:** [get started with Runic Translations](translations/README.md).

## All guides

- [Getting started](application/getting-started/README.md), [choosing a host and MVVM library](application/choosing.md), [Windows and Views, step by step](application/tutorial/README.md) and [adding Runic to an existing app](application/existing-app.md).
- [Pages and navigation](application/guides/pages-and-navigation.md), [ViewModel state and threads](application/guides/model-context.md) and the [glossary](application/glossary.md).
- Samples: [open and save files](application/samples/files.md), [app settings and desktop preferences](application/samples/settings.md), [ask the user from a ViewModel](application/samples/prompts.md) and [update every Window from a shared service](application/samples/cross-window.md).
- [Published-package desktop consumer](application/package-consumer.md) and
  [operations and cancellation](application/guides/operations-and-cancellation.md).
- [Incremental WPF migration](application/migrations/wpf-incremental.md): independent Translations and Command Line, native navigation, then optional web Views [hosted in WPF](application/migrations/wpf-hybrid.md).
- [Runic Application Views](application/README.md) and [application architecture](application/architecture/README.md).
- [First Window](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/first-window/README.md), [CommunityToolkit Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/notes-view-first/README.md), and [Reactive Notes](https://github.com/Runic-Artifex/runic-sdk/blob/v0.7.0-preview.6/examples/notes-reactive-views/README.md).
- [Desktop native services](desktop-services.md), [host selection](desktop/host-selection.md), and [window close lifecycle](desktop/window-close-lifecycle.md).
- [Runic Command Line](command-line/README.md).
- [Runic Translations](translations/README.md), the [Translations repository's guides](https://github.com/Runic-Artifex/runic-translations-sdk/tree/main/docs/guides/translations) and [migrating Svelte translation imports](migrations/translations-svelte.md).
- [Embed and serve assets](assets/README.md) with Runic Assets.

## Contributing

Guides for working on the SDK itself are kept out of the product navigation:
the [Application contributor guide](application/contributing/README.md),
[NixOS development](desktop/nixos-development.md),
[container automation](desktop/container-automation.md) and the
[portal implementation audit](portal-implementation-audit.md).

Code blocks tagged `docs-test` are checked against the pinned SDK snapshot by
[`tests/guide-snippets.test.mjs`](../tests/guide-snippets.test.mjs); every block
in a quickstart guide must be tagged. Shared build commands and ownership come
from the root contributor guide.
Translations owns its versioned schemas and protocol inputs in its repository.
