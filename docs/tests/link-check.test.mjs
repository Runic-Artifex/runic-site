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
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** `<a href>`, `<link href>`, `<script src>` and `<img src>` in a page. */
function references(html) {
  const found = [];
  const body = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const match of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const href = /\bhref="([^"]*)"/.exec(match[1])?.[1];
    if (href !== undefined)
      found.push({ url: decodeAttribute(href), text: stripMarkup(match[2]) });
  }
  for (const match of body.matchAll(
    /<(?:link|script|img|source)\b[^>]*\b(?:href|src)="([^"]*)"/g,
  )) {
    found.push({ url: decodeAttribute(match[1]), text: '' });
  }
  return found;
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
    const html = readFileSync(file, 'utf8');
    idCache.set(
      file,
      new Set(
        [...html.matchAll(/\b(?:id|name)="([^"]+)"/g)].map((match) =>
          decodeAttribute(match[1]),
        ),
      ),
    );
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
