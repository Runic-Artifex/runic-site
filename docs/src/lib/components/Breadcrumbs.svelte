<script lang="ts">
  // Plain breadcrumbs. An entry without href is the current section.
  let { items }: { items: readonly { label: string; href?: string }[] } =
    $props();
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <ol>
    {#each items as item (item.label)}
      <li>
        {#if item.href}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolved paths -->
          <a href={item.href}>{item.label}</a>
        {:else}
          <span>{item.label}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
