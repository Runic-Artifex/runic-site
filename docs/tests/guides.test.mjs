import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

import {
  guideNavigation,
  navigationFile,
} from '../src/lib/guide-navigation.ts';
import {
  createSlugger,
  guideHref,
  renderGuide,
  renderGuides,
  resolveGuideLink,
  siteHrefForGitHubGuide,
} from '../src/lib/guides-core.ts';
import { prepareIndex, search, searchTerms } from '../src/lib/search-core.ts';

const guidesRoot = new URL('../guides/', import.meta.url);
const buildDirectory = new URL('../build/', import.meta.url);
const docsRoot = new URL('../', import.meta.url);
const docsFileExists = (path) => existsSync(new URL(path, docsRoot));

function guideFiles(directory = guidesRoot, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? guideFiles(
            new URL(`${entry.name}/`, directory),
            `${prefix}${entry.name}/`,
          )
        : entry.name.endsWith('.md')
          ? [`${prefix}${entry.name}`]
          : [],
    )
    .sort();
}

const files = guideFiles();
const sources = files.map((file) => ({
  file,
  markdown: readFileSync(new URL(file, guidesRoot), 'utf8'),
}));

function render(path) {
  return readFileSync(new URL(`.${path}index.html`, buildDirectory), 'utf8');
}

test('maps guide files to site paths', () => {
  assert.equal(guideHref('README.md'), '/guides/');
  assert.equal(guideHref('application/README.md'), '/guides/application/');
  assert.equal(
    guideHref('application/existing-app.md'),
    '/guides/application/existing-app/',
  );
});

test('maps GitHub guide source URLs to site paths, keeping anchors', () => {
  const github =
    'https://github.com/Runic-Artifex/runic-site/blob/main/docs/guides';
  assert.equal(
    siteHrefForGitHubGuide(
      `${github}/application/tutorial/README.md#5-render-the-views`,
    ),
    '/guides/application/tutorial/#5-render-the-views',
  );
  assert.equal(
    siteHrefForGitHubGuide(`${github}/desktop/host-selection.md`),
    '/guides/desktop/host-selection/',
  );
  assert.equal(
    siteHrefForGitHubGuide(
      'https://github.com/Runic-Artifex/runic-site/tree/main/docs/guides/assets',
    ),
    '/guides/assets/',
  );
  assert.equal(
    siteHrefForGitHubGuide(
      'https://github.com/Runic-Artifex/runic-sdk/blob/main/README.md',
    ),
    null,
  );
  // Every guide source has a site page at its mapped path.
  for (const file of files) {
    const href = siteHrefForGitHubGuide(`${github}/${file}`);
    assert.ok(
      statSync(new URL(`.${href}index.html`, buildDirectory)).isFile(),
      file,
    );
  }
});

test('creates GitHub-compatible heading anchors', () => {
  const slug = createSlugger();
  assert.equal(slug('5. Render the Views'), '5-render-the-views');
  assert.equal(
    slug('Upgrading generated clients'),
    'upgrading-generated-clients',
  );
  assert.equal(slug('`IViewFor<T>` support'), 'iviewfort-support');
  assert.equal(
    slug('Upgrading generated clients'),
    'upgrading-generated-clients-1',
  );
  assert.equal(
    slug('Upgrading generated clients'),
    'upgrading-generated-clients-2',
  );
});

test('resolves guide links to site routes and other files to GitHub', () => {
  const known = new Set(['README.md', 'a/README.md', 'a/b.md', 'c.md']);
  assert.equal(
    resolveGuideLink('a/README.md', 'b.md#x', known, docsFileExists),
    '/guides/a/b/#x',
  );
  assert.equal(
    resolveGuideLink('a/b.md', '../c.md', known, docsFileExists),
    '/guides/c/',
  );
  assert.equal(
    resolveGuideLink('a/b.md', 'README.md', known, docsFileExists),
    '/guides/a/',
  );
  assert.equal(
    resolveGuideLink('c.md', 'a/', known, docsFileExists),
    '/guides/a/',
  );
  assert.equal(
    resolveGuideLink('c.md', 'a', known, docsFileExists),
    '/guides/a/',
  );
  assert.equal(
    resolveGuideLink('c.md', '#local', known, docsFileExists),
    '#local',
  );
  assert.equal(
    resolveGuideLink(
      'c.md',
      '../tests/guide-snippets.test.mjs',
      known,
      docsFileExists,
    ),
    'https://github.com/Runic-Artifex/runic-site/blob/main/docs/tests/guide-snippets.test.mjs',
  );
  assert.equal(
    resolveGuideLink('c.md', 'https://example.com/x.md', known, docsFileExists),
    'https://example.com/x.md',
  );
  assert.equal(
    resolveGuideLink(
      'c.md',
      'https://github.com/Runic-Artifex/runic-site/blob/main/docs/guides/a/b.md#y',
      known,
      docsFileExists,
    ),
    '/guides/a/b/#y',
  );
  assert.throws(
    () => resolveGuideLink('c.md', 'missing.md', known, docsFileExists),
    /missing guide/,
  );
  assert.throws(
    () => resolveGuideLink('c.md', '../../x.md', known, docsFileExists),
    /outside docs/,
  );
});

test('allows only https, mailto, relative and fragment links', () => {
  const known = new Set(['a.md']);
  for (const href of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,x',
    'vbscript:x',
    'http://example.com/',
    'ftp://example.com/',
    'file:///etc/passwd',
    '//example.com/x',
  ])
    assert.throws(
      () => resolveGuideLink('a.md', href, known, docsFileExists),
      /disallowed link scheme|protocol-relative/,
      href,
    );
  for (const href of ['https://example.com/', 'mailto:security@example.com'])
    assert.equal(resolveGuideLink('a.md', href, known, docsFileExists), href);
  for (const markdown of [
    '# T\n\n[x](javascript:alert(1))\n',
    '# T\n\n![x](JAVASCRIPT:alert(1))\n',
    '# T\n\n[x][ref]\n\n[ref]: data:text/html,x\n',
  ])
    assert.throws(
      () => renderGuide({ file: 'a.md', markdown }, known, docsFileExists),
      /disallowed link scheme/,
      markdown,
    );
});

test('links to other docs files fail when the file does not exist', () => {
  const known = new Set(['a.md']);
  assert.equal(
    resolveGuideLink('a.md', '../README.md#develop', known, docsFileExists),
    'https://github.com/Runic-Artifex/runic-site/blob/main/docs/README.md#develop',
  );
  assert.equal(
    resolveGuideLink('a.md', '../plans/', known, docsFileExists),
    'https://github.com/Runic-Artifex/runic-site/blob/main/docs/plans/',
  );
  for (const href of ['../tests/missing.test.mjs', 'image.png', '../nowhere/'])
    assert.throws(
      () => resolveGuideLink('a.md', href, known, docsFileExists),
      /missing file/,
      href,
    );
});

test('renders one title, escapes raw HTML and splits sections', () => {
  const guide = renderGuide(
    {
      file: 'a/b.md',
      markdown:
        '# Title `code`\n\nIntro with <script>alert(1)</script> text.\n\n<div>block</div>\n\n## First part\n\nBody **bold**.\n\n```sh docs-test=commands\necho hi\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n',
    },
    new Set(['a/b.md']),
    docsFileExists,
  );
  assert.equal(guide.title, 'Title code');
  assert.doesNotMatch(guide.html, /<h1|<script|<div>block/);
  assert.match(guide.html, /&lt;script&gt;/);
  assert.match(guide.html, /<h2 id="first-part">First part<\/h2>/);
  assert.match(
    guide.html,
    /<pre tabindex="0" role="region" aria-label="sh code example"><code class="language-sh">echo hi/,
  );
  assert.match(
    guide.html,
    /<div class="table-scroll" tabindex="0" role="region" aria-label="Table: A, B"><table>/,
  );
  assert.deepEqual(
    guide.sections.map((section) => section.id),
    [null, 'first-part'],
  );
  assert.equal(guide.sections[1].text, 'Body bold. A B 1 2');
  assert.throws(
    () =>
      renderGuide(
        { file: 'x.md', markdown: 'No title\n' },
        new Set(['x.md']),
        docsFileExists,
      ),
    /level-1 heading/,
  );
});

test('every guide renders and appears once in the guide navigation', () => {
  const guides = renderGuides(sources, docsFileExists);
  assert.equal(guides.length, files.length);
  const listed = guideNavigation.flatMap((group) =>
    group.files.map(navigationFile),
  );
  assert.equal(new Set(listed).size, listed.length, 'a guide is listed twice');
  assert.deepEqual([...listed].sort(), files);

  // Development and test infrastructure comes last, apart from product guides.
  const last = guideNavigation.at(-1);
  assert.equal(last.title, 'Contributing and testing');
  assert.deepEqual(last.files.map(navigationFile).sort(), [
    'desktop/container-automation.md',
    'desktop/nixos-development.md',
    'portal-implementation-audit.md',
  ]);
  const contributing = guideNavigation.find((group) =>
    group.files.includes('application/contributing/README.md'),
  );
  assert.equal(contributing.title, 'Contributing to Application');
  const sidebar = render('/guides/');
  assert.match(
    sidebar,
    /<h2 class="guide-nav-heading" id="guide-nav-0">\s*Overview\s*<\/h2>\s*<ul aria-labelledby="guide-nav-0">/,
  );
});

test('all guides are reachable from the guide navigation of every guide page', () => {
  const guides = renderGuides(sources, docsFileExists);
  for (const guide of guides) {
    const html = render(guide.href);
    const nav = html.match(/<nav class="guide-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, `${guide.href} has no guide navigation`);
    for (const other of guides)
      assert.ok(
        nav.includes(`href="${other.href}"`),
        `${guide.href} -> ${other.href}`,
      );
    assert.match(nav, new RegExp(`href="${guide.href}" aria-current="page"`));
    assert.equal(html.match(/<h1\b/g)?.length, 1, guide.href);
    assert.ok(html.includes(guide.sourceUrl), guide.href);
  }
  // The primary navigation reaches the guide index from every page.
  assert.match(render('/'), /<a href="\.\/guides"[^>]*>Guides<\/a>/);
});

test('portal pages link the rendered guides', () => {
  for (const [path, guide] of [
    ['/products/runic-application/', '/guides/application/'],
    ['/products/runic-application/', '/guides/application/tutorial/'],
    ['/products/runic-desktop/', '/guides/desktop/host-selection/'],
    ['/products/runic-assets/', '/guides/assets/'],
    ['/packages/', '/guides/application/existing-app/'],
  ])
    assert.ok(render(path).includes(`href="${guide}"`), `${path} -> ${guide}`);
  assert.match(
    render('/getting-started/'),
    /href="\.\.\/guides\/application\/tutorial"/,
  );
});

test('builds a small offline search index over all guides and products', () => {
  const raw = readFileSync(new URL('search-index.json', buildDirectory));
  // Budget: the index loads only on the search page.
  assert.ok(raw.length < 352 * 1024, `index is ${raw.length} bytes`);
  assert.ok(gzipSync(raw).length < 88 * 1024, 'compressed index over budget');
  const index = JSON.parse(raw.toString('utf8'));
  assert.equal(index.version, 1);
  const pages = new Set(index.entries.map((entry) => entry.u.split('#')[0]));
  for (const guide of renderGuides(sources, docsFileExists))
    assert.ok(pages.has(guide.href), guide.href);
  assert.ok(pages.has('/products/runic-translations/'));
  for (const entry of index.entries) {
    assert.equal(typeof entry.t, 'string');
    assert.equal(typeof entry.x, 'string');
  }

  const prepared = prepareIndex(index);
  const [first] = search(prepared, 'host selection');
  assert.equal(first.entry.u, '/guides/desktop/host-selection/');
  assert.ok(
    search(prepared, 'DynamicData').some((r) =>
      r.entry.u.startsWith('/guides/application/guides/dynamicdata/'),
    ),
  );
  assert.deepEqual(search(prepared, 'zzzz-not-a-word'), []);
  assert.deepEqual(search(prepared, '   '), []);
  assert.deepEqual(searchTerms('Runic.Assets  <VERSION> c#'), [
    'runic.assets',
    'version',
    'c#',
  ]);
  const [result] = search(prepared, 'MessageFormat');
  assert.ok(
    result.excerpt.some(
      (part) => part.match && /messageformat/i.test(part.text),
    ),
  );
});

test('the search page works from a plain GET form', () => {
  const html = render('/search/');
  assert.match(html, /<form[^>]*role="search"/);
  assert.match(html, /name="q"/);
  assert.match(html, /<noscript>[\s\S]*needs JavaScript/);
  assert.match(
    render('/guides/'),
    /<form[^>]*action="\.\.\/search"[^>]*role="search"/,
  );
});
