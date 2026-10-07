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
    slug: 'runic-application',
    name: 'Runic Application',
    shortName: 'Application',
    capability: 'Application composition',
    description:
      'Compose typed .NET Windows and Views with generated frontend clients and scoped ViewModel lifetimes.',
    docs: `${docs}/runic-application/`,
    source: `${github}/runic-sdk/tree/main/packages/dotnet/Runic.Application.Views`,
  },
  {
    slug: 'runic-desktop',
    name: 'Runic Desktop',
    shortName: 'Desktop',
    capability: 'Desktop presentation',
    description:
      'Host web-powered native windows, choose GTK3 or GTK4 on Linux, and add desktop services through platform adapters.',
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
    source: `${github}/runic-translations-sdk/tree/main/packages/dotnet/Runic.Translations`,
  },
  {
    slug: 'runic-command-line',
    name: 'Runic Command Line',
    shortName: 'Command Line',
    capability: 'Command applications',
    description:
      'Generate NativeAOT-ready commands from typed C# methods, with help, validation, completion, and optional Spectre.Console presentation.',
    docs: `${docs}/runic-command-line/`,
    source: `${github}/runic-cli-sdk/tree/main/packages/dotnet/Runic.CommandLine`,
  },
];
