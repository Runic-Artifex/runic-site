<script lang="ts">
  import Mark from './Mark.svelte';

  // The RUNIC wordmark with the Artifex descriptor on its baseline.
  let { descriptor = 'Artifex' }: { descriptor?: string } = $props();
</script>

<span class="lockup">
  <Mark name="wordmark" class="lockup__mark" />
  <span class="lockup__descriptor">{descriptor}</span>
</span>

<style>
  .lockup {
    display: inline-flex;
    align-items: flex-end;
    gap: 0.42em;
    font-size: 1.25rem;
  }

  .lockup :global(.lockup__mark) {
    height: 0.98em;
    width: auto;
  }

  .lockup__descriptor {
    font-size: 0.96em;
    font-weight: 540;
    line-height: 0.76;
    letter-spacing: -0.005em;
  }
</style>
