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

## Guide pages and search

The build renders every Markdown file in `guides/` as a page under `/guides/`:
`guides/a/README.md` becomes `/guides/a/` and `guides/a/b.md` becomes
`/guides/a/b/`. Heading anchors match GitHub's, so `#section` links keep
working. Links between guides become site links; relative links to other files
in this directory point to their GitHub source. Links may only be relative,
fragments, `https:` or `mailto:`; another scheme, or a link to a missing guide
or file, fails the build. Guides are Markdown only; raw HTML is shown as text.

Add each new guide to `src/lib/guide-navigation.ts`, which orders the guide
sidebar; the build fails while a guide is missing from it. Runic Translations
consumer guides stay in their repository and appear in the sidebar as links.

The build also writes `search-index.json` with the text of each guide section
and product summary. The `/search/` page loads it and ranks results in the
browser; there is no search service. `tests/link-check.test.mjs` resolves every
internal `href`, `src`, `srcset` and social image in `build/`, and every
fragment against the target page's `id` attributes. It checks the syntax of
external links without fetching them.

Guide sources keep their GitHub paths, so existing GitHub links still open the
Markdown. GitHub cannot redirect a file to another site, and the static host has
no server-side redirect rules in this repository. Once the portal with guides is
deployed, update links in other repositories to the site paths above;
`siteHrefForGitHubGuide` in `src/lib/guide-paths.ts` performs that mapping.

The Application creator imports only the template files and package inventory
listed in `sources/sdk-inputs.json`; these checked-in inputs have an immutable
SDK revision and SHA-256 digest. The same snapshot holds the example tests and
package READMEs that the guides quote. To refresh them, update the pin and
digest, then run from the repository root:

```sh
bun docs/scripts/sync-sdk-inputs.mjs <checkout-of-pinned-sdk-revision>
```

The script checks the checkout revision and source bytes before replacing the
snapshot. Guides link SDK sources (`examples/`, `packages/`, `tools/`, `tests/`,
`specs/`) and the current release notes at the active release tag, such as
`blob/v0.7.0-preview.2/`, so the links match the quoted snapshot; move them to
the new tag with the catalog. Review the manifest and imported files together. The snapshot is an
input to the portal, not a second editable template implementation.

Every fenced code block in `guides/` names its check with `docs-test=<kind>`
in its info string; `tests/guide-snippets.test.mjs` enforces this and rejects
indented code blocks and misspelled attributes. `commands` blocks must match
the commands the creator, the catalog and the generated README produce.
`template:<path>` and `source:<path>` blocks are excerpts of the template or
of examples and tests, which the SDK's CI builds and runs, so these snippets
are compiled code. `readme:<path>` blocks are excerpts of SDK package READMEs;
they only track the README text, which SDK CI does not compile. In each case a
snapshot refresh that changes the quoted text fails here until the guide
follows. `skip:<reason>` marks blocks that are not checked, such as SDK
repository workflows; quickstart guides may not skip. The snapshot follows the SDK's
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
0.6.0-preview.1 history. Command Line and Translations have separate release
lifecycles: after one of their releases, update `version` and `releaseNotes`
of the product in `src/lib/docs-data.ts`.

## API reference

`/api/` documents the public API of every NuGet and npm library package in
`src/lib/active-sdk-release.json`; templates and tools have no library API.
The build reads only the checked-in models in `sources/api/` and their pins in
`sources/api-inputs.json` (package, version, download URL, registry SHA-512
and a content digest). After updating the active release, refresh them from
the site repository root with network access and the .NET SDK:

```sh
bun docs/scripts/sync-api-inputs.mjs
```

For NuGet the script verifies each published `.nupkg` against the SHA-512 in
the nuget.org catalog, then runs `tools/ApiExtractor`. It reads the highest
`netX.Y` target under `lib/` (else `netstandard`) with
`System.Reflection.Metadata`, without loading package code, and joins the XML
documentation. Signatures keep publicly visible types only and show nullable
reference annotations (including inside function pointers), generic
constraints, `params`, `required`, enum defaults, `ref` and `ref readonly`
returns and parameters, and tuple element names. Nested generic types keep
their arguments with each type, in references (`Outer<string>.Inner<int>`) and
declarations (`Outer<T>.Inner<U>`), and tuples of more than seven
elements are shown flat. For npm it verifies each tarball against `dist.integrity` and reads
the exported declarations of every typed entry point with the TypeScript
compiler API. A final pass resolves `<inheritdoc/>` from base types,
interfaces or its `cref` across packages and links documentation inherited
from .NET to Microsoft Learn. Review the diff with the release.

After changing the extractor, run its golden test, which packs
`tools/ApiExtractor.Fixture` and compares the extracted model with
`tools/ApiExtractor.Fixture/expected.json` (`--update` rewrites it):

```sh
direnv exec <runic-sdk-checkout> bun docs/scripts/test-api-extractor.mjs
```

Site CI has no .NET, so this test runs by hand. Search has one entry per type.
`tests/api-reference.test.mjs` checks the pins, digest and size budgets: at
most 1.5 MB of inputs, 160 KB of HTML per page, and 3 MB for all reference
pages and their `__data.json` payloads gzipped. The link check covers every
reference page.

See [the ownership and deployment plan](plans/documentation-ownership.md) for
review branches and the ordered hosting cutover. This change does not publish
or deploy either application.
