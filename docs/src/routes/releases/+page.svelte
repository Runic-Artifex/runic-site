<script lang="ts">
  import { resolve } from '$app/paths';
  import DocSection from '#lib/components/DocSection.svelte';
  import {
    currentRelease,
    historicalRelease,
    releaseSummary,
  } from '#lib/release-docs.js';
</script>

<svelte:head>
  <title>Releases · Runic Artifex</title>
  <meta
    name="description"
    content="Published Runic SDK versions, release notes and upgrade guidance."
  />
  <meta property="og:title" content="Releases · Runic Artifex" />
  <meta
    property="og:description"
    content="Published Runic SDK versions, release notes and upgrade guidance."
  />
  <meta name="twitter:title" content="Releases · Runic Artifex" />
  <meta
    name="twitter:description"
    content="Published Runic SDK versions, release notes and upgrade guidance."
  />
</svelte:head>
<div class="shell">
  <div class="page-head">
    <h1>Install a published SDK release.</h1>
    <p class="lede">{releaseSummary}</p>
  </div>
  <div class="doc-sections">
    <DocSection title={`Runic SDK ${currentRelease.version}`}>
      <p>
        SDK libraries, tools and templates are published together from the
        runic-sdk repository. Copy exact installation commands from the <a
          href={resolve('/packages')}>package catalog</a
        >, or
        <a href={resolve('/getting-started')}>create your first app</a>.
      </p>
      <p>
        <a href={currentRelease.url} rel="external">Read the release notes</a>
        for changes, migration steps and known issues.
        <a href="https://github.com/Runic-Artifex/runic-sdk/releases"
          >All releases</a
        > remain available on GitHub.
      </p>
    </DocSection>
    <DocSection title="Update the components you use">
      <p>
        Keep SDK packages on the same preview version, restore dependencies and
        rebuild to regenerate bridge code. Check the behavior your application
        relies on. Preview APIs can change; release notes describe any required
        migration.
      </p>
    </DocSection>
    <DocSection title="Separate availability">
      <p>
        Command Line and Translations, including Translations Editor, are moving
        to their own repositories and release lifecycles. Their first
        independent previews are not published yet. The <a
          href={historicalRelease.url}
          rel="external">{historicalRelease.version} unified catalog</a
        >
        remains release history.
        <a href="https://github.com/Runic-Artifex/cs-webui/releases"
          >CS-WebUI releases</a
        > are maintained separately.
      </p>
    </DocSection>
  </div>
</div>
