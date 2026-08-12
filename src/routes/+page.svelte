<script lang="ts">
  import FamilyConstellation from '$lib/components/FamilyConstellation.svelte';
  import ProductCard from '$lib/components/ProductCard.svelte';
  import { products } from '$lib/products';
</script>

<svelte:head>
  <title>Independent open-source .NET tools · Runic Artifex</title>
  <meta
    name="description"
    content="Runic Artifex is a family of independent open-source .NET tools for desktop and browser UI, application hosting, workflows, assets, localization, and command-line apps."
  />
  <link rel="canonical" href="https://runic-artifex.eu/" />
  <link rel="icon" href="/icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Runic Artifex" />
  <meta
    property="og:title"
    content="Independent tools. Explicit seams. · Runic Artifex"
  />
  <meta
    property="og:description"
    content="Focused open-source .NET tools that work independently and connect through documented integrations when needed."
  />
  <meta property="og:url" content="https://runic-artifex.eu/" />
  <meta property="og:image" content="https://runic-artifex.eu/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:title"
    content="Independent tools. Explicit seams. · Runic Artifex"
  />
  <meta
    name="twitter:description"
    content="Focused open-source .NET tools that work independently and connect through documented integrations when needed."
  />
  <meta name="twitter:image" content="https://runic-artifex.eu/og.png" />
</svelte:head>

<section class="hero shell">
  <div class="hero__copy">
    <p class="eyebrow"><span></span> Open-source .NET product family</p>
    <h1>Build the application you need. Keep the tools independent.</h1>
    <p class="hero__lede">
      Runic Artifex is a family of focused tools for desktop and browser UI,
      application hosting, workflows, assets, localization, and command-line
      apps. Each product works on its own and connects through documented
      integrations when needed.
    </p>
    <div class="hero__actions">
      <a class="button button--primary" href="#products"
        >Explore the tools <span aria-hidden="true">↓</span></a
      >
      <a class="button button--secondary" href="https://docs.runic-artifex.eu/"
        >Read the documentation <span aria-hidden="true">↗</span></a
      >
    </div>
    <ul class="hero__facts" aria-label="Project facts">
      <li><strong>Public preview</strong><span>NuGet and npm</span></li>
      <li><strong>MIT licensed</strong><span>Built in the open</span></li>
      <li>
        <strong>NativeAOT-minded</strong><span>From contracts to hosts</span>
      </li>
    </ul>
  </div>
  <FamilyConstellation />
</section>

<section id="principles" class="section shell principles">
  <div class="section-heading">
    <p class="eyebrow"><span></span> Why Runic Artifex</p>
    <h2>Use one tool. Connect another when it earns its place.</h2>
    <p>
      Architecture should preserve choices, not quietly remove them. Every Runic
      product has a clear job and an honest boundary.
    </p>
  </div>
  <div class="principle-grid">
    <article>
      <span class="principle-number">01</span>
      <h3>Focused by design</h3>
      <p>
        Adopt a localization compiler, asset pipeline, workflow engine, or
        native host without adopting an all-in-one framework.
      </p>
    </article>
    <article>
      <span class="principle-number">02</span>
      <h3>Explicit integrations</h3>
      <p>
        Official adapters connect products without forcing their cores to depend
        on each other. The seam stays visible and replaceable.
      </p>
    </article>
    <article>
      <span class="principle-number">03</span>
      <h3>Independent evolution</h3>
      <p>
        Products own their contracts, packages, histories, and release cycles.
        Applications decide when each dependency should move.
      </p>
    </article>
  </div>
</section>

<section id="products" class="section products-section">
  <div class="shell">
    <div class="section-heading section-heading--wide">
      <div>
        <p class="eyebrow"><span></span> The product family</p>
        <h2>Seven clear jobs. One shared grammar.</h2>
      </div>
      <p>
        Start from the capability your application needs. Each guide explains
        what the product owns, what it deliberately leaves out, and how to add
        it without taking the rest of the family.
      </p>
    </div>
    <div class="product-grid">
      {#each products as product (product.slug)}
        <ProductCard {product} />
      {/each}
    </div>
  </div>
</section>

<section id="integrations" class="section shell integration-section">
  <div class="integration-section__copy">
    <p class="eyebrow"><span></span> Explicit seams</p>
    <h2>Composition without hidden ownership.</h2>
    <p>
      Each tool works on its own. Official integrations connect tools without
      forcing their cores to depend on each other, so products can keep separate
      packages and release cycles.
    </p>
    <a class="text-link" href="https://docs.runic-artifex.eu/architecture/"
      >Explore the architecture <span aria-hidden="true">→</span></a
    >
  </div>
  <div class="seam-diagram" aria-label="Example of an explicit product seam">
    <div class="seam-node">
      <img src="/products/runic-flow.png" alt="" aria-hidden="true" />
      <span><small>Independent product</small>Runic Flow</span>
    </div>
    <div class="seam-connector">
      <span>Product-owned adapter</span>
      <strong>RunicFlow.ApplicationBridge</strong>
    </div>
    <div class="seam-node">
      <img src="/products/runic-toolkit.png" alt="" aria-hidden="true" />
      <span><small>Independent product</small>Runic Toolkit</span>
    </div>
  </div>
</section>

<section class="section shell preview-callout">
  <div>
    <p class="eyebrow"><span></span> Build in the open</p>
    <h2>The first package preview is public.</h2>
    <p>
      Explore the source, install only what you need, and use the documentation
      as the authoritative home for exact versions and release status.
    </p>
  </div>
  <div class="preview-callout__actions">
    <a
      class="button button--primary"
      href="https://docs.runic-artifex.eu/getting-started/"
      >Start building <span aria-hidden="true">→</span></a
    >
    <a class="button button--secondary" href="https://github.com/Runic-Artifex"
      >Browse GitHub <span aria-hidden="true">↗</span></a
    >
  </div>
</section>
