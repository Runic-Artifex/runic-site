<script lang="ts">
  // The site carries no release versions; --prerelease resolves the latest
  // preview of the creator, which then prints its exact version.
  let { command = 'dnx Runic.Create --prerelease' }: { command?: string } =
    $props();

  let copied = $state(false);
  let reset: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    await navigator.clipboard.writeText(command);
    copied = true;
    clearTimeout(reset);
    reset = setTimeout(() => (copied = false), 1600);
  }
</script>

<div class="command">
  <code><span class="command__prompt" aria-hidden="true">$</span>{command}</code
  >
  <button type="button" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
  <span class="sr-only" role="status">{copied ? 'Command copied' : ''}</span>
</div>

<style>
  .command {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: fit-content;
    max-width: 100%;
    padding: 0.4rem 0.4rem 0.4rem 1rem;
    border-radius: var(--radius-control);
    color: var(--rune-stone);
    background: var(--rune-ink);
  }

  code {
    min-width: 0;
    overflow-x: auto;
    font-size: 0.9375rem;
    white-space: nowrap;
  }

  @media (max-width: 26rem) {
    code {
      font-size: 0.8125rem;
    }
  }

  .command__prompt {
    margin-right: 1ch;
    color: var(--rune-paint);
    user-select: none;
  }

  button {
    flex: none;
    min-height: 2.25rem;
    padding: 0.3rem 0.8rem;
    border: 1px solid color-mix(in srgb, var(--rune-stone) 28%, transparent);
    border-radius: 3px;
    color: inherit;
    background: transparent;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 540;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--rune-stone);
  }

  button:focus-visible {
    box-shadow: 0 0 0 2px var(--rune-paint);
  }
</style>
