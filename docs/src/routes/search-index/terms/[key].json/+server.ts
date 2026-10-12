import { error, json } from '@sveltejs/kit';
import { allTermShardKeys } from '#lib/search-core.js';
import { siteSearch } from '#lib/search.server.js';

export const prerender = true;
export const trailingSlash = 'never';

export function entries() {
  return allTermShardKeys().map((key) => ({ key }));
}

export function GET({ params }) {
  const shard = siteSearch.shards.get(params.key);
  if (!shard) error(404);
  return json(shard);
}
