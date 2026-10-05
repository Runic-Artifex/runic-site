import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function digestInputs(root, files) {
  const digest = createHash('sha256');
  for (const name of [...files].sort()) {
    assert.ok(!path.isAbsolute(name) && !name.split('/').includes('..'));
    digest.update(name);
    digest.update('\0');
    digest.update(await readFile(path.join(root, name)));
    digest.update('\0');
  }
  return `sha256:${digest.digest('hex')}`;
}
