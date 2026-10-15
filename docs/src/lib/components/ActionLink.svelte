<script lang="ts">
  import type { Snippet } from 'svelte';

  // A page's actions: one primary (ink, painted on hover), the rest outlined.
  let {
    href,
    variant = 'secondary',
    children,
  }: {
    href: string;
    variant?: 'primary' | 'secondary';
    children: Snippet;
  } = $props();
</script>

<a class={['button', variant === 'primary' && 'button--primary']} {href}
  >{@render children()}</a
>
