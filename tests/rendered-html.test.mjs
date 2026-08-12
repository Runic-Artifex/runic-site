import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { products } from '../src/lib/products.ts';

const htmlPath = fileURLToPath(new URL('../build/index.html', import.meta.url));

function render() {
  return readFile(htmlPath, 'utf8');
}

function stripMarkup(value) {
  return value
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('renders the family landing page with canonical metadata', async () => {
  const html = await render();

  assert.match(
    html,
    /<title>Independent open-source \.NET tools · Runic Artifex<\/title>/,
  );
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/runic-artifex\.eu\/"/,
  );
  assert.match(
    html,
    /property="og:image" content="https:\/\/runic-artifex\.eu\/og\.png"/,
  );
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.equal(html.match(/<h1\b/g)?.length, 1);
  assert.match(
    html,
    /<h1>Build the application you need\. Keep the tools independent\.<\/h1>/,
  );
});

test('keeps the landing page distinct from technical documentation', async () => {
  const html = await render();

  assert.match(html, /Independent tools\. Explicit seams\./);
  assert.match(html, /Read the documentation/);
  assert.match(
    html,
    /authoritative home for exact versions and release status/,
  );
  assert.doesNotMatch(html, /\d+\.\d+\.\d+-(?:preview|beta)/i);
  assert.doesNotMatch(html, /dotnet add package|npm (?:install|i)/i);
  assert.doesNotMatch(html, /Verified candidate|not yet published/i);
});

test('introduces every product and links to its guide and source', async () => {
  const html = await render();

  for (const product of products) {
    assert.match(
      html,
      new RegExp(`>${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`),
    );
    assert.match(
      html,
      new RegExp(`href="${product.docs.replaceAll('.', '\\.')}"`),
    );
    assert.match(
      html,
      new RegExp(`href="${product.source.replaceAll('.', '\\.')}"`),
    );
    assert.match(html, new RegExp(`src="/products/${product.slug}\\.png"`));
  }
});

test('provides semantic landmarks, keyboard entry, and valid page fragments', async () => {
  const html = await render();

  assert.match(
    html,
    /<a class="skip-link" href="#content">Skip to content<\/a>/,
  );
  assert.match(html, /<nav aria-label="Primary navigation">/);
  assert.match(html, /<main id="content" tabindex="-1">/);
  assert.match(html, /<footer class="site-footer">/);

  for (const fragment of ['principles', 'products', 'integrations']) {
    assert.match(html, new RegExp(`id="${fragment}"`));
    assert.match(html, new RegExp(`href="(?:\\./)?#${fragment}"`));
  }
});

test('explains independent ownership before using architectural shorthand', async () => {
  const html = await render();
  const text = stripMarkup(html);
  const explanation =
    'Each tool works on its own. Official integrations connect tools without forcing their cores to depend on each other';
  const shorthand = 'Explicit seams';

  assert.ok(
    text.indexOf(explanation) >= 0,
    'expected plain-language explanation',
  );
  assert.ok(text.indexOf(shorthand) >= 0, 'expected explicit-seams wording');
  assert.match(html, /RunicFlow\.ApplicationBridge/);
  assert.match(html, /Product-owned adapter/);
});
