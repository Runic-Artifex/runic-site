![Runic Artifex banner](.github/assets/brand/banner.png)

# Runic Artifex Website

The project landing page for Runic Artifex: a family of independent,
open-source .NET tools joined through explicit integrations.

This repository owns the narrative website served at
`https://runic-artifex.eu`. Technical guides, exact package versions, install
commands, and release status remain authoritative at
`https://docs.runic-artifex.eu` in the separate `runic-docs` repository.

The site is built with SvelteKit and Svelte 5, fully prerendered with
`@sveltejs/adapter-static`, and styled with the canonical Runic Artifex family
identity from `runic-brand`.

## Develop locally

Use Node.js 24 and npm:

```bash
npm ci
npm run dev
```

## Verify

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm run check
npm test
```

## Deployment contract

- `runic-artifex.eu` serves the static `build/` output from this repository.
- `www.runic-artifex.eu` redirects permanently to the apex origin.
- `docs.runic-artifex.eu` remains owned by `runic-docs`.
- `/schemas/translations/*` on the apex remains routed to the canonical static
  schema assets published by `runic-docs`.

## Content boundary

This site owns the project story, principles, product-family overview, and
links into documentation. It intentionally does not duplicate volatile package
versions, installation instructions, or detailed release status.

## License

The website source is licensed under the MIT License.
