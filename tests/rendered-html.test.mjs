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
    /release status is generated from the release manifest authority/,
  );
  assert.doesNotMatch(html, /\d+\.\d+\.\d+-(?:preview|beta)/i);
  assert.doesNotMatch(html, /dotnet add package|npm (?:install|i)/i);
  assert.doesNotMatch(html, /Public preview|Start building/i);
  assert.match(html, /The v1\.0 release train is not published\./);
  assert.match(
    html,
    /No v1\.0 package versions or distributions have been assigned\./,
  );
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

test('presents Flow as a historical archive, not an active product seam', async () => {
  const html = await render();

  assert.match(html, /Seven maintained tools\. One historical archive\./);
  assert.match(html, /Historical archive/);
  assert.match(html, /Migration guidance only/);
  assert.match(html, /Not a current package identity/);
  assert.match(html, /No replacement or forwarding alias/);
  assert.match(html, /Flow is outside the v1\.0 train\./);
  assert.match(html, /Read the archive guidance/);
  assert.doesNotMatch(html, /RunicFlow\.ApplicationBridge/);
  assert.doesNotMatch(html, /deprecated migration sources/i);
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
  assert.match(html, /Runic Desktop/);
  assert.match(html, /WebUI’s public API/);
  assert.match(html, /Explicit seams/);
});
