<script lang="ts">
  import { resolve } from '$app/paths';
  import '@fontsource/cormorant/500.css';
  import '@fontsource/cormorant/600.css';
  import '@fontsource-variable/geist';
  import type { Snippet } from 'svelte';
  import '../app.css';

  let { children }: { children: Snippet } = $props();
  const home = resolve('/');
</script>

<a class="skip-link" href="#content">Skip to content</a>
<header class="site-header">
  <div class="shell site-header__inner">
    <a class="brand-link" href={home} aria-label="Runic Artifex home">
      <img src="/icon.png" alt="" aria-hidden="true" />
      <span>
        <strong>Runic Artifex</strong>
        <small>Independent tools. Explicit seams.</small>
      </span>
    </a>
    <nav aria-label="Primary navigation">
      <a href={resolve('/#principles')}>Principles</a>
      <a href={resolve('/#products')}>Products</a>
      <a href={resolve('/#integrations')}>Integrations</a>
      <a href={resolve('/ci/')}>CI status</a>
      <a href="https://github.com/Runic-Artifex">GitHub</a>
      <a class="nav-cta" href="https://docs.runic-artifex.eu/">Documentation</a>
    </nav>
  </div>
</header>

<main id="content" tabindex="-1">
  {@render children()}
</main>

<footer class="site-footer">
  <div class="shell site-footer__inner">
    <div class="site-footer__brand">
      <img src="/icon.png" alt="" aria-hidden="true" />
      <div>
        <strong>Runic Artifex</strong>
        <p>Focused open-source .NET tools that compose on your terms.</p>
      </div>
    </div>
    <div class="site-footer__links">
      <a href="https://docs.runic-artifex.eu/">Documentation</a>
      <a href="https://docs.runic-artifex.eu/packages/">Packages</a>
      <a href="https://docs.runic-artifex.eu/releases/">Release status</a>
      <a href={resolve('/ci/')}>CI status</a>
      <a href="https://github.com/Runic-Artifex">GitHub</a>
    </div>
    <p class="site-footer__legal">MIT licensed · Built in the open</p>
  </div>
</footer>
