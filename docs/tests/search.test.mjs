import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

import {
  SiteSearch,
  searchTerms,
  termShardKey,
} from '../src/lib/search-core.ts';

const buildDirectory = new URL('../build/', import.meta.url);
const read = (path) => readFileSync(new URL(path, buildDirectory));
const index = JSON.parse(read('search-index.json').toString('utf8'));

/** A search over the build that records each file it loads. */
function siteSearch() {
  const loaded = new Set();
  const search = new SiteSearch(async (path) => {
    loaded.add(path);
    return JSON.parse(read(path).toString('utf8'));
  });
  return { search, loaded };
}

/** The bytes a browser downloads for these files, raw and gzipped. */
function transfer(paths) {
  let raw = 0;
  let gzip = 0;
  for (const path of paths) {
    const bytes = read(path);
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
  }
  return { raw, gzip };
}

// The previous search, which loaded every text at once, as the reference.
const entries = index.entries.map((entry, id) => ({
  ...entry,
  x:
    entry.x ??
    JSON.parse(read(`search-index/text/${id}.json`).toString('utf8')),
}));

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordStart(haystack, term) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}`, 'u').test(
    haystack,
  );
}

function fullTextSearch(query) {
  const terms = searchTerms(query);
  const phrase = query.trim().toLowerCase();
  const results = [];
  for (const entry of entries) {
    const title = entry.t.toLowerCase();
    const section = (entry.s ?? '').toLowerCase();
    const text = entry.x.toLowerCase();
    const path = entry.u
      .split('#')[0]
      .toLowerCase()
      .replace(/[/_-]+/g, ' ');
    let score = 0;
    let matched = true;
    for (const term of terms) {
      const inTitle = title.includes(term);
      const inSection = section.includes(term);
      const inText = text.includes(term);
      const inPath = wordStart(path, term);
      if (!inTitle && !inSection && !inText && !inPath) {
        matched = false;
        break;
      }
      if (inTitle) score += wordStart(title, term) ? 12 : 6;
      if (inSection) score += wordStart(section, term) ? 8 : 4;
      if (inText) score += wordStart(text, term) ? 2 : 1;
      if (inPath) score += 5;
    }
    if (!matched) continue;
    if (terms.length > 1 && text.includes(phrase)) score += 4;
    if (terms.length > 1 && `${title} ${section} ${path}`.includes(phrase))
      score += 10;
    if (!entry.s) score += 1;
    results.push({ u: entry.u, score });
  }
  return results.sort((a, b) => b.score - a.score || a.u.localeCompare(b.u));
}

// Representative queries: guides, API types, a product and a sample page,
// with the top results they returned before the index was split.
const queries = {
  'host selection': [
    '/guides/desktop/host-selection/',
    '/guides/desktop/host-choice-and-footprint/',
  ],
  'getting started': ['/guides/application/getting-started/'],
  RunicNavigator: [
    '/api/Runic.Navigation/Runic.Navigation.RunicNavigatorOptions/',
    '/api/Runic.Navigation/Runic.Navigation.RunicNavigator/',
  ],
  ReactiveLeaveConfirmation: [
    '/guides/application/glossary/#navigation',
    '/guides/application/guides/pages-and-navigation/#coming-from-reactiveui-navigation',
    '/guides/application/guides/pages-and-navigation/#guard-against-leaving',
  ],
  IRunicWindowService: [
    '/guides/application/samples/cross-window/',
    '/guides/application/glossary/#hosts-and-windows',
    '/guides/application/samples/cross-window/#open-a-window-from-a-viewmodel',
  ],
  DynamicData: ['/guides/application/guides/dynamicdata/'],
  MessageFormat: [
    '/products/runic-translations-editor/',
    '/products/runic-translations/',
    '/guides/translations/#message-files',
  ],
  'sleep inhibition': ['/guides/desktop/inhibition/'],
  'leave guard': [
    '/api/Runic.Navigation/Runic.Navigation.LeaveConfirmation/',
    '/guides/application/guides/pages-and-navigation/#guard-against-leaving',
  ],
  'wpf migration': [
    '/guides/application/migrations/wpf-hybrid/#single-one-wpf-project',
  ],
  'reactiveui command': [
    '/guides/application/reference/reactiveui/#typed-command-operations',
  ],
};

// Each search loads the index, its terms' shards and the texts it shows.
const budget = { raw: 400 * 1024, gzip: 104 * 1024 };

test('representative queries keep their top results within the budget', async () => {
  for (const [query, top] of Object.entries(queries)) {
    const { search, loaded } = siteSearch();
    const { total, results } = await search.search(query);
    assert.deepEqual(
      results.slice(0, top.length).map((result) => result.entry.u),
      top,
      query,
    );
    const reference = fullTextSearch(query);
    assert.equal(total, reference.length, query);
    assert.deepEqual(
      results.map((result) => ({ u: result.entry.u, score: result.score })),
      reference.slice(0, 20),
      query,
    );
    const size = transfer(loaded);
    assert.ok(size.raw <= budget.raw, `${query}: ${size.raw} bytes`);
    assert.ok(size.gzip <= budget.gzip, `${query}: ${size.gzip} gzipped`);
  }
});

test('any search of up to three terms fits the budget', () => {
  // The index, the three largest term shards and the 20 longest texts.
  const largest = (directory, count) =>
    readdirSync(new URL(directory, buildDirectory))
      .filter((file) => file.endsWith('.json'))
      .map((file) => `${directory}${file}`)
      .sort((a, b) => read(b).length - read(a).length)
      .slice(0, count);
  const size = transfer([
    'search-index.json',
    ...largest('search-index/terms/', 3),
    ...largest('search-index/text/', 20),
  ]);
  assert.ok(size.raw <= budget.raw, `${size.raw} bytes`);
  assert.ok(size.gzip <= budget.gzip, `${size.gzip} gzipped`);
});

test('search finds words inside identifiers and marks excerpts', async () => {
  const { search, loaded } = siteSearch();
  const [first] = (await search.search('host selection')).results;
  assert.equal(first.entry.u, '/guides/desktop/host-selection/');
  // `Navigator` is part of RunicNavigator in guide text.
  assert.ok(
    (await search.search('navigator')).results.some((result) =>
      result.entry.u.startsWith('/guides/'),
    ),
  );
  assert.ok(
    (await search.search('DynamicData')).results.some((result) =>
      result.entry.u.startsWith('/guides/application/guides/dynamicdata/'),
    ),
  );
  assert.deepEqual(await search.search('zzzz-not-a-word'), {
    total: 0,
    results: [],
  });
  assert.deepEqual(await search.search('   '), { total: 0, results: [] });
  assert.deepEqual(searchTerms('Runic.Assets  <VERSION> c#'), [
    'runic.assets',
    'version',
    'c#',
  ]);
  const [result] = (await search.search('MessageFormat')).results;
  assert.ok(
    result.excerpt.some(
      (part) => part.match && /messageformat/i.test(part.text),
    ),
  );
  // Typing a longer word reuses the shard of its first three characters.
  const shards = () => [...loaded].filter((path) => path.includes('/terms/'));
  await search.search('inhib');
  const before = shards().length;
  await search.search('inhibition');
  assert.equal(shards().length, before);
  assert.equal(termShardKey('i'), null);
});

test('one-character terms match titles, headings and paths only', async () => {
  const { search } = siteSearch();
  const { total } = await search.search('x');
  const path = (entry) =>
    entry.u
      .split('#')[0]
      .toLowerCase()
      .replace(/[/_-]+/g, ' ');
  assert.equal(
    total,
    index.entries.filter(
      (entry) =>
        `${entry.t} ${entry.s ?? ''}`.toLowerCase().includes('x') ||
        wordStart(path(entry), 'x'),
    ).length,
  );
});
