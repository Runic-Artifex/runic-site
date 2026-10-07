// Minimal package compositions for common goals. Every package must be in the
// active SDK catalog (tests/package-goals.test.mjs), so the install commands
// come from the same release as the full inventory.
import { guideHref } from './guide-paths';

export type GoalPackage = {
  readonly name: string;
  /** Why or when the package is needed. */
  readonly note: string;
};

export type PackageGoal = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly packages: readonly GoalPackage[];
  readonly guide:
    | { readonly route: '/getting-started'; readonly label: string }
    | { readonly href: string; readonly label: string };
};

export const packageGoals: readonly PackageGoal[] = [
  {
    id: 'new-app',
    title: 'Start a new desktop app',
    summary:
      'The creator asks for a frontend, package manager, host and ViewModel library, then runs the template. The generated project references every package it needs.',
    packages: [
      {
        name: 'Runic.Create',
        note: 'Guided creator; runs without installing.',
      },
      {
        name: 'Runic.Application.Templates',
        note: 'The runic-app template, for dotnet new.',
      },
    ],
    guide: { route: '/getting-started', label: 'Getting started' },
  },
  {
    id: 'existing-app',
    title: 'Add Windows and Views to an existing app',
    summary:
      'Reference one host adapter in the .NET project and the shared runtime plus your framework binding in the frontend.',
    packages: [
      {
        name: 'Runic.Application.CsWebUi',
        note: 'Host adapter for a browser or WebView window, or:',
      },
      {
        name: 'Runic.Application.Desktop',
        note: 'Host adapter for Runic Desktop native windows.',
      },
      {
        name: 'Runic.Application.ReactiveUI',
        note: 'Only for ReactiveUI ViewModels.',
      },
      {
        name: 'dotnet-runic',
        note: 'dotnet runic dev and doctor.',
      },
      {
        name: '@runic-artifex/views',
        note: 'Runtime for the generated TypeScript clients.',
      },
      {
        name: '@runic-artifex/react',
        note: 'Or @runic-artifex/vue, @runic-artifex/svelte, @runic-artifex/angular.',
      },
    ],
    guide: {
      href: guideHref('application/existing-app.md'),
      label: 'Add Runic to an existing app',
    },
  },
  {
    id: 'test',
    title: 'Test Windows and Views',
    summary:
      'Drive the real ViewModels and generated Bridges without a browser or native window. Frontend tests use the mock Bridge in @runic-artifex/views.',
    packages: [
      {
        name: 'Runic.Application.Testing',
        note: 'In the .NET test project.',
      },
    ],
    guide: {
      href: `${guideHref('application/tutorial/README.md')}#7-test-the-window-and-the-frontend`,
      label: 'Testing in the tutorial',
    },
  },
  {
    id: 'desktop',
    title: 'Open native windows and use platform services',
    summary:
      'Runic Desktop hosts embedded WebViews in native windows; the platform packages add file dialogs, notifications, appearance and inhibition.',
    packages: [
      { name: 'Runic.Desktop', note: 'Native windows and embedded WebViews.' },
      {
        name: 'Runic.Platform',
        note: 'Platform service contracts; add the Runic.Platform.* adapter for each operating system.',
      },
    ],
    guide: {
      href: guideHref('desktop/host-selection.md'),
      label: 'Choose a desktop host',
    },
  },
  {
    id: 'assets',
    title: 'Embed and serve a frontend',
    summary:
      'Pack a frontend build into the executable and serve it from ASP.NET Core or a Runic Desktop window.',
    packages: [
      {
        name: 'Runic.Assets',
        note: 'Archive, manifest and build integration.',
      },
      {
        name: 'Runic.Assets.AspNetCore',
        note: 'Serve from ASP.NET Core, or:',
      },
      {
        name: 'Runic.Assets.Desktop',
        note: 'Serve in a Runic Desktop window.',
      },
    ],
    guide: {
      href: guideHref('assets/README.md'),
      label: 'Embed and serve assets',
    },
  },
];
