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

<div class="create-command">
  <span class="create-command__prompt" aria-hidden="true">$</span>
  <code>{command}</code>
  <button type="button" onclick={copy} aria-label="Copy command"
    >{copied ? 'Copied' : 'Copy'}</button
  >
  <span class="visually-hidden" role="status"
    >{copied ? 'Copied to clipboard' : ''}</span
  >
</div>

<style>
  .create-command {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    max-width: 36rem;
    padding: 0.55rem 0.55rem 0.55rem 1.1rem;
    border: 1px solid var(--line-strong);
    background: rgb(7 16 11 / 72%);
    box-shadow: var(--shadow);
  }

  .create-command__prompt {
    color: var(--gold);
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  }

  code {
    flex: 1;
    min-width: 0;
    overflow-wrap: break-word;
    color: var(--parchment);
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 0.92rem;
  }

  button {
    min-height: 2.25rem;
    padding: 0.4rem 0.85rem;
    border: 1px solid var(--line-strong);
    color: var(--parchment);
    background: rgb(24 35 27 / 55%);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    border-color: var(--gold);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
