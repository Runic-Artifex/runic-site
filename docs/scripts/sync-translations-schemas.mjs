#!/usr/bin/env bun
import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import source from '../sources/translations-schemas.json' with { type: 'json' };
import { digestInputs } from './source-inputs.mjs';
import {
  retainedNames,
  schemaFiles,
  verifyRetainedSchemas,
} from './translation-schema-set.mjs';

const [sourceDirectory, revision, ...extra] = process.argv.slice(2);
assert(
  sourceDirectory && revision && !extra.length,
  'Usage: bun docs/scripts/sync-translations-schemas.mjs <schema-source-directory> <pinned-revision>',
);

const sourceRoot = path.resolve(sourceDirectory);
const mirrorRoot = fileURLToPath(
  new URL('../public/schemas/translations/', import.meta.url),
);
assert.equal(
  revision,
  source.revision,
  'Source revision must match docs/sources/translations-schemas.json',
);

const schemaNames = await schemaFiles(sourceRoot);
assert.ok(schemaNames.length, 'Source contains no translation schemas');
assert.equal(
  await digestInputs(sourceRoot, schemaNames),
  source.contentDigest,
  'Source schemas do not match the pinned digest',
);
for (const name of schemaNames)
  assert.ok(
    !retainedNames.has(name),
    `${name} is shipped by the pin again; drop it from "retained"`,
  );

// Retained legacy schemas are no longer in the source; keep their frozen bytes.
await mkdir(mirrorRoot, { recursive: true });
const retained = await verifyRetainedSchemas(mirrorRoot);
for (const name of await readdir(mirrorRoot))
  if (!retainedNames.has(name))
    await rm(path.join(mirrorRoot, name), { recursive: true, force: true });
for (const name of schemaNames)
  await copyFile(path.join(sourceRoot, name), path.join(mirrorRoot, name));

console.log(
  `Synchronized ${schemaNames.length} translation schemas from ${source.repository}@${source.revision}; kept ${retained.length} retained.`,
);
