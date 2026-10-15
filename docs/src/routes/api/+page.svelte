<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const description =
    'Types and members of the published Runic .NET and npm packages, generated from the released packages.';
  let groups = $derived([
    {
      title: '.NET packages',
      packages: data.packages.filter((pkg) => pkg.ecosystem === 'nuget'),
    },
    {
      title: 'npm packages',
      packages: data.packages.filter((pkg) => pkg.ecosystem === 'npm'),
    },
  ]);
</script>

<svelte:head>
  <title>API reference · Runic Artifex</title>
  <meta name="description" content={description} />
  <meta property="og:title" content="API reference · Runic Artifex" />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content="API reference · Runic Artifex" />
  <meta name="twitter:description" content={description} />
</svelte:head>

<div class="shell">
  <div class="page-head">
    <h1>API reference</h1>
    <p class="lede">
      Public types and members of every library package in Runic SDK {data.release},
      read from the packages published on NuGet and npm.
    </p>
    <p class="api-index-note">
      The reference documents the published {data.release} only. APIs added on the
      SDK's <code>main</code> branch since then appear here once a release publishes
      them; until then, guides marked unreleased describe them.
    </p>
  </div>
  {#each groups as group (group.title)}
    <section class="api-index">
      <h2>{group.title}</h2>
      <ul class="api-package-list">
        {#each group.packages as pkg (pkg.id)}
          <li>
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- package paths come from the prerendered reference -->
            <a href={pkg.href}><code>{pkg.id}</code></a>
            <span
              >{pkg.types} type{pkg.types === 1 ? '' : 's'}{pkg.framework
                ? `, ${pkg.framework}`
                : ''}</span
            >
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .api-index-note {
    max-width: 44rem;
    color: var(--rune-ink-soft);
  }

  .api-index-note code {
    color: var(--rune-ink);
  }

  .api-index {
    display: grid;
    grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
    gap: 1.25rem clamp(2rem, 5vw, 5rem);
    padding-block: 2.25rem;
    border-top: var(--rule);
  }

  .api-index h2 {
    font-size: 1.5rem;
  }

  .api-package-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
    gap: 0 2.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .api-package-list li {
    display: grid;
    gap: 0.15rem;
    padding-block: 0.7rem;
    border-bottom: var(--rule);
  }

  .api-package-list a {
    justify-self: start;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .api-package-list span {
    color: var(--rune-ink-soft);
    font-size: var(--text-small);
  }

  @media (max-width: 52rem) {
    .api-index {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
