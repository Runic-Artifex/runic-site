<script lang="ts">
  import { products } from '$lib/products';
</script>

<figure class="constellation" aria-labelledby="constellation-caption">
  <figcaption id="constellation-caption" class="sr-only">
    Runic SDK connects Application, Desktop, Assets, Translations, and Command
    Line.
  </figcaption>
  <div class="constellation__rings" aria-hidden="true"></div>
  <svg class="constellation__seams" viewBox="0 0 600 600" aria-hidden="true">
    <path
      d="M300 300 300 72M300 300 517 230M300 300 434 485M300 300 166 485M300 300 83 230"
    />
  </svg>
  <div class="constellation__center" aria-hidden="true">
    <img src="/icon.png" alt="" />
  </div>
  {#each products as product, index (product.slug)}
    <div
      class="constellation__product"
      style:left={`${50 + 38 * Math.sin((index * 2 * Math.PI) / products.length)}%`}
      style:top={`${50 - 38 * Math.cos((index * 2 * Math.PI) / products.length)}%`}
      aria-hidden="true"
    >
      <img src={`/products/${product.slug}.png`} alt="" />
      <span>{product.shortName}</span>
    </div>
  {/each}
</figure>
