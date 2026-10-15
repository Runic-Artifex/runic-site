import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import test from 'node:test';

import { appearanceKey, themeModes } from '../src/lib/appearance.ts';

const expectedThemeModes = ['system', 'light', 'dark'];
const expectedAppearanceKey = 'runic-docs.theme-mode';

test('initializes validated docs appearance before SvelteKit head rendering', async () => {
  const html = await readFile(
    new URL('../src/app.html', import.meta.url),
    'utf8',
  );
  const initializer = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

  assert.ok(initializer, 'missing pre-hydration appearance initializer');
  // No scheme is fixed in the markup: without JavaScript, tokens.css follows
  // prefers-color-scheme.
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="color-scheme" content="light dark" \/>/);
  assert.ok(
    html.indexOf('<script>') < html.indexOf('%sveltekit.head%'),
    'appearance initializer must precede %sveltekit.head%',
  );
  assert.deepEqual(themeModes, expectedThemeModes);
  assert.equal(appearanceKey, expectedAppearanceKey);

  const initializerModes = parseInitializerArray(initializer, 'modes');
  const initializerKeys = [
    ...initializer.matchAll(/localStorage\.getItem\(\s*'([^']+)'\s*,?\s*\)/g),
  ].map((match) => match[1]);

  assert.deepEqual(initializerModes, expectedThemeModes);
  assert.deepEqual(initializerModes, themeModes);
  assert.deepEqual(initializerKeys, [appearanceKey]);
  assert.match(initializer, /modes\.includes\(storedMode\)/);
  assert.match(initializer, /\? storedMode : 'system'/);
  assert.match(initializer, /prefers-color-scheme: dark/);
  assert.match(initializer, /classList\.toggle\('dark', dark\)/);
  assert.match(initializer, /dataset\.scheme = dark \? 'dark' : 'light'/);
  assert.match(initializer, /style\.colorScheme = dark \? 'dark' : 'light'/);
  assert.match(initializer, /root\.classList\.add\('js'\)/);
  assert.doesNotMatch(html, /palette|data-theme/);
  assert.doesNotMatch(html, /runic-translations\.theme-/);
  assert.doesNotMatch(html, /webui\.js|translations-editor/i);
});

test('reveals the hydrated Sheet trigger only after JavaScript is detected', async () => {
  const html = await readFile(
    new URL('../src/app.html', import.meta.url),
    'utf8',
  );
  const css = await readFile(
    new URL('../src/app.css', import.meta.url),
    'utf8',
  );

  assert.match(html, /root\.classList\.add\('js'\)/);
  assert.match(css, /\.mobile-menu-button\s*\{[\s\S]*?display:\s*none/);
  assert.match(
    css,
    /@media\s*\(max-width:\s*\d+px\)[\s\S]*?\.js \.mobile-menu-button\s*\{[^}]*display:\s*inline-flex/,
  );
  assert.doesNotMatch(
    css,
    /(?<!\.js )\.mobile-menu-button\s*\{[^}]*display:\s*inline-flex/,
  );
});

function parseInitializerArray(initializer, name) {
  const match = initializer.match(
    new RegExp(`const ${name} = \\[([^\\]]+)\\]`),
  );
  assert.ok(match, `missing initializer ${name} allowlist`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

test('owns shared root appearance state and both desktop and mobile controls', async () => {
  const layout = await readFile(
    new URL('../src/routes/+layout.svelte', import.meta.url),
    'utf8',
  );
  const menu = await readFile(
    new URL('../src/lib/components/AppearanceMenu.svelte', import.meta.url),
    'utf8',
  );

  assert.match(layout, /let themeMode = \$state<ThemeMode>\('system'\)/);
  assert.doesNotMatch(layout, /palette/i);
  assert.match(layout, /onMount\(\(\) => \{/);
  assert.match(layout, /themeMode = readThemeMode\(\)/);
  assert.match(layout, /applyThemeMode\(themeMode\)/);
  assert.match(layout, /return subscribeSystemScheme/);
  assert.equal(layout.match(/<AppearanceMenu/g)?.length, 2);
  assert.match(layout, /<AppearanceMenu[\s\S]*?compact/);
  assert.match(
    layout,
    /<Sheet\.Content[\s\S]*?<AppearanceMenu[\s\S]*?onmodechange=/,
  );
  assert.match(layout, /<noscript>[\s\S]*?noscript-nav[\s\S]*?<\/noscript>/);

  assert.match(menu, /let accessibleLabel = \$derived\(`Appearance, \$\{/);
  assert.match(menu, /aria-label=\{accessibleLabel\}/);
  assert.match(menu, /data-appearance-trigger="compact"/);
  assert.match(menu, /<DropdownMenu\.Label>Appearance<\/DropdownMenu\.Label>/);
  // Both forms offer exactly the modes from appearance.ts.
  assert.match(
    menu,
    /\{#each themeModes as value[\s\S]*?<DropdownMenu\.RadioItem \{value\}/,
  );
  assert.match(
    menu,
    /\{#each themeModes as value[\s\S]*?<input\s+type="radio"\s+name="appearance-mode"/,
  );
  assert.doesNotMatch(menu, /palette|Color theme/i);
});

test('keeps the Editor dropdown wrapper snapshot byte-equivalent', async () => {
  const directory = new URL(
    '../src/lib/components/ui/dropdown-menu/',
    import.meta.url,
  );
  const files = (await readdir(directory)).sort();
  const hash = createHash('sha256');

  for (const file of files) {
    hash.update(file);
    hash.update('\0');
    hash.update(await readFile(new URL(file, directory)));
    hash.update('\0');
  }

  assert.equal(files.length, 18);
  assert.equal(
    hash.digest('hex'),
    '47f1cc79753eb82c50e0f57f1daf8bebc9abe5e421e19dee6f9bc232035a523c',
  );
});
