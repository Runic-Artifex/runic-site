import { json } from '@sveltejs/kit';
import { siteSearch } from '#lib/search.server.js';

export const prerender = true;
export const trailingSlash = 'never';

export function GET() {
  return json(siteSearch.index);
}
