<script lang="ts">
  import { resolve } from '$app/paths';
  import SearchIcon from '@lucide/svelte/icons/search';

  let {
    id = 'guide-search',
    large = false,
    placeholder = 'Search guides',
  }: { id?: string; large?: boolean; placeholder?: string } = $props();
</script>

<!-- A plain GET form, so the search page receives the query in its URL. -->
<form
  class={['search-form', large && 'large']}
  action={resolve('/search')}
  method="get"
  role="search"
>
  <label class="sr-only" for={id}>Search the documentation</label>
  <SearchIcon aria-hidden="true" />
  <input {id} name="q" type="search" {placeholder} autocomplete="off" />
</form>
