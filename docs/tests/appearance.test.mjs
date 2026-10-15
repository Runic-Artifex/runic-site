import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  appearanceKey,
  applyThemeMode,
  defaultThemeMode,
  isThemeMode,
  readThemeMode,
  resolveColorScheme,
  saveThemeMode,
  subscribeSystemScheme,
  themeModes,
} from '../src/lib/appearance.ts';

const expectedThemeModes = ['system', 'light', 'dark'];
const expectedAppearanceKey = 'runic-docs.theme-mode';

function createStorage() {
  const values = new Map();
  const reads = [];
  const writes = [];
  return {
    values,
    reads,
    writes,
    getItem(key) {
      reads.push(key);
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      writes.push([key, String(value)]);
      values.set(key, String(value));
    },
  };
}

function createRoot() {
  const classes = new Set();
  return {
    classes,
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
        return Boolean(force);
      },
    },
    dataset: {},
    style: { colorScheme: '' },
  };
}

function createMedia(matches = false) {
  const listeners = new Set();
  return {
    matches,
    listeners,
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'change');
      listeners.delete(listener);
    },
    emit() {
      for (const listener of [...listeners]) listener();
    },
  };
}

test('follows the system by default and guards stored modes', () => {
  assert.deepEqual(themeModes, expectedThemeModes);
  assert.equal(appearanceKey, expectedAppearanceKey);
  assert.equal(defaultThemeMode, 'system');
  assert.equal(readThemeMode(undefined), 'system');

  for (const mode of themeModes) assert.equal(isThemeMode(mode), true);
  for (const invalid of [null, undefined, '', 'sepia', 'runic', 1, {}])
    assert.equal(isThemeMode(invalid), false);
});

test('persists and applies every mode with the docs-only key', () => {
  const storage = createStorage();
  const root = createRoot();

  for (const systemPrefersDark of [false, true]) {
    const media = createMedia(systemPrefersDark);
    for (const mode of themeModes) {
      saveThemeMode(mode, storage, root, media);
      const scheme =
        mode === 'dark' || (mode === 'system' && systemPrefersDark)
          ? 'dark'
          : 'light';
      assert.equal(readThemeMode(storage), mode);
      assert.equal(root.dataset.scheme, scheme, `${mode} ${systemPrefersDark}`);
      assert.equal(root.style.colorScheme, scheme);
      assert.equal(root.classes.has('dark'), scheme === 'dark');
      assert.equal(root.dataset.theme, undefined);
    }
  }

  assert.deepEqual(new Set(storage.reads), new Set([appearanceKey]));
  assert.deepEqual(
    new Set(storage.writes.map(([key]) => key)),
    new Set([appearanceKey]),
  );
  assert.equal(
    storage.writes.some(([key]) =>
      /palette|runic-translations|translations-editor/.test(key),
    ),
    false,
  );
});

test('resolves system mode and falls back safely for corrupt or blocked storage', () => {
  assert.equal(resolveColorScheme('dark', false), 'dark');
  assert.equal(resolveColorScheme('light', true), 'light');
  assert.equal(resolveColorScheme('system', false), 'light');
  assert.equal(resolveColorScheme('system', true), 'dark');

  const storage = createStorage();
  storage.values.set(appearanceKey, 'sepia');
  assert.equal(readThemeMode(storage), 'system');
  assert.equal(
    readThemeMode({
      getItem() {
        throw new Error('blocked');
      },
      setItem() {},
    }),
    'system',
  );

  const root = createRoot();
  applyThemeMode('system', root, createMedia(true));
  assert.equal(root.classes.has('dark'), true);
  assert.equal(root.dataset.scheme, 'dark');
  assert.equal(root.style.colorScheme, 'dark');

  const blocked = createRoot();
  saveThemeMode(
    'dark',
    {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error('blocked');
      },
    },
    blocked,
    createMedia(false),
  );
  assert.equal(blocked.dataset.scheme, 'dark');
});

test('subscribes to system changes only in system mode and cleans up exactly once', () => {
  const media = createMedia(false);
  let mode = 'system';
  const applied = [];
  const cleanup = subscribeSystemScheme(
    () => mode,
    media,
    (next) => applied.push(next),
  );

  assert.equal(media.listeners.size, 1);
  media.emit();
  assert.deepEqual(applied, ['system']);

  mode = 'dark';
  media.emit();
  assert.deepEqual(applied, ['system']);

  cleanup();
  assert.equal(media.listeners.size, 0);
  media.emit();
  assert.deepEqual(applied, ['system']);
});

test('maps the shadcn theme names onto the rune tokens in one place', async () => {
  const css = await readFile(
    new URL('../src/routes/layout.css', import.meta.url),
    'utf8',
  );
  const appCss = await readFile(
    new URL('../src/app.css', import.meta.url),
    'utf8',
  );
  const tokens = await readFile(
    new URL('../src/lib/brand/tokens.css', import.meta.url),
    'utf8',
  );
  const mapping = {
    background: 'stone',
    foreground: 'ink',
    card: 'raised',
    'card-foreground': 'ink',
    popover: 'raised',
    'popover-foreground': 'ink',
    primary: 'ink',
    'primary-foreground': 'stone',
    secondary: 'sunk',
    'secondary-foreground': 'ink',
    muted: 'sunk',
    'muted-foreground': 'ink-soft',
    accent: 'sunk',
    'accent-foreground': 'ink',
    destructive: 'paint',
    border: 'groove',
    input: 'groove',
    ring: 'paint',
  };

  assert.match(css, /@import '\.\.\/lib\/brand\/tokens\.css';/);
  const root = cssBlock(css, ':root');
  for (const [name, token] of Object.entries(mapping))
    assert.match(
      root,
      new RegExp(`--${name}: var\\(--rune-${token}\\);`),
      `--${name} should use --rune-${token}`,
    );
  // Dark values come from tokens.css; the mapping has no second colour block.
  assert.doesNotMatch(css, /^\.dark\s*\{/m);
  for (const scheme of [
    ":root[data-scheme='dark']",
    ":root:not([data-scheme='light'])",
  ])
    assert.ok(tokens.includes(scheme), scheme);

  for (const source of [css, appCss]) {
    assert.doesNotMatch(
      source,
      /data-theme|--docs-accent|--runic-(?:gold|moss)/,
    );
    assert.doesNotMatch(source, /oklch\(\d/);
    assert.doesNotMatch(source, /Newsreader|Geist|Inter Variable/);
  }
});

function cssBlock(source, selector) {
  const start = source.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing theme selector ${selector}`);
  const bodyStart = source.indexOf('{', start) + 1;
  const end = source.indexOf('}', bodyStart);
  assert.notEqual(end, -1, `Unclosed theme selector ${selector}`);
  return source.slice(bodyStart, end);
}
