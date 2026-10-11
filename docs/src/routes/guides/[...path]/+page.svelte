<script lang="ts">
  import { resolve } from '$app/paths';
  import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
  import { Separator } from '#lib/components/ui/separator/index.js';
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
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={description} />
</svelte:head>

<div>
  <section class="doc-hero guide-hero shell">
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href={resolve('/guides/[...path]', { path: '' })}
            >Guides</Breadcrumb.Link
          >
        </Breadcrumb.Item>
        {#if guide.path}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{guide.title}</Breadcrumb.Page>
          </Breadcrumb.Item>
        {/if}
      </Breadcrumb.List>
    </Breadcrumb.Root>
    <h1>{guide.title}</h1>
  </section>

  <Separator class="shell" />
  <div class="guide-layout shell">
    <aside class="guide-sidebar">
      <SearchForm />
      <nav class="guide-nav" aria-label="Guides">
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
                    aria-current={entry.href === guide.href
                      ? 'page'
                      : undefined}>{entry.title}</a
                  >
                </li>
              {/each}
              {#each group.external as entry (entry.href)}
                <li>
                  <a class="external" href={entry.href}>{entry.label} ↗</a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </nav>
    </aside>

    <article class="guide-content">
      {#if toc.length > 2}
        <nav class="guide-toc" aria-label="On this page">
          <strong>On this page</strong>
          <ul>
            {#each toc as heading (heading.id)}
              <li><a href={`#${heading.id}`}>{heading.text}</a></li>
            {/each}
          </ul>
        </nav>
      {/if}
      <div class="guide-prose">
        <!-- Rendered at build time from checked-in Markdown; raw HTML is escaped. -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html guide.html}
      </div>
      <footer class="guide-footer">
        <nav class="guide-pager" aria-label="Previous and next guide">
          {#if data.previous}
            <a href={data.previous.href} rel="prev">
              <small>Previous</small>{data.previous.title}
            </a>
          {/if}
          {#if data.next}
            <a class="next" href={data.next.href} rel="next">
              <small>Next</small>{data.next.title}
            </a>
          {/if}
        </nav>
        {#if guide.file !== glossaryFile}
          <p class="guide-glossary">
            New to a term such as Window, View or model context? See the
            <a
              class="text-link"
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
        <a class="text-link" href={guide.sourceUrl}>View source on GitHub</a>
      </footer>
    </article>
  </div>
</div>
