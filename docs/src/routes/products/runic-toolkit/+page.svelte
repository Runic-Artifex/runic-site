<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<!-- The Runic Application product page used the legacy runic-toolkit slug. -->
<svelte:head>
  <title>Runic Application moved · Runic Artifex</title>
  <meta http-equiv="refresh" content="0;url=/products/runic-application/" />
  <link rel="canonical" href="/products/runic-application/" />
</svelte:head>

<div class="shell page-head">
  <h1>Runic Application has moved.</h1>
  <p class="lede">The Runic Application product page has a new address.</p>
  <p>
    <a href={resolve('/products/[slug]', { slug: 'runic-application' })}
      >Open Runic Application</a
    >
  </p>
</div>
