// Builds the API reference pages from the checked-in models in sources/api/
// (see scripts/sync-api-inputs.mjs). Pure functions, shared by the
// prerendered routes and the tests. Output HTML is escaped here; the models
// never contain markup.
import { apiPackageHref, apiPackageSlug } from './api-paths';

export type Segment = string | [text: string, id: string];

export type DocNode =
  | string
  | { c: string }
  | { see: string; t?: string }
  | { href: string; t: string }
  | { p: DocNode[] }
  | { pre: string }
  | { ul: DocNode[][] }
  | { ol: DocNode[][] }
  | { b: DocNode[] }
  | { i: DocNode[] };

type Named = { name: string; doc: DocNode[] };

export type ApiDocs = {
  summary?: DocNode[];
  remarks?: DocNode[];
  returns?: DocNode[];
  value?: DocNode[];
  example?: DocNode[];
  params?: Named[];
  typeparams?: Named[];
  exceptions?: { cref: string | null; doc: DocNode[] }[];
  seealso?: string[];
  inheritdoc?: { cref?: string };
};

export type ApiMember = {
  id: string;
  kind: string;
  name: string;
  signature: Segment[];
  docs?: ApiDocs;
  obsolete?: string;
  inherited?: string;
  extension?: boolean;
};

export type ApiType = ApiMember & {
  namespace: string;
  members?: ApiMember[];
  base?: string;
  interfaces?: string[];
  declaringType?: string;
  reexport?: string;
};

export type ApiPackage = {
  package: string;
  version: string;
  framework?: string;
  frameworks?: string[];
  assemblies?: string[];
  modules?: string[];
  types: ApiType[];
};

export type ApiPin = {
  ecosystem: 'nuget' | 'npm';
  package: string;
  version: string;
  url: string;
  sha512?: string;
  integrity?: string;
  framework?: string;
  file: string;
};

export type ApiManifest = {
  release: string;
  extractors: Record<string, string>;
  packages: ApiPin[];
  contentDigest: string;
};

export type ApiTypeView = {
  type: ApiType;
  slug: string;
  href: string;
  /** Types with members get a page; others are documented on the package page. */
  page: boolean;
  anchor: string;
  summaryText: string;
};

export type ApiPackageView = {
  id: string;
  slug: string;
  href: string;
  ecosystem: 'nuget' | 'npm';
  version: string;
  framework?: string;
  frameworks?: string[];
  assemblies?: string[];
  url: string;
  groups: { title: string; types: ApiTypeView[] }[];
};

const memberGroups: [kinds: string[], title: string][] = [
  [['constructor'], 'Constructors'],
  [['value'], 'Values'],
  [['field'], 'Fields'],
  [['property', 'indexer'], 'Properties'],
  [['method'], 'Methods'],
  [['event'], 'Events'],
  [['operator'], 'Operators'],
];

const kindLabels: Record<string, string> = {
  class: 'class',
  record: 'record',
  'record struct': 'record struct',
  struct: 'struct',
  interface: 'interface',
  enum: 'enum',
  delegate: 'delegate',
  function: 'function',
  const: 'constant',
  type: 'type alias',
  namespace: 'namespace',
  reexport: 're-export',
};

export function kindLabel(kind: string) {
  return kindLabels[kind] ?? kind;
}

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Anchor-safe fragment: letters, digits, `.`, `_` and `-`. */
export function anchorSlug(text: string) {
  return (
    text
      .replace(/`/g, '-')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

/** Short display name of a cref or member ID, such as `AssetManifest.Open`. */
export function shortName(id: string) {
  const body = id.replace(/^[A-Z!]:/, '').replace(/^npm:[^:]+:/, '');
  const withoutParameters = body.replace(/\(.*$/, '').replace(/~.*$/, '');
  const parts = withoutParameters.split('.');
  const name =
    id.startsWith('T:') || id.startsWith('npm:')
      ? parts.at(-1)!
      : parts.slice(-2).join('.');
  return name.replace(/``?\d+/g, '').replace('#ctor', 'constructor');
}

/** Microsoft Learn page for framework types and members, when the ID is one. */
export function learnUrl(id: string) {
  const match = /^[TMPFEN]:((?:System|Microsoft)\.[^(~]*)/.exec(id);
  if (!match) return null;
  const name = match[1]
    .replace(/``\d+/g, '')
    .replace(/`(\d+)/g, '-$1')
    .replace(/\.#ctor$/, '.-ctor')
    .toLowerCase();
  return `https://learn.microsoft.com/dotnet/api/${name}`;
}

export function docText(nodes: DocNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (typeof node === 'string') return node;
      if ('c' in node) return node.c;
      if ('see' in node) return node.t ?? shortName(node.see);
      if ('href' in node) return node.t;
      if ('p' in node) return ` ${docText(node.p)} `;
      if ('pre' in node) return '';
      if ('ul' in node) return node.ul.map(docText).join(' ');
      if ('ol' in node) return node.ol.map(docText).join(' ');
      if ('b' in node) return docText(node.b);
      return docText(node.i);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, length: number) {
  return text.length > length
    ? `${text.slice(0, length - 1).replace(/\s+\S*$/, '')}…`
    : text;
}

export class ApiReference {
  readonly packages: ApiPackageView[];
  readonly types = new Map<
    string,
    { pkg: ApiPackageView; view: ApiTypeView }
  >();
  readonly #links = new Map<string, string>();

  constructor(manifest: ApiManifest, models: Record<string, ApiPackage>) {
    this.packages = manifest.packages
      .map((pin) => {
        const model = models[pin.file];
        if (!model) throw new Error(`Missing API model ${pin.file}`);
        if (model.package !== pin.package || model.version !== pin.version)
          throw new Error(`${pin.file} does not match its pin`);
        return this.#packageView(pin, model);
      })
      .sort(
        (a, b) =>
          (a.ecosystem === b.ecosystem
            ? 0
            : a.ecosystem === 'nuget'
              ? -1
              : 1) || a.id.localeCompare(b.id),
      );
    // Second pass: member links, now that every type has an address.
    for (const pkg of this.packages)
      for (const group of pkg.groups)
        for (const view of group.types)
          for (const { member, anchor } of this.memberAnchors(view.type))
            this.#links.set(
              member.id,
              view.page ? `${view.href}#${anchor}` : view.href,
            );
  }

  #packageView(pin: ApiPin, model: ApiPackage): ApiPackageView {
    const slug = apiPackageSlug(pin.package);
    const href = apiPackageHref(pin.package);
    const groups = new Map<string, ApiTypeView[]>();
    const usedSlugs = new Set<string>();
    for (const type of model.types) {
      const page =
        pin.ecosystem === 'nuget' ||
        ['class', 'interface', 'enum'].includes(type.kind);
      const base =
        pin.ecosystem === 'nuget'
          ? type.id.slice(2).replace(/`/g, '-')
          : `${type.namespace === pin.package ? '' : `${type.namespace.slice(pin.package.length + 1)}.`}${type.name}`;
      let typeSlug = anchorSlug(base);
      for (let index = 2; usedSlugs.has(typeSlug.toLowerCase()); index++)
        typeSlug = `${anchorSlug(base)}-${index}`;
      usedSlugs.add(typeSlug.toLowerCase());
      const anchor = `api-${typeSlug}`;
      const view: ApiTypeView = {
        type,
        slug: typeSlug,
        href: page ? `${href}${typeSlug}/` : `${href}#${anchor}`,
        page,
        anchor,
        summaryText: docText(type.docs?.summary),
      };
      const title = type.namespace || pin.package;
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title)!.push(view);
      this.#links.set(type.id, view.href);
    }
    const pkg: ApiPackageView = {
      id: pin.package,
      slug,
      href,
      ecosystem: pin.ecosystem,
      version: pin.version,
      framework: model.framework,
      frameworks: model.frameworks,
      assemblies: model.assemblies,
      url: pin.url,
      groups: [...groups]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([title, types]) => ({
          title,
          types: types.sort((a, b) => a.type.name.localeCompare(b.type.name)),
        })),
    };
    for (const group of pkg.groups)
      for (const view of group.types)
        this.types.set(view.type.id, { pkg, view });
    return pkg;
  }

  /** Stable anchors for a type's members; overloads get -2, -3, ... */
  memberAnchors(type: ApiType) {
    const used = new Map<string, number>();
    return (type.members ?? []).map((member) => {
      const base = anchorSlug(
        member.kind === 'constructor' ? 'constructor' : member.name,
      );
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      return { member, anchor: count === 1 ? base : `${base}-${count}` };
    });
  }

  /** Site path or external URL for a documentation ID, if one is known. */
  href(id: string): string | null {
    return this.#links.get(id) ?? learnUrl(id);
  }

  link(id: string, label?: string) {
    const href = this.href(id);
    const code = `<code>${escapeHtml(label ?? shortName(id))}</code>`;
    return href ? `<a href="${escapeHtml(href)}">${code}</a>` : code;
  }

  signature(parts: Segment[]) {
    return parts
      .map((part) => {
        if (typeof part === 'string') return escapeHtml(part);
        const href = this.href(part[1]);
        return href
          ? `<a href="${escapeHtml(href)}">${escapeHtml(part[0])}</a>`
          : escapeHtml(part[0]);
      })
      .join('');
  }

  signatureBlock(parts: Segment[], label: string) {
    return `<pre class="api-signature" tabindex="0" role="region" aria-label="${escapeHtml(label)}"><code>${this.signature(parts)}</code></pre>`;
  }

  inline(nodes: DocNode[]): string {
    return nodes
      .map((node) => {
        if (typeof node === 'string') return escapeHtml(node);
        if ('c' in node) return `<code>${escapeHtml(node.c)}</code>`;
        if ('see' in node) return this.link(node.see, node.t);
        if ('href' in node)
          return /^(https:|mailto:)/i.test(node.href)
            ? `<a href="${escapeHtml(node.href)}">${escapeHtml(node.t)}</a>`
            : escapeHtml(node.t);
        if ('b' in node) return `<strong>${this.inline(node.b)}</strong>`;
        if ('i' in node) return `<em>${this.inline(node.i)}</em>`;
        return this.blocks([node]);
      })
      .join('');
  }

  /** Doc nodes as paragraphs, lists and code blocks. */
  blocks(nodes: DocNode[] | undefined): string {
    let html = '';
    let inline: DocNode[] = [];
    const flush = () => {
      const text = this.inline(inline).trim();
      if (text) html += `<p>${text}</p>`;
      inline = [];
    };
    for (const node of nodes ?? []) {
      if (typeof node === 'object' && 'p' in node) {
        flush();
        html += `<p>${this.inline(node.p)}</p>`;
      } else if (typeof node === 'object' && 'pre' in node) {
        flush();
        html += `<pre tabindex="0" role="region" aria-label="Code example"><code>${escapeHtml(node.pre)}</code></pre>`;
      } else if (typeof node === 'object' && ('ul' in node || 'ol' in node)) {
        flush();
        const tag = 'ul' in node ? 'ul' : 'ol';
        const items = 'ul' in node ? node.ul : node.ol;
        html += `<${tag}>${items.map((item) => `<li>${this.inline(item)}</li>`).join('')}</${tag}>`;
      } else inline.push(node);
    }
    flush();
    return html;
  }

  /** Documentation of a type or member below its signature. */
  docs(entry: ApiMember): string {
    const docs = entry.docs ?? {};
    let html = '';
    if (entry.obsolete !== undefined)
      html += `<p class="api-obsolete"><strong>Obsolete.</strong> ${escapeHtml(entry.obsolete)}</p>`;
    html += this.blocks(docs.summary);
    const named = (title: string, items: Named[] | undefined) =>
      items?.length
        ? `<p class="api-label">${title}</p><dl class="api-params">${items
            .map(
              (item) =>
                `<dt><code>${escapeHtml(item.name)}</code></dt><dd>${this.inline(item.doc) || '—'}</dd>`,
            )
            .join('')}</dl>`
        : '';
    html += named('Type parameters', docs.typeparams);
    html += named('Parameters', docs.params);
    if (docs.returns?.length)
      html += `<p class="api-label">Returns</p>${this.blocks(docs.returns)}`;
    if (docs.value?.length)
      html += `<p class="api-label">Value</p>${this.blocks(docs.value)}`;
    if (docs.exceptions?.length)
      html += `<p class="api-label">Exceptions</p><dl class="api-params">${docs.exceptions
        .map(
          (exception) =>
            `<dt>${exception.cref ? this.link(exception.cref) : ''}</dt><dd>${this.inline(exception.doc) || '—'}</dd>`,
        )
        .join('')}</dl>`;
    if (docs.remarks?.length)
      html += `<p class="api-label">Remarks</p>${this.blocks(docs.remarks)}`;
    if (docs.example?.length)
      html += `<p class="api-label">Example</p>${this.blocks(docs.example)}`;
    if (docs.seealso?.length)
      html += `<p class="api-label">See also</p><ul>${docs.seealso
        .map((cref) => `<li>${this.link(cref)}</li>`)
        .join('')}</ul>`;
    if (docs.inheritdoc)
      html += `<p class="api-inherited">Inherits documentation from ${
        docs.inheritdoc.cref
          ? this.link(docs.inheritdoc.cref)
          : 'its base member'
      }.</p>`;
    else if (entry.inherited)
      html += `<p class="api-inherited">Documentation from ${this.link(entry.inherited)}.</p>`;
    if (!html) html = '<p class="api-undocumented">No documentation.</p>';
    return html;
  }

  /** View model of a type page. */
  typePage(packageSlug: string, typeSlug: string) {
    const pkg = this.packages.find(
      (candidate) => candidate.slug === packageSlug,
    );
    const view = pkg?.groups
      .flatMap((group) => group.types)
      .find((candidate) => candidate.page && candidate.slug === typeSlug);
    if (!pkg || !view) return null;
    const { type } = view;
    const anchors = this.memberAnchors(type);
    const inheritance = [type.base, ...(type.interfaces ?? [])]
      .filter((id): id is string => Boolean(id))
      .map((id) => this.link(id));
    return {
      package: { id: pkg.id, href: pkg.href, version: pkg.version },
      title: `${type.name} ${kindLabel(type.kind)}`,
      name: type.name,
      kind: kindLabel(type.kind),
      namespace: type.namespace,
      summary: truncate(docText(type.docs?.summary), 200),
      signature: this.signatureBlock(
        type.signature,
        `${type.name} declaration`,
      ),
      docs: this.docs(type),
      declaringType: type.declaringType ? this.link(type.declaringType) : null,
      inheritance,
      groups: memberGroups
        .map(([kinds, title]) => ({
          title,
          id: anchorSlug(title.toLowerCase()),
          members: anchors
            .filter(({ member }) => kinds.includes(member.kind))
            .map(({ member, anchor }) => ({
              anchor,
              name: member.name,
              signature: this.signatureBlock(
                member.signature,
                `${member.name} declaration`,
              ),
              docs: this.docs(member),
            })),
        }))
        .filter((group) => group.members.length > 0),
    };
  }

  /** View model of a package page, with inline entries for page-less types. */
  packagePage(packageSlug: string) {
    const pkg = this.packages.find(
      (candidate) => candidate.slug === packageSlug,
    );
    if (!pkg) return null;
    return {
      id: pkg.id,
      ecosystem: pkg.ecosystem,
      version: pkg.version,
      framework: pkg.framework ?? null,
      frameworks: pkg.frameworks ?? [],
      assemblies: pkg.assemblies ?? [],
      url: pkg.url,
      groups: pkg.groups.map((group) => ({
        title: group.title,
        id: anchorSlug(`ns-${group.title}`),
        types: group.types.map((view) => ({
          name: view.type.name,
          kind: kindLabel(view.type.kind),
          href: view.page ? view.href : null,
          anchor: view.anchor,
          summary: this.inline(
            view.type.docs?.summary?.filter(
              (node) => typeof node === 'string' || !('pre' in node),
            ) ?? [],
          ),
          // Page-less types are documented here in full.
          inline: view.page
            ? null
            : {
                signature: this.signatureBlock(
                  view.type.signature,
                  `${view.type.name} declaration`,
                ),
                docs: view.type.reexport
                  ? `<p>Re-exported from ${this.link(view.type.reexport)}.</p>`
                  : this.docs(view.type),
              },
        })),
      })),
    };
  }

  /** One search entry per type: name, package, address and summary. */
  searchEntries() {
    return this.packages.flatMap((pkg) =>
      pkg.groups.flatMap((group) =>
        group.types.map((view) => ({
          t: view.type.name,
          s: pkg.id,
          u: view.href,
          x: truncate(view.summaryText, 120),
        })),
      ),
    );
  }
}
