<script lang="ts">
  import { resolve } from '$app/paths';
  import Lockup from '$lib/brand/Lockup.svelte';
  import '@fontsource-variable/schibsted-grotesk';
  import '@fontsource-variable/spline-sans-mono';
  import type { Snippet } from 'svelte';
  import '../app.css';

  let { children }: { children: Snippet } = $props();
  const docs = 'https://docs.runic-artifex.eu';
</script>

<a class="skip-link" href="#content">Skip to content</a>

<header class="site-header page">
  <a
    class="site-header__home"
    href={resolve('/')}
    aria-label="Runic Artifex home"
  >
    <Lockup />
  </a>
  <nav aria-label="Primary navigation">
    <a rel="external" href={`${docs}/guides/`}>Guides</a>
    <a rel="external" href={`${docs}/api/`}>API</a>
    <a rel="external" href="https://github.com/Runic-Artifex">GitHub</a>
    <a rel="external" class="site-header__docs" href={`${docs}/`}
      >Documentation</a
    >
  </nav>
</header>

<main id="content" tabindex="-1">
  {@render children()}
</main>

<footer class="site-footer">
  <div class="page site-footer__inner">
    <div class="site-footer__about">
      <Lockup />
      <p>
        Open-source .NET tools for desktop applications, translations and
        command lines. MIT licensed.
      </p>
    </div>
    <nav class="site-footer__links" aria-label="Footer">
      <a rel="external" href={`${docs}/getting-started/`}>Getting started</a>
      <a rel="external" href={`${docs}/packages/`}>Packages</a>
      <a rel="external" href={`${docs}/releases/`}>Release notes</a>
      <a rel="external" href={`${docs}/support/`}>Supported platforms</a>
      <a rel="external" href="https://github.com/Runic-Artifex">GitHub</a>
    </nav>
    <div class="site-footer__notes">
      <p>
        <a rel="external" href="https://github.com/Runic-Artifex/cs-webui"
          >CS-WebUI</a
        >, a .NET binding for WebUI, is a separate related project.
      </p>
      <p>
        Runic Flow is retired; its <a
          rel="external"
          href={`${docs}/products/runic-flow/`}>archive page</a
        > explains how to move to Runic Application.
      </p>
    </div>
  </div>
</footer>

<style>
  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    min-height: 5.5rem;
  }

  .site-header__home {
    display: inline-flex;
    padding-block: 0.5rem;
    text-decoration: none;
  }

  nav {
    display: flex;
    align-items: center;
    gap: clamp(1rem, 2.4vw, 2rem);
    font-size: 0.9375rem;
    font-weight: 500;
  }

  nav a {
    text-decoration: none;
  }

  nav a:hover {
    color: var(--rune-paint);
  }

  .site-header__docs {
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--rune-groove);
    border-radius: var(--radius-control);
  }

  .site-header__docs:hover {
    border-color: currentColor;
  }

  @media (max-width: 40rem) {
    .site-header {
      flex-wrap: wrap;
      gap: 0.25rem 1.5rem;
      padding-block: 1rem;
    }

    .site-header nav a:not(.site-header__docs):first-child {
      display: none;
    }
  }

  .site-footer {
    margin-top: var(--space-section);
    padding-block: 3.5rem 4rem;
    border-top: 1px solid var(--rune-groove);
    font-size: 0.9375rem;
  }

  .site-footer__inner {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 2.5rem;
  }

  .site-footer__about {
    display: grid;
    align-content: start;
    gap: 1.1rem;
  }

  .site-footer p {
    max-width: 32rem;
    color: var(--rune-ink-soft);
  }

  .site-footer__links {
    display: grid;
    align-content: start;
    gap: 0.55rem;
    font-weight: 400;
  }

  .site-footer__notes {
    display: grid;
    align-content: start;
    gap: 0.8rem;
  }

  .site-footer__notes a {
    color: var(--rune-ink);
  }

  @media (max-width: 52rem) {
    .site-footer__inner {
      grid-template-columns: 1fr;
    }
  }
</style>
