// Loads the checked-in API models at build time. Server-only: the reference
// data and its rendering never reach the browser bundle.
import {
  ApiReference,
  type ApiManifest,
  type ApiPackage,
} from '#lib/api-core.js';
import manifest from '../../sources/api-inputs.json';

const models = import.meta.glob<ApiPackage>('/sources/api/**/*.json', {
  import: 'default',
  eager: true,
});

export const apiReference = new ApiReference(
  manifest as ApiManifest,
  Object.fromEntries(
    Object.entries(models).map(([file, model]) => [
      file.slice('/sources/api/'.length),
      model,
    ]),
  ),
);
