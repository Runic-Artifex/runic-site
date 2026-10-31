<script lang="ts">
  import { resolve } from '$app/paths';
  import DocSection from '#lib/components/DocSection.svelte';
  import Notice from '#lib/components/Notice.svelte';

  const description =
    'What Runic 1.0 promises: SemVer rules, breaking changes, how the three SDKs version, supported platforms, package tiers, deprecation and fixes.';
  const guides = [
    {
      name: 'Runic SDK',
      href: 'https://github.com/Runic-Artifex/runic-sdk/blob/main/eng/release/README.md#versioning-and-support-from-10',
    },
    {
      name: 'Runic Command Line',
      href: 'https://github.com/Runic-Artifex/runic-cli-sdk/blob/main/eng/release/README.md#versioning-and-support-from-10',
    },
    {
      name: 'Runic Translations',
      href: 'https://github.com/Runic-Artifex/runic-translations-sdk/blob/main/eng/release/README.md#versioning-and-support-from-10',
    },
  ];
  const planned = [
    ['linux-x64', 'Supported', 'Supported', 'n/a'],
    ['win-x64', 'Supported', 'Supported', 'Supported'],
    ['osx-arm64', 'Supported', 'Supported', 'n/a'],
    ['linux-arm64', 'Supported', 'Supported', 'n/a'],
    ['win-arm64', 'Supported', 'Unsupported', 'Supported'],
    ['linux-musl-x64', 'Supported', 'Unsupported', 'n/a'],
    ['linux-musl-arm64', 'Supported', 'Unsupported', 'n/a'],
    ['osx-x64', 'Unsupported', 'Unsupported', 'n/a'],
  ];
</script>

<svelte:head>
  <title>Versioning and support policy · Runic Artifex</title>
  <meta name="description" content={description} />
  <meta
    property="og:title"
    content="Versioning and support policy · Runic Artifex"
  />
  <meta property="og:description" content={description} />
  <meta
    name="twitter:title"
    content="Versioning and support policy · Runic Artifex"
  />
  <meta name="twitter:description" content={description} />
</svelte:head>
<div class="shell">
  <div class="page-head">
    <h1>Versioning and support policy</h1>
    <p class="lede">
      What Runic promises from 1.0 for Runic SDK, Runic Command Line and Runic
      Translations.
    </p>
  </div>
  <div class="doc-sections doc-sections--wide">
    <Notice title="Applies from 1.0">
      <p>
        This policy takes effect with 1.0.0. Until then every release is a
        preview with a plain <code>0.y.z</code> version: a new minor (<code
          >0.9.0</code
        >
        to <code>0.10.0</code>) may change or remove APIs, a patch (<code
          >0.9.1</code
        >) only fixes or adds, and only the latest minor gets fixes. Releases
        from 0.9.0 on carry no <code>-preview.N</code>
        suffix; GitHub still marks them as prereleases. 0.15.0 is the current minor
        release. Views protocol 4, introduced in 0.13.0, is the protocol that 1.0
        keeps, and later releases add only features negotiated in its
        <code>hello</code>. The release candidates <code>1.0.0-rc.N</code> start
        when Runic is ready and take only fixes, stabilization and
        documentation.
        <code>Runic.Application.Views.CsWebUi</code> keeps a prerelease version of
        its own while the CS-WebUI release it depends on is a prerelease.
      </p>
    </Notice>
    <DocSection title="Version numbers" id="versions">
      <ul>
        <li>
          Each SDK follows <a href="https://semver.org/" rel="external"
            >Semantic Versioning 2.0</a
          >. A major release may break; a minor release adds features, packages,
          platforms and deprecations; a patch release only fixes.
        </li>
        <li>All packages of one SDK share its version.</li>
        <li>
          From 1.0, previews of the next version (<code>x.y.0-preview.N</code>
          or
          <code>x.y.0-rc.N</code>) remain possible. They go to the npm
          <code>preview</code> dist-tag, and <code>latest</code> moves only to
          stable versions; until 1.0 it moves to every <code>0.y.z</code>
          release, and from <code>1.0.0-rc.1</code> it stays on the last
          <code>0.y.z</code> release until 1.0.0 is published.
        </li>
        <li>
          Experimental APIs and the preview package are outside these rules.
        </li>
      </ul>
    </DocSection>
    <DocSection title="What counts as breaking" id="breaking">
      <p>
        A change is breaking when a project that built and ran against a release
        fails to build, fails to run or behaves differently against a later
        minor or patch of the same major without changes by its author. That
        covers:
      </p>
      <ul>
        <li>
          The C# API in each library's <code>PublicAPI.Shipped.txt</code>:
          removed or renamed members, changed signatures, nullability or
          defaults, new abstract or interface members without a default, sealed
          types, changed documented behaviour or failure results.
        </li>
        <li>New trim or AOT warnings in an AOT-compatible library.</li>
        <li>
          Diagnostic IDs reused for another meaning, or warnings turned into
          errors.
        </li>
        <li>
          Documented MSBuild properties, items and targets, and defaults that
          change a passing build. Renamed properties keep working with a
          warning.
        </li>
        <li>
          Command-line commands, options, exit codes and versioned JSON
          contracts such as <code>runic.create/2</code> or
          <code>runic.application.tool.doctor/1</code>. A changed contract gets
          a new identifier and the old one stays until the next major.
          Human-readable output is not a contract.
        </li>
        <li>
          The Bridge protocol between .NET and npm packages of the same release,
          and the Translations transport: a 1.x reader reads every message a 1.x
          writer produced.
        </li>
        <li>
          npm exports, TypeScript types and peer ranges; widening a range is not
          breaking.
        </li>
        <li>
          Dropping a supported RID, host or OS version before .NET drops it, and
          dependency updates that change third-party types in the public API
          (ReactiveUI, Spectre.Console, CS-WebUI).
        </li>
      </ul>
    </DocSection>
    <DocSection title="Enforcement" id="enforcement">
      <p>
        Every shipping library tracks its API with the public API analyzers and
        runs package validation against the latest stable release of its major
        line. Compatibility suppressions are allowed only in a major release,
        for experimental members, or for a security fix that the release notes
        explain. A stable package never depends on a prerelease package.
      </p>
    </DocSection>
    <DocSection title="How the three SDKs version" id="sdks">
      <p>
        1.0.0 ships as one release train in dependency order: Command Line, then
        Translations, then Runic SDK. After 1.0 each SDK releases minors and
        patches independently, references the others by NuGet minimum version,
        and names in its release notes the versions it was tested with.
      </p>
    </DocSection>
    <DocSection title="Supported platforms" id="platforms">
      <p>
        A host and RID pair is supported only when Runic CI builds and runs that
        host's native layer on it. Packaged but unverified RIDs are best effort.
        The <a href={resolve('/support')}>supported platforms</a> page shows the
        current status and minimum operating systems. CI covers
        <code>linux-arm64</code>
        and
        <code>win-arm64</code> on hosted Arm runners and the musl RIDs in an Alpine
        container. The 1.0 status:
      </p>
      <!-- The scrollable table region must be reachable by keyboard. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="1.0 support by host and runtime identifier"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">RID</th>
              <th scope="col">Runic Desktop</th>
              <th scope="col">CS-WebUI (preview)</th>
              <th scope="col">WPF</th>
            </tr>
          </thead>
          <tbody>
            {#each planned as [rid, ...cells] (rid)}
              <tr>
                <th scope="row"><code>{rid}</code></th>
                {#each cells as cell, index (index)}
                  <td>{cell}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p>
        Intel Macs (<code>osx-x64</code>) are not a Runic target since 0.12.0:
        CI runs only the latest macOS on Apple silicon, and
        <code>dotnet runic package macos</code> builds no universal bundle.
        <code>Runic.Platform.Administration.Windows</code> supports Windows x64
        only, by policy; no arm64 or x86 support is planned. On Windows on Arm,
        publish it for <code>win-x64</code>. Managed packages and Command Line
        apps run wherever .NET 10 does; Command Line NativeAOT apps are
        supported on the RIDs its CI publishes. On musl, Runic Desktop needs an
        Alpine release that .NET 10 supports, with GTK 3 and WebKitGTK 4.1.
      </p>
    </DocSection>
    <DocSection title=".NET versions" id="dotnet">
      <p>
        Every package targets <code>net10.0</code> (WPF packages
        <code>net10.0-windows</code>); .NET 10 is supported by Microsoft until
        November 2028. Later .NET versions use the <code>net10.0</code> assets.
        Adding a target framework is a minor release; dropping a .NET version
        needs a major release, and <code>net10.0</code> is not dropped before .NET
        10 leaves support.
      </p>
    </DocSection>
    <DocSection title="Package tiers" id="tiers">
      <ul>
        <li><strong>Stable:</strong> every shipped package from 1.0.0.</li>
        <li>
          <strong>Experimental APIs in stable packages:</strong> marked
          <code>[Experimental]</code> with one diagnostic ID per API family. Use
          is a compile error until the project suppresses the ID, and the API
          may change in a minor release. The IDs are listed on the
          <a
            href="https://github.com/Runic-Artifex/runic-sdk/blob/main/docs/experimental.md"
            rel="external">experimental APIs</a
          >
          page. An npm package exports experimental APIs only from its
          <code>./experimental</code> subpath. No .NET or npm API is
          experimental since 0.10.0, which removed every
          <code>./experimental</code> entry; 0.11.0 to 0.15.0 add none.
        </li>
        <li>
          <strong>Preview:</strong>
          <code>Runic.Application.Views.CsWebUi</code> is the only preview
          package. It depends on the prerelease <code>CsWebUi</code>, so it
          ships with each release on a prerelease version of its own and may
          change in any release.
        </li>
      </ul>
    </DocSection>
    <DocSection title="Deprecation and fixes" id="deprecation">
      <ul>
        <li>
          Deprecated APIs get <code>[Obsolete]</code> with a diagnostic ID and the
          replacement, stay for at least one minor release, and are removed only in
          a major release. Each deprecation has a release-notes entry.
        </li>
        <li>
          Bug and security fixes ship in a patch of the latest minor only. A
          preview gets no fixes once the next preview or stable release ships.
        </li>
      </ul>
    </DocSection>
    <DocSection title="Release guides" id="guides">
      <p>Each SDK's release guide holds the full policy and its own rules:</p>
      <ul>
        {#each guides as guide (guide.name)}
          <li><a href={guide.href} rel="external">{guide.name}</a></li>
        {/each}
      </ul>
    </DocSection>
  </div>
</div>
