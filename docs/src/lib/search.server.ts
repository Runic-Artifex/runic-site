// Builds the search index at build time from the guides, products and API
// reference. Server-only; the browser loads the generated files.
import { apiReference } from '#lib/api.server.js';
import { products } from '#lib/docs-data.js';
import { guides } from '#lib/guides.server.js';
import { buildSearchIndex, type SearchEntry } from '#lib/search-core.js';

const entries: SearchEntry[] = [];
for (const guide of guides) {
  for (const section of guide.sections) {
    entries.push({
      t: guide.title,
      ...(section.heading ? { s: section.heading } : {}),
      u: section.id ? `${guide.href}#${section.id}` : guide.href,
      x: section.text,
    });
  }
}
for (const product of products) {
  entries.push({
    t: product.name,
    u: `/products/${product.slug}/`,
    x: `${product.summary} ${product.description}`,
  });
}
// One entry per API type; members are found on the type page.
entries.push(...apiReference.searchEntries());

export const siteSearch = buildSearchIndex(entries);
