<script lang="ts">
  import { products } from '$lib/products';
</script>

<figure class="constellation" aria-labelledby="constellation-caption">
  <figcaption id="constellation-caption" class="sr-only">
    Runic Artifex at the center of seven maintained products and one historical
    archive.
  </figcaption>
  <div class="constellation__rings" aria-hidden="true"></div>
  <svg class="constellation__seams" viewBox="0 0 600 600" aria-hidden="true">
    <path
      d="M300 300 300 72M300 300 461 139M300 300 528 300M300 300 461 461M300 300 300 528M300 300 139 461M300 300 72 300M300 300 139 139"
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
