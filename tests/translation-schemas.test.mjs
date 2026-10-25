import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import source from '../docs/sources/translations-schemas.json' with { type: 'json' };
import { digestInputs } from '../docs/scripts/source-inputs.mjs';
import { fileURLToPath } from 'node:url';

const root = new URL('../build/schemas/translations/', import.meta.url);
const retained = new Set(source.retained.map(({ name }) => name));

// Every schema URL the apex has published must keep resolving.
const previouslyPublished = [
  'asset-manifest-v1.schema.json',
  'capabilities-v1.schema.json',
  'editor-state-v1.schema.json',
  'external-pack-v5.schema.json',
  'locale-artifact-v5.schema.json',
  'message-ast-v5.schema.json',
  'project-v1.schema.json',
  'web-module-manifest-v3.schema.json',
];
const addedInTranslations080 = [
  'translations-serve-v1.schema.json',
  'translations-support-v1.schema.json',
  'translations-tool-v1.schema.json',
];
// sha256 of editor-state-v1 as last published from Translations f160e56.
const editorStateV1 =
  '6b9e5569b93e1346eeb2a129041c095f81779908c5ad7e4428f27f00f6fd2cb1';

const builtFiles = async () =>
  (await readdir(root)).filter((name) => name.endsWith('.schema.json')).sort();

test('apex schemas preserve canonical identifiers and the pinned portal bytes', async () => {
  const files = await builtFiles();
  assert.equal(
    await digestInputs(
      fileURLToPath(root),
      files.filter((name) => !retained.has(name)),
    ),
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

test('apex keeps every published schema URL and adds the 0.8.0 schemas', async () => {
  const files = new Set(await builtFiles());
  for (const name of [...previouslyPublished, ...addedInTranslations080])
    assert.ok(files.has(name), name);
});

test('retained legacy schemas keep their last published bytes', async () => {
  assert.deepEqual([...retained], ['editor-state-v1.schema.json']);
  const sha256 = async (name) =>
    createHash('sha256')
      .update(await readFile(new URL(name, root)))
      .digest('hex');
  assert.equal(await sha256('editor-state-v1.schema.json'), editorStateV1);
  for (const { name, contentDigest } of source.retained)
    assert.equal(`sha256:${await sha256(name)}`, contentDigest, name);
});
