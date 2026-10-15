<script lang="ts">
  import { resolve } from '$app/paths';
  import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let pkg = $derived(data.page);
  let title = $derived(`${pkg.id} ${pkg.version} API · Runic Artifex`);
  let description = $derived(
    `Public API of the ${pkg.id} ${pkg.ecosystem === 'nuget' ? 'NuGet' : 'npm'} package, version ${pkg.version}.`,
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>

<div class="shell">
  <div class="page-head api-head">
    <Breadcrumbs items={[{ label: 'API reference', href: resolve('/api') }]} />
    <h1><code>{pkg.id}</code></h1>
    <p class="lede">
      Version {pkg.version}{pkg.framework
        ? `, target framework ${pkg.framework}`
        : ''}.
      {#if pkg.frameworks.length > 1}
        The package also targets {pkg.frameworks
          .filter((framework) => framework !== pkg.framework)
          .join(', ')}.
      {/if}
      Read from the <a href={pkg.url}>published package</a>.
    </p>
  </div>
  <div class="api-layout">
    <nav class="api-toc" aria-label="Namespaces">
      <p class="guide-toc-title">
        {pkg.ecosystem === 'nuget' ? 'Namespaces' : 'Modules'}
      </p>
      <ul>
        {#each pkg.groups as group (group.id)}
          <li><a href={`#${group.id}`}>{group.title}</a></li>
        {/each}
      </ul>
    </nav>
    <article class="api-content">
      {#each pkg.groups as group (group.id)}
        <section aria-labelledby={group.id}>
          <h2 id={group.id}><code>{group.title}</code></h2>
          <dl class="api-type-list">
            {#each group.types as type (type.anchor)}
              <dt id={type.anchor}>
                {#if type.href}
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- type paths come from the prerendered reference -->
                  <a href={type.href}><code>{type.name}</code></a>
                {:else}
                  <code>{type.name}</code>
                {/if}
                <span class="api-kind">{type.kind}</span>
              </dt>
              <dd>
                {#if type.inline}
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
                  {@html type.inline.signature}
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
                  {@html type.inline.docs}
                {:else if type.summary}
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
                  {@html type.summary}
                {/if}
              </dd>
            {/each}
          </dl>
        </section>
      {/each}
    </article>
  </div>
</div>
