import assert from 'node:assert/strict';
import test from 'node:test';
import activeSdkRelease from '../src/lib/active-sdk-release.json' with { type: 'json' };
import publishedRelease from '../src/lib/published-release.json' with { type: 'json' };
import workspace from '../sources/sdk/eng/workspace.json' with { type: 'json' };
import {
  createReleaseDocs,
  packageInstallCommand,
  snapshotPackageRenames,
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

// The versions a pinned snapshot may carry: the active release, or the
// immediate next development version (the next preview of the same
// major.minor, or the first preview of the next minor).
const acceptedSnapshotVersions = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/.exec(version);
  assert.ok(match, `unexpected version ${version}`);
  const [major, minor, patch, preview] = match.slice(1).map(Number);
  const accepted = [version, `${major}.${minor + 1}.0-preview.1`];
  if (!Number.isNaN(preview))
    accepted.push(`${major}.${minor}.${patch}-preview.${preview + 1}`);
  return accepted;
};

test('active catalog follows the SDK-owned package inventory only', () => {
  const inventory = [...workspace.nuget, ...workspace.npm]
    .map((entry) => entry.name)
    .sort();
  const catalog = activeSdkRelease.packages
    .map((entry) => snapshotPackageRenames[entry.identity] ?? entry.identity)
    .sort();
  for (const [published, renamed] of Object.entries(snapshotPackageRenames)) {
    assert.ok(
      activeSdkRelease.packages.some((entry) => entry.identity === published),
      `${published} is not in the published catalog`,
    );
    assert.ok(inventory.includes(renamed), `${renamed} left the SDK inventory`);
    assert.ok(!inventory.includes(published), `${published} was not renamed`);
  }
  assert.ok(
    acceptedSnapshotVersions(activeSdkRelease.version).includes(
      workspace.version,
    ),
    `snapshot ${workspace.version} is neither ${activeSdkRelease.version} nor its next version`,
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

test('a snapshot may be the active release or its immediate next version', () => {
  assert.deepEqual(acceptedSnapshotVersions('0.7.0-preview.1'), [
    '0.7.0-preview.1',
    '0.8.0-preview.1',
    '0.7.0-preview.2',
  ]);
  assert.deepEqual(acceptedSnapshotVersions('1.0.0'), [
    '1.0.0',
    '1.1.0-preview.1',
  ]);
});
