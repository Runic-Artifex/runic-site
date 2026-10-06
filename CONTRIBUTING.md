# Contributing

## Change flow

`main` accepts changes only through pull requests. The `safe-main` ruleset
requires a pull request and a passing `verify` check, and blocks force pushes
and branch deletion. No approving review is required.

1. Branch from `origin/main` and make the change.
2. Run the checks below locally.
3. Open a pull request and wait for `verify` to pass, then merge.

`verify` is the job in [ci.yml](.github/workflows/ci.yml). It lints the
workflows with actionlint, audits dependencies and lints, type-checks, builds
and tests the marketing site. [docs.yml](.github/workflows/docs.yml) verifies
the documentation portal. It runs only when `docs/`, a Markdown file or the
workflow changes, so it is not a required check; do not merge a pull request
while it is failing.

Organization administrators can bypass the ruleset. Use the bypass only for an
emergency, such as restoring a broken deployment, and open a follow-up pull
request that records the change.

## Checks

From the repository root:

```sh
bun install --frozen-lockfile
bun run lint
bun run check
bun run test
```

For the documentation portal, from `docs/`:

```sh
bun install --frozen-lockfile
bun run lint
bun run check
bun run test
```

The portal tests include a check that every relative link in a tracked Markdown
file resolves to a tracked file or directory.

Lint changed workflows with `actionlint .github/workflows/*.yml`. On NixOS in
the shared workspace, run these commands through the runic-sdk development
shell, for example `direnv exec ../runic-sdk bun run test`; it provides the same
actionlint version as CI.

Pin new workflow actions to a full commit SHA with a `# vX.Y.Z` comment.

Report vulnerabilities as described in [SECURITY.md](SECURITY.md).
