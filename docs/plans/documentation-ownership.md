# Documentation ownership migration

Status: implemented and independently reviewed; deployment cutover has not happened.

The shared documentation portal belongs to `Runic-Artifex/runic-site`. The
marketing app at the repository root and the portal in `docs/` have separate
lockfiles, checks, builds and deployment outputs. SDK package development must
not build or deploy the all-product portal.

## Ownership and source inputs

Move the portal application, assets, tests and portal guides from SDK revision
`0e3370eb` into this repository. Keep package READMEs and specifications with
their products. Runic Translations maintains its canonical consumer guides in
`runic-translations-sdk/docs/guides/translations`; link those guides directly.
The portal's product pages provide per-product entry points and navigation.

The creator preview consumes a small checked-in SDK template snapshot. Record
repository, full revision, original paths and a content digest; import only the
listed files. Translation schemas retain their existing full revision and digest
pin. Ordinary builds use checked-in inputs without network or sibling repos.
Published catalog snapshots retain independent and historical product status;
a development revision never implies a new published product release.

## Review branches

Site worktree: `.worktrees/runic-site-docs`, branch
`codex/documentation-portal-migration`, based on
`extraction-workspace-docs-site` (site PR #5).
SDK worktree: `.worktrees/runic-sdk-docs`, branch
`codex/documentation-portal-extraction`, based on
`extraction/sdk-integration` (SDK PR #48).
Prepare site first; verify a standalone portal build before removing SDK portal
inputs and build wiring. The root agent owns staging, commits, pushes and PRs.
No shared checkout is switched or staged by the migration agent.

## Deployment contract and cutover

Publish root `build/` to `runic-artifex.eu`; publish `docs/build/` to
`docs.runic-artifex.eu`. Preserve `www` -> apex redirects and existing docs
paths including legacy Application product routes. Apex
`/schemas/translations/*` continues to serve byte-identical canonical schemas.
The root build includes a generated mirror from the portal's pinned schemas.
The documentation deployment changes its repository and build directory, not
its hostname or public URL structure. CI produces independently deployable
artifacts; publication remains an explicit hosting action.

Review and merge the site migration, update the existing docs hosting build to
this repository's `docs/` directory, deploy the verified artifact, then merge
SDK removal. Package releases do not depend on deploying either website.
Retain the prior deployed artifact for rollback until the new portal is served.

## Verification

Run portal source checks, type checks, and focused static route/link/catalog/
schema tests in the existing locked SDK development environment. Run marketing
checks and schema mirror verification independently. Verify SDK engineering
workspace tests and lockfile after removing its portal workspace. Do not run a
full native, container or release matrix for this ownership change.

Implementation is complete in the isolated worktrees. Focused verification:

- Portal type check: zero errors or warnings; portal lint and high-severity
  dependency audit pass.
- Standalone portal static build passes without the marketing application's
  generated state; its sources contain no sibling SDK imports. Forty focused
  tests pass, including old routes, guide areas, historical/active catalogs,
  template snapshots and pinned schemas.
- Marketing type check and lint pass; static build and five route/schema tests
  pass. The high-severity dependency audit passes.
- SDK workspace, focused runner, CI and release contracts, release workflow and
  template-lock tests: 49 pass. SDK removal deletes portal build/workspace/CI
  integration and updates current guide references. Historical release notes
  retain their original tagged links.
- Actionlint validates both site workflows and the SDK workflow. Frozen
  lockfile validation passes for the portal and the trimmed SDK workspace.
- Both pinned input synchronization scripts succeed from the site repository
  root. The 16-file SDK snapshot and eight schemas retain matching digests.

Verification logs were retained outside source inputs in `/tmp` during review;
CI will produce the deployable artifacts. No native or release matrix was run,
and no deployment, registry publication, merge or push occurred during
implementation. The remaining hosting cutover is the explicit operator action
described above, after the site PR is reviewed and merged.
