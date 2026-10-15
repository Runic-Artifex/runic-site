<script lang="ts" module>
  import marks from './marks.json';

  export type MarkName = keyof typeof marks.glyphs | 'wordmark';
</script>

<script lang="ts">
  // Brand marks from @runic-artifex/brand: staves are ink, twigs are paint.
  let {
    name,
    label,
    class: className,
  }: { name: MarkName; label?: string; class?: string } = $props();

  const paths = $derived(
    name === 'wordmark' ? marks.wordmark : marks.glyphs[name],
  );
</script>

<svg
  class={['mark', className]}
  data-mark={name}
  viewBox={`0 0 ${paths.width} ${paths.height}`}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  <path class="mark__paint" d={paths.paint} />
  <path class="mark__ink" d={paths.ink} />
</svg>

<style>
  .mark {
    display: block;
    flex: none;
  }

  .mark__ink {
    fill: var(--mark-ink, var(--rune-ink));
  }

  .mark__paint {
    fill: var(--mark-paint, var(--rune-paint));
  }
</style>
