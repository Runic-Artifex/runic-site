<script lang="ts">
  import { resolve } from '$app/paths';
  import SearchForm from '#lib/components/SearchForm.svelte';

  let {
    status,
    title,
    description,
  }: { status: number | string; title: string; description: string } = $props();
</script>

<div class="shell page-head error-state">
  <h1>{title}</h1>
  <p class="lede">{description}</p>
  <SearchForm id="error-search" large placeholder="Search the documentation" />
  <p class="error-state__links">
    <a href={resolve('/')}>Documentation home</a>
    <a href={resolve('/guides/[...path]', { path: '' })}>All guides</a>
    <a href={resolve('/products')}>Products</a>
  </p>
  <p class="error-state__status">Status {status}</p>
</div>

<style>
  .error-state {
    min-height: 50vh;
  }

  .error-state :global(.search-form) {
    width: 100%;
    margin-top: 0.5rem;
  }

  .error-state__links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
  }

  .error-state__status {
    color: var(--rune-ink-soft);
    font-family: var(--rune-font-mono);
    font-size: var(--text-small);
  }
</style>
