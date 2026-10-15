import type { MarkName } from '$lib/brand/Mark.svelte';

export type Product = {
  slug: string;
  name: string;
  mark: MarkName;
  description: string;
  docs: string;
  source: string;
};

export type ProductGroup = {
  name: string;
  repository: string;
  summary: string;
  products: Product[];
};

const github = 'https://github.com/Runic-Artifex';
const docs = 'https://docs.runic-artifex.eu/products';

export const productGroups: ProductGroup[] = [
  {
    name: 'Runic SDK',
    repository: `${github}/runic-sdk`,
    summary: 'Released together, usable apart.',
    products: [
      {
        slug: 'runic-application',
        name: 'Runic Application',
        mark: 'application',
        description:
          'Declare Windows, Views and navigation over your .NET ViewModels. The build generates a typed TypeScript client for each View, and your frontend framework renders it.',
        docs: `${docs}/runic-application/`,
        source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Application.Views`,
      },
      {
        slug: 'runic-desktop',
        name: 'Runic Desktop',
        mark: 'desktop',
        description:
          'Open the frontend in a native window through WebView2, WKWebView or WebKitGTK, with file dialogs, notifications and other desktop services.',
        docs: `${docs}/runic-desktop/`,
        source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Desktop`,
      },
      {
        slug: 'runic-assets',
        name: 'Runic Assets',
        mark: 'assets',
        description:
          'Package static files into one validated manifest, then serve it embedded, from a development source or from a server.',
        docs: `${docs}/runic-assets/`,
        source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Assets`,
      },
    ],
  },
  {
    name: 'Runic Translations',
    repository: `${github}/runic-translations-sdk`,
    summary: 'Its own repository and release cycle.',
    products: [
      {
        slug: 'runic-translations',
        name: 'Runic Translations',
        mark: 'translations',
        description:
          'Write messages in MessageFormat 2 and call them through generated, typed C# and TypeScript APIs. A desktop editor is included.',
        docs: `${docs}/runic-translations/`,
        source: `${github}/runic-translations-sdk/tree/main/packages/dotnet/Runic.Translations`,
      },
    ],
  },
  {
    name: 'Runic Command Line',
    repository: `${github}/runic-cli-sdk`,
    summary: 'Its own repository and release cycle.',
    products: [
      {
        slug: 'runic-command-line',
        name: 'Runic Command Line',
        mark: 'command-line',
        description:
          'Turn typed C# methods into a NativeAOT command-line application with help, validation and shell completion.',
        docs: `${docs}/runic-command-line/`,
        source: `${github}/runic-cli-sdk/tree/main/packages/dotnet/Runic.CommandLine`,
      },
    ],
  },
];

export const products: Product[] = productGroups.flatMap(
  (group) => group.products,
);
