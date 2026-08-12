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
    name: 'Runic Toolkit',
    shortName: 'Toolkit',
    capability: 'Application composition',
    description:
      'Compose .NET hosts, desktop windows, and browser frontends around one application model.',
    docs: `${docs}/runic-toolkit/`,
    source: `${github}/runic-toolkit`,
  },
  {
    slug: 'cs-webui',
    name: 'CS-WebUI',
    shortName: 'CS-WebUI',
    capability: 'Native web host',
    description:
      'Host a web-powered cross-platform desktop UI in a lightweight native window.',
    docs: `${docs}/cs-webui/`,
    source: `${github}/cs-webui`,
  },
  {
    slug: 'runic-flow',
    name: 'Runic Flow',
    shortName: 'Flow',
    capability: 'Headless orchestration',
    description:
      'Coordinate typed, deterministic application processes without taking a UI dependency.',
    docs: `${docs}/runic-flow/`,
    source: `${github}/runic-flow`,
  },
  {
    slug: 'runic-assets',
    name: 'Runic Assets',
    shortName: 'Assets',
    capability: 'Portable assets',
    description:
      'Package static assets once and carry the same validated manifest across hosts.',
    docs: `${docs}/runic-assets/`,
    source: `${github}/runic-assets`,
  },
  {
    slug: 'runic-translations',
    name: 'Runic Translations',
    shortName: 'Translations',
    capability: 'Deterministic localization',
    description:
      'Turn portable translation resources into strongly typed, NativeAOT-ready APIs.',
    docs: `${docs}/runic-translations/`,
    source: `${github}/runic-translations`,
  },
  {
    slug: 'runic-translations-editor',
    name: 'Runic Translations Editor',
    shortName: 'Editor',
    capability: 'Translation authoring',
    description:
      'Give translators a focused workspace without asking them to edit resource files.',
    docs: `${docs}/runic-translations-editor/`,
    source: `${github}/runic-translations-editor`,
  },
  {
    slug: 'runic-command-line',
    name: 'Runic Command Line',
    shortName: 'Command Line',
    capability: 'Command applications',
    description:
      'Build reflection-free NativeAOT command applications with predictable output.',
    docs: `${docs}/runic-command-line/`,
    source: `${github}/runic-command-line`,
  },
];
