import { error } from '@sveltejs/kit';
import {
  getGuide,
  guides,
  navigation,
  neighbours,
} from '#lib/guides.server.js';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () =>
  guides.map((guide) => ({ path: guide.path }));

export const load: PageServerLoad = ({ params }) => {
  const guide = getGuide(params.path);
  if (!guide) error(404, 'Guide not found');
  // Section text only feeds the search index.
  const { file, path, href, title, summary, headings, html, sourceUrl } = guide;
  return {
    guide: { file, path, href, title, summary, headings, html, sourceUrl },
    navigation,
    ...neighbours(guide),
  };
};
