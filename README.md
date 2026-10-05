![Runic Artifex banner](.github/assets/brand/banner.png)

# Runic Artifex Website

The static marketing site for the Runic SDK products, served at
`https://runic-artifex.eu`.
Built with SvelteKit, Svelte 5, and `@sveltejs/adapter-static`.

## Develop and verify

Use Node from `.node-version` and Bun from `package.json`:

```sh
bun install --frozen-lockfile
bun run dev
bun run lint
bun run check
bun run test
```

`bun run test` builds the site and checks the rendered routes and links. After dependencies are installed, builds need no network access or sibling repository. On NixOS in the shared workspace, reuse the locked application SDK environment with `direnv exec ../runic-sdk bun run test`.

## Maintain content

Keep the homepage focused on capabilities, templates, and examples. Update product links in `src/lib/products.ts`; preserve existing guide URLs where they serve as stable routes. Installation details, package availability, and technical guides are maintained with their owning SDK product and published at [docs.runic-artifex.eu](https://docs.runic-artifex.eu/). The marketing site has no generated release or CI state to synchronize.

## Deployment contract

- `runic-artifex.eu` serves the static `build/` output from this repository.
- `www.runic-artifex.eu` redirects permanently to the apex origin.
- `docs.runic-artifex.eu` serves the unified documentation from the Runic SDK product repositories.
- `/schemas/translations/*` on the apex remains routed to the documentation portal's canonical static schema copy for Runic Translations. Preserve these public schema URLs when changing deployments.
- `/ci/` remains a lightweight link to SDK Actions for existing bookmarks.

## License

MIT.
