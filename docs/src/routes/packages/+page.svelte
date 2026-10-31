<script lang="ts">
  import { resolve } from '$app/paths';
  import { apiPackageSlug, hasApiReference } from '#lib/api-paths.js';
  import DocSection from '#lib/components/DocSection.svelte';
  import { packageGoals } from '#lib/package-goals.js';
  import {
    currentRelease,
    catalogRows as activeSdkCatalogRows,
    packageInstallCommand,
  } from '#lib/release-docs.js';

  const rowFor = (name: string) =>
    activeSdkCatalogRows.find((row) => row.name === name)!;
  const description =
    'Install published Runic SDK packages from NuGet and npm.';
</script>

<svelte:head>
  <title>Package catalog · Runic Artifex</title>
  <meta name="description" content={description} />
  <meta property="og:title" content="Package catalog · Runic Artifex" />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content="Package catalog · Runic Artifex" />
  <meta name="twitter:description" content={description} />
</svelte:head>
<div class="shell">
  <div class="page-head">
    <h1>Install the components you need.</h1>
    <p class="lede">
      These SDK packages are available in Runic SDK {currentRelease.version}.
      Keep SDK dependencies on the same preview version. Command Line and
      Translations are released independently.
    </p>
  </div>
  <div class="doc-sections">
    <DocSection title="What do you want to do?">
      <p>
        Each goal lists the smallest set of packages that reaches it. Run .NET
        package commands from your project directory and npm commands from your
        frontend directory. Runic Translations and Runic Command Line have their
        own <a
          href={resolve('/products/[slug]', { slug: 'runic-translations' })}
          >Translations</a
        >
        and
        <a href={resolve('/products/[slug]', { slug: 'runic-command-line' })}
          >Command Line</a
        > installation guides.
      </p>
    </DocSection>
    {#each packageGoals as goal (goal.id)}
      <DocSection title={goal.title} id={`goal-${goal.id}`}>
        <p>{goal.summary}</p>
        <ul class="package-rows">
          {#each goal.packages as entry (entry.name)}
            <li>
              <a href={rowFor(entry.name).registryUrl} rel="external"
                >{entry.name}</a
              >
              <span>{entry.note}</span>
              <pre class="code-block"><code
                  >{packageInstallCommand(rowFor(entry.name))}</code
                ></pre>
            </li>
          {/each}
        </ul>
        <p>
          {#if 'route' in goal.guide}
            <a href={resolve(goal.guide.route)}>{goal.guide.label}</a>
          {:else}
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- guide paths come from guideHref -->
            <a href={goal.guide.href}>{goal.guide.label}</a>
          {/if}
        </p>
      </DocSection>
    {/each}
    <DocSection title="All packages" id="all-packages">
      <p>
        No GitHub package feed or token is required. For local .NET tools,
        create a manifest with <code>dotnet new tool-manifest</code> if the project
        does not already have one.
      </p>
      <ul class="package-rows">
        {#each activeSdkCatalogRows as row (row.name)}
          <li>
            <h3><a href={row.registryUrl} rel="external">{row.name}</a></h3>
            <span>{row.product} on {row.registry}</span>
            {#if row.name === 'Runic.Platform.Administration.Windows'}
              <span>
                Supported on Windows x64 only. Its local, LDAP/AD, DNS and Group
                Policy scenarios are accepted on disposable fixtures under
                NativeAOT and JIT. See the
                <a href={currentRelease.url} rel="external">release notes</a>.
              </span>
            {/if}
            <pre class="code-block"><code>{packageInstallCommand(row)}</code
              ></pre>
            {#if hasApiReference(row.installKind, row.name)}
              <a
                class="package-rows__api"
                href={resolve('/api/[package]', {
                  package: apiPackageSlug(row.name),
                })}>API reference</a
              >
            {/if}
          </li>
        {/each}
      </ul>
    </DocSection>
  </div>
</div>

<style>
  .package-rows {
    margin: 1.25rem 0 0;
    padding: 0;
    list-style: none;
  }

  .package-rows li {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.4rem;
    margin: 0;
    padding-block: 1.1rem;
    border-top: var(--rule);
  }

  .package-rows li:last-child {
    border-bottom: var(--rule);
  }

  .package-rows li > :global(*) {
    margin: 0;
  }

  .package-rows h3,
  .package-rows li > a:first-child {
    justify-self: start;
    font-family: var(--rune-font-mono);
    font-size: 0.9375rem;
    font-weight: 500;
    letter-spacing: 0;
    overflow-wrap: anywhere;
  }

  .package-rows span {
    color: var(--rune-ink-soft);
    font-size: var(--text-ui);
  }

  .package-rows pre {
    margin: 0.25rem 0 0;
  }

  .package-rows__api {
    justify-self: start;
    font-size: var(--text-ui);
  }
</style>
