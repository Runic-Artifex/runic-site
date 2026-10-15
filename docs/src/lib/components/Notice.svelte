<script lang="ts">
  import type { Snippet } from 'svelte';

  // Notices carry a pigment bar; the title names the kind for readers who
  // cannot tell the colours apart.
  let {
    title,
    tone = 'note',
    children,
  }: {
    title: string;
    tone?: 'note' | 'tip' | 'warning' | 'caution';
    children: Snippet;
  } = $props();
</script>

<div class="notice" data-tone={tone} role="note">
  <p class="notice-title">{title}</p>
  {@render children()}
</div>
