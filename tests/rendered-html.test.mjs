import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { products } from '../src/lib/products.ts';

const readPage = (path) =>
  readFile(new URL(`../build/${path}`, import.meta.url), 'utf8');

test('prerenders the homepage with canonical metadata and accessible entry', async () => {
  const html = await readPage('index.html');
  assert.ok(html.includes('href="https://runic-artifex.eu/"'));
  assert.ok(html.includes('content="https://runic-artifex.eu/og.png"'));
  assert.equal(html.match(/<h1\b/g)?.length, 1);
  assert.match(html, /<main id="content" tabindex="-1">/);
  assert.match(html, /href="#content"/);
  assert.match(html, /<nav aria-label="Primary navigation">/);
  for (const match of html.matchAll(/href="(?:\.\/)?#([^"]+)"/g)) {
    assert.ok(
      html.includes(`id="${match[1]}"`),
      `missing fragment ${match[1]}`,
    );
  }
});

test('links each SDK capability to its guide, current source, and existing artwork', async () => {
  const html = await readPage('index.html');
  assert.equal(products.length, 5);
  for (const product of products) {
    assert.ok(html.includes(`href="${product.docs}"`));
    assert.ok(html.includes(`href="${product.source}"`));
    const sourceRepository =
      product.slug === 'runic-command-line'
        ? 'runic-cli-sdk'
        : product.slug === 'runic-translations'
          ? 'runic-translations-sdk'
          : 'runic-sdk';
    assert.ok(
      product.source.startsWith(
        `https://github.com/Runic-Artifex/${sourceRepository}/tree/main/`,
      ),
    );
    await access(
      new URL(`../static/products/${product.slug}.png`, import.meta.url),
    );
  }
  for (const match of html.matchAll(/src="(\/[^"?]+)"/g)) {
    await access(new URL(`../build${match[1]}`, import.meta.url));
  }
});

test('offers setup and runnable examples without embedding release state', async () => {
  const html = await readPage('index.html');
  assert.ok(
    html.includes('href="https://docs.runic-artifex.eu/getting-started/"'),
  );
  // The creator command carries no version; dnx resolves the latest preview.
  assert.ok(html.includes('dnx Runic.Create --prerelease'));
  assert.ok(html.includes('href="https://docs.runic-artifex.eu/create/"'));
  assert.doesNotMatch(html, /runic-app-(?:react|vue|svelte|angular)/);
  assert.ok(
    html.includes(
      'href="https://github.com/Runic-Artifex/runic-sdk/tree/main/examples"',
    ),
  );
  assert.doesNotMatch(
    html,
    /\d+\.\d+\.\d+-(?:preview|beta)|release manifest authority/,
  );
  assert.ok(
    !products.some((product) =>
      [
        'runic-flow',
        'runic-toolkit',
        'runic-translations-editor',
        'cs-webui',
      ].includes(product.slug),
    ),
  );
});

test('preserves the CI bookmark with a direct link to current workflow results', async () => {
  const html = await readPage('ci/index.html');
  assert.ok(
    html.includes('href="https://github.com/Runic-Artifex/runic-sdk/actions"'),
  );
  assert.match(html, /<main id="content"/);
  const home = await readPage('index.html');
  assert.doesNotMatch(home, /href="(?:\.\/)?ci\//);
});
