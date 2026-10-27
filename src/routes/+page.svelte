<script lang="ts">
  import Mark from '#lib/brand/Mark.svelte';
  import CreateCommand from '#lib/components/CreateCommand.svelte';
  import Seam from '#lib/components/Seam.svelte';
  import { productGroups } from '#lib/products.js';

  const docs = 'https://docs.runic-artifex.eu';
  const title =
    'Runic Artifex: desktop applications in C# with your web frontend';
  const description =
    'Runic generates typed TypeScript clients for .NET ViewModels and opens React, Vue, Svelte or Angular frontends in native windows on Windows, macOS and Linux.';

  const platforms = [
    {
      name: 'Windows',
      webview: 'WebView2',
      needs:
        'Windows 11 or a supported Windows 10, with the Edge WebView2 Runtime',
    },
    { name: 'macOS', webview: 'WKWebView', needs: 'macOS 15 or newer' },
    {
      name: 'Linux',
      webview: 'WebKitGTK',
      needs: 'GTK 3 with WebKitGTK 4.1, or GTK 4.12 with WebKitGTK 6.0',
    },
  ];

  const starts = [
    {
      title: 'A new desktop application',
      text: 'Create a project from the template, run it, and change the counter into your first screen.',
      href: `${docs}/getting-started/`,
    },
    {
      title: 'An existing WPF application',
      text: 'Keep your shell and replace one view at a time with a web View driven by the same ViewModel.',
      href: `${docs}/guides/application/migrations/wpf-incremental/`,
    },
    {
      title: 'A command-line tool',
      text: 'Write commands as typed C# methods and publish a NativeAOT executable.',
      href: `${docs}/products/runic-command-line/`,
    },
    {
      title: 'Messages to translate',
      text: 'Compile MessageFormat 2 files into typed APIs for .NET, Vite or SvelteKit.',
      href: `${docs}/products/runic-translations/`,
    },
  ];
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href="https://runic-artifex.eu/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Runic Artifex" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content="https://runic-artifex.eu/" />
  <meta property="og:image" content="https://runic-artifex.eu/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta
    property="og:image:alt"
    content="The Runic wordmark and the line: Desktop applications with C# logic and the web frontend you know."
  />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content="https://runic-artifex.eu/og.png" />
</svelte:head>

<section class="hero page" aria-labelledby="hero-title">
  <h1 id="hero-title">
    Your C# ViewModels, rendered by React, Vue, Svelte or Angular.
  </h1>
  <div class="hero__body">
    <p class="hero__lede">
      Runic generates a typed TypeScript client for each .NET View and opens
      your frontend in a native window on Windows, macOS and Linux.
    </p>
    <div class="hero__start">
      <CreateCommand />
      <p class="hero__note">
        Needs the .NET 10 SDK. The creator asks for your frontend, package
        manager, window host and MVVM library.
      </p>
      <div class="hero__actions">
        <a
          rel="external"
          class="action action--primary"
          href={`${docs}/getting-started/`}>Read the getting-started guide</a
        >
        <a rel="external" class="action action--quiet" href={`${docs}/create/`}
          >Choose your stack in the browser</a
        >
      </div>
    </div>
  </div>
</section>

<div class="stage page">
  <Seam />
</div>

<section id="products" class="products page" aria-labelledby="products-title">
  <div class="section-head">
    <h2 id="products-title">Use one part, or all of them.</h2>
    <p>
      Each product has its own packages and guide. Official integrations connect
      them, and no product's core depends on another's.
    </p>
  </div>

  {#each productGroups as group (group.name)}
    {@const headingId = `group-${group.name.toLowerCase().replaceAll(' ', '-')}`}
    <section class="group" aria-labelledby={headingId}>
      <header class="group__head">
        <h3 id={headingId}>
          <a rel="external" href={group.repository}>{group.name}</a>
        </h3>
        <p>{group.summary}</p>
      </header>
      <ul class="group__products">
        {#each group.products as product (product.slug)}
          <li class="product">
            <Mark name={product.mark} class="product__mark" />
            <div class="product__text">
              <h4>{product.name}</h4>
              <p>{product.description}</p>
            </div>
            <div class="product__links">
              <a rel="external" href={product.docs}>Read the guide</a>
              <a rel="external" href={product.source}>Source</a>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</section>

<section
  id="platforms"
  class="platforms page"
  aria-labelledby="platforms-title"
>
  <div class="section-head">
    <h2 id="platforms-title">A native window on each platform.</h2>
    <p>
      Runic Desktop uses the WebView the system already provides, so your
      application does not ship a browser engine of its own.
    </p>
  </div>
  <dl class="platforms__list">
    {#each platforms as platform (platform.name)}
      <div class="platform">
        <dt>{platform.name}</dt>
        <dd class="platform__webview">{platform.webview}</dd>
        <dd class="platform__needs">{platform.needs}</dd>
      </div>
    {/each}
  </dl>
  <p class="platforms__note">
    CI verifies win-x64, osx-arm64 and linux-x64. Publish with NativeAOT for one
    native executable per platform, or choose CS-WebUI to open the frontend in a
    browser window instead. <a rel="external" href={`${docs}/support/`}
      >See every supported platform</a
    >.
  </p>
</section>

<section id="start" class="start page" aria-labelledby="start-title">
  <div class="section-head">
    <h2 id="start-title">Start from what you have.</h2>
  </div>
  <ul class="start__paths">
    {#each starts as start (start.href)}
      <li>
        <a rel="external" href={start.href}>
          <span class="start__title">{start.title}</span>
          <span class="start__text">{start.text}</span>
        </a>
      </li>
    {/each}
  </ul>
  <p class="start__examples">
    Prefer to read code first? The <a
      rel="external"
      href="https://github.com/Runic-Artifex/runic-sdk/tree/main/examples"
      >SDK examples</a
    > include a first window, several windows, nested Views, DynamicData collections
    and WPF hosting.
  </p>
</section>

<style>
  /* Hero */
  .hero {
    display: grid;
    gap: clamp(1.75rem, 3vw, 2.5rem);
    padding-block: clamp(2.5rem, 7vw, 5.5rem) clamp(2.5rem, 5vw, 4rem);
  }

  .hero h1 {
    max-width: 17ch;
  }

  .hero__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    gap: 1.5rem clamp(2rem, 6vw, 5rem);
    align-items: start;
  }

  .hero__lede {
    max-width: 30rem;
    font-size: var(--text-lede);
    line-height: 1.5;
    color: var(--rune-ink-soft);
  }

  .hero__start {
    display: grid;
    gap: 0.9rem;
  }

  .hero__note {
    max-width: 30rem;
    font-size: 0.9375rem;
    color: var(--rune-ink-soft);
  }

  .hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.4rem;
  }

  @media (max-width: 52rem) {
    .hero__body {
      grid-template-columns: 1fr;
    }
  }

  .stage {
    width: min(86rem, 100% - 2 * var(--gutter));
    padding-bottom: var(--space-section);
  }

  /* Products */
  .products {
    display: grid;
    gap: 3.5rem;
    padding-top: var(--space-section);
    border-top: 1px solid var(--rune-groove);
  }

  .group {
    display: grid;
    grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
    gap: 1.5rem clamp(2rem, 5vw, 4rem);
  }

  .group__head {
    display: grid;
    align-content: start;
    gap: 0.35rem;
    padding-top: 1.35rem;
  }

  .group__head h3 a {
    text-decoration: none;
  }

  .group__head h3 a:hover {
    color: var(--rune-paint);
  }

  .group__head p {
    font-size: 0.9375rem;
    color: var(--rune-ink-soft);
  }

  .group__products {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .product {
    display: grid;
    grid-template-columns: 3.25rem minmax(0, 1fr) auto;
    gap: 1.5rem;
    align-items: start;
    padding-block: 1.35rem;
    border-top: 1px solid var(--rune-groove);
  }

  .group__products .product:last-child {
    border-bottom: 1px solid var(--rune-groove);
  }

  .product :global(.product__mark) {
    width: 3.25rem;
    height: 3.25rem;
  }

  .product__text {
    display: grid;
    gap: 0.35rem;
    max-width: 38rem;
  }

  .product h4 {
    font-size: var(--text-h3);
    font-weight: 600;
    line-height: 1.3;
  }

  .product p {
    color: var(--rune-ink-soft);
  }

  .product__links {
    display: flex;
    gap: 1.25rem;
    padding-top: 0.2rem;
    font-size: 0.9375rem;
    font-weight: 540;
    white-space: nowrap;
  }

  @media (max-width: 52rem) {
    .group {
      grid-template-columns: 1fr;
    }

    .group__head {
      padding-top: 0;
    }

    .product {
      grid-template-columns: 2.5rem minmax(0, 1fr);
      gap: 0.75rem 1.1rem;
    }

    .product :global(.product__mark) {
      width: 2.5rem;
      height: 2.5rem;
    }

    .product__links {
      grid-column: 2;
    }
  }

  /* Platforms */
  .platforms {
    display: grid;
    gap: 2.5rem;
    padding-top: var(--space-section);
  }

  .platforms__list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-top: 2px solid var(--rune-ink);
  }

  .platform {
    display: grid;
    align-content: start;
    gap: 0.3rem;
    padding: 1.25rem 1.5rem 0 0;
  }

  .platform + .platform {
    padding-left: 1.5rem;
    border-left: 1px solid var(--rune-groove);
  }

  .platform dt {
    font-size: var(--text-h3);
    font-weight: 600;
  }

  .platform__webview {
    font-family: var(--font-mono);
    font-size: 0.9375rem;
  }

  .platform__needs {
    margin-top: 0.4rem;
    font-size: 0.9375rem;
    color: var(--rune-ink-soft);
  }

  .platforms__note {
    max-width: 46rem;
    color: var(--rune-ink-soft);
  }

  .platforms__note a {
    color: var(--rune-ink);
  }

  @media (max-width: 52rem) {
    .platforms__list {
      grid-template-columns: 1fr;
    }

    .platform,
    .platform + .platform {
      padding: 1.1rem 0;
      border-left: 0;
    }

    .platform + .platform {
      border-top: 1px solid var(--rune-groove);
    }
  }

  /* Start */
  .start {
    display: grid;
    gap: 2.5rem;
    padding-top: var(--space-section);
  }

  .start__paths {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 clamp(2rem, 5vw, 4rem);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .start__paths li {
    border-top: 1px solid var(--rune-groove);
  }

  .start__paths a {
    display: grid;
    gap: 0.3rem;
    padding-block: 1.25rem 1.5rem;
    text-decoration: none;
  }

  .start__title {
    font-size: var(--text-h3);
    font-weight: 600;
    line-height: 1.3;
  }

  .start__paths a:hover .start__title {
    color: var(--rune-paint);
  }

  .start__text {
    max-width: 30rem;
    color: var(--rune-ink-soft);
  }

  .start__examples {
    max-width: 46rem;
    color: var(--rune-ink-soft);
  }

  .start__examples a {
    color: var(--rune-ink);
  }

  @media (max-width: 52rem) {
    .start__paths {
      grid-template-columns: 1fr;
    }
  }
</style>
