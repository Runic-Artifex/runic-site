<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<svelte:head>
  <title>Application guidance moved · Runic Artifex</title>
  <meta http-equiv="refresh" content="0;url=/views" />
</svelte:head>

<div class="shell page-head">
  <h1>Application guidance has moved.</h1>
  <p class="lede">
    The current application model uses explicit .NET Windows and Views with
    generated TypeScript clients.
  </p>
  <p>
    <a href={resolve('/views')}>Read the Windows and Views guide</a>
  </p>
</div>
