<script lang="ts">
  import { products } from '$lib/products';
</script>

<figure class="constellation" aria-labelledby="constellation-caption">
  <figcaption id="constellation-caption" class="sr-only">
    Runic Artifex at the center of seven independently adoptable products.
  </figcaption>
  <div class="constellation__rings" aria-hidden="true"></div>
  <svg class="constellation__seams" viewBox="0 0 600 600" aria-hidden="true">
    <path
      d="M300 300 300 72M300 300 478 158M300 300 522 351M300 300 400 510M300 300 187 500M300 300 76 341M300 300 126 151"
    />
  </svg>
  <div class="constellation__center" aria-hidden="true">
    <img src="/icon.png" alt="" />
  </div>
  {#each products as product, index (product.slug)}
    <div
      class={`constellation__product constellation__product--${index + 1}`}
      aria-hidden="true"
    >
      <img src={`/products/${product.slug}.png`} alt="" />
      <span>{product.shortName}</span>
    </div>
  {/each}
</figure>
