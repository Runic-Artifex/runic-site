// The guide sidebar. Every file in docs/guides appears exactly once;
// tests/guides.test.mjs fails when a guide is added without a place here.

/** A guide file below docs/guides, optionally with a sidebar label. */
export type GuideNavigationEntry =
  string | { readonly file: string; readonly label: string };

export type GuideNavigationGroup = {
  readonly title: string;
  /** Guides in reading order. */
  readonly files: readonly GuideNavigationEntry[];
  /** Guides that their owning product publishes elsewhere. */
  readonly external?: readonly {
    readonly href: string;
    readonly label: string;
  }[];
};

export function navigationFile(entry: GuideNavigationEntry) {
  return typeof entry === 'string' ? entry : entry.file;
}

export const guideNavigation: readonly GuideNavigationGroup[] = [
  { title: 'Overview', files: ['README.md'] },
  {
    title: 'Application',
    files: [
      'application/getting-started/README.md',
      'application/choosing.md',
      'application/tutorial/README.md',
      'application/existing-app.md',
      'application/package-consumer.md',
      'application/migrations/wpf-incremental.md',
      'application/README.md',
      'application/guides/README.md',
      'application/guides/pages-and-navigation.md',
      'application/guides/model-context.md',
      'application/guides/dynamicdata.md',
      'application/guides/operations-and-cancellation.md',
      'application/guides/typed-failures.md',
      'application/reference/README.md',
      'application/reference/reactiveui.md',
      'application/glossary.md',
      'application/architecture/README.md',
      'application/architecture/reactiveui-expansion.md',
    ],
  },
  {
    title: 'Desktop',
    files: [
      'desktop/host-selection.md',
      'desktop-services.md',
      'desktop/window-close-lifecycle.md',
      'desktop/inhibition.md',
      'desktop/size-and-tuning.md',
      'desktop/shipping.md',
      'desktop/migrations/webui-compat-to-desktop.md',
      'desktop/host-choice-and-footprint.md',
    ],
  },
  {
    title: 'Assets',
    files: [
      'assets/README.md',
      'assets/adr/0013-framework-neutral-asset-boundary.md',
    ],
  },
  {
    title: 'Translations',
    files: ['migrations/translations-svelte.md'],
    // Runic Translations owns its consumer guides (plans/documentation-ownership.md).
    external: [
      {
        href: 'https://github.com/Runic-Artifex/runic-translations-sdk/tree/main/docs/guides/translations',
        label: 'Translations guides',
      },
    ],
  },
  {
    title: 'Contributing to Application',
    files: [
      'application/contributing/README.md',
      'application/contributing/development.md',
      'application/contributing/quality-gates.md',
    ],
  },
  {
    // SDK development and test infrastructure rather than product usage.
    title: 'Contributing and testing',
    files: [
      'desktop/nixos-development.md',
      'desktop/container-automation.md',
      'portal-implementation-audit.md',
    ],
  },
];
