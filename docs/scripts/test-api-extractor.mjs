#!/usr/bin/env bun
// Golden test for tools/ApiExtractor. Needs the .NET SDK (for example
// `direnv exec <runic-sdk-checkout> bun docs/scripts/test-api-extractor.mjs`),
// so it is not part of `bun run test`. It packs tools/ApiExtractor.Fixture,
// extracts it and compares the result with
// tools/ApiExtractor.Fixture/expected.json. Pass --update to rewrite it after
// an intended change, then review the diff.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = fileURLToPath(new URL('../tools/', import.meta.url));
const expectedPath = path.join(tools, 'ApiExtractor.Fixture/expected.json');
const update = process.argv.includes('--update');
const work = await mkdtemp(path.join(tmpdir(), 'runic-api-extractor-'));
const run = (args) =>
  execFileSync('dotnet', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

try {
  run([
    'build',
    path.join(tools, 'ApiExtractor'),
    '-c',
    'Release',
    '-nologo',
    '-v',
    'q',
  ]);
  const extractor = path.join(
    tools,
    'ApiExtractor/bin/Release/net10.0/ApiExtractor.dll',
  );
  for (const [candidates, expected] of [
    [['netstandard2.0', 'net8.0', 'net10.0'], 'net10.0'],
    [['net10.0-windows10.0.19041', 'net10.0', 'net9.0'], 'net10.0'],
    [['net10.0-windows10.0.19041', 'net9.0'], 'net10.0-windows10.0.19041'],
    [['netstandard2.0', 'netstandard2.1'], 'netstandard2.1'],
    [['net48'], '(none)'],
  ])
    assert.equal(
      run([extractor, '--select-framework', ...candidates]).trim(),
      expected,
      candidates.join(' '),
    );

  run([
    'pack',
    path.join(tools, 'ApiExtractor.Fixture'),
    '-c',
    'Release',
    '-o',
    work,
    '-nologo',
    '-v',
    'q',
  ]);
  const id = 'Runic.ApiExtractor.Fixture';
  const nupkg = path.join(work, `${id}.1.0.0.nupkg`);
  assert.throws(() =>
    execFileSync(
      'dotnet',
      [extractor, path.join(work, 'out'), `Other=${nupkg}`],
      {
        stdio: 'ignore',
      },
    ),
  );
  run([extractor, path.join(work, 'out'), `${id}=${nupkg}`]);
  const actual = `${JSON.stringify(
    JSON.parse(await readFile(path.join(work, 'out', `${id}.json`), 'utf8')),
    null,
    2,
  )}\n`;
  if (update) {
    await writeFile(expectedPath, actual);
    console.log(`Updated ${path.relative(process.cwd(), expectedPath)}.`);
  } else {
    assert.equal(actual, await readFile(expectedPath, 'utf8'));
    console.log('API extractor golden test passed.');
  }
} finally {
  await rm(work, { recursive: true, force: true });
  await rm(path.join(tools, 'ApiExtractor.Fixture/bin'), {
    recursive: true,
    force: true,
  });
  await rm(path.join(tools, 'ApiExtractor.Fixture/obj'), {
    recursive: true,
    force: true,
  });
}
