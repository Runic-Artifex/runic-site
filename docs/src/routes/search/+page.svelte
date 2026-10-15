<script lang="ts">
  import { resolve } from '$app/paths';
  import { replaceState } from '$app/navigation';
  import { SiteSearch, type SearchResponse } from '#lib/search-core.js';
  import SearchIcon from '@lucide/svelte/icons/search';
  import { onMount } from 'svelte';

  let query = $state('');
  let response = $state<SearchResponse | null>(null);
  let failed = $state(false);
  const shown = 20;
  let results = $derived(response?.results ?? []);

  // The index loads on the first search, then only the files a query needs.
  const site = new SiteSearch(async (path) => {
    const reply = await fetch(`${resolve('/')}${path}`);
    if (!reply.ok) throw new Error(`HTTP ${reply.status}`);
    return reply.json();
  });

  onMount(() => {
    query = new URLSearchParams(window.location.search).get('q') ?? '';
  });

  $effect(() => {
    const current = query;
    if (!current.trim()) {
      response = null;
      return;
    }
    let active = true;
    site.search(current, shown).then(
      (next) => {
        if (active) [response, failed] = [next, false];
      },
      () => {
        if (active) failed = true;
      },
    );
    return () => {
      active = false;
    };
  });

  function updateUrl() {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    replaceState(url, {});
  }
</script>

<svelte:head>
  <title>Search · Runic Artifex</title>
  <meta
    name="description"
    content="Search the Runic Artifex guides and product documentation."
  />
  <meta property="og:title" content="Search · Runic Artifex" />
  <meta
    property="og:description"
    content="Search the Runic Artifex guides and product documentation."
  />
  <meta name="twitter:title" content="Search · Runic Artifex" />
  <meta
    name="twitter:description"
    content="Search the Runic Artifex guides and product documentation."
  />
</svelte:head>

<div class="shell page-head search-page">
  <h1>Search the documentation</h1>
  <form
    class="search-form large"
    role="search"
    action={resolve('/search')}
    method="get"
    onsubmit={(event) => {
      event.preventDefault();
      updateUrl();
    }}
  >
    <label class="sr-only" for="search-query">Search query</label>
    <SearchIcon aria-hidden="true" />
    <!-- svelte-ignore a11y_autofocus -->
    <input
      id="search-query"
      name="q"
      type="search"
      placeholder="Search guides and products"
      autocomplete="off"
      autofocus
      bind:value={query}
      oninput={updateUrl}
    />
  </form>
  <noscript>
    <p class="search-status">
      Search runs in your browser and needs JavaScript. Browse the
      <a href={resolve('/guides/[...path]', { path: '' })}>guide index</a> instead.
    </p>
  </noscript>

  <div aria-live="polite">
    {#if failed}
      <p class="search-status">The search index could not be loaded.</p>
    {:else if query.trim() && response}
      <p class="search-status">
        {response.total === 0
          ? 'No results.'
          : `${response.total > shown ? `${shown}+` : response.total} result${response.total === 1 ? '' : 's'}`}
      </p>
    {/if}
  </div>
  {#if results.length}
    <ol class="search-results">
      {#each results as result (result.entry.u)}
        <li>
          <a href={result.entry.u}>
            <strong>{result.entry.t}</strong>
            {#if result.entry.s}<span class="section">{result.entry.s}</span
              >{/if}
            <span class="excerpt"
              >{#each result.excerpt as part, partIndex (partIndex)}{#if part.match}<mark
                    >{part.text}</mark
                  >{:else}{part.text}{/if}{/each}</span
            >
          </a>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .search-page :global(.search-form) {
    width: 100%;
    margin-top: 0.5rem;
  }

  .search-status {
    color: var(--rune-ink-soft);
    font-size: var(--text-ui);
  }

  .search-results {
    width: 100%;
    max-width: 48rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .search-results li {
    border-bottom: var(--rule);
  }

  .search-results li:first-child {
    border-top: var(--rule);
  }

  .search-results a {
    display: grid;
    gap: 0.2rem;
    padding-block: 1rem;
    text-decoration: none;
  }

  .search-results strong {
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .search-results a:hover strong {
    text-decoration: underline;
    text-decoration-color: var(--rune-paint);
  }

  .section {
    color: var(--rune-ink);
    font-size: var(--text-ui);
  }

  .excerpt {
    color: var(--rune-ink-soft);
    font-size: var(--text-ui);
    line-height: 1.55;
  }

  mark {
    padding: 0 0.1em;
    border-radius: 2px;
    background: color-mix(in srgb, var(--rune-paint) 18%, transparent);
    color: var(--rune-ink);
  }
</style>
