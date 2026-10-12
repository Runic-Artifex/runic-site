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

<div class="page-hero shell search-page">
  <p class="eyebrow">Search</p>
  <h1>Search the documentation.</h1>
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
      <a class="text-link" href={resolve('/guides/[...path]', { path: '' })}
        >guide index</a
      > instead.
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
            <strong
              >{result.entry.t}{#if result.entry.s}<span
                  >{` › ${result.entry.s}`}</span
                >{/if}</strong
            >
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
