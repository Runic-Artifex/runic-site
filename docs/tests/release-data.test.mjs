import assert from 'node:assert/strict';
import test from 'node:test';
import activeSdkRelease from '../src/lib/active-sdk-release.json' with { type: 'json' };
import publishedRelease from '../src/lib/published-release.json' with { type: 'json' };
import workspace from '../sources/sdk/eng/workspace.json' with { type: 'json' };
import {
  createReleaseDocs,
  packageInstallCommand,
} from '../src/lib/release-docs-core.ts';

test('published catalog has unique installable packages and matching registry links', () => {
  const rows = createReleaseDocs(activeSdkRelease).catalogRows;
  assert.equal(new Set(rows.map((row) => row.name)).size, rows.length);
  for (const row of rows) {
    assert.ok(packageInstallCommand(row), row.name);
    assert.ok(row.registryUrl.endsWith(`/${activeSdkRelease.version}`));
  }
  assert.ok(rows.some((row) => row.name === 'Runic.Application.Templates'));
  assert.ok(rows.some((row) => row.name === 'Runic.Application'));
  assert.ok(rows.some((row) => row.name === 'Runic.Application.Testing'));
  assert.ok(rows.some((row) => row.name === 'Runic.Application.ReactiveUI'));
  assert.ok(rows.some((row) => row.name === '@runic-artifex/svelte'));
  assert.ok(!rows.some((row) => row.name === 'Runic.CommandLine'));
  assert.ok(!rows.some((row) => row.name === 'Runic.Translations'));
  assert.ok(
    rows.every(
      (row) =>
        !row.name.includes('Editor') &&
        row.name !== 'Runic.Application.Bridge' &&
        row.name !== '@runic-artifex/application-bridge',
    ),
  );
});

test('the unified 0.6 catalog remains immutable release history', () => {
  const rows = createReleaseDocs(publishedRelease).catalogRows;
  assert.ok(rows.some((row) => row.name === 'Runic.CommandLine'));
  assert.ok(rows.some((row) => row.name === 'Runic.Translations'));
  assert.equal(publishedRelease.version, '0.6.0-preview.1');
});

// Packages added to the SDK after the active release. The pinned snapshot is a
// development revision, so its inventory can be ahead of the published catalog;
// `bun run docs:release` adds them once a release publishes them.
const unpublishedInventory = [];

// Orders x.y.z and x.y.z-preview.n versions; a release sorts after its previews.
const versionKey = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/.exec(version);
  assert.ok(match, `unexpected version ${version}`);
  const [, major, minor, patch, preview] = match;
  return [major, minor, patch, preview ?? 99999]
    .map((part) => String(part).padStart(5, '0'))
    .join('.');
};

test('active catalog follows the SDK-owned package inventory only', () => {
  const inventory = [...workspace.nuget, ...workspace.npm]
    .map((entry) => entry.name)
    .sort();
  const catalog = activeSdkRelease.packages
    .map((entry) => entry.identity)
    .sort();
  // A development snapshot carries the next version, which is never older.
  assert.ok(
    versionKey(workspace.version) >= versionKey(activeSdkRelease.version),
    `snapshot ${workspace.version} is older than ${activeSdkRelease.version}`,
  );
  assert.deepEqual(
    catalog,
    inventory.filter((name) => !unpublishedInventory.includes(name)),
  );
  for (const name of unpublishedInventory)
    assert.ok(inventory.includes(name), `${name} left the SDK inventory`);
});

test('commands cover libraries, templates, tools and npm packages', () => {
  const version = { state: 'published', value: '1.2.3-preview.4' };
  for (const [name, installKind, expected] of [
    [
      'Runic.Application',
      'nuget-package',
      'dotnet add package Runic.Application --version 1.2.3-preview.4',
    ],
    [
      'Runic.Application.Templates',
      'dotnet-template',
      'dotnet new install Runic.Application.Templates@1.2.3-preview.4',
    ],
    ['Runic.Create', 'dotnet-tool-exec', 'dnx Runic.Create@1.2.3-preview.4'],
    [
      'dotnet-runic',
      'dotnet-tool',
      'dotnet tool install --local dotnet-runic --version 1.2.3-preview.4',
    ],
    [
      '@runic-artifex/svelte',
      'npm-package',
      'npm install --save-exact @runic-artifex/svelte@1.2.3-preview.4',
    ],
  ])
    assert.equal(
      packageInstallCommand({ name, installKind, version }),
      expected,
    );
  assert.equal(
    packageInstallCommand({
      name: 'Future',
      installKind: 'nuget-package',
      version: { state: 'unpublished', value: '2.0.0' },
    }),
    undefined,
  );
});

test('catalog uses its published snapshot even when development packages change', () => {
  const release = {
    version: '1.0.0',
    url: 'https://example.com/release',
    packages: [
      {
        identity: 'Released',
        ecosystem: 'nuget',
        product: 'application',
        installKind: 'nuget-package',
      },
    ],
  };
  const docs = createReleaseDocs(release);
  assert.equal(docs.catalogRows.length, 1);
  assert.equal(docs.activeVersionForProduct('application').value, '1.0.0');
  assert.equal(docs.activeVersionForProduct('future'), undefined);
});
