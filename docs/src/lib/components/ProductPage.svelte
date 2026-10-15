<script lang="ts">
  import { resolve } from '$app/paths';
  import Mark from '#lib/brand/Mark.svelte';
  import ActionLink from '#lib/components/ActionLink.svelte';
  import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
  import Notice from '#lib/components/Notice.svelte';
  import type { Product } from '#lib/docs-data.js';
  import {
    catalogRows,
    currentRelease,
    packageInstallCommand,
    versionLabel,
  } from '#lib/release-docs.js';

  let { product }: { product: Product } = $props();
  let isApplication = $derived(product.kind === 'application');
  let isArchived = $derived(product.availability === 'archived');
  let isIndependent = $derived(product.availability === 'independent');
  let productVersion = $derived({
    state: product.versionState,
    value: product.version,
  });
  let displayPackages = $derived(
    catalogRows.filter(
      (entry) =>
        entry.productId === product.releaseProduct ||
        (product.includedReleaseProducts?.includes(entry.productId) ?? false),
    ),
  );
  let hasPublishedVersion = $derived(productVersion.state === 'published');
  let availabilityVersion = $derived(productVersion);
  let packageSectionTitle = $derived(
    product.slug === 'runic-application'
      ? 'Application and framework packages'
      : isApplication
        ? 'Source application'
        : 'Packages',
  );
  let pageTitle = $derived(`${product.name} · Runic Artifex`);
  let statusTitle = $derived(
    isArchived
      ? 'Retired project'
      : isIndependent
        ? hasPublishedVersion
          ? `${product.shortName} ${product.version}`
          : product.transitioning
            ? 'Independent preview pending'
            : 'Independently released product'
        : product.slug === 'runic-application'
          ? `Runic Application in SDK ${currentRelease.version}`
          : isApplication
            ? 'Source application'
            : `Runic SDK ${currentRelease.version}`,
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={product.summary} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={product.summary} />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={product.summary} />
</svelte:head>

<div class="shell">
  <div class="page-head product-head">
    <Breadcrumbs items={[{ label: 'Products', href: resolve('/products') }]} />
    <div class="product-title">
      <Mark name={product.mark} class="product-title__mark" />
      <div>
        <h1>{product.name}</h1>
        <p class="product-title__kind">{product.kicker}</p>
      </div>
    </div>
    <p class="lede">{product.description}</p>
    <div class="actions">
      {#if product.slug === 'runic-application'}
        <ActionLink href={resolve('/views')} variant="primary"
          >Explore Windows and Views</ActionLink
        >
        <ActionLink href={product.source}>View source</ActionLink>
      {:else if !isArchived && hasPublishedVersion}
        <ActionLink
          variant="primary"
          href={isIndependent && product.guides?.length
            ? product.guides[0].href
            : resolve('/products/[slug]#availability', {
                slug: product.slug,
              })}
          >{isApplication
            ? 'Downloads'
            : `Install ${product.shortName}`}</ActionLink
        >
      {:else}
        <ActionLink href={product.source} variant="primary"
          >{isArchived ? 'Migration guidance' : 'View source'}</ActionLink
        >
      {/if}
      {#if !isArchived && !isIndependent && !hasPublishedVersion && !isApplication}
        <ActionLink
          href={resolve('/products/[slug]#availability', {
            slug: product.slug,
          })}>Release status</ActionLink
        >
      {/if}
      {#if product.slug !== 'runic-application' && !isArchived && hasPublishedVersion}
        <ActionLink href={product.source}>View source</ActionLink>
      {/if}
      {#if product.related}
        <ActionLink href={resolve(product.related.href)}
          >{product.related.label}</ActionLink
        >
      {/if}
    </div>
  </div>

  <div class="product-layout">
    <article class="product-article">
      {#if product.guides?.length}
        <section id="guides">
          <h2>Guides and specifications</h2>
          <ul>
            {#each product.guides as guide (guide.href)}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- guide links are site paths or external URLs -->
              <li><a href={guide.href}>{guide.label}</a></li>
            {/each}
          </ul>
        </section>
      {/if}
      <section id="choose">
        <h2>When to choose it</h2>
        <ul>
          {#each product.bestFor as item (item)}<li>{item}</li>{/each}
        </ul>
      </section>
      <section id="boundaries">
        <h2>Scope and boundaries</h2>
        <ul>
          {#each product.boundaries as item (item)}<li>{item}</li>{/each}
        </ul>
      </section>
      <section id="availability">
        <h2>Release status</h2>
        <Notice title={statusTitle} tone={isArchived ? 'warning' : 'note'}>
          <p>
            {#if isArchived}
              Runic Flow is no longer an active product. Start with
              <a
                href={resolve('/products/[slug]', {
                  slug: 'runic-application',
                })}>Runic Application</a
              >
              for the current Window and View application model.
            {:else if isIndependent}
              {#if hasPublishedVersion}
                {product.name} is released independently from the Runic SDK. The current
                preview is <code>{product.version}</code>; its getting started
                guide shows how to install it.
              {:else if product.transitioning}
                {product.name} is moving to its own release lifecycle. Its first independent
                preview is not yet published; the 0.6.0-preview.1 unified catalog
                remains available as release history. Follow the product for its next
                preview and installation guidance.
              {:else}
                {product.name} is maintained separately. Runic Application provides
                a separate adapter for application Windows and ViewModels.
              {/if}
            {:else if product.slug === 'runic-application'}
              The published SDK catalog includes the current Window and View
              packages. Keep the runtime, host adapter, templates, and frontend
              packages on the same SDK version.
            {:else if isApplication}
              Standalone Translations Editor distributions are outside this SDK
              preview. Build and run the application from this repository.
            {:else}
              Install these packages from NuGet and npm. Keep Runic packages on
              the same preview version.
            {/if}
          </p>
          {#if !isIndependent}
            <p>
              <a href={currentRelease.url} rel="external"
                >Release notes and migration guidance</a
              >
            </p>
          {:else if product.releaseNotes}
            <p>
              <a href={product.releaseNotes} rel="external">Release notes</a>
            </p>
          {/if}
        </Notice>
      </section>
      {#if !isArchived && !isIndependent}
        <section id="packages">
          <h2>{packageSectionTitle}</h2>
          <ul class="product-packages">
            {#each displayPackages as entry (entry.name)}
              {@const command = packageInstallCommand(entry)}
              <li>
                <code class="product-packages__name">{entry.name}</code>
                {#if command}
                  <code class="product-packages__command">{command}</code>
                {:else}
                  <span>{versionLabel(entry.version)}</span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if !isApplication}
            <p>
              SDK version:
              <code>{availabilityVersion?.value ?? 'Version unassigned'}</code>
            </p>
          {/if}
        </section>
      {/if}
      <p class="product-next">
        Next, read how Runic products <a href={resolve('/architecture')}
          >connect without coupling their cores</a
        >.
      </p>
    </article>
    <nav class="product-toc" aria-label="On this page">
      <p class="guide-toc-title">On this page</p>
      <ul>
        {#if product.guides?.length}
          <li><a href="#guides">Guides and specifications</a></li>
        {/if}
        <li>
          <a href={resolve('/products/[slug]#choose', { slug: product.slug })}
            >When to choose it</a
          >
        </li>
        <li>
          <a
            href={resolve('/products/[slug]#boundaries', {
              slug: product.slug,
            })}>Scope and boundaries</a
          >
        </li>
        <li>
          <a
            href={resolve('/products/[slug]#availability', {
              slug: product.slug,
            })}
            >{isArchived
              ? 'Archive status'
              : isIndependent
                ? 'Independent status'
                : 'Availability'}</a
          >
        </li>
        {#if !isArchived && !isIndependent}
          <li>
            <a
              href={resolve('/products/[slug]#packages', {
                slug: product.slug,
              })}>{packageSectionTitle}</a
            >
          </li>
        {/if}
      </ul>
    </nav>
  </div>
</div>

<style>
  .product-title {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .product-title :global(.product-title__mark) {
    width: clamp(3rem, 6vw, 4rem);
    height: clamp(3rem, 6vw, 4rem);
  }

  .product-title__kind {
    margin-top: 0.4rem;
    color: var(--rune-ink-soft);
    font-size: 1.0625rem;
  }

  .product-layout {
    display: grid;
    grid-template-columns: minmax(0, 46rem) 13rem;
    justify-content: space-between;
    gap: 4rem;
  }

  /* Sections are styled through the article so their markup stays bare. */
  .product-article :global(section) {
    display: grid;
    gap: 1rem;
    padding-block: 2.25rem;
    border-top: var(--rule);
    font-size: var(--text-prose);
    line-height: 1.65;
  }

  .product-article :global(section > ul) {
    margin: 0;
    padding-left: 1.35em;
    list-style: disc;
  }

  .product-article :global(section > ul li + li) {
    margin-top: 0.4em;
  }

  .product-article :global(section li::marker) {
    color: var(--rune-ink-soft);
  }

  .product-article :global(:not(pre) > code) {
    padding: 0.1em 0.32em;
    border-radius: 3px;
    background: var(--rune-sunk);
    font-size: 0.875em;
  }

  .product-article :global(.notice code) {
    background: color-mix(in srgb, var(--rune-ink) 6%, transparent);
  }

  .product-packages {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .product-packages li {
    display: grid;
    gap: 0.35rem;
    padding-block: 0.75rem;
    border-bottom: var(--rule);
  }

  .product-packages li:first-child {
    border-top: var(--rule);
  }

  .product-article .product-packages__name {
    justify-self: start;
    padding: 0;
    background: none;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .product-article .product-packages__command {
    justify-self: start;
    max-width: 100%;
    overflow-x: auto;
    padding: 0.35rem 0.6rem;
    border: var(--rule);
    border-radius: var(--radius-control);
    background: var(--rune-raised);
    color: var(--rune-ink-soft);
    font-size: var(--text-code);
    white-space: nowrap;
  }

  .product-next {
    padding-top: 1.5rem;
    border-top: var(--rule);
    color: var(--rune-ink-soft);
  }

  .product-next a {
    color: var(--rune-ink);
  }

  .product-toc {
    position: sticky;
    top: 0;
    align-self: start;
    padding-top: 2.25rem;
    font-size: var(--text-small);
  }

  .product-toc ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .product-toc a {
    display: block;
    padding-block: 0.25rem;
    color: var(--rune-ink-soft);
    text-decoration: none;
  }

  .product-toc a:hover {
    color: var(--rune-ink);
  }

  @media (max-width: 68rem) {
    .product-layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .product-toc {
      display: none;
    }
  }
</style>
