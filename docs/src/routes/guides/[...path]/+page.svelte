<script lang="ts">
  import { resolve } from '$app/paths';
  import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
  import SearchForm from '#lib/components/SearchForm.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let guide = $derived(data.guide);
  let pageTitle = $derived(
    guide.path ? `${guide.title} · Runic Artifex` : 'Guides · Runic Artifex',
  );
  let description = $derived(
    guide.summary || `${guide.title} in the Runic Artifex guides.`,
  );
  let toc = $derived(guide.headings.filter((heading) => heading.depth === 2));
  // Every guide links the glossary of the terms the guides share.
  const glossaryFile = 'application/glossary.md';
  // SDK development guides stay out of the product sidebar. Product guides
  // list them in the footer; a contributor guide shows them in the sidebar.
  let onContributorGuide = $derived(
    data.navigation.some(
      (group) =>
        group.contributor &&
        group.guides.some((entry) => entry.href === guide.href),
    ),
  );
  let sidebarGroups = $derived(
    data.navigation.filter((group) => !group.contributor || onContributorGuide),
  );
  let contributorGuides = $derived(
    data.navigation
      .filter((group) => group.contributor)
      .flatMap((group) => group.guides),
  );
  let groupTitle = $derived(
    data.navigation.find((group) =>
      group.guides.some((entry) => entry.href === guide.href),
    )?.title,
  );
  let breadcrumbs = $derived([
    { label: 'Guides', href: resolve('/guides/[...path]', { path: '' }) },
    ...(groupTitle ? [{ label: groupTitle }] : []),
  ]);
  // Narrow screens fold the guide list behind a button once JavaScript runs.
  let navOpen = $state(false);
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={description} />
</svelte:head>

<div class="shell guide-layout">
  <aside class="guide-sidebar">
    <div class="guide-sidebar-bar">
      <SearchForm />
      <button
        class="guide-nav-toggle"
        type="button"
        aria-expanded={navOpen}
        aria-controls="guide-nav"
        onclick={() => (navOpen = !navOpen)}
        >{navOpen ? 'Hide guides' : 'All guides'}</button
      >
    </div>
    <nav
      class="guide-nav"
      id="guide-nav"
      aria-label="Guides"
      data-open={navOpen}
    >
      {#each sidebarGroups as group, groupIndex (group.title)}
        <div class="guide-nav-group">
          <h2 class="guide-nav-heading" id={`guide-nav-${groupIndex}`}>
            {group.title}
          </h2>
          <ul aria-labelledby={`guide-nav-${groupIndex}`}>
            {#each group.guides as entry (entry.href)}
              <li>
                <a
                  href={entry.href}
                  aria-current={entry.href === guide.href ? 'page' : undefined}
                  >{entry.title}</a
                >
              </li>
            {/each}
            {#each group.external as entry (entry.href)}
              <li>
                <a href={entry.href} title="Published on GitHub"
                  >{entry.label}</a
                >
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>
  </aside>

  <article class="guide-content">
    <header class="guide-head">
      {#if guide.path}
        <Breadcrumbs items={breadcrumbs} />
      {/if}
      <h1>{guide.title}</h1>
    </header>
    {#if toc.length > 2}
      <details class="guide-toc-inline">
        <summary>On this page</summary>
        <ul>
          {#each toc as heading (heading.id)}
            <li><a href={`#${heading.id}`}>{heading.text}</a></li>
          {/each}
        </ul>
      </details>
    {/if}
    <div class="prose">
      <!-- Rendered at build time from checked-in Markdown; raw HTML is escaped. -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html guide.html}
    </div>
    <footer class="guide-footer">
      {#if data.previous || data.next}
        <nav class="guide-pager" aria-label="Previous and next guide">
          {#if data.previous}
            <a href={data.previous.href} rel="prev">
              <small>Previous</small>{data.previous.title}
            </a>
          {/if}
          {#if data.next}
            <a href={data.next.href} rel="next">
              <small>Next</small>{data.next.title}
            </a>
          {/if}
        </nav>
      {/if}
      {#if guide.file !== glossaryFile}
        <p class="guide-glossary">
          New to a term such as Window, View or model context? See the
          <a
            href={resolve('/guides/[...path]', {
              path: 'application/glossary',
            })}>glossary</a
          >.
        </p>
      {/if}
      {#if !onContributorGuide}
        <nav class="guide-contributors" aria-label="Contributor guides">
          <span>Working on the SDK itself?</span>
          {#each contributorGuides as entry (entry.href)}
            <a href={entry.href}>{entry.title}</a>
          {/each}
        </nav>
      {/if}
      <p><a href={guide.sourceUrl}>View source on GitHub</a></p>
    </footer>
  </article>

  {#if toc.length > 2}
    <nav class="guide-toc" aria-label="On this page">
      <p class="guide-toc-title">On this page</p>
      <ul>
        {#each toc as heading (heading.id)}
          <li><a href={`#${heading.id}`}>{heading.text}</a></li>
        {/each}
      </ul>
    </nav>
  {/if}
</div>
