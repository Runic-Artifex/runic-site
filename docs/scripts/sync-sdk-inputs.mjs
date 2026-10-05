#!/usr/bin/env bun
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import source from '../sources/sdk-inputs.json' with { type: 'json' };
import { digestInputs } from './source-inputs.mjs';

const [sourceDirectory, ...extra] = process.argv.slice(2);
assert(
  sourceDirectory && !extra.length,
  'Usage: bun docs/scripts/sync-sdk-inputs.mjs <SDK-checkout>',
);
const sourceRoot = path.resolve(sourceDirectory);
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: sourceRoot,
  encoding: 'utf8',
}).trim();
assert.equal(
  revision,
  source.revision,
  'Check out the SDK revision pinned in docs/sources/sdk-inputs.json',
);
assert.equal(
  await digestInputs(sourceRoot, source.files),
  source.contentDigest,
  'SDK inputs differ from the pinned content digest',
);
const mirrorRoot = fileURLToPath(new URL('../sources/sdk/', import.meta.url));
await rm(mirrorRoot, { recursive: true, force: true });
for (const name of source.files) {
  const target = path.join(mirrorRoot, name);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(sourceRoot, name), target);
}
console.log(
  `Synchronized ${source.files.length} SDK inputs from ${source.repository}@${revision}.`,
);
