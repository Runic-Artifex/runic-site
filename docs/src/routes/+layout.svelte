<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import {
    applyThemeMode,
    readThemeMode,
    saveThemeMode,
    subscribeSystemScheme,
    type ThemeMode,
  } from '#lib/appearance.js';
  import Lockup from '#lib/brand/Lockup.svelte';
  import AppearanceMenu from '#lib/components/AppearanceMenu.svelte';
  import * as Sheet from '#lib/components/ui/sheet/index.js';
  import '@fontsource-variable/schibsted-grotesk';
  import '@fontsource-variable/spline-sans-mono';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import SearchIcon from '@lucide/svelte/icons/search';
  import { onMount, type Snippet } from 'svelte';
  import './layout.css';
  import '../app.css';

  let { children }: { children: Snippet } = $props();
  let mobileOpen = $state(false);
  let themeMode = $state<ThemeMode>('system');

  const navigation = [
    { href: '/getting-started', label: 'Start' },
    { href: '/create', label: 'Create' },
    { href: '/guides', label: 'Guides' },
    { href: '/products', label: 'Products' },
    { href: '/views', label: 'Window and View' },
    { href: '/architecture', label: 'Architecture' },
    { href: '/packages', label: 'Packages' },
    { href: '/api', label: 'API' },
    { href: '/releases', label: 'Releases' },
  ] as const;

  function navHref(href: (typeof navigation)[number]['href']) {
    // The guide index is the empty rest parameter of /guides/[...path].
    return href === '/guides'
      ? resolve('/guides/[...path]', { path: '' })
      : resolve(href);
  }

  function isCurrent(href: (typeof navigation)[number]['href']) {
    return page.url.pathname.startsWith(href);
  }

  function changeThemeMode(mode: ThemeMode): void {
    themeMode = mode;
    saveThemeMode(themeMode);
  }

  onMount(() => {
    themeMode = readThemeMode();
    applyThemeMode(themeMode);
    return subscribeSystemScheme(() => themeMode);
  });
</script>

<svelte:head>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/icon.png" type="image/png" />
  <link rel="apple-touch-icon" href="/icon.png" />
  <link rel="canonical" href={`${page.url.origin}${page.url.pathname}`} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={`${page.url.origin}${page.url.pathname}`} />
  <meta property="og:site_name" content="Runic Artifex Documentation" />
  <meta property="og:image" content={`${page.url.origin}/og.png`} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Runic Artifex documentation" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={`${page.url.origin}/og.png`} />
</svelte:head>

<a class="skip-link" href="#content">Skip to content</a>
<header class="site-header">
  <div class="shell header-inner">
    <a
      class="brand"
      href={resolve('/')}
      aria-label="Runic Artifex documentation home"
    >
      <Lockup descriptor="Documentation" />
    </a>

    <nav class="desktop-nav" aria-label="Primary navigation">
      {#each navigation as item (item.href)}
        <a
          href={navHref(item.href)}
          aria-current={isCurrent(item.href) ? 'page' : undefined}
          >{item.label}</a
        >
      {/each}
    </nav>

    <div class="header-tools">
      <a
        class="header-search"
        href={resolve('/search')}
        aria-label="Search the documentation"
        aria-current={page.url.pathname.startsWith('/search')
          ? 'page'
          : undefined}
      >
        <SearchIcon aria-hidden="true" />
        <span>Search</span>
      </a>
      <div class="desktop-appearance">
        <AppearanceMenu
          mode={themeMode}
          compact
          onmodechange={changeThemeMode}
        />
      </div>

      <noscript>
        <details class="noscript-nav">
          <summary>Navigation</summary>
          <nav aria-label="Mobile navigation without JavaScript">
            {#each navigation as item (item.href)}
              <a
                href={navHref(item.href)}
                aria-current={isCurrent(item.href) ? 'page' : undefined}
                >{item.label}</a
              >
            {/each}
          </nav>
        </details>
      </noscript>

      <Sheet.Root bind:open={mobileOpen}>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              class="icon-button mobile-menu-button"
              type="button"
              aria-label="Open documentation navigation"
            >
              <MenuIcon aria-hidden="true" />
            </button>
          {/snippet}
        </Sheet.Trigger>
        <Sheet.Content side="right" class="w-[min(88vw,22rem)] gap-0">
          <Sheet.Header class="border-b border-border px-5 pt-5 pb-4">
            <Sheet.Title class="text-lg font-semibold"
              >Documentation</Sheet.Title
            >
            <Sheet.Description class="text-muted-foreground">
              Guides, products, packages and release notes.
            </Sheet.Description>
          </Sheet.Header>
          <nav class="mobile-nav" aria-label="Mobile navigation">
            {#each navigation as item (item.href)}
              <a
                href={navHref(item.href)}
                aria-current={isCurrent(item.href) ? 'page' : undefined}
                onclick={() => (mobileOpen = false)}>{item.label}</a
              >
            {/each}
          </nav>
          <div class="sheet-tools">
            <AppearanceMenu mode={themeMode} onmodechange={changeThemeMode} />
            <a href="https://runic-artifex.eu/">Runic Artifex website</a>
            <a href="https://github.com/Runic-Artifex">GitHub organization</a>
          </div>
        </Sheet.Content>
      </Sheet.Root>
    </div>
  </div>
</header>

<main id="content" tabindex="-1">{@render children()}</main>

<footer class="site-footer">
  <div class="shell footer-grid">
    <div class="footer-about">
      <p class="footer-name">Runic Artifex</p>
      <p>
        Open-source .NET libraries, tools and application guides, built with
        NativeAOT in mind.
      </p>
    </div>
    <nav class="footer-links" aria-labelledby="footer-explore">
      <h2 id="footer-explore">Explore</h2>
      <a href={resolve('/products')}>Products</a>
      <a href={resolve('/packages')}>Package catalog</a>
      <a href={resolve('/support')}>Supported platforms</a>
      <a href={resolve('/support/policy')}>Support policy</a>
      <a href={resolve('/architecture')}>Architecture</a>
    </nav>
    <nav class="footer-links" aria-labelledby="footer-project">
      <h2 id="footer-project">Project</h2>
      <a href="https://runic-artifex.eu/">Runic Artifex website</a>
      <a href="https://github.com/Runic-Artifex">GitHub organization</a>
      <a href={resolve('/releases')}>Release notes</a>
      <a
        href={resolve('/guides/[...path]', {
          path: 'application/contributing',
        })}>Contributing</a
      >
      <a href="https://github.com/Runic-Artifex/.github/blob/main/SECURITY.md"
        >Security</a
      >
    </nav>
  </div>
  <div class="shell footer-bottom">
    <span>© 2026 Runic Artifex</span>
    <span>MIT licensed where possible. Preview documentation.</span>
  </div>
</footer>
