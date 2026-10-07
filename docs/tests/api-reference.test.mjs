import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import activeSdkRelease from '../src/lib/active-sdk-release.json' with { type: 'json' };
import manifest from '../sources/api-inputs.json' with { type: 'json' };
import { finishApiPackages } from '../scripts/api-postprocess.mjs';
import { digestInputs } from '../scripts/source-inputs.mjs';
import { ApiReference, learnUrl, shortName } from '../src/lib/api-core.ts';
import { apiPackageSlug } from '../src/lib/api-paths.ts';

const docsRoot = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = join(docsRoot, 'sources/api');
const buildApi = join(docsRoot, 'build/api');

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}

const models = Object.fromEntries(
  manifest.packages.map((pin) => [
    pin.file,
    JSON.parse(readFileSync(join(apiRoot, pin.file), 'utf8')),
  ]),
);
const reference = new ApiReference(manifest, models);

test('API inputs cover exactly the library packages of the active release', async () => {
  assert.equal(manifest.release, activeSdkRelease.version);
  const expected = activeSdkRelease.packages
    .filter((entry) =>
      ['nuget-package', 'npm-package'].includes(entry.installKind),
    )
    .map((entry) => entry.identity)
    .sort();
  assert.deepEqual(
    manifest.packages.map((pin) => pin.package).sort(),
    expected,
  );
  for (const pin of manifest.packages) {
    assert.equal(pin.version, activeSdkRelease.version, pin.package);
    if (pin.ecosystem === 'nuget') {
      assert.match(pin.sha512, /^[A-Za-z0-9+/]{86}==$/, pin.package);
      assert.match(pin.framework, /^net\d+\.\d+/, pin.package);
      assert.ok(
        pin.url.startsWith('https://api.nuget.org/v3-flatcontainer/'),
        pin.url,
      );
    } else {
      assert.match(pin.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/, pin.package);
      assert.ok(pin.url.startsWith('https://registry.npmjs.org/'), pin.url);
    }
    assert.equal(models[pin.file].package, pin.package);
    assert.equal(models[pin.file].version, pin.version);
  }
  assert.equal(
    await digestInputs(
      apiRoot,
      manifest.packages.map((pin) => pin.file),
    ),
    manifest.contentDigest,
  );
  const checkedIn = files(apiRoot)
    .map((file) => file.slice(apiRoot.length + 1))
    .sort();
  assert.deepEqual(checkedIn, manifest.packages.map((pin) => pin.file).sort());
});

test('API inputs and rendered pages stay within their size budgets', () => {
  const inputs =
    files(apiRoot).reduce((total, file) => total + statSync(file).size, 0) +
    statSync(join(docsRoot, 'sources/api-inputs.json')).size;
  assert.ok(inputs <= 1.5 * 1024 * 1024, `inputs are ${inputs} bytes`);
  const rendered = files(buildApi)
    .filter((file) => file.endsWith('.html'))
    .reduce((total, file) => total + statSync(file).size, 0);
  assert.ok(rendered <= 6 * 1024 * 1024, `rendered HTML is ${rendered} bytes`);
});

test('every package and type has its page, and pages load no scripts', () => {
  let pages = 0;
  for (const pkg of reference.packages) {
    const packageHtml = readFileSync(
      join(buildApi, pkg.slug, 'index.html'),
      'utf8',
    );
    assert.equal(packageHtml.match(/<h1\b/g)?.length, 1, pkg.id);
    for (const view of pkg.groups.flatMap((group) => group.types)) {
      if (view.page) {
        const html = readFileSync(
          join(buildApi, pkg.slug, view.slug, 'index.html'),
          'utf8',
        );
        assert.equal(html.match(/<h1\b/g)?.length, 1, view.type.id);
        assert.doesNotMatch(html, /<script\b[^>]*\bsrc=|modulepreload/);
        pages++;
      } else {
        assert.ok(packageHtml.includes(`id="${view.anchor}"`), view.type.id);
      }
    }
  }
  assert.ok(pages > 300, `only ${pages} type pages`);
  assert.equal(apiPackageSlug('@runic-artifex/views'), 'runic-artifex-views');
  assert.equal(apiPackageSlug('Runic.Assets'), 'Runic.Assets');
  const catalog = readFileSync(
    join(docsRoot, 'build/packages/index.html'),
    'utf8',
  );
  assert.ok(catalog.includes('href="../api/Runic.Assets"'));
});

test('search indexes one entry per API type within the index budget', () => {
  const index = JSON.parse(
    readFileSync(join(docsRoot, 'build/search-index.json'), 'utf8'),
  );
  const urls = new Set(index.entries.map((entry) => entry.u));
  let types = 0;
  for (const pkg of reference.packages)
    for (const view of pkg.groups.flatMap((group) => group.types)) {
      assert.ok(urls.has(view.href), view.href);
      types++;
    }
  assert.equal(
    index.entries.filter((entry) => entry.u.startsWith('/api/')).length,
    types,
  );
});

test('renders documentation with links for crefs and escapes text', () => {
  const api = new ApiReference(
    {
      release: '1.0.0',
      extractors: {},
      contentDigest: '',
      packages: [
        {
          ecosystem: 'nuget',
          package: 'Demo',
          version: '1.0.0',
          url: 'https://api.nuget.org/v3-flatcontainer/demo/1.0.0/demo.1.0.0.nupkg',
          file: 'dotnet/Demo.json',
        },
      ],
    },
    {
      'dotnet/Demo.json': {
        package: 'Demo',
        version: '1.0.0',
        types: [
          {
            id: 'T:Demo.Widget',
            namespace: 'Demo',
            name: 'Widget',
            kind: 'class',
            signature: ['public class ', ['Widget', 'T:Demo.Widget']],
            docs: {
              summary: [
                'Uses <b> & ',
                { see: 'M:Demo.Widget.Run(System.String)' },
                ', ',
                { see: 'T:System.String' },
                ' and ',
                { see: 'T:Other.Unknown' },
                { href: 'javascript:alert(1)', t: 'bad' },
              ],
            },
            members: [
              {
                id: 'M:Demo.Widget.Run(System.String)',
                kind: 'method',
                name: 'Run',
                signature: ['public void Run(string value)'],
              },
              {
                id: 'M:Demo.Widget.Run(System.Int32)',
                kind: 'method',
                name: 'Run',
                signature: ['public void Run(int value)'],
              },
            ],
          },
        ],
      },
    },
  );
  const html = api.docs(api.packages[0].groups[0].types[0].type);
  assert.match(html, /Uses &lt;b&gt; &amp; /);
  assert.match(
    html,
    /<a href="\/api\/Demo\/Demo.Widget\/#Run"><code>Widget.Run<\/code><\/a>/,
  );
  assert.match(
    html,
    /<a href="https:\/\/learn.microsoft.com\/dotnet\/api\/system.string"><code>String<\/code><\/a>/,
  );
  assert.match(html, /<code>Unknown<\/code>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.equal(
    api.href('M:Demo.Widget.Run(System.Int32)'),
    '/api/Demo/Demo.Widget/#Run-2',
  );
  assert.equal(
    learnUrl('T:System.Collections.Generic.List`1'),
    'https://learn.microsoft.com/dotnet/api/system.collections.generic.list-1',
  );
  assert.equal(learnUrl('T:Runic.Assets.AssetPath'), null);
  assert.equal(
    shortName('M:Demo.Widget.#ctor(System.String)'),
    'Widget.constructor',
  );
});

test('resolves inheritdoc and positional record parameters across packages', () => {
  const base = {
    package: 'Base',
    version: '1',
    types: [
      {
        id: 'T:A.IService',
        kind: 'interface',
        members: [
          { id: 'M:A.IService.Start', docs: { summary: ['Starts it.'] } },
        ],
      },
      {
        id: 'T:A.Root',
        kind: 'class',
        docs: { summary: ['Root type.'] },
        members: [{ id: 'P:A.Root.Name', docs: { summary: ['The name.'] } }],
      },
    ],
  };
  const derived = {
    package: 'Derived',
    version: '1',
    types: [
      {
        id: 'T:B.Service',
        kind: 'class',
        base: 'T:A.Root',
        interfaces: ['T:A.IService'],
        docs: { inheritdoc: {} },
        members: [
          { id: 'M:B.Service.Start', docs: { inheritdoc: {} } },
          {
            id: 'P:B.Service.Name',
            docs: { inheritdoc: {}, remarks: ['Own.'] },
          },
          {
            id: 'M:B.Service.Other',
            docs: { inheritdoc: { cref: 'M:A.IService.Start' } },
          },
          {
            id: 'M:B.Service.Lost',
            docs: { inheritdoc: { cref: 'M:X.Gone' } },
          },
        ],
      },
      {
        id: 'T:B.Point',
        kind: 'record',
        docs: {
          summary: ['A point.'],
          params: [{ name: 'X', doc: ['Across.'] }],
        },
        members: [{ id: 'P:B.Point.X', kind: 'property', name: 'X' }],
      },
    ],
  };
  finishApiPackages([base, derived]);
  const [service, point] = derived.types;
  assert.deepEqual(service.docs, { summary: ['Root type.'] });
  assert.equal(service.inherited, 'T:A.Root');
  const [start, name, other, lost] = service.members;
  assert.deepEqual(start.docs.summary, ['Starts it.']);
  assert.equal(start.inherited, 'M:A.IService.Start');
  assert.deepEqual(name.docs, { summary: ['The name.'], remarks: ['Own.'] });
  assert.equal(other.inherited, 'M:A.IService.Start');
  assert.deepEqual(lost.docs, { inheritdoc: { cref: 'M:X.Gone' } });
  assert.deepEqual(point.members[0].docs.summary, ['Across.']);
});

test('the checked-in reference resolves most inheritdoc and cross references', () => {
  let inherited = 0;
  let unresolved = 0;
  for (const model of Object.values(models))
    for (const type of model.types)
      for (const entry of [type, ...(type.members ?? [])]) {
        if (entry.inherited) inherited++;
        if (entry.docs?.inheritdoc) unresolved++;
      }
  assert.ok(inherited > 50, `${inherited} inherited`);
  assert.ok(unresolved < inherited / 2, `${unresolved} unresolved`);
});
