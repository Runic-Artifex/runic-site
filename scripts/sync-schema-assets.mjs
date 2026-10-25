import assert from 'node:assert/strict';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import source from '../docs/sources/translations-schemas.json' with { type: 'json' };
import { digestInputs } from '../docs/scripts/source-inputs.mjs';
import {
  currentSchemaNames,
  verifyRetainedSchemas,
} from '../docs/scripts/translation-schema-set.mjs';

const sourceRoot = fileURLToPath(
  new URL('../docs/public/schemas/translations/', import.meta.url),
);
const mirrorRoot = fileURLToPath(
  new URL('../static/schemas/translations/', import.meta.url),
);
const names = await currentSchemaNames(sourceRoot);
assert.equal(
  await digestInputs(sourceRoot, names),
  source.contentDigest,
  'Portal schemas must match the canonical pinned digest',
);
// Legacy schemas keep their public URLs at their last published bytes.
const retained = await verifyRetainedSchemas(sourceRoot);
await rm(mirrorRoot, { recursive: true, force: true });
await mkdir(mirrorRoot, { recursive: true });
for (const name of [...names, ...retained])
  await copyFile(path.join(sourceRoot, name), path.join(mirrorRoot, name));
console.log(
  `Prepared ${names.length} canonical and ${retained.length} retained translation schemas for the apex site.`,
);
