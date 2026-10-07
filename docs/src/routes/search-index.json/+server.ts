import { json } from '@sveltejs/kit';
import { apiReference } from '#lib/api.server.js';
import { products } from '#lib/docs-data.js';
import { guides } from '#lib/guides.server.js';
import type { SearchEntry, SearchIndex } from '#lib/search-core.js';

export const prerender = true;
export const trailingSlash = 'never';

export function GET() {
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
  return json({ version: 1, entries } satisfies SearchIndex);
}
