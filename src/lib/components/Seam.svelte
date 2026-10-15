<script lang="ts">
  import {
    frontends,
    members,
    tokens,
    viewModels,
    type Member,
    type Snippet,
  } from '$lib/seam';

  type Flow = { member: Member; direction: 'to-frontend' | 'to-dotnet' };

  const steps = [1, 2, 5, 10];

  let viewModelId = $state('reactiveui');
  let frontendId = $state('react');
  let pinned = $state<Member | null>(null);
  let hovered = $state<Member | null>(null);
  let flow = $state<Flow | null>(null);
  let busy = $state(false);
  let status = $state('');

  // The ViewModel's state, and the copy the frontend has received.
  let count = $state(0);
  let step = $state(1);
  let shownCount = $state(0);
  let shownStep = $state(1);

  const viewModel = $derived(
    viewModels.find((option) => option.id === viewModelId) ?? viewModels[0],
  );
  const frontend = $derived(
    frontends.find((option) => option.id === frontendId) ?? frontends[0],
  );
  const lit = $derived(flow?.member ?? hovered ?? pinned);

  function pause(milliseconds: number) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise((done) => setTimeout(done, reduced ? 0 : milliseconds));
  }

  async function increment() {
    if (busy) return;
    busy = true;
    flow = { member: 'increment', direction: 'to-dotnet' };
    await pause(560);
    count += step;
    flow = { member: 'count', direction: 'to-frontend' };
    await pause(560);
    shownCount = count;
    flow = null;
    busy = false;
    status = `IncrementCommand ran in C#. Count is now ${count}.`;
  }

  async function changeStep(value: number) {
    busy = true;
    flow = { member: 'step', direction: 'to-dotnet' };
    await pause(480);
    step = value;
    flow = { member: 'step', direction: 'to-frontend' };
    await pause(480);
    shownStep = step;
    flow = null;
    busy = false;
    status = `setStep(${value}) set Step in C#.`;
  }

  function togglePin(member: Member) {
    pinned = pinned === member ? null : member;
  }

  // The first line of a ViewModel that names a member shows its live value.
  function valueLine(snippet: Snippet, member: Member) {
    return snippet.lines.findIndex(
      ([owner, text]) => owner === member && text.includes(`«${member}|`),
    );
  }
</script>

<figure class="seam" aria-labelledby="seam-caption">
  <section class="pane pane--dotnet" aria-label="C# ViewModel">
    <header class="pane__head">
      <span class="pane__file">{viewModel.file}</span>
      <fieldset class="choice">
        <legend class="sr-only">MVVM library</legend>
        {#each viewModels as option (option.id)}
          <label>
            <input
              type="radio"
              name="seam-viewmodels"
              value={option.id}
              bind:group={viewModelId}
            />
            <span>{option.label}</span>
          </label>
        {/each}
      </fieldset>
    </header>
    {@render code(viewModel, true)}
  </section>

  <div class="contract">
    <p class="contract__title">Generated client</p>
    <ul class="contract__members">
      {#each members as member (member.id)}
        <li>
          <button
            type="button"
            class="member"
            class:member--lit={lit === member.id}
            data-direction={member.direction}
            data-flow={flow?.member === member.id ? flow.direction : undefined}
            aria-pressed={pinned === member.id}
            onclick={() => togglePin(member.id)}
            onpointerenter={() => (hovered = member.id)}
            onpointerleave={() => (hovered = null)}
          >
            <svg class="member__twig" viewBox="0 0 160 56" aria-hidden="true">
              {#if member.direction !== 'to-dotnet'}
                <path class="twig twig--right" d="M22 6 138 50" />
              {/if}
              {#if member.direction !== 'to-frontend'}
                <path class="twig twig--left" d="M138 6 22 50" />
              {/if}
              {#if flow?.member === member.id}
                <path
                  class="pulse"
                  d={flow.direction === 'to-frontend'
                    ? 'M22 6 138 50'
                    : 'M138 6 22 50'}
                />
              {/if}
            </svg>
            <code class="member__name">{member.name}</code>
            <span class="member__role">{member.role}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <section class="pane pane--frontend" aria-label="Frontend View">
    <header class="pane__head">
      <span class="pane__file">{frontend.file}</span>
      <fieldset class="choice">
        <legend class="sr-only">Frontend framework</legend>
        {#each frontends as option (option.id)}
          <label>
            <input
              type="radio"
              name="seam-frontends"
              value={option.id}
              bind:group={frontendId}
            />
            <span>{option.label}</span>
          </label>
        {/each}
      </fieldset>
    </header>
    {@render code(frontend, false)}
  </section>

  <div
    class="window"
    role="group"
    aria-label="The counter page in a Runic window"
  >
    <div class="window__bar" aria-hidden="true">
      <span class="window__controls"><i></i><i></i><i></i></span>
      <span class="window__title">MyApp</span>
    </div>
    <div class="window__body">
      <p class="window__heading">Counter View</p>
      <p class="window__count">{shownCount}</p>
      <div class="window__actions">
        <label>
          Step
          <select
            value={shownStep}
            disabled={busy}
            onchange={(event) => changeStep(Number(event.currentTarget.value))}
          >
            {#each steps as value (value)}
              <option {value}>{value}</option>
            {/each}
          </select>
        </label>
        <button type="button" disabled={busy} onclick={increment}
          >Increment</button
        >
      </div>
    </div>
    <p class="sr-only" role="status">{status}</p>
  </div>

  <figcaption id="seam-caption">
    The template's counter page. Switch the MVVM library or the framework: the
    generated client keeps the same members, and the C# setter decides what the
    frontend may change.
  </figcaption>
</figure>

{#snippet code(snippet: Snippet, dotnet: boolean)}
  <pre class="pane__code"><code
      >{#each snippet.lines as [owner, text], index (index)}<span
          class="line"
          class:line--lit={owner !== null && owner === lit}
          >{#each tokens(text) as token, part (part)}{#if token.member}<span
                class="crossing">{token.text}</span
              >{:else}{token.text}{/if}{/each}{#if dotnet && owner && index === valueLine(snippet, owner) && owner !== 'increment'}<span
              class="live"
              aria-hidden="true">// {owner === 'count' ? count : step}</span
            >{/if}</span
        >{/each}</code
    ></pre>
{/snippet}

<style>
  .seam {
    --contract: 11.5rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--contract) minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    align-items: stretch;
  }

  /* Code panes */
  .pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 1px solid var(--rune-groove);
    border-radius: var(--radius-pane);
    background: var(--rune-raised);
  }

  .pane--dotnet {
    grid-area: 1 / 1;
  }

  .pane--frontend {
    grid-area: 1 / 3;
  }

  .pane__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    padding: 0.7rem 0.75rem 0.7rem 1.1rem;
    border-bottom: 1px solid var(--rune-groove);
  }

  .pane__file {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--rune-ink-soft);
  }

  .choice {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin: 0;
    padding: 2px;
    border: 0;
    border-radius: var(--radius-control);
    background: var(--rune-sunk);
  }

  .choice label {
    position: relative;
  }

  .choice input {
    position: absolute;
    inset: 0;
    opacity: 0;
    margin: 0;
    cursor: pointer;
  }

  .choice span {
    display: block;
    padding: 0.28rem 0.6rem;
    border-radius: 3px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--rune-ink-soft);
  }

  .choice input:checked + span {
    color: var(--rune-ink);
    background: var(--rune-raised);
    box-shadow: 0 0 0 1px var(--rune-groove);
  }

  .choice input:focus-visible + span {
    box-shadow: var(--focus);
  }

  .pane__code {
    flex: 1;
    margin: 0;
    padding: 1rem 1.1rem 6.5rem;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.62;
    tab-size: 4;
    color: var(--rune-ink);
  }

  .line {
    display: block;
    min-height: 1lh;
    margin-inline: -1.1rem;
    padding-inline: 1.1rem;
    transition: background-color 180ms ease;
  }

  .line--lit {
    background: color-mix(in srgb, var(--rune-paint) 11%, transparent);
  }

  .crossing {
    color: var(--rune-paint);
    font-weight: 600;
  }

  .live {
    margin-left: 2ch;
    color: var(--rune-ink-soft);
  }

  /* The contract: a stave, and one twig for each member that crosses it. */
  .contract {
    position: relative;
    grid-area: 1 / 2 / 3 / 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 0 8rem;
  }

  .contract::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 5px;
    margin-left: -2.5px;
    background: var(--rune-ink);
    content: '';
    transform-origin: top;
    animation: carve 900ms cubic-bezier(0.6, 0, 0.2, 1) both;
  }

  .contract__title {
    position: relative;
    margin-bottom: auto;
    padding: 0.2rem 0.5rem;
    font-size: 0.8125rem;
    font-weight: 560;
    color: var(--rune-ink-soft);
    background: var(--rune-stone);
  }

  .contract__members {
    display: grid;
    gap: 2.25rem;
    width: 100%;
    margin: 0 0 auto;
    padding: 0;
    list-style: none;
  }

  .member {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    width: 100%;
    padding: 0 0.5rem 0.4rem;
    border: 0;
    color: inherit;
    background: none;
    font: inherit;
    text-align: center;
    cursor: pointer;
  }

  .member__twig {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .twig {
    fill: none;
    stroke: var(--rune-paint);
    stroke-width: 7;
    stroke-linecap: butt;
    stroke-dasharray: 150;
    animation: paint 620ms cubic-bezier(0.5, 0, 0.2, 1) both;
  }

  .contract__members li:nth-child(1) .twig {
    animation-delay: 620ms;
  }

  .contract__members li:nth-child(2) .twig {
    animation-delay: 760ms;
  }

  .contract__members li:nth-child(3) .twig {
    animation-delay: 900ms;
  }

  .member__name {
    position: relative;
    padding: 0.05rem 0.35rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--rune-paint);
    background: var(--rune-stone);
  }

  .member__role {
    position: relative;
    max-width: 11rem;
    padding: 0 0.3rem;
    font-size: 0.8125rem;
    line-height: 1.35;
    color: var(--rune-ink-soft);
    background: var(--rune-stone);
  }

  .member--lit .twig {
    stroke-width: 11;
  }

  .member[aria-pressed='true'] .member__name {
    box-shadow: inset 0 -2px 0 var(--rune-paint);
  }

  /* A call travelling across the seam, as a light streak along its twig. */
  .pulse {
    fill: none;
    stroke: var(--rune-raised);
    stroke-width: 3;
    stroke-dasharray: 22 160;
    animation: travel 520ms linear both;
  }

  .member[data-flow='to-frontend'] .twig--left,
  .member[data-flow='to-dotnet'] .twig--right {
    opacity: 0.3;
  }

  @keyframes carve {
    from {
      transform: scaleY(0);
    }
  }

  @keyframes paint {
    from {
      stroke-dashoffset: 150;
    }
  }

  @keyframes travel {
    from {
      stroke-dashoffset: 22;
    }
    to {
      stroke-dashoffset: -130;
    }
  }

  /* The window the frontend runs in. */
  .window {
    grid-area: 2 / 1 / 3 / 4;
    justify-self: center;
    position: relative;
    width: min(25rem, 100%);
    margin-top: -5.25rem;
    border: 1px solid var(--rune-groove);
    border-radius: var(--radius-window);
    background: var(--rune-raised);
    box-shadow:
      0 1px 2px rgb(20 24 26 / 8%),
      0 18px 48px -12px rgb(20 24 26 / 26%);
    overflow: hidden;
  }

  .window__bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0.55rem 0.8rem;
    border-bottom: 1px solid var(--rune-groove);
    background: var(--rune-sunk);
  }

  .window__controls {
    display: flex;
    gap: 0.4rem;
  }

  .window__controls i {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    background: var(--rune-groove);
  }

  .window__title {
    font-size: 0.8125rem;
    font-weight: 560;
    color: var(--rune-ink-soft);
  }

  /* The page inside is the template's own, not Runic's: system UI type. */
  .window__body {
    display: grid;
    justify-items: center;
    gap: 0.3rem;
    padding: 1.4rem 1.5rem 1.6rem;
    font-family: system-ui, sans-serif;
  }

  .window__heading {
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .window__count {
    font-size: 3.25rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .window__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.4rem;
    font-size: 0.9375rem;
  }

  .window select,
  .window button {
    min-height: 2.25rem;
    border: 1px solid var(--rune-groove);
    border-radius: 6px;
    font: inherit;
    color: var(--rune-ink);
    background: var(--rune-stone);
  }

  .window select {
    margin-left: 0.35rem;
    padding: 0 0.4rem;
  }

  .window button {
    padding: 0 0.95rem;
    font-weight: 600;
    color: var(--rune-stone);
    border-color: var(--rune-ink);
    background: var(--rune-ink);
    cursor: pointer;
  }

  .window button:disabled,
  .window select:disabled {
    cursor: progress;
  }

  figcaption {
    grid-area: 3 / 1 / 4 / 4;
    justify-self: center;
    max-width: 38rem;
    margin-top: 1.5rem;
    font-size: 0.9375rem;
    color: var(--rune-ink-soft);
    text-align: center;
  }

  @media (max-width: 64rem) {
    .seam {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: none;
    }

    .pane--dotnet,
    .pane--frontend,
    .contract,
    .window,
    figcaption {
      grid-area: auto;
    }

    .pane__code {
      padding-bottom: 1.25rem;
    }

    .contract {
      padding: 1.5rem 0;
    }

    .contract::before {
      animation: none;
    }

    .contract__title {
      margin-bottom: 1rem;
    }

    .contract__members {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
    }

    .member__twig {
      max-width: 7rem;
    }

    .window {
      margin-top: 1.5rem;
    }
  }

  @media (max-width: 36rem) {
    .contract__members {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    .pane__code {
      font-size: 0.75rem;
    }
  }
</style>
