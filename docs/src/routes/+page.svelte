<script lang="ts">
  import { resolve } from '$app/paths';
  import Mark from '#lib/brand/Mark.svelte';
  import CommandBlock from '#lib/components/CommandBlock.svelte';
  import SearchForm from '#lib/components/SearchForm.svelte';
  import { creatorCommands } from '#lib/creator.js';
  import { activeProducts } from '#lib/docs-data.js';
  import { currentRelease } from '#lib/release-docs.js';

  const description =
    'Open-source .NET tools for desktop and browser UI, application hosting, assets, localization, and command-line applications.';
  const title =
    'Runic SDK for .NET and TypeScript applications · Runic Artifex';
  const createCommand = creatorCommands(
    currentRelease.version,
    'MyApp',
    {},
  ).interactive;

  // One start page for each kind of reader.
  const personas = [
    {
      title: 'A desktop app with a web frontend',
      text: 'Create a Window with .NET ViewModels and a React, Vue, Svelte or Angular frontend.',
      path: 'application/getting-started',
    },
    {
      title: 'An existing WPF app',
      text: 'Keep your shell and adopt Translations, navigation and web Views one screen at a time.',
      path: 'application/migrations/wpf-incremental',
    },
    {
      title: 'A command-line tool',
      text: 'Turn typed C# methods into commands with help, validation and JSON output.',
      path: 'command-line',
    },
    {
      title: 'Translations for .NET or the web',
      text: 'Compile message files into typed C# and TypeScript APIs.',
      path: 'translations',
    },
  ] as const;

  const reference = [
    {
      href: resolve('/packages'),
      title: 'Packages',
      text: 'Install commands for every published SDK package, grouped by goal.',
    },
    {
      href: resolve('/api'),
      title: 'API reference',
      text: 'Types and members of the published .NET and npm packages.',
    },
    {
      href: resolve('/releases'),
      title: 'Releases',
      text: 'Published SDK versions, release notes and upgrade guidance.',
    },
    {
      href: resolve('/support'),
      title: 'Supported platforms',
      text: 'Runtime identifiers per Window host, and what target machines need.',
    },
    {
      href: resolve('/architecture'),
      title: 'Architecture',
      text: 'How each product stands alone and how integrations connect them.',
    },
    {
      href: resolve('/views'),
      title: 'Window and View',
      text: 'Typed .NET Windows and Views with generated TypeScript clients.',
    },
  ];
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>

<div class="shell">
  <div class="home-head">
    <h1>Runic documentation</h1>
    <p class="lede">
      Guides and reference for building .NET applications with Runic: native
      windows with a web frontend, assets, translations and command-line tools.
    </p>
    <SearchForm
      id="home-search"
      large
      placeholder="Search guides, products and API"
    />
    <p class="home-release">
      Runic SDK <strong>{currentRelease.version}</strong> is published on NuGet
      and npm. <a href={resolve('/releases')}>Read the release notes</a>
    </p>
  </div>

  <section class="home-section" aria-labelledby="start-here">
    <h2 id="start-here">Start here</h2>
    <ul class="start-paths">
      {#each personas as persona (persona.path)}
        <li>
          <h3>
            <a href={resolve('/guides/[...path]', { path: persona.path })}
              >{persona.title}</a
            >
          </h3>
          <p>{persona.text}</p>
        </li>
      {/each}
    </ul>
  </section>

  <section class="home-section" aria-labelledby="create-app">
    <h2 id="create-app">Create an app</h2>
    <div class="home-create">
      <p>
        The guided creator asks for a frontend, package manager, window host and
        ViewModel library, then creates the project. It needs the .NET 10 SDK.
      </p>
      <CommandBlock command={createCommand} />
      <p>
        <a href={resolve('/create')}>Choose every option in the browser</a>
        or follow the
        <a href={resolve('/getting-started')}>getting-started guide</a>.
      </p>
    </div>
  </section>

  <section class="home-section" aria-labelledby="products">
    <h2 id="products">Products</h2>
    <div>
      <ul class="rows product-rows">
        {#each activeProducts as product (product.slug)}
          <li>
            <Mark name={product.mark} class="product-rows__mark" />
            <div class="product-rows__text">
              <h3>
                <a href={resolve('/products/[slug]', { slug: product.slug })}
                  >{product.name}</a
                >
              </h3>
              <p>{product.summary}</p>
            </div>
            <p class="product-rows__links">
              {#if product.guides?.length}
                <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- guide links are site paths or external URLs -->
                <a href={product.guides[0].href}>{product.guides[0].label}</a>
              {/if}
              <a href={product.source}>Source</a>
            </p>
          </li>
        {/each}
      </ul>
      <p class="home-more">
        <a href={resolve('/products')}>Compare all products</a>, including the
        retired Runic Flow and the source-only Translations Editor.
      </p>
    </div>
  </section>

  <section class="home-section" aria-labelledby="reference">
    <h2 id="reference">Reference</h2>
    <ul class="reference-list">
      {#each reference as entry (entry.href)}
        <li>
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
          <a href={entry.href}>{entry.title}</a>
          <p>{entry.text}</p>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  .home-head {
    display: grid;
    justify-items: start;
    gap: 1.1rem;
    padding-block: clamp(2.5rem, 6vw, 4.5rem) clamp(2.5rem, 5vw, 3.5rem);
  }

  .home-head :global(.search-form) {
    width: 100%;
    margin-top: 0.75rem;
  }

  .home-release {
    color: var(--rune-ink-soft);
    font-size: var(--text-ui);
  }

  .home-release strong {
    color: var(--rune-ink);
    font-family: var(--rune-font-mono);
    font-size: 0.9em;
    font-weight: 500;
  }

  .home-release a {
    color: var(--rune-ink);
  }

  .home-section {
    display: grid;
    grid-template-columns: minmax(0, 13rem) minmax(0, 1fr);
    gap: 1.25rem clamp(2rem, 5vw, 5rem);
    padding-block: 2.5rem;
    border-top: var(--rule);
  }

  .home-section > h2 {
    font-size: 1.5rem;
  }

  /* Start paths: a two-by-two list divided by grooves */

  .start-paths {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 clamp(2rem, 4vw, 3.5rem);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .start-paths li {
    display: grid;
    align-content: start;
    gap: 0.35rem;
    padding-block: 0 1.75rem;
  }

  .start-paths li:nth-child(n + 3) {
    padding-top: 1.5rem;
    border-top: var(--rule);
  }

  .start-paths h3 a,
  .product-rows h3 a,
  .reference-list a {
    text-decoration: none;
  }

  .start-paths h3 a:hover,
  .product-rows h3 a:hover,
  .reference-list a:hover {
    text-decoration: underline;
    text-decoration-color: var(--rune-paint);
    text-decoration-thickness: 2px;
  }

  .start-paths p,
  .product-rows p,
  .reference-list p {
    max-width: 34rem;
    color: var(--rune-ink-soft);
  }

  /* Creator */

  .home-create {
    display: grid;
    gap: 1rem;
    max-width: 44rem;
  }

  .home-create p:first-child {
    color: var(--rune-ink-soft);
  }

  /* Products */

  .product-rows > li {
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr) auto;
    gap: 1.25rem;
    align-items: start;
    padding-block: 1.25rem;
  }

  .product-rows > li:first-child {
    padding-top: 0;
    border-top: 0;
  }

  .product-rows :global(.product-rows__mark) {
    width: 2.75rem;
    height: 2.75rem;
  }

  .product-rows__text {
    display: grid;
    gap: 0.3rem;
  }

  .product-rows__links {
    display: flex;
    gap: 1.25rem;
    padding-top: 0.15rem;
    font-size: var(--text-ui);
    white-space: nowrap;
  }

  .product-rows .product-rows__links {
    color: var(--rune-ink);
  }

  .home-more {
    margin-top: 1.25rem;
    color: var(--rune-ink-soft);
    font-size: var(--text-ui);
  }

  .home-more a {
    color: var(--rune-ink);
  }

  /* Reference */

  .reference-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 clamp(2rem, 4vw, 3rem);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .reference-list li {
    display: grid;
    align-content: start;
    gap: 0.3rem;
    padding-block: 0 1.5rem;
  }

  .reference-list li:nth-child(n + 4) {
    padding-top: 1.25rem;
    border-top: var(--rule);
  }

  .reference-list a {
    justify-self: start;
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .reference-list p {
    font-size: var(--text-ui);
  }

  @media (max-width: 70rem) {
    .reference-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .reference-list li:nth-child(n + 3) {
      padding-top: 1.25rem;
      border-top: var(--rule);
    }

    .product-rows > li {
      grid-template-columns: 2.5rem minmax(0, 1fr);
    }

    .product-rows :global(.product-rows__mark) {
      width: 2.5rem;
      height: 2.5rem;
    }

    .product-rows__links {
      grid-column: 2;
      flex-wrap: wrap;
      white-space: normal;
    }
  }

  @media (max-width: 52rem) {
    .home-section {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 40rem) {
    .start-paths,
    .reference-list {
      grid-template-columns: minmax(0, 1fr);
    }

    .start-paths li:nth-child(n + 2),
    .reference-list li:nth-child(n + 2) {
      padding-top: 1.25rem;
      border-top: var(--rule);
    }
  }
</style>
