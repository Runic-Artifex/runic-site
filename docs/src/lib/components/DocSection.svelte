<script lang="ts">
  import type { Snippet } from 'svelte';

  // One section of a hand-written page: a heading and prose, set off by a groove.
  let {
    title,
    id,
    children,
  }: { title: string; id?: string; children: Snippet } = $props();
</script>

<section class="doc-section" {id}>
  <h2>{title}</h2>
  <div class="prose">{@render children()}</div>
</section>
