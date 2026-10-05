import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import source from '../docs/sources/translations-schemas.json' with { type: 'json' };
import { digestInputs } from '../docs/scripts/source-inputs.mjs';

const sourceRoot = fileURLToPath(
  new URL('../docs/public/schemas/translations/', import.meta.url),
);
const mirrorRoot = fileURLToPath(
  new URL('../static/schemas/translations/', import.meta.url),
);
const names = (await readdir(sourceRoot))
  .filter((name) => name.endsWith('.schema.json'))
  .sort();
assert.equal(
  await digestInputs(sourceRoot, names),
  source.contentDigest,
  'Portal schemas must match the canonical pinned digest',
);
await rm(mirrorRoot, { recursive: true, force: true });
await mkdir(mirrorRoot, { recursive: true });
for (const name of names)
  await copyFile(
    new URL(
      name,
      new URL('../docs/public/schemas/translations/', import.meta.url),
    ),
    new URL(name, new URL('../static/schemas/translations/', import.meta.url)),
  );
console.log(
  `Prepared ${names.length} canonical translation schemas for the apex site.`,
);
