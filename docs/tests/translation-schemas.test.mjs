import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import source from '../sources/translations-schemas.json' with { type: 'json' };

const schemaRoot = path.resolve('public/schemas/translations');
const publishedRoot = path.resolve('build/schemas/translations');
const canonicalRoot = 'https://runic-artifex.eu/schemas/translations/';
const retainedNames = source.retained.map(({ name }) => name);

async function schemaNames(root) {
  return (await readdir(root))
    .filter((name) => name.endsWith('.schema.json'))
    .sort();
}

async function schemaDigest(root, names) {
  const hash = createHash('sha256');
  for (const name of names) {
    hash.update(name);
    hash.update('\0');
    hash.update(await readFile(path.join(root, name)));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

async function fileDigest(file) {
  return `sha256:${createHash('sha256')
    .update(await readFile(file))
    .digest('hex')}`;
}

test('translation schema mirror has a pinned canonical source', async () => {
  assert.equal(source.repository, 'Runic-Artifex/runic-translations-sdk');
  assert.match(source.revision, /^[0-9a-f]{40}$/);
  assert.equal(
    source.archiveUrl,
    `https://github.com/${source.repository}/archive/${source.revision}.tar.gz`,
  );
  assert.equal(source.sourcePath, 'specs/translations/schemas');
  assert.match(source.contentDigest, /^sha256:[0-9a-f]{64}$/);
});

test('retained legacy schemas are pinned to their last published revision', () => {
  assert.ok(Array.isArray(source.retained));
  assert.equal(new Set(retainedNames).size, retainedNames.length);
  for (const entry of source.retained) {
    assert.deepEqual(Object.keys(entry).sort(), [
      'contentDigest',
      'name',
      'revision',
    ]);
    assert.match(entry.name, /^[a-z0-9-]+\.schema\.json$/);
    assert.match(entry.revision, /^[0-9a-f]{40}$/);
    assert.notEqual(entry.revision, source.revision, entry.name);
    assert.match(entry.contentDigest, /^sha256:[0-9a-f]{64}$/);
  }
});

test('translation schemas have canonical identifiers and match the pinned mirror', async () => {
  const all = await schemaNames(schemaRoot);
  const names = all.filter((name) => !retainedNames.includes(name));
  assert.ok(names.length);
  assert.equal(await schemaDigest(schemaRoot, names), source.contentDigest);
  for (const { name, contentDigest } of source.retained)
    assert.equal(
      await fileDigest(path.join(schemaRoot, name)),
      contentDigest,
      name,
    );
  assert.deepEqual(await schemaNames(publishedRoot), all);

  for (const name of all) {
    const source = await readFile(path.join(schemaRoot, name), 'utf8');
    const schema = JSON.parse(source);
    assert.equal(schema.$id, canonicalRoot + name, name);
    assert.equal(
      schema.$schema,
      'https://json-schema.org/draft/2020-12/schema',
      name,
    );
    assert.equal(
      await readFile(path.join(publishedRoot, name), 'utf8'),
      source,
      name,
    );
  }
});
