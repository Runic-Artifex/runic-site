<script lang="ts">
  import FamilyConstellation from '$lib/components/FamilyConstellation.svelte';
  import ProductCard from '$lib/components/ProductCard.svelte';
  import { products } from '$lib/products';
</script>

<svelte:head>
  <title>C# applications with your frontend · Runic Artifex</title>
  <meta
    name="description"
    content="Runic SDK brings C# application logic and React, Vue, Svelte, or Angular frontends to native desktop applications."
  />
  <link rel="canonical" href="https://runic-artifex.eu/" />
  <link rel="icon" href="/icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Runic Artifex" />
  <meta
    property="og:title"
    content="C# logic. Your frontend. · Runic Artifex"
  />
  <meta
    property="og:description"
    content="Build native desktop applications with C# logic, your chosen frontend, and composable SDK packages."
  />
  <meta property="og:url" content="https://runic-artifex.eu/" />
  <meta property="og:image" content="https://runic-artifex.eu/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:title"
    content="C# logic. Your frontend. · Runic Artifex"
  />
  <meta
    name="twitter:description"
    content="Build native desktop applications with C# logic, your chosen frontend, and composable SDK packages."
  />
  <meta name="twitter:image" content="https://runic-artifex.eu/og.png" />
</svelte:head>

<section class="hero shell">
  <div class="hero__copy">
    <p class="eyebrow"><span></span> Open-source Runic SDK</p>
    <h1>C# at the core. Your frontend on the desktop.</h1>
    <p class="hero__lede">
      Build native desktop applications with C# application logic and a React,
      Vue, Svelte, or Angular frontend. Runic SDK brings the host, typed bridge,
      assets, and translations together—with packages you can also use
      independently.
    </p>
    <div class="hero__actions">
      <a
        class="button button--primary"
        href="https://docs.runic-artifex.eu/getting-started/"
        >Get started <span aria-hidden="true">↓</span></a
      >
      <a class="button button--secondary" href="https://docs.runic-artifex.eu/"
        >Explore the documentation <span aria-hidden="true">↗</span></a
      >
    </div>
    <ul class="hero__facts" aria-label="Project facts">
      <li><strong>C# + web UI</strong><span>Your choice of frontend</span></li>
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
        Adopt a localization compiler, asset pipeline, or native host without
        adopting an all-in-one framework.
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
      <h3>Developed together</h3>
      <p>
        One SDK repository keeps the libraries, tools, examples, and
        documentation together. Adopt the packages your application needs.
      </p>
    </article>
  </div>
</section>

<section id="products" class="section products-section">
  <div class="shell">
    <div class="section-heading section-heading--wide">
      <div>
        <p class="eyebrow"><span></span> The SDK building blocks</p>
        <h2>Compose the capabilities you need.</h2>
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
    <p class="eyebrow"><span></span> From template to application</p>
    <h2>Start with a working app. Make it yours.</h2>
    <p>
      Choose a frontend template, then build your application behavior in C#.
      The SDK examples show the same pieces in a counter, a customer editor, and
      a document application.
    </p>
    <a
      class="text-link"
      href="https://github.com/Runic-Artifex/runic-sdk/tree/main/examples"
      >Explore the examples <span aria-hidden="true">→</span></a
    >
  </div>
  <div class="template-example">
    <p class="eyebrow">After installing the templates</p>
    <pre><code>dotnet new runic-app-svelte --name MyApp</code></pre>
    <p>Prefer React, Vue, or Angular? Choose the matching template.</p>
    <a class="text-link" href="https://docs.runic-artifex.eu/getting-started/"
      >Follow the setup guide <span aria-hidden="true">→</span></a
    >
  </div>
</section>

<section class="section shell preview-callout">
  <div>
    <p class="eyebrow"><span></span> Build with Runic</p>
    <h2>Your next application starts here.</h2>
    <p>
      The documentation covers setup, host choices, frontend integration, and
      current package availability.
    </p>
  </div>
  <div class="preview-callout__actions">
    <a
      class="button button--primary"
      href="https://docs.runic-artifex.eu/getting-started/"
      >Get started <span aria-hidden="true">→</span></a
    >
    <a
      class="button button--secondary"
      href="https://github.com/Runic-Artifex/runic-sdk"
      >Browse the SDK <span aria-hidden="true">↗</span></a
    >
  </div>
</section>

<section class="section shell related-projects">
  <p>
    <a href="https://github.com/Runic-Artifex/cs-webui">CS-WebUI</a> is a separate
    related project for WebUI's managed API.
  </p>
  <p>
    Looking for Runic Flow? See the <a
      href="https://docs.runic-artifex.eu/products/runic-flow/"
      >historical archive guidance</a
    >.
  </p>
</section>
