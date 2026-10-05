import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import source from '../docs/sources/translations-schemas.json' with { type: 'json' };
import { digestInputs } from '../docs/scripts/source-inputs.mjs';
import { fileURLToPath } from 'node:url';

test('apex schemas preserve canonical identifiers and the pinned portal bytes', async () => {
  const root = new URL('../build/schemas/translations/', import.meta.url);
  const files = (await readdir(root))
    .filter((name) => name.endsWith('.schema.json'))
    .sort();
  assert.equal(
    await digestInputs(fileURLToPath(root), files),
    source.contentDigest,
  );
  for (const name of files) {
    const bytes = await readFile(new URL(name, root), 'utf8');
    assert.equal(
      bytes,
      await readFile(
        new URL(`../docs/public/schemas/translations/${name}`, import.meta.url),
        'utf8',
      ),
    );
    assert.equal(
      JSON.parse(bytes).$id,
      `https://runic-artifex.eu/schemas/translations/${name}`,
    );
  }
});
