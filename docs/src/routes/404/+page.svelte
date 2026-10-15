<script lang="ts">
  import ErrorState from '#lib/components/ErrorState.svelte';
</script>

<svelte:head>
  <title>Page not found · Runic Artifex</title>
  <meta
    name="description"
    content="The requested Runic Artifex documentation page was not found."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<ErrorState
  status="404"
  title="No page at this address"
  description="It may have moved while the preview documentation changes. Search for it, or start from the documentation home."
/>
