<script lang="ts">
  import { resolve } from '$app/paths';
  import SearchIcon from '@lucide/svelte/icons/search';
</script>

<!-- A plain GET form, so the search page receives the query in its URL. -->
<form
  class="search-form"
  action={resolve('/search')}
  method="get"
  role="search"
>
  <label class="sr-only" for="guide-search">Search the documentation</label>
  <SearchIcon aria-hidden="true" />
  <input
    id="guide-search"
    name="q"
    type="search"
    placeholder="Search guides"
    autocomplete="off"
  />
</form>
