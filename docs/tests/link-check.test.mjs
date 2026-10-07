// Checks every link in the prerendered site without a network. Internal links
// must resolve to a built file and, with a fragment, to an element id in the
// target page. External links are only checked for valid syntax.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const buildDirectory = fileURLToPath(new URL('../build/', import.meta.url));
const origin = 'https://docs.runic-artifex.eu';
const githubGuideSource =
  /^https:\/\/github\.com\/Runic-Artifex\/runic-site\/(?:blob|tree)\/main\/docs\/guides\//;

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function pagePath(file) {
  const path = `/${relative(buildDirectory, file).split(sep).join('/')}`;
  return path.endsWith('/index.html')
    ? path.slice(0, -'index.html'.length)
    : path;
}

/** Built file that the static host serves for a site path, if any. */
export function servedFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  const direct = join(buildDirectory, decoded);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const index = join(direct, 'index.html');
  if (existsSync(index)) return index;
  const html = `${direct.replace(/[\\/]$/, '')}.html`;
  return existsSync(html) ? html : null;
}

function stripMarkup(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeAttribute(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const attributePattern =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const tagPattern =
  /<([a-zA-Z][\w-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;

/** Parses double-quoted, single-quoted and unquoted attributes of a tag. */
export function parseAttributes(source) {
  const attributes = new Map();
  for (const match of source.matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    if (!attributes.has(name))
      attributes.set(
        name,
        decodeAttribute(match[2] ?? match[3] ?? match[4] ?? ''),
      );
  }
  return attributes;
}

/** Start tags with their attributes, ignoring comments and script bodies. */
export function tags(html) {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2>/gi, '$1</$2>');
  return [...markup.matchAll(tagPattern)].map((match) => ({
    name: match[1].toLowerCase(),
    attributes: parseAttributes(match[2]),
    end: match.index + match[0].length,
    markup,
  }));
}

function srcsetUrls(value) {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

const imageMeta = new Set(['og:image', 'og:image:url', 'twitter:image']);

/**
 * Every URL a page references: `href` on `a` and `link`, `src` and
 * `srcset` on embedded content, and social preview images.
 */
export function references(html) {
  const found = [];
  for (const tag of tags(html)) {
    const { name, attributes } = tag;
    const href = attributes.get('href');
    if (name === 'a' && href !== undefined) {
      const close = tag.markup.indexOf('</a>', tag.end);
      const text = stripMarkup(
        tag.markup.slice(tag.end, close < 0 ? undefined : close),
      );
      found.push({ url: href, text });
    } else if (name === 'link' && href !== undefined) {
      found.push({ url: href, text: '' });
    }
    if (attributes.has('src'))
      found.push({ url: attributes.get('src'), text: '' });
    if (attributes.has('srcset'))
      for (const url of srcsetUrls(attributes.get('srcset')))
        found.push({ url, text: '' });
    const property = attributes.get('property') ?? attributes.get('name');
    if (name === 'meta' && imageMeta.has(property) && attributes.has('content'))
      found.push({ url: attributes.get('content'), text: '' });
  }
  return found;
}

/** Fragment targets: only `id` attributes define anchors. */
export function anchorIds(html) {
  return new Set(
    tags(html)
      .map((tag) => tag.attributes.get('id'))
      .filter((id) => id !== undefined),
  );
}

const pages = new Map(
  htmlFiles(buildDirectory).map((file) => [
    pagePath(file),
    readFileSync(file, 'utf8'),
  ]),
);
const idCache = new Map();

function ids(file) {
  if (!idCache.has(file)) {
    idCache.set(file, anchorIds(readFileSync(file, 'utf8')));
  }
  return idCache.get(file);
}

test('the build contains the guide pages to check', () => {
  assert.ok(pages.size > 40, `found only ${pages.size} pages`);
  assert.ok(pages.has('/guides/'));
});

test('every internal link and fragment resolves in the built site', () => {
  const failures = [];
  let checked = 0;
  for (const [path, html] of pages) {
    const base = new URL(path, origin);
    for (const { url } of references(html)) {
      if (url === '') {
        failures.push(`${path}: empty link`);
        continue;
      }
      let target;
      try {
        target = new URL(url, base);
      } catch {
        failures.push(`${path}: invalid URL ${url}`);
        continue;
      }
      if (target.origin !== origin) continue;
      checked++;
      const file = servedFile(target.pathname);
      if (!file) {
        failures.push(`${path}: ${url} -> missing ${target.pathname}`);
        continue;
      }
      if (target.hash && file.endsWith('.html')) {
        const fragment = decodeURIComponent(target.hash.slice(1));
        if (!ids(file).has(fragment))
          failures.push(`${path}: ${url} -> missing fragment #${fragment}`);
      }
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(checked > 1000, `checked only ${checked} internal links`);
});

test('external links are well-formed', () => {
  const failures = [];
  for (const [path, html] of pages) {
    for (const { url } of references(html)) {
      if (!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) continue;
      let target;
      try {
        target = new URL(url);
      } catch {
        failures.push(`${path}: invalid URL ${url}`);
        continue;
      }
      if (target.origin === origin) continue;
      if (!['https:', 'mailto:'].includes(target.protocol))
        failures.push(`${path}: use https for ${url}`);
      else if (target.protocol === 'https:' && !target.hostname.includes('.'))
        failures.push(`${path}: unexpected host in ${url}`);
      else if (/\s/.test(url)) failures.push(`${path}: whitespace in ${url}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('pages link guides on the site, not their GitHub sources', () => {
  const failures = [];
  for (const [path, html] of pages) {
    for (const { url, text } of references(html)) {
      if (githubGuideSource.test(url) && text !== 'View source on GitHub')
        failures.push(`${path}: ${url} (${text})`);
    }
  }
  assert.deepEqual(failures, []);
});

test('the link parser reads every attribute form and only id anchors', () => {
  const html = `<!-- <a href="/commented"> -->
<a href='/single/'>Single</a> <a href=/unquoted/ class=x>Unquoted</a>
<a class="x" href="/double/?a=1&amp;b=2">Double</a>
<img alt="a > b" src="/img.png" srcset="/img-1x.png 1x, /img-2x.png 2x">
<meta property="og:image" content="https://docs.runic-artifex.eu/og.png">
<meta name="twitter:image" content='/tw.png'>
<script src="/app.js">const fake = '<a href="/in-script">';</script>
<div data-id="data" name="named" id='real'></div><span id=bare></span>`;
  assert.deepEqual(
    references(html).map((reference) => reference.url),
    [
      '/single/',
      '/unquoted/',
      '/double/?a=1&b=2',
      '/img.png',
      '/img-1x.png',
      '/img-2x.png',
      'https://docs.runic-artifex.eu/og.png',
      '/tw.png',
      '/app.js',
    ],
  );
  assert.equal(references(html)[1].text, 'Unquoted');
  assert.deepEqual([...anchorIds(html)].sort(), ['bare', 'real']);
  assert.deepEqual(
    Object.fromEntries(parseAttributes(` href='a b' disabled data-x=1`)),
    { href: 'a b', disabled: '', 'data-x': '1' },
  );
});
