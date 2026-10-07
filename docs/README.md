# Runic documentation portal

[docs.runic-artifex.eu](https://docs.runic-artifex.eu) is built from this directory
in `runic-site`. The portal serves all Runic products with separate product pages,
installation status, guides and release history. Start with the
[Application getting-started guide](guides/application/getting-started/README.md).

## Develop and verify

Install the versions pinned in `.node-version` and `package.json`. The portal has
its own lockfile and dependencies, independent of the marketing application:

```sh
cd docs
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
```

On NixOS in the shared workspace reuse the existing locked SDK toolchain with
`direnv exec <runic-sdk-checkout> bun run test` from this directory. The SDK is
only a convenient local toolchain provider; the build does not read sibling
source, need .NET, or access GitHub. CI independently builds `docs/build/` and
retains a `documentation-site` artifact. Deploy that output at the existing docs
origin, retaining all paths. Root `build/` is the separate marketing artifact.

## Product-owned inputs

Portal guides live in `guides/`. Product package READMEs, detailed specifications
and canonical Translations consumer guides stay with their owners. Each product
page links the relevant guides and source. The initial portal source and its
retained history are recorded in `sources/portal-origin.json`.

The Application creator imports only the template files and package inventory
listed in `sources/sdk-inputs.json`; these checked-in inputs have an immutable
SDK revision and SHA-256 digest. The same snapshot holds the example tests and
package READMEs that the guides quote. To refresh them, update the pin and
digest, then run from the repository root:

```sh
bun docs/scripts/sync-sdk-inputs.mjs <checkout-of-pinned-sdk-revision>
```

The script checks the checkout revision and source bytes before replacing the
snapshot. Review the manifest and imported files together. The snapshot is an
input to the portal, not a second editable template implementation.

Guide code blocks opt into verification with `docs-test=<kind>` in their info
string. `tests/guide-snippets.test.mjs` checks `commands` blocks against the
commands the creator, the catalog and the generated README produce, and
`template:<path>` or `source:<path>` blocks as excerpts of the snapshot. The
template and examples it quotes are built and run by the SDK's own CI, so a
refresh that changes quoted code fails here until the guide follows. Every
block in a quickstart guide must be tagged. The snapshot follows the SDK's
`main` branch; guides mark APIs that are not in the published release as
unreleased.

Runic Translations owns canonical schemas. Preserve the existing pin and content
digest in `sources/translations-schemas.json`. Synchronize a changed pin with:

```sh
bun docs/scripts/sync-translations-schemas.mjs <schema-source-directory> <pinned-revision>
```

The docs tests verify the checked-in schema digest and published bytes. The
marketing build deterministically mirrors those schemas into its generated
static assets, preserving `runic-artifex.eu/schemas/translations/*` without a
second manually maintained schema copy.

## Release catalogs

From the site repository root after publishing an SDK release:

```sh
bun run docs:release <published-version>
```

This reads the published tagged SDK package inventory using `gh` and updates
`src/lib/active-sdk-release.json`. Review that snapshot and any affected guides
before deployment. Refresh the pinned SDK input inventory for its matching
release revision as needed. Development version bumps never publish package
availability. `published-release.json` preserves the immutable unified
0.6.0-preview.1 history; Command Line and Translations have separate release
lifecycles and remain explicitly pending until their own preview is published.

See [the ownership and deployment plan](plans/documentation-ownership.md) for
review branches and the ordered hosting cutover. This change does not publish
or deploy either application.
