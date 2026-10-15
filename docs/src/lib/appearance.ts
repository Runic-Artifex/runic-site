// The documentation follows the system color scheme unless the reader picks
// light or dark. src/app.html applies the same rules before the first paint.
export const themeModes = ['system', 'light', 'dark'] as const;

export type ThemeMode = (typeof themeModes)[number];
export type ColorScheme = 'light' | 'dark';

export type AppearanceStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type AppearanceRoot = {
  classList: {
    toggle(name: string, force?: boolean): boolean;
  };
  dataset: Record<string, string | undefined>;
  style: {
    colorScheme: string;
  };
};

export type AppearanceMediaQuery = {
  matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
};

export const appearanceKey = 'runic-docs.theme-mode';

export const defaultThemeMode: ThemeMode = 'system';

const colorSchemeQuery = '(prefers-color-scheme: dark)';

export function isThemeMode(value: unknown): value is ThemeMode {
  return themeModes.some((mode) => mode === value);
}

export function resolveColorScheme(
  mode: ThemeMode,
  systemPrefersDark: boolean,
): ColorScheme {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark)
    ? 'dark'
    : 'light';
}

export function readThemeMode(
  storage: AppearanceStorage | undefined = browserStorage(),
): ThemeMode {
  if (storage === undefined) return defaultThemeMode;

  try {
    const stored = storage.getItem(appearanceKey);
    return isThemeMode(stored) ? stored : defaultThemeMode;
  } catch {
    return defaultThemeMode;
  }
}

/** Sets the Tailwind `dark` class and the resolved `data-scheme` on <html>. */
export function applyThemeMode(
  mode: ThemeMode,
  root: AppearanceRoot | undefined = documentRoot(),
  media: AppearanceMediaQuery | undefined = colorSchemeMedia(),
): void {
  if (root === undefined) return;

  const scheme = resolveColorScheme(mode, media?.matches ?? false);
  root.classList.toggle('dark', scheme === 'dark');
  root.dataset.scheme = scheme;
  root.style.colorScheme = scheme;
}

export function saveThemeMode(
  mode: ThemeMode,
  storage: AppearanceStorage | undefined = browserStorage(),
  root: AppearanceRoot | undefined = documentRoot(),
  media: AppearanceMediaQuery | undefined = colorSchemeMedia(),
): void {
  if (storage !== undefined) {
    try {
      storage.setItem(appearanceKey, mode);
    } catch {
      // Applying the in-memory preference remains useful when storage is blocked.
    }
  }

  applyThemeMode(mode, root, media);
}

/** Follows system changes while the reader's mode is `system`. */
export function subscribeSystemScheme(
  getMode: () => ThemeMode,
  media: AppearanceMediaQuery | undefined = colorSchemeMedia(),
  apply: (mode: ThemeMode) => void = applyThemeMode,
): () => void {
  if (media === undefined) return () => {};

  const update = (): void => {
    const mode = getMode();
    if (mode === 'system') apply(mode);
  };

  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}

function browserStorage(): AppearanceStorage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}

function documentRoot(): AppearanceRoot | undefined {
  return typeof document === 'undefined' ? undefined : document.documentElement;
}

function colorSchemeMedia(): AppearanceMediaQuery | undefined {
  return typeof matchMedia === 'undefined'
    ? undefined
    : matchMedia(colorSchemeQuery);
}
