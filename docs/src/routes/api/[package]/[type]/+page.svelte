<script lang="ts">
  import { resolve } from '$app/paths';
  import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let type = $derived(data.page);
  let title = $derived(`${type.title} · ${type.package.id} · Runic Artifex`);
  let description = $derived(
    type.summary ||
      `${type.title} in ${type.package.id} ${type.package.version}.`,
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
    <Breadcrumbs
      items={[
        { label: 'API reference', href: resolve('/api') },
        { label: type.package.id, href: type.package.href },
      ]}
    />
    <h1><code>{type.name}</code> <span class="api-kind">{type.kind}</span></h1>
    <p class="api-meta">
      Namespace <code>{type.namespace}</code> in {type.package.id}
      {type.package.version}
    </p>
  </div>
  <div class="api-layout">
    {#if type.groups.length}
      <nav class="api-toc" aria-label="Members">
        <p class="guide-toc-title">Members</p>
        <ul>
          {#each type.groups as group (group.id)}
            <li><a href={`#${group.id}`}>{group.title}</a></li>
          {/each}
        </ul>
      </nav>
    {/if}
    <article class="api-content">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
      {@html type.signature}
      {#if type.declaringType || type.inheritance.length}
        <p class="api-meta">
          {#if type.declaringType}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
            Nested in {@html type.declaringType}.
          {/if}
          {#if type.inheritance.length}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
            Inherits or implements {@html type.inheritance.join(', ')}.
          {/if}
        </p>
      {/if}
      <div class="api-docs">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
        {@html type.docs}
      </div>
      {#each type.groups as group (group.id)}
        <section aria-labelledby={group.id}>
          <h2 id={group.id}>{group.title}</h2>
          {#each group.members as member (member.anchor)}
            <div class="api-member">
              <h3 id={member.anchor}><code>{member.name}</code></h3>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
              {@html member.signature}
              <div class="api-docs">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped by api-core -->
                {@html member.docs}
              </div>
            </div>
          {/each}
        </section>
      {/each}
    </article>
  </div>
</div>
