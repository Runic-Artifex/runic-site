import { apiReference } from '#lib/api.server.js';
import type { PageServerLoad } from './$types';

// Static reference pages need no client-side JavaScript.
export const csr = false;

export const load: PageServerLoad = () => ({
  release: apiReference.packages[0]?.version ?? '',
  packages: apiReference.packages.map((pkg) => ({
    id: pkg.id,
    href: pkg.href,
    ecosystem: pkg.ecosystem,
    framework: pkg.framework ?? null,
    types: pkg.groups.reduce((count, group) => count + group.types.length, 0),
  })),
});
