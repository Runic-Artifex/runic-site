<script lang="ts">
  import { resolve } from '$app/paths';
  import ContentCard from '#lib/components/ContentCard.svelte';
  import { packageGoals } from '#lib/package-goals.js';
  import {
    currentRelease,
    catalogRows as activeSdkCatalogRows,
    packageInstallCommand,
  } from '#lib/release-docs.js';

  const rowFor = (name: string) =>
    activeSdkCatalogRows.find((row) => row.name === name)!;
</script>

<svelte:head>
  <title>Package catalog · Runic Artifex</title>
  <meta
    name="description"
    content="Install published Runic SDK packages from NuGet and npm."
  />
  <meta property="og:title" content="Package catalog · Runic Artifex" />
  <meta
    property="og:description"
    content="Install published Runic SDK packages from NuGet and npm."
  />
  <meta name="twitter:title" content="Package catalog · Runic Artifex" />
  <meta
    name="twitter:description"
    content="Install published Runic SDK packages from NuGet and npm."
  />
</svelte:head>
<div>
  <section class="page-hero shell">
    <p class="eyebrow">Packages</p>
    <h1>Install the components you need.</h1>
    <p class="lede">
      These SDK packages are available in Runic SDK {currentRelease.version}.
      Keep SDK dependencies on the same preview version. Command Line and
      Translations will publish their next previews independently.
    </p>
  </section>
  <section class="content-grid shell">
    <ContentCard eyebrow="Choose by goal" title="What do you want to do?" full>
      <p>
        Each goal lists the smallest set of packages that reaches it. Run .NET
        package commands from your project directory and npm commands from your
        frontend directory. Runic Translations and Runic Command Line have their
        own <a
          class="text-link"
          href={resolve('/products/[slug]', { slug: 'runic-translations' })}
          >Translations</a
        >
        and
        <a
          class="text-link"
          href={resolve('/products/[slug]', { slug: 'runic-command-line' })}
          >Command Line</a
        > installation guides.
      </p>
    </ContentCard>
    {#each packageGoals as goal (goal.id)}
      <ContentCard eyebrow="Goal" title={goal.title}>
        <p>{goal.summary}</p>
        <ul class="goal-packages">
          {#each goal.packages as entry (entry.name)}
            <li>
              <a href={rowFor(entry.name).registryUrl} rel="external"
                >{entry.name}</a
              >
              <span>{entry.note}</span>
              <pre><code>{packageInstallCommand(rowFor(entry.name))}</code
                ></pre>
            </li>
          {/each}
        </ul>
        <p>
          {#if 'route' in goal.guide}
            <a class="text-link" href={resolve(goal.guide.route)}
              >{goal.guide.label}</a
            >
          {:else}
            <a class="text-link" href={goal.guide.href}>{goal.guide.label}</a>
          {/if}
        </p>
      </ContentCard>
    {/each}
    <ContentCard eyebrow="Public registries" title="All packages" full>
      <p>
        No GitHub package feed or token is required. For local .NET tools,
        create a manifest with <code>dotnet new tool-manifest</code> if the project
        does not already have one.
      </p>
      <div class="package-list">
        {#each activeSdkCatalogRows as row (row.name)}
          <section>
            <h2><a href={row.registryUrl} rel="external">{row.name}</a></h2>
            <p>{row.product} · {row.registry}</p>
            {#if row.name === 'Runic.Platform.Administration.Windows'}
              <p>
                Experimental Windows administration APIs. Administrative writes
                and domain services still need native validation. See the
                <a href={currentRelease.url} rel="external">release notes</a> for
                tested scenarios.
              </p>
            {/if}
            <pre><code>{packageInstallCommand(row)}</code></pre>
          </section>
        {/each}
      </div>
    </ContentCard>
  </section>
</div>

<style>
  .goal-packages {
    display: grid;
    gap: 12px;
    padding: 0;
    list-style: none;
  }

  .goal-packages li {
    display: grid;
    gap: 4px;
  }

  .goal-packages pre {
    margin: 0;
    overflow-x: auto;
  }
</style>
