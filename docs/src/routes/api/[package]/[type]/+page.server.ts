import { error } from '@sveltejs/kit';
import { apiReference } from '#lib/api.server.js';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () =>
  apiReference.packages.flatMap((pkg) =>
    pkg.groups.flatMap((group) =>
      group.types
        .filter((view) => view.page)
        .map((view) => ({ package: pkg.slug, type: view.slug })),
    ),
  );

export const load: PageServerLoad = ({ params }) => {
  const page = apiReference.typePage(params.package, params.type);
  if (!page) error(404, 'Type not found');
  return { page };
};
