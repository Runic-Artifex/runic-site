<script lang="ts">
  import { page } from '$app/state';
  import ErrorState from '#lib/components/ErrorState.svelte';
</script>

<svelte:head
  ><title
    >{page.status === 404 ? 'Page not found' : 'Error'} · Runic Artifex</title
  ></svelte:head
>

<ErrorState
  status={page.status}
  title={page.status === 404
    ? 'No page at this address'
    : 'This page could not be shown'}
  description={page.status === 404
    ? 'It may have moved while the preview documentation changes. Search for it, or start from the documentation home.'
    : 'Something went wrong while rendering it. Try again, or start from the documentation home.'}
/>
