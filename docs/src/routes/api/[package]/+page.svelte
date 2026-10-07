<script lang="ts">
  import { resolve } from '$app/paths';
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

<div>
  <section class="doc-hero guide-hero shell">
    <nav class="api-breadcrumb" aria-label="Breadcrumb">
      <a href={resolve('/api')}>API reference</a>
    </nav>
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
      Read from the <a class="text-link" href={pkg.url}>published package</a>.
    </p>
  </section>
  <div class="api-layout shell">
    <nav class="api-toc" aria-label="Namespaces">
      <strong>{pkg.ecosystem === 'nuget' ? 'Namespaces' : 'Modules'}</strong>
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
