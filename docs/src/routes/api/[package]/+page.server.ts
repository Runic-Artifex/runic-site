import { error } from '@sveltejs/kit';
import { apiReference } from '#lib/api.server.js';
import type { EntryGenerator, PageServerLoad } from './$types';

export const csr = false;

export const entries: EntryGenerator = () =>
  apiReference.packages.map((pkg) => ({ package: pkg.slug }));

export const load: PageServerLoad = ({ params }) => {
  const page = apiReference.packagePage(params.package);
  if (!page) error(404, 'Package not found');
  return { page };
};
