<script lang="ts">
  import type { Product } from '$lib/products';

  let { product }: { product: Product } = $props();
</script>

<article class="product-card">
  <div class="product-card__heading">
    <img src={`/products/${product.slug}.png`} alt="" aria-hidden="true" />
    <div>
      <p>{product.capability}</p>
      <h3>{product.name}</h3>
    </div>
  </div>
  <p class="product-card__description">{product.description}</p>
  <div class="product-card__links">
    <a href={`https://docs.runic-artifex.eu/products/${product.slug}/`}
      >Read the guide <span aria-hidden="true">→</span></a
    >
    <a href={`https://github.com/Runic-Artifex/${product.slug}`}
      >Source <span aria-hidden="true">↗</span></a
    >
  </div>
</article>
