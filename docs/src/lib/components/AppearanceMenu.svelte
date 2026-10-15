<script lang="ts">
  import { isThemeMode, themeModes, type ThemeMode } from '#lib/appearance.js';
  import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
  import MonitorIcon from '@lucide/svelte/icons/monitor';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SunIcon from '@lucide/svelte/icons/sun';

  // Mode only: follow the system, or keep light or dark. The compact form is
  // a menu in the header; the full form is a three-way switch in the Sheet.
  let {
    mode,
    compact = false,
    onmodechange,
  }: {
    mode: ThemeMode;
    compact?: boolean;
    onmodechange: (mode: ThemeMode) => void;
  } = $props();

  const modeNames: Record<ThemeMode, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  };
  const modeIcons = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

  let accessibleLabel = $derived(`Appearance, ${modeNames[mode]}`);
  let ModeIcon = $derived(modeIcons[mode]);

  function changeMode(value: string): void {
    if (isThemeMode(value)) onmodechange(value);
  }
</script>

{#if compact}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          class="icon-button"
          type="button"
          aria-label={accessibleLabel}
          title="Appearance"
          data-appearance-trigger="compact"
        >
          <ModeIcon aria-hidden="true" />
        </button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="min-w-40" align="end">
      <DropdownMenu.Label>Appearance</DropdownMenu.Label>
      <DropdownMenu.RadioGroup value={mode} onValueChange={changeMode}>
        {#each themeModes as value (value)}
          {@const Icon = modeIcons[value]}
          <DropdownMenu.RadioItem {value}
            ><Icon aria-hidden="true" />{modeNames[
              value
            ]}</DropdownMenu.RadioItem
          >
        {/each}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else}
  <fieldset class="appearance-switch" data-appearance-trigger="full">
    <legend>Appearance</legend>
    <div class="appearance-options">
      {#each themeModes as value (value)}
        {@const Icon = modeIcons[value]}
        <label>
          <input
            type="radio"
            name="appearance-mode"
            {value}
            checked={mode === value}
            onchange={() => changeMode(value)}
          />
          <Icon aria-hidden="true" />
          {modeNames[value]}
        </label>
      {/each}
    </div>
  </fieldset>
{/if}

<style>
  .appearance-switch {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 0.5rem;
    font-size: var(--text-small);
    font-weight: 600;
  }

  .appearance-options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border: var(--rule);
    border-radius: var(--radius-control);
  }

  label {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.5rem;
    padding: 0.4rem 0.5rem;
    color: var(--rune-ink-soft);
    font-size: var(--text-small);
    cursor: pointer;
  }

  label + label {
    border-left: var(--rule);
  }

  label:first-child {
    border-radius: 3px 0 0 3px;
  }

  label:last-child {
    border-radius: 0 3px 3px 0;
  }

  label:has(input:checked) {
    background: var(--rune-ink);
    color: var(--rune-stone);
  }

  label:has(input:focus-visible) {
    z-index: 1;
    outline: 2px solid var(--rune-paint);
    outline-offset: 2px;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  label :global(svg) {
    width: 1rem;
    height: 1rem;
  }
</style>
