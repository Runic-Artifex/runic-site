// Loads docs/guides at build time. Server-only, so neither the Markdown
// renderer nor the guide sources reach the browser bundle.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderGuides, type Guide } from '#lib/guides-core.js';
import { guideNavigation, navigationFile } from '#lib/guide-navigation.js';

const sources = import.meta.glob<string>('/guides/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Vite builds from docs/; guide links to other docs files must exist there.
const docsRoot = process.cwd();
if (!existsSync(join(docsRoot, 'guides', 'README.md'))) {
  throw new Error(`Build the portal from docs/, not ${docsRoot}`);
}

export const guides: readonly Guide[] = renderGuides(
  Object.entries(sources).map(([file, markdown]) => ({
    file: file.slice('/guides/'.length),
    markdown,
  })),
  (path) => existsSync(join(docsRoot, path)),
);

const byPath = new Map(guides.map((guide) => [guide.path, guide]));
const byFile = new Map(guides.map((guide) => [guide.file, guide]));

export function getGuide(path: string) {
  return byPath.get(path.replace(/\/$/, ''));
}

export type GuideLink = { readonly href: string; readonly title: string };

export type GuideNavigation = readonly {
  readonly title: string;
  /** SDK development guides, kept out of the product sidebar. */
  readonly contributor: boolean;
  readonly guides: readonly GuideLink[];
  readonly external: readonly {
    readonly href: string;
    readonly label: string;
  }[];
}[];

export const navigation: GuideNavigation = guideNavigation.map((group) => ({
  title: group.title,
  contributor: group.contributor ?? false,
  guides: group.files.map((entry) => {
    const file = navigationFile(entry);
    const guide = byFile.get(file);
    if (!guide) throw new Error(`Navigation lists missing guide ${file}`);
    const title = typeof entry === 'string' ? guide.title : entry.label;
    return { href: guide.href, title };
  }),
  external: group.external ?? [],
}));

/**
 * Previous and next guide in navigation order. Product and contributor guides
 * page separately, so a product guide never leads into SDK development.
 */
export function neighbours(guide: Guide) {
  const contributor = navigation.some(
    (group) =>
      group.contributor &&
      group.guides.some((entry) => entry.href === guide.href),
  );
  const ordered = navigation
    .filter((group) => group.contributor === contributor)
    .flatMap((group) => group.guides);
  const index = ordered.findIndex((entry) => entry.href === guide.href);
  return {
    previous: index > 0 ? ordered[index - 1] : null,
    next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null,
  };
}

const listedFiles = guideNavigation.flatMap((group) =>
  group.files.map(navigationFile),
);
const listed = new Set(listedFiles);
const unlisted = guides.filter((guide) => !listed.has(guide.file));
if (unlisted.length || listed.size !== listedFiles.length) {
  throw new Error(
    `Every guide must appear once in src/lib/guide-navigation.ts; unlisted: ${unlisted.map((guide) => guide.file).join(', ')}`,
  );
}
