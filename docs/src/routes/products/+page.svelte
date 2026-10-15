<script lang="ts">
  import { resolve } from '$app/paths';
  import Mark from '#lib/brand/Mark.svelte';
  import { activeProducts } from '#lib/docs-data.js';

  const description =
    'Choose the independent Runic Artifex product that owns the capability you need.';
</script>

<svelte:head>
  <title>Products · Runic Artifex</title>
  <meta name="description" content={description} />
  <meta property="og:title" content="Products · Runic Artifex" />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content="Products · Runic Artifex" />
  <meta name="twitter:description" content={description} />
</svelte:head>

<div class="shell">
  <div class="page-head">
    <h1>Products with clear boundaries.</h1>
    <p class="lede">
      Every Runic product solves a focused job and can be used on its own. Add
      integrations when your application needs products to work together.
    </p>
  </div>

  <ul class="rows product-list">
    {#each activeProducts as product (product.slug)}
      <li>
        <Mark name={product.mark} class="product-list__mark" />
        <div class="product-list__text">
          <h2>
            <a href={resolve('/products/[slug]', { slug: product.slug })}
              >{product.name}</a
            >
          </h2>
          <p class="product-list__kind">{product.kicker}</p>
          <p>{product.summary}</p>
        </div>
      </li>
    {/each}
  </ul>
  <p class="product-list__more">
    Runic Flow is retired; its <a
      href={resolve('/products/[slug]', { slug: 'runic-flow' })}>archive page</a
    >
    explains how to move to Runic Application. The
    <a
      href={resolve('/products/[slug]', {
        slug: 'runic-translations-editor',
      })}>Translations Editor</a
    > is a source-only application built on Runic Translations.
  </p>
</div>

<style>
  .product-list {
    max-width: 52rem;
  }

  .product-list li {
    display: grid;
    grid-template-columns: 3.25rem minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
    padding-block: 1.6rem;
  }

  .product-list :global(.product-list__mark) {
    width: 3.25rem;
    height: 3.25rem;
  }

  .product-list__text {
    display: grid;
    gap: 0.35rem;
  }

  .product-list h2 {
    font-size: 1.375rem;
    letter-spacing: -0.01em;
  }

  .product-list h2 a {
    text-decoration: none;
  }

  .product-list h2 a:hover {
    text-decoration: underline;
    text-decoration-color: var(--rune-paint);
    text-decoration-thickness: 2px;
  }

  .product-list__kind {
    color: var(--rune-ink-soft);
    font-size: var(--text-ui);
  }

  .product-list__text p:last-child {
    max-width: 40rem;
    margin-top: 0.35rem;
    color: var(--rune-ink-soft);
  }

  .product-list__more {
    max-width: 46rem;
    margin-top: 1.75rem;
    color: var(--rune-ink-soft);
  }

  .product-list__more a {
    color: var(--rune-ink);
  }

  @media (max-width: 40rem) {
    .product-list li {
      grid-template-columns: 2.5rem minmax(0, 1fr);
      gap: 1rem;
    }

    .product-list :global(.product-list__mark) {
      width: 2.5rem;
      height: 2.5rem;
    }
  }
</style>
