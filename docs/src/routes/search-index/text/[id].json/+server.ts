import { error, json } from '@sveltejs/kit';
import { siteSearch } from '#lib/search.server.js';

export const prerender = true;
export const trailingSlash = 'never';

export function entries() {
  return [...siteSearch.texts.keys()].map((id) => ({ id: String(id) }));
}

export function GET({ params }) {
  const text = siteSearch.texts.get(Number(params.id));
  if (text === undefined) error(404);
  return json(text);
}
