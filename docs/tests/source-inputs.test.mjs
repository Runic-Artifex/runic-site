import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import source from '../sources/sdk-inputs.json' with { type: 'json' };
import origin from '../sources/portal-origin.json' with { type: 'json' };
import { digestInputs } from '../scripts/source-inputs.mjs';

const snapshotRoot = fileURLToPath(new URL('../sources/sdk/', import.meta.url));

test('creator and inventory snapshot matches its pinned SDK source', async () => {
  assert.equal(source.repository, 'Runic-Artifex/runic-sdk');
  assert.match(source.revision, /^[0-9a-f]{40}$/);
  assert.equal(
    source.archiveUrl,
    `https://github.com/${source.repository}/archive/${source.revision}.tar.gz`,
  );
  assert.equal(
    await digestInputs(snapshotRoot, source.files),
    source.contentDigest,
  );
  const files = await readdir(snapshotRoot, {
    recursive: true,
    withFileTypes: true,
  });
  const actual = files
    .filter((file) => file.isFile())
    .map((file) => `${file.parentPath}/${file.name}`.slice(snapshotRoot.length))
    .sort();
  assert.deepEqual(actual, source.files);
  assert.equal(origin.repository, source.repository);
  assert.match(origin.revision, /^[0-9a-f]{40}$/);
});

test('the portal builds from its checked-in inputs without SDK-relative imports', async () => {
  for (const name of ['creator.ts', 'template-preview.ts']) {
    const code = await readFile(
      new URL(`../src/lib/${name}`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(code, /\.\.\/\.\.\/\.\.\/(?:tools|eng|packages)/);
    assert.match(code, /\.\.\/\.\.\/sources\/sdk\/tools\//);
  }
});
