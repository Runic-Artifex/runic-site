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
        {#each data.navigation as group (group.title)}
          <div class="guide-nav-group">
            <strong>{group.title}</strong>
            <ul>
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
        <a class="text-link" href={guide.sourceUrl}>View source on GitHub</a>
      </footer>
    </article>
  </div>
</div>
