export type Product = {
  slug: string;
  name: string;
  shortName: string;
  capability: string;
  description: string;
  docs: string;
  source: string;
};

const github = 'https://github.com/Runic-Artifex';
const docs = 'https://docs.runic-artifex.eu/products';

export const products: Product[] = [
  {
    slug: 'runic-toolkit',
    name: 'Runic Application',
    shortName: 'Application',
    capability: 'Application composition',
    description:
      'Compose .NET hosts, desktop windows, and browser frontends around one application model.',
    docs: `${docs}/runic-toolkit/`,
    source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Application`,
  },
  {
    slug: 'runic-desktop',
    name: 'Runic Desktop',
    shortName: 'Desktop',
    capability: 'Desktop presentation',
    description:
      'Own the web-powered desktop presentation layer with native C# hosting and TypeScript frontend packages.',
    docs: `${docs}/runic-desktop/`,
    source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Desktop`,
  },
  {
    slug: 'runic-assets',
    name: 'Runic Assets',
    shortName: 'Assets',
    capability: 'Portable assets',
    description:
      'Package static assets once and carry the same validated manifest across hosts.',
    docs: `${docs}/runic-assets/`,
    source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Assets`,
  },
  {
    slug: 'runic-translations',
    name: 'Runic Translations',
    shortName: 'Translations',
    capability: 'Deterministic localization',
    description:
      'Turn portable translation resources into strongly typed, NativeAOT-ready APIs.',
    docs: `${docs}/runic-translations/`,
    source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Translations`,
  },
  {
    slug: 'runic-command-line',
    name: 'Runic Command Line',
    shortName: 'Command Line',
    capability: 'Command applications',
    description:
      'Build reflection-free NativeAOT command applications with predictable output.',
    docs: `${docs}/runic-command-line/`,
    source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.CommandLine`,
  },
];
