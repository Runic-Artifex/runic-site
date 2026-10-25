<script lang="ts">
  import { resolve } from '$app/paths';
  import CommandBlock from '#lib/components/CommandBlock.svelte';
  import {
    choiceFor,
    creatorCommands,
    creatorOptions,
    creatorTexts,
    creatorToggles,
    defaultSelection,
    isValidApplicationId,
    isValidProjectName,
    optionApplies,
    textValue,
    viewCommand,
  } from '#lib/creator.js';
  import { catalogRows, currentRelease } from '#lib/release-docs.js';
  import { previewFiles } from '#lib/template-preview.js';
  import { onMount } from 'svelte';

  const version = currentRelease.version;
  // The preview Runic.Application.Views.CsWebUi ships on a prerelease version
  // of its own.
  const csWebUiVersion =
    catalogRows.find((row) => row.name === 'Runic.Application.Views.CsWebUi')
      ?.version.value ?? version;

  // Prerequisites that depend on a choice. Every project needs the .NET 10 SDK.
  const requirements: Readonly<Record<string, { text: string; href: string }>> =
    {
      npm: {
        text: 'Node.js 24 with npm',
        href: 'https://nodejs.org/en/download',
      },
      pnpm: {
        text: 'Node.js 24 with pnpm 12',
        href: 'https://pnpm.io/installation',
      },
      bun: { text: 'Bun 1.4 or later', href: 'https://bun.sh' },
      cswebui: {
        text: 'A Chromium-based browser, or the platform WebView as a fallback',
        href: '/guides/application/choosing/#cs-webui-best-effort',
      },
      desktop: {
        text: 'WebView2 on Windows, WKWebView on macOS, or GTK 3 with WebKitGTK 4.1 on Linux',
        href: 'https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Desktop/README.md',
      },
      // Runic Desktop with --linux-gtk 4.
      'desktop-gtk4': {
        text: 'WebView2 on Windows, WKWebView on macOS, or GTK 4.12 with WebKitGTK 6.0 on Linux',
        href: 'https://github.com/Runic-Artifex/runic-sdk/blob/main/packages/dotnet/Runic.Desktop/README.md',
      },
    };

  let name = $state('MyApp');
  let selection = $state<Record<string, string>>(defaultSelection());
  let mode = $state<'creator' | 'template'>('creator');
  let activeFile = $state(0);
  let ready = $state(false);

  let validName = $derived(isValidProjectName(name));
  let projectName = $derived(validName ? name : 'MyApp');
  // A text parameter such as --application-id is passed only when it is
  // valid; an invalid value is shown as an error and left out.
  let validTexts = $derived(
    Object.fromEntries(
      creatorTexts.map((text) => {
        const value = textValue(text, selection);
        return [
          text.symbol,
          !value ||
            text.symbol !== 'applicationId' ||
            isValidApplicationId(value),
        ];
      }),
    ),
  );
  let effectiveSelection = $derived({
    ...selection,
    ...Object.fromEntries(
      creatorTexts
        .filter((text) => !validTexts[text.symbol])
        .map((text) => [text.symbol, '']),
    ),
  });
  let commands = $derived(
    creatorCommands(version, projectName, effectiveSelection),
  );
  let files = $derived(
    previewFiles(projectName, version, effectiveSelection, csWebUiVersion),
  );
  let shownOptions = $derived(
    creatorOptions.filter((option) => optionApplies(option, selection)),
  );
  let file = $derived(files[Math.min(activeFile, files.length - 1)]);
  let needs = $derived(
    shownOptions
      .map((option) => choiceFor(option, selection).value)
      .map(
        (value) =>
          requirements[
            value === 'desktop' && selection.linuxGtk === '4'
              ? 'desktop-gtk4'
              : value
          ],
      )
      .filter((entry) => entry !== undefined),
  );

  // Shareable links: ?frontend=svelte&host=desktop&tests=true selects those choices.
  onMount(() => {
    const query = new URLSearchParams(window.location.search);
    const requestedName = query.get('name');
    if (requestedName && isValidProjectName(requestedName))
      name = requestedName;
    for (const option of creatorOptions) {
      const value = query.get(option.flag.slice(2));
      if (value && option.choices.some((choice) => choice.value === value))
        selection[option.symbol] = value;
    }
    for (const toggle of creatorToggles) {
      const value = query.get(toggle.flag.slice(2));
      if (value === 'true' || value === 'false')
        selection[toggle.symbol] = value;
    }
    for (const text of creatorTexts) {
      const value = query.get(text.flag.slice(2));
      if (value) selection[text.symbol] = value;
    }
    ready = true;
  });

  $effect(() => {
    if (!ready) return;
    const query: [string, string][] = [];
    if (projectName !== 'MyApp') query.push(['name', projectName]);
    for (const option of shownOptions) {
      const value = choiceFor(option, selection).value;
      if (value !== option.defaultValue)
        query.push([option.flag.slice(2), value]);
    }
    for (const toggle of creatorToggles)
      if (selection[toggle.symbol] !== String(toggle.defaultValue))
        query.push([toggle.flag.slice(2), selection[toggle.symbol]]);
    for (const text of creatorTexts) {
      const value = textValue(text, effectiveSelection);
      if (value) query.push([text.flag.slice(2), value]);
    }
    const search =
      query.length > 0
        ? `?${query.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`
        : '';
    if (search !== window.location.search)
      history.replaceState(
        history.state,
        '',
        `${window.location.pathname}${search}`,
      );
  });

  function selectFile(event: KeyboardEvent) {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    activeFile = (activeFile + step + files.length) % files.length;
    document.getElementById(`preview-tab-${activeFile}`)?.focus();
  }
</script>

<svelte:head>
  <title>Create an app · Runic Artifex</title>
  <meta
    name="description"
    content="Choose a frontend, package manager, Window host and ViewModel library, then copy one command that creates your Runic application."
  />
  <meta property="og:title" content="Create an app · Runic Artifex" />
  <meta
    property="og:description"
    content="Choose your stack and copy one command that creates your Runic application."
  />
  <meta name="twitter:title" content="Create an app · Runic Artifex" />
  <meta
    name="twitter:description"
    content="Choose your stack and copy one command that creates your Runic application."
  />
</svelte:head>

<div class="shell">
  <div class="page-head">
    <h1>Put your app together.</h1>
    <p class="lede">
      Choose a frontend, package manager, Window host, and ViewModel library.
      The command below creates exactly this project. It makes the same choices <code
        >dnx Runic.Create</code
      > asks for in your terminal.
    </p>
    <p class="create-intro">
      The defaults, Runic Desktop and ReactiveUI, suit most apps.
      <a href={resolve('/guides/[...path]', { path: 'application/choosing' })}
        >Choosing a host and MVVM library</a
      > explains when to pick another.
    </p>
  </div>

  <section class="creator" aria-label="Project creator">
    <form class="creator-options" onsubmit={(event) => event.preventDefault()}>
      <label class="creator-field">
        <span class="creator-legend">Project name</span>
        <input
          class="creator-input"
          bind:value={name}
          autocomplete="off"
          spellcheck="false"
          aria-invalid={!validName}
          aria-describedby="project-name-help"
        />
        <span
          id="project-name-help"
          class={validName ? 'creator-help' : 'creator-help creator-error'}
        >
          {validName
            ? 'Also the folder, C# namespace, and frontend package name.'
            : "Start with a letter and use letters, digits, '.', '_' or '-'."}
        </span>
      </label>

      {#each shownOptions as option (option.symbol)}
        <fieldset class="creator-field">
          <legend class="creator-legend">{option.label}</legend>
          <p class="creator-help">{option.description}</p>
          <div class="choice-grid">
            {#each option.choices as choice (choice.value)}
              <label class="choice-card">
                <input
                  type="radio"
                  name={option.symbol}
                  value={choice.value}
                  bind:group={selection[option.symbol]}
                />
                <span class="choice-label"
                  >{choice.label}{#if choice.value === option.defaultValue}<small
                      >Default</small
                    >{/if}</span
                >
                <span class="choice-description">{choice.description}</span>
              </label>
            {/each}
          </div>
        </fieldset>
      {/each}

      {#each creatorToggles as toggle (toggle.symbol)}
        <fieldset class="creator-field">
          <legend class="creator-legend">{toggle.label}</legend>
          <div class="choice-grid">
            <label class="choice-card choice-card--toggle">
              <input
                type="checkbox"
                checked={selection[toggle.symbol] === 'true'}
                onchange={(event) =>
                  (selection[toggle.symbol] = String(
                    event.currentTarget.checked,
                  ))}
              />
              <span class="choice-label"><code>{toggle.flag}</code></span>
              <span class="choice-description">{toggle.description}</span>
            </label>
          </div>
        </fieldset>
      {/each}

      {#each creatorTexts as text (text.symbol)}
        <label class="creator-field">
          <span class="creator-legend"
            >{text.label} <code class="creator-flag">{text.flag}</code></span
          >
          <input
            class="creator-input"
            bind:value={selection[text.symbol]}
            placeholder={text.symbol === 'applicationId'
              ? 'org.example.Notes'
              : undefined}
            autocomplete="off"
            spellcheck="false"
            aria-invalid={!validTexts[text.symbol]}
            aria-describedby={`${text.symbol}-help`}
          />
          <span
            id={`${text.symbol}-help`}
            class={validTexts[text.symbol]
              ? 'creator-help'
              : 'creator-help creator-error'}
          >
            {validTexts[text.symbol]
              ? `${text.description} Optional.`
              : 'Use at least two dot-separated parts of ASCII letters and digits, each starting with a letter, at most 50 characters.'}
          </span>
        </label>
      {/each}
    </form>

    <div class="creator-output">
      <section class="creator-pane" aria-labelledby="creator-command-title">
        <div class="creator-pane__head">
          <h2 id="creator-command-title">Your command</h2>
          <p class="creator-help">For Runic SDK {version}.</p>
        </div>
        <div class="mode-tabs" role="radiogroup" aria-label="Command style">
          <label
            ><input
              type="radio"
              bind:group={mode}
              value="creator"
            />Runic.Create</label
          >
          <label
            ><input type="radio" bind:group={mode} value="template" />dotnet new</label
          >
        </div>
        {#if mode === 'creator'}
          <CommandBlock command={commands.creator} />
          <p class="creator-help">
            <code>dnx</code> runs the creator without installing it. It installs
            <code>Runic.Application.Templates</code> and runs
            <code>dotnet new runic-app</code>, then prints these commands again.
            Run <code>{commands.interactive}</code> to answer the questions in your
            terminal instead.
          </p>
        {:else}
          <CommandBlock command={`${commands.install}\n${commands.create}`} />
          <p class="creator-help">
            The template's own options. <code>dotnet new runic-app --help</code>
            lists them.
          </p>
        {/if}
        <div class="creator-group">
          <h3>Then run it</h3>
          <CommandBlock
            command={commands.nextSteps.join('\n')}
            label="Copy next steps"
          />
        </div>
        <div class="creator-group">
          <h3>Add a View later</h3>
          <CommandBlock
            command={`${viewCommand('Settings', effectiveSelection)}\n${viewCommand('Preferences', effectiveSelection, true)}`}
            label="Copy View commands"
          />
          <p class="creator-help">
            Run in the project directory. The <code>runic-view</code> item
            template comes with <code>Runic.Application.Templates</code> and
            adds a View, or with <code>--window</code> a Window, and its ViewModel;
            the next build writes its typed client.
          </p>
        </div>
        <div class="creator-group">
          <h3>You need</h3>
          <ul class="creator-needs">
            <li>
              <a href="https://dotnet.microsoft.com/download/dotnet/10.0"
                >The .NET 10 SDK</a
              >
            </li>
            {#each needs as need (need.text)}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- requirement links are external URLs or guide paths -->
              <li><a href={need.href} rel="external">{need.text}</a></li>
            {/each}
          </ul>
        </div>
      </section>

      <section class="creator-pane" aria-labelledby="creator-preview-title">
        <div class="creator-pane__head">
          <h2 id="creator-preview-title">Preview</h2>
          <p class="creator-help">
            Selected files from the template, rendered for your choices.
          </p>
        </div>
        <div class="file-tabs" role="tablist" aria-label="Generated files">
          {#each files as entry, index (entry.path)}
            <button
              id={`preview-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={index === activeFile}
              aria-controls="preview-panel"
              tabindex={index === activeFile ? 0 : -1}
              onclick={() => (activeFile = index)}
              onkeydown={selectFile}>{entry.path}</button
            >
          {/each}
        </div>
        <div
          id="preview-panel"
          class="file-preview"
          role="tabpanel"
          aria-labelledby={`preview-tab-${activeFile}`}
        >
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre
            class="code-block"
            tabindex="0"
            data-language={file.language}><code>{file.content}</code></pre>
        </div>
        <p class="creator-help">
          New to the Window and View model? Read
          <a href={resolve('/views')}>Window and View</a> or the
          <a href={resolve('/getting-started')}>getting-started guide</a>.
        </p>
      </section>
    </div>
  </section>
</div>

<style>
  .create-intro {
    max-width: 44rem;
    color: var(--rune-ink-soft);
  }

  .create-intro a {
    color: var(--rune-ink);
  }

  .creator {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: clamp(2rem, 4vw, 3.5rem);
    align-items: start;
    padding-top: 2.25rem;
    border-top: var(--rule);
  }

  .creator-options {
    display: grid;
    gap: 2rem;
  }

  .creator-field {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .creator-legend {
    padding: 0;
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .creator-help {
    color: var(--rune-ink-soft);
    font-size: var(--text-ui);
  }

  .creator-help code,
  .creator-help a {
    color: var(--rune-ink);
  }

  .creator-flag {
    margin-left: 0.35rem;
    color: var(--rune-ink-soft);
    font-size: var(--text-small);
    font-weight: 400;
  }

  .creator-error {
    color: var(--rune-paint);
  }

  .creator-input {
    height: 2.75rem;
    padding-inline: 0.85rem;
    border: var(--rule);
    border-radius: var(--radius-control);
    background: var(--rune-raised);
    color: var(--rune-ink);
    font: 500 1rem var(--rune-font-mono);
  }

  .creator-input:hover {
    border-color: var(--rune-ink-soft);
  }

  .creator-input[aria-invalid='true'] {
    border-color: var(--rune-paint);
  }

  /* Choices: a grid of groove-bordered options; the chosen one is inked. */
  .choice-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
    gap: 0.6rem;
    margin-top: 0.25rem;
  }

  .choice-card {
    position: relative;
    display: grid;
    align-content: start;
    gap: 0.25rem;
    padding: 0.85rem 2.5rem 0.9rem 1rem;
    border: 1px solid var(--rune-groove);
    border-radius: var(--radius-control);
    cursor: pointer;
  }

  .choice-card:hover {
    border-color: var(--rune-ink-soft);
  }

  .choice-card:has(input:checked) {
    border-color: var(--rune-ink);
    box-shadow: inset 0 0 0 0.5px var(--rune-ink);
  }

  .choice-card:has(input:focus-visible) {
    outline: 2px solid var(--rune-paint);
    outline-offset: 2px;
  }

  /* The indicator repeats the state in shape, not only in border weight. */
  .choice-card::after {
    position: absolute;
    top: 1rem;
    right: 0.9rem;
    width: 0.875rem;
    height: 0.875rem;
    border: 1px solid var(--rune-ink-soft);
    border-radius: 50%;
    content: '';
  }

  .choice-card--toggle::after {
    border-radius: 2px;
  }

  .choice-card:has(input:checked)::after {
    border-color: var(--rune-ink);
    background: var(--rune-ink);
    box-shadow: inset 0 0 0 2.5px var(--rune-stone);
  }

  .choice-card input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .choice-label {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    font-weight: 600;
  }

  .choice-label small {
    color: var(--rune-ink-soft);
    font-size: var(--text-small);
    font-weight: 400;
  }

  .choice-description {
    color: var(--rune-ink-soft);
    font-size: var(--text-small);
    line-height: 1.45;
  }

  /* Output */
  .creator-output {
    position: sticky;
    top: 1.5rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .creator-pane {
    --code-ground: var(--rune-stone);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: clamp(1rem, 2.5vw, 1.5rem);
    border: var(--rule);
    border-radius: var(--radius-pane);
    background: var(--rune-raised);
  }

  .creator-pane__head {
    display: grid;
    gap: 0.25rem;
  }

  .creator-pane h2 {
    font-size: 1.375rem;
  }

  .creator-group {
    display: grid;
    gap: 0.5rem;
  }

  .creator-group h3 {
    font-size: 1rem;
  }

  .mode-tabs {
    display: inline-flex;
    justify-self: start;
    border: var(--rule);
    border-radius: var(--radius-control);
  }

  .mode-tabs label {
    position: relative;
    padding: 0.35rem 0.85rem;
    color: var(--rune-ink-soft);
    font: 500 var(--text-small) var(--rune-font-mono);
    cursor: pointer;
  }

  .mode-tabs label + label {
    border-left: var(--rule);
  }

  .mode-tabs label:first-child {
    border-radius: 3px 0 0 3px;
  }

  .mode-tabs label:last-child {
    border-radius: 0 3px 3px 0;
  }

  .mode-tabs label:has(input:checked) {
    background: var(--rune-ink);
    color: var(--rune-stone);
  }

  .mode-tabs label:has(input:focus-visible) {
    z-index: 1;
    outline: 2px solid var(--rune-paint);
    outline-offset: 2px;
  }

  .mode-tabs input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .creator-needs {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding-left: 1.2rem;
    font-size: var(--text-ui);
    list-style: disc;
  }

  .creator-needs li::marker {
    color: var(--rune-ink-soft);
  }

  .file-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0 1.1rem;
    border-bottom: var(--rule);
  }

  .file-tabs button {
    position: relative;
    padding: 0.4rem 0 0.55rem;
    border: 0;
    background: transparent;
    color: var(--rune-ink-soft);
    font: 500 0.8125rem var(--rune-font-mono);
    cursor: pointer;
  }

  .file-tabs button:hover {
    color: var(--rune-ink);
  }

  .file-tabs button[aria-selected='true'] {
    color: var(--rune-ink);
  }

  .file-tabs button[aria-selected='true']::after {
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 2px;
    background: var(--rune-paint);
    content: '';
  }

  .file-preview pre {
    max-height: 30rem;
    margin: 0;
    overflow: auto;
    font-size: 0.8125rem;
  }

  @media (max-width: 60rem) {
    .creator {
      grid-template-columns: minmax(0, 1fr);
    }

    .creator-output {
      position: static;
    }
  }
</style>
