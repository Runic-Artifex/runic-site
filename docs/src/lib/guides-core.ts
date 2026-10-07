// Renders the Markdown guides in docs/guides as portal pages. Pure functions
// over checked-in sources, shared by the prerendered routes and the tests.
import { Marked, walkTokens, type Token, type Tokens } from 'marked';
import {
  docsSourceUrl,
  githubGuide,
  guideHref,
  guidePath,
} from './guide-paths';

export { guideHref, guidePath, siteHrefForGitHubGuide } from './guide-paths';

export type GuideSource = {
  /** Path below docs/guides, such as `application/tutorial/README.md`. */
  readonly file: string;
  readonly markdown: string;
};

export type GuideHeading = {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
};

export type GuideSection = {
  /** Heading anchor, or null for the text before the first section. */
  readonly id: string | null;
  readonly heading: string | null;
  readonly text: string;
};

export type Guide = {
  readonly file: string;
  /** Route parameter for `/guides/[...path]`; empty for the guides index. */
  readonly path: string;
  /** Site path with the trailing slash the static build serves. */
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly headings: readonly GuideHeading[];
  readonly sections: readonly GuideSection[];
  readonly html: string;
  readonly sourceUrl: string;
};

/** GitHub-compatible heading anchors, including duplicate suffixes. */
export function createSlugger() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-');
    let slug = base;
    let count = seen.get(base) ?? 0;
    while (seen.has(slug)) slug = `${base}-${++count}`;
    seen.set(base, count);
    seen.set(slug, 0);
    return slug;
  };
}

const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decode(text: string) {
  return text.replace(
    /&(?:amp|lt|gt|quot|#39);/g,
    (entity) => entities[entity],
  );
}

/** Readable text of a token, without code blocks. */
export function plainText(token: Token): string {
  switch (token.type) {
    case 'code':
    case 'space':
    case 'hr':
    case 'html':
    case 'def':
      return '';
    case 'br':
      return ' ';
    case 'table': {
      const table = token as Tokens.Table;
      return [...table.header, ...table.rows.flat()]
        .map((cell) => cell.tokens.map(plainText).join(''))
        .join(' ');
    }
    case 'list':
      return (token as Tokens.List).items.map(plainText).join(' ');
  }
  if ('tokens' in token && token.tokens) {
    const blocks = token.type === 'blockquote' || token.type === 'list_item';
    return token.tokens.map(plainText).join(blocks ? ' ' : '');
  }
  return 'text' in token ? decode(token.text) : '';
}

function collapse(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function posixResolve(fromFile: string, target: string) {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/') + (target.endsWith('/') ? '/' : '');
}

/**
 * Resolves a guide link or image. Links to other guides become site routes;
 * relative links to other docs files go to their GitHub source. Only https,
 * mailto, relative and fragment links are allowed. A link to a missing guide
 * or docs file, or with another scheme, throws so the build fails.
 *
 * `docsFileExists` receives a path relative to docs/, such as
 * `tests/guide-snippets.test.mjs`.
 */
export function resolveGuideLink(
  fromFile: string,
  href: string,
  files: ReadonlySet<string>,
  docsFileExists: (path: string) => boolean,
): string {
  const scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(href)?.[1].toLowerCase();
  if (scheme !== undefined && scheme !== 'https' && scheme !== 'mailto') {
    throw new Error(`${fromFile} uses a disallowed link scheme: ${href}`);
  }
  if (/^\s*[\\/]{2}/.test(href)) {
    throw new Error(`${fromFile} uses a protocol-relative link: ${href}`);
  }
  const github = githubGuide(href);
  if (github) {
    if (!files.has(github.file)) {
      throw new Error(`${fromFile} links to missing guide ${github.file}`);
    }
    return `${guideHref(github.file)}${github.hash}`;
  }
  if (scheme !== undefined) return href;
  if (href.startsWith('#')) return href;
  const [target, ...hashParts] = href.split('#');
  const hash = hashParts.length ? `#${hashParts.join('#')}` : '';
  // Paths are relative to docs/guides; `../` reaches the rest of docs/.
  const resolved = posixResolve(`guides/${fromFile}`, decodeURI(target));
  if (resolved === null) {
    throw new Error(`${fromFile} links outside docs/: ${href}`);
  }
  if (resolved.startsWith('guides/')) {
    const inGuides = resolved.slice('guides/'.length);
    const file =
      inGuides === '' || inGuides.endsWith('/')
        ? `${inGuides}README.md`
        : inGuides;
    if (file.endsWith('.md')) {
      if (!files.has(file)) {
        throw new Error(`${fromFile} links to missing guide ${file}`);
      }
      return `${guideHref(file)}${hash}`;
    }
    if (files.has(`${file}/README.md`)) {
      return `${guideHref(`${file}/README.md`)}${hash}`;
    }
  }
  const path = resolved.replace(/\/$/, '');
  if (path === '' || !docsFileExists(path)) {
    throw new Error(`${fromFile} links to missing file docs/${resolved}`);
  }
  return `${docsSourceUrl}${encodeURI(resolved)}${hash}`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type AnchoredHeading = Tokens.Heading & { anchor?: string };

export function renderGuide(
  source: GuideSource,
  files: ReadonlySet<string>,
  docsFileExists: (path: string) => boolean,
): Guide {
  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(source.markdown);
  const slug = createSlugger();
  const headings: GuideHeading[] = [];
  let title: AnchoredHeading | undefined;

  walkTokens(tokens, (token) => {
    if (token.type === 'heading') {
      const heading = token as AnchoredHeading;
      const text = collapse(plainText(heading));
      heading.anchor = slug(text);
      if (heading.depth === 1 && !title) title = heading;
      else if (heading.depth <= 3) {
        headings.push({ depth: heading.depth, id: heading.anchor, text });
      }
    } else if (token.type === 'link' || token.type === 'image') {
      const link = token as Tokens.Link | Tokens.Image;
      link.href = resolveGuideLink(
        source.file,
        link.href,
        files,
        docsFileExists,
      );
    }
  });
  if (!title || tokens.find((token) => token.type === 'heading') !== title) {
    throw new Error(`${source.file} must start with a level-1 heading`);
  }

  // The page renders the title as its only h1.
  const body = tokens.filter((token) => token !== title);
  marked.use({
    renderer: {
      heading(token) {
        const { anchor } = token as AnchoredHeading;
        const content = this.parser.parseInline(token.tokens);
        return `<h${token.depth} id="${anchor}">${content}</h${token.depth}>\n`;
      },
      // Guides are Markdown only; show stray HTML as text.
      html({ text }) {
        return escapeHtml(text);
      },
      // Code scrolls horizontally, so keyboard users must be able to focus it.
      code({ text, lang }) {
        const language = /^\S*/.exec(lang ?? '')?.[0] ?? '';
        const label = language ? `${language} code example` : 'Code example';
        const className = language
          ? ` class="language-${escapeHtml(language)}"`
          : '';
        return `<pre tabindex="0" role="region" aria-label="${escapeHtml(label)}"><code${className}>${escapeHtml(text)}\n</code></pre>\n`;
      },
    },
  });
  // Wide tables scroll inside a focusable, labelled region. Code is escaped,
  // so these tags only come from Markdown tables, in document order.
  const tableLabels: string[] = [];
  walkTokens(body, (token) => {
    if (token.type === 'table') {
      const columns = (token as Tokens.Table).header
        .map((cell) => collapse(cell.tokens.map(plainText).join('')))
        .filter(Boolean);
      tableLabels.push(`Table: ${columns.join(', ')}`);
    }
  });
  let table = 0;
  const html = marked
    .parser(body)
    .replace(
      /<table>/g,
      () =>
        `<div class="table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(tableLabels[table++] ?? 'Table')}"><table>`,
    )
    .replace(/<\/table>/g, '</table></div>');

  const sections: GuideSection[] = [];
  let current: { id: string | null; heading: string | null; text: string[] } = {
    id: null,
    heading: null,
    text: [],
  };
  const flush = () => {
    const text = collapse(current.text.join(' '));
    if (text || current.heading) {
      sections.push({ id: current.id, heading: current.heading, text });
    }
  };
  for (const token of body) {
    if (token.type === 'heading' && token.depth <= 3) {
      flush();
      const heading = token as AnchoredHeading;
      current = {
        id: heading.anchor!,
        heading: collapse(plainText(heading)),
        text: [],
      };
    } else current.text.push(plainText(token));
  }
  flush();

  const firstParagraph = body.find((token) => token.type === 'paragraph');
  const summary = firstParagraph ? collapse(plainText(firstParagraph)) : '';

  return {
    file: source.file,
    path: guidePath(source.file),
    href: guideHref(source.file),
    title: collapse(plainText(title)),
    summary:
      summary.length > 200
        ? `${summary.slice(0, 197).replace(/\s+\S*$/, '')}…`
        : summary,
    headings,
    sections,
    html,
    sourceUrl: `${docsSourceUrl}guides/${source.file}`,
  };
}

export function renderGuides(
  sources: readonly GuideSource[],
  docsFileExists: (path: string) => boolean,
): Guide[] {
  const files = new Set(sources.map((source) => source.file));
  const paths = new Map<string, string>();
  for (const { file } of sources) {
    const path = guidePath(file);
    const other = paths.get(path);
    if (other) throw new Error(`${file} and ${other} share the route ${path}`);
    paths.set(path, file);
  }
  return [...sources]
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((source) => renderGuide(source, files, docsFileExists));
}
