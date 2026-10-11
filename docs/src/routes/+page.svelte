<script lang="ts">
  import { resolve } from '$app/paths';
  import ActionLink from '#lib/components/ActionLink.svelte';
  import CreatorHero from '#lib/components/CreatorHero.svelte';
  import ProductCard from '#lib/components/ProductCard.svelte';
  import { Badge } from '#lib/components/ui/badge/index.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Separator } from '#lib/components/ui/separator/index.js';
  import { activeProducts } from '#lib/docs-data.js';
  import { currentRelease, releaseSummary } from '#lib/release-docs.js';

  // One start page for each kind of reader.
  const personas = [
    {
      title: 'A desktop app with a web frontend',
      text: 'Create a Window with .NET ViewModels and a React, Vue, Svelte or Angular frontend.',
      path: 'application/getting-started',
      label: 'Get started',
    },
    {
      title: 'An existing WPF app',
      text: 'Keep your shell and adopt Translations, navigation and web Views one screen at a time.',
      path: 'application/migrations/wpf-incremental',
      label: 'Adopt Runic in WPF',
    },
    {
      title: 'A command-line tool',
      text: 'Turn typed C# methods into commands with help, validation and JSON output.',
      path: 'command-line',
      label: 'Get started with Command Line',
    },
    {
      title: 'Translations for .NET or the web',
      text: 'Compile message files into typed C# and TypeScript APIs.',
      path: 'translations',
      label: 'Get started with Translations',
    },
  ] as const;
</script>

<svelte:head>
  <title>Runic SDK for .NET and TypeScript applications · Runic Artifex</title>
  <meta
    name="description"
    content="Open-source .NET tools for desktop and browser UI, application hosting, assets, localization, and command-line applications."
  />
  <meta
    property="og:title"
    content="Runic SDK for .NET and TypeScript applications · Runic Artifex"
  />
  <meta
    property="og:description"
    content="Open-source .NET tools for desktop and browser UI, application hosting, assets, localization, and command-line applications."
  />
  <meta
    name="twitter:title"
    content="Runic SDK for .NET and TypeScript applications · Runic Artifex"
  />
  <meta
    name="twitter:description"
    content="Open-source .NET tools for desktop and browser UI, application hosting, assets, localization, and command-line applications."
  />
</svelte:head>

<div>
  <CreatorHero version={currentRelease.version} />

  <section class="section shell" aria-labelledby="start-here">
    <div class="section-heading">
      <p class="eyebrow">Start here</p>
      <h2 id="start-here">Pick the path for what you are building.</h2>
      <p>
        Each start page explains the concepts it needs and leads on from there.
      </p>
    </div>
    <div class="persona-grid">
      {#each personas as persona (persona.path)}
        <Card.Root class="persona-card">
          <Card.Header>
            <Card.Title><h3>{persona.title}</h3></Card.Title>
            <Card.Description>{persona.text}</Card.Description>
          </Card.Header>
          <Card.Content>
            <a
              class="text-link"
              href={resolve('/guides/[...path]', { path: persona.path })}
              >{persona.label} →</a
            >
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  </section>

  <section class="section shell">
    <div class="section-heading split-heading">
      <div>
        <p class="eyebrow">Find your starting point</p>
        <h2>Start with one focused product.</h2>
        <p>
          Begin with the problem you need to solve. Add another Runic product
          only when your application needs it.
        </p>
      </div>
      <a class="text-link" href={resolve('/products')}>Compare all products →</a
      >
    </div>
    <div class="product-grid">
      {#each activeProducts as product (product.slug)}
        <ProductCard {product} label={`Explore ${product.shortName}`} />
      {/each}
    </div>
  </section>

  <section class="section shell">
    <Card.Root class="principle-panel">
      <div>
        <p class="eyebrow">Made to compose</p>
        <h2>Connect products without coupling their cores.</h2>
      </div>
      <p>
        The Runic SDK repository contains SDK libraries, tools, templates and
        examples. Its package set releases together through NuGet and npm.
        Command Line and Translations, including Translations Editor, will
        release independently. Official integrations can connect a product to
        another product, framework, or tool; the product cores do not depend
        back on those integrations.
      </p>
      <p>
        Application Views defines explicit Window and View contracts and emits
        ordinary TypeScript clients. Frontend frameworks render their
        components; .NET owns logical Views and ViewModel scopes.
      </p>
      <ActionLink href={resolve('/architecture')} variant="outline"
        >Read the architecture guide</ActionLink
      >
    </Card.Root>
  </section>

  <Separator class="shell" />
  <section class="section shell launch-strip">
    <div>
      <Badge variant="outline" class="mb-4 border-primary/30 text-primary"
        >Published SDK</Badge
      >
      <h2>Install the published SDK.</h2>
      <p>
        {releaseSummary}
      </p>
    </div>
    <ActionLink href={resolve('/releases')} variant="outline"
      >Read release notes</ActionLink
    >
  </section>
</div>
