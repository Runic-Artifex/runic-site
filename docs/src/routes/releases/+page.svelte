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
    <DocSection title="Security advisories">
      <p>
        Runic SDK 0.17.0 and CS-WebUI 2.5.0-beta.4.9 fix two local-process
        issues of applications on the CS-WebUI host: another process on the same
        computer that listened on the other loopback address of a window's port
        could receive or serve the window's traffic. Runic Desktop and WPF
        applications are not affected, and nothing is reachable from another
        computer. Applications need no code changes.
      </p>
      <ul>
        <li>
          <a
            href="https://github.com/Runic-Artifex/runic-sdk/security/advisories/GHSA-vhx5-crr3-7pv5"
            rel="external">GHSA-vhx5-crr3-7pv5</a
          >: <code>Runic.Application.Views.CsWebUi</code> 0.16.0-preview.1 and earlier,
          including the blob and upload endpoint on Linux and macOS. Fixed in 0.17.0-preview.1.
        </li>
        <li>
          <a
            href="https://github.com/Runic-Artifex/cs-webui/security/advisories/GHSA-9p7m-x6rx-97qh"
            rel="external">GHSA-9p7m-x6rx-97qh</a
          >: the page server that WebUI runs for every CS-WebUI window,
          <code>CsWebUi</code> 2.5.0-beta.4.8 and earlier. Fixed in
          <a
            href="https://github.com/Runic-Artifex/cs-webui/releases/tag/v2.5.0-beta.4.9"
            rel="external">CS-WebUI 2.5.0-beta.4.9</a
          >, which <code>Runic.Application.Views.CsWebUi</code> 0.17.0-preview.1 requires.
        </li>
      </ul>
      <p>
        Update every Runic package to 0.17.0 together. Applications that call
        <code>CsWebUi.Native</code>'s <code>Show</code>,
        <code>StartServer</code> or <code>GetUrl</code> themselves stay exposed
        until WebUI listens on both loopback addresses; use
        <code>CsWebUi</code>'s <code>WebUiWindow</code> instead. See the
        <a
          href="https://github.com/Runic-Artifex/runic-sdk/blob/v0.17.0/eng/release/notes/0.17.0.md#security-cs-webui-blob-endpoint"
          rel="external">0.17.0 release notes</a
        >.
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
