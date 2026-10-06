# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/Runic-Artifex/runic-site/security/advisories/new)
(**Security** > **Report a vulnerability**). Do not open a public issue, pull
request or discussion for an unfixed vulnerability.

Include the affected page or URL, the browser and operating system, reproduction
steps, and the impact you observed. We acknowledge reports as soon as we can,
keep you informed while we investigate, and credit you in the advisory unless
you prefer otherwise.

## Supported versions

Only the currently deployed sites are supported: the marketing site at
`runic-artifex.eu` and the documentation portal at `docs.runic-artifex.eu`,
both built from `main`.

## Scope

This repository covers the two static sites, their build scripts and the
published Translations schema mirror under `runic-artifex.eu/schemas/`. Report
vulnerabilities in the Runic packages and tools to their own repositories:
[runic-sdk](https://github.com/Runic-Artifex/runic-sdk/security),
[runic-cli-sdk](https://github.com/Runic-Artifex/runic-cli-sdk/security) and
[runic-translations-sdk](https://github.com/Runic-Artifex/runic-translations-sdk/security).
The schemas themselves are owned by runic-translations-sdk.

Both CI workflows run `bun audit --audit-level=high` on every pull request and
push to `main`. Workflow actions are pinned to full commit SHAs.
