import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import source from '../sources/translations-schemas.json' with { type: 'json' };

// Schemas that a later pin no longer ships but whose public URLs stay served.
// Each one is frozen at the revision and digest that last published it.
export const retainedSchemas = source.retained ?? [];
export const retainedNames = new Set(retainedSchemas.map(({ name }) => name));

export async function schemaFiles(root) {
  return (await readdir(root))
    .filter((name) => name.endsWith('.schema.json'))
    .sort();
}

export async function currentSchemaNames(root) {
  return (await schemaFiles(root)).filter((name) => !retainedNames.has(name));
}

export async function fileDigest(file) {
  return `sha256:${createHash('sha256')
    .update(await readFile(file))
    .digest('hex')}`;
}

export async function verifyRetainedSchemas(root) {
  for (const { name, contentDigest } of retainedSchemas)
    assert.equal(
      await fileDigest(path.join(root, name)),
      contentDigest,
      `Retained schema ${name} must keep its last published bytes`,
    );
  return retainedSchemas.map(({ name }) => name);
}
