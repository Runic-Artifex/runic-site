<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import CopyIcon from '@lucide/svelte/icons/copy';

  let {
    command,
    label = 'Copy command',
    class: className,
  }: {
    command: string;
    label?: string;
    class?: string;
  } = $props();

  let copied = $state(false);
  let reset: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    await navigator.clipboard.writeText(command);
    copied = true;
    clearTimeout(reset);
    reset = setTimeout(() => (copied = false), 1600);
  }
</script>

<!-- The command scrolls in its own cell, so the copy button never covers it. -->
<div class={['command-block', className]}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre tabindex="0"><code>{command}</code></pre>
  <button
    class="command-copy"
    type="button"
    aria-label={copied ? 'Copied' : label}
    title={copied ? 'Copied' : label}
    onclick={copy}
  >
    {#if copied}<CheckIcon aria-hidden="true" />{:else}<CopyIcon
        aria-hidden="true"
      />{/if}
  </button>
  <span class="sr-only" role="status"
    >{copied ? 'Copied to clipboard' : ''}</span
  >
</div>

<style>
  .command-block {
    display: flex;
    align-items: flex-start;
    min-width: 0;
    border: var(--rule);
    border-radius: var(--radius-pane);
    background: var(--code-ground, var(--rune-raised));
  }

  .command-block pre {
    min-width: 0;
    flex: 1;
    margin: 0;
    overflow-x: auto;
    padding: 0.95rem 0.5rem 0.95rem 1.15rem;
    border: 0;
    border-radius: var(--radius-pane) 0 0 var(--radius-pane);
    background: none;
    font-size: var(--text-code);
    line-height: 1.6;
    white-space: pre;
  }

  .command-block code {
    padding: 0;
    background: none;
    font-size: inherit;
    overflow-wrap: normal;
  }

  .command-copy {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: none;
    place-items: center;
    margin: 0.55rem 0.55rem 0 0;
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--rune-ink-soft);
    cursor: pointer;
  }

  .command-copy:hover {
    border-color: var(--rune-groove);
    color: var(--rune-ink);
  }

  .command-copy :global(svg) {
    width: 1rem;
    height: 1rem;
  }
</style>
