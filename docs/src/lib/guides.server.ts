// Loads docs/guides at build time. Server-only, so neither the Markdown
// renderer nor the guide sources reach the browser bundle.
import { renderGuides, type Guide } from '#lib/guides-core.js';
import { guideNavigation } from '#lib/guide-navigation.js';

const sources = import.meta.glob<string>('/guides/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const guides: readonly Guide[] = renderGuides(
  Object.entries(sources).map(([file, markdown]) => ({
    file: file.slice('/guides/'.length),
    markdown,
  })),
);

const byPath = new Map(guides.map((guide) => [guide.path, guide]));
const byFile = new Map(guides.map((guide) => [guide.file, guide]));

export function getGuide(path: string) {
  return byPath.get(path.replace(/\/$/, ''));
}

export type GuideLink = { readonly href: string; readonly title: string };

export type GuideNavigation = readonly {
  readonly title: string;
  readonly guides: readonly GuideLink[];
  readonly external: readonly {
    readonly href: string;
    readonly label: string;
  }[];
}[];

export const navigation: GuideNavigation = guideNavigation.map((group) => ({
  title: group.title,
  guides: group.files.map((file) => {
    const guide = byFile.get(file);
    if (!guide) throw new Error(`Navigation lists missing guide ${file}`);
    return { href: guide.href, title: guide.title };
  }),
  external: group.external ?? [],
}));

/** Previous and next guide in navigation order. */
export function neighbours(guide: Guide) {
  const ordered = navigation.flatMap((group) => group.guides);
  const index = ordered.findIndex((entry) => entry.href === guide.href);
  return {
    previous: index > 0 ? ordered[index - 1] : null,
    next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null,
  };
}

const listed = new Set(guideNavigation.flatMap((group) => group.files));
const unlisted = guides.filter((guide) => !listed.has(guide.file));
if (
  unlisted.length ||
  listed.size !== guideNavigation.flatMap((g) => g.files).length
) {
  throw new Error(
    `Every guide must appear once in src/lib/guide-navigation.ts; unlisted: ${unlisted.map((guide) => guide.file).join(', ')}`,
  );
}
