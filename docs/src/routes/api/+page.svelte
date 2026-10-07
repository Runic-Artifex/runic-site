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

<div>
  <section class="page-hero shell">
    <p class="eyebrow">API reference</p>
    <h1>API reference</h1>
    <p class="lede">
      Public types and members of every library package in Runic SDK {data.release},
      read from the packages published on NuGet and npm.
    </p>
    <p class="lede">
      The reference documents the published {data.release}. Types new in 0.7,
      such as <code>DesktopContent</code>, the React and Vue
      <code>ViewOutlet</code>, <code>views/generated</code> and the typed testing
      host, appear here after that release.
    </p>
  </section>
  <section class="api-index shell">
    {#each groups as group (group.title)}
      <h2>{group.title}</h2>
      <ul class="api-package-list">
        {#each group.packages as pkg (pkg.id)}
          <li>
            <a href={pkg.href}><code>{pkg.id}</code></a>
            <span
              >{pkg.types} type{pkg.types === 1 ? '' : 's'}{pkg.framework
                ? ` · ${pkg.framework}`
                : ''}</span
            >
          </li>
        {/each}
      </ul>
    {/each}
  </section>
</div>
