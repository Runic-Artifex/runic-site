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
    slug: 'runic-desktop',
    name: 'Runic Desktop',
    shortName: 'Desktop',
    capability: 'Desktop presentation',
    description:
      'Own the web-powered desktop presentation layer with native C# hosting and TypeScript frontend packages.',
    docs: `${docs}/runic-desktop/`,
    source: `${github}/runic-desktop`,
  },
  {
    slug: 'cs-webui',
    name: 'CS-WebUI',
    shortName: 'CS-WebUI',
    capability: 'WebUI compatibility',
    description:
      'A standalone managed compatibility layer for WebUI’s public API, maintained separately from the Runic v1.0 train.',
    docs: `${docs}/cs-webui/`,
    source: `${github}/cs-webui`,
  },
  {
    slug: 'runic-flow',
    name: 'Runic Flow',
    shortName: 'Flow',
    capability: 'Historical archive',
    description:
      'A historical project archive with migration guidance only; it is not a current product, package, or forwarding identity.',
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
