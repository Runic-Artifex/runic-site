// The guide sidebar. Every file in docs/guides appears exactly once;
// tests/guides.test.mjs fails when a guide is added without a place here.

export type GuideNavigationGroup = {
  readonly title: string;
  /** Guide files below docs/guides, in reading order. */
  readonly files: readonly string[];
  /** Guides that their owning product publishes elsewhere. */
  readonly external?: readonly {
    readonly href: string;
    readonly label: string;
  }[];
};

export const guideNavigation: readonly GuideNavigationGroup[] = [
  { title: 'Overview', files: ['README.md'] },
  {
    title: 'Application',
    files: [
      'application/getting-started/README.md',
      'application/tutorial/README.md',
      'application/existing-app.md',
      'application/README.md',
      'application/guides/README.md',
      'application/guides/dynamicdata.md',
      'application/reference/README.md',
      'application/reference/reactiveui.md',
      'application/architecture/README.md',
      'application/architecture/reactiveui-expansion.md',
      'application/contributing/README.md',
      'application/contributing/development.md',
      'application/contributing/quality-gates.md',
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
      'desktop/migrations/webui-compat-to-desktop.md',
      'desktop/host-choice-and-footprint.md',
      'desktop/nixos-development.md',
      'desktop/container-automation.md',
      'desktop/vm-automation.md',
      'desktop/portal-vm.md',
      'portal-implementation-audit.md',
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
];
