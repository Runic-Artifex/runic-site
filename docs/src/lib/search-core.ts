// Offline site search. The build writes a small JSON index of guide sections
// and product summaries; the browser ranks it without a search service.

export type SearchEntry = {
  /** Page title. */
  readonly t: string;
  /** Section heading, when the entry is a section of a page. */
  readonly s?: string;
  /** Site path including any fragment. */
  readonly u: string;
  /** Plain text of the section. */
  readonly x: string;
};

export type SearchIndex = {
  readonly version: 1;
  readonly entries: SearchEntry[];
};

export type SearchResult = {
  readonly entry: SearchEntry;
  readonly score: number;
  readonly excerpt: readonly { text: string; match: boolean }[];
};

type Prepared = {
  entry: SearchEntry;
  title: string;
  section: string;
  text: string;
  /** Page path as words, so `host selection` finds `/desktop/host-selection/`. */
  path: string;
};

export function searchTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}_.#+-]+/u)
        .map((term) => term.replace(/^[.-]+|[.-]+$/g, ''))
        .filter(Boolean),
    ),
  ];
}

export function prepareIndex(index: SearchIndex): Prepared[] {
  if (index.version !== 1) throw new Error('Unsupported search index');
  return index.entries.map((entry) => ({
    entry,
    title: entry.t.toLowerCase(),
    section: (entry.s ?? '').toLowerCase(),
    text: entry.x.toLowerCase(),
    path: entry.u
      .split('#')[0]
      .toLowerCase()
      .replace(/[/_-]+/g, ' '),
  }));
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordStart(haystack: string, term: string) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}`, 'u').test(
    haystack,
  );
}

/** Splits an excerpt of `text` around the first match into marked parts. */
export function excerpt(text: string, terms: readonly string[], width = 180) {
  const lower = text.toLowerCase();
  const first = Math.min(
    ...terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0),
  );
  let start = Number.isFinite(first) ? Math.max(0, first - width / 3) : 0;
  if (start > 0) start = text.indexOf(' ', start) + 1 || start;
  let end = Math.min(text.length, start + width);
  if (end < text.length) end = text.lastIndexOf(' ', end) || end;
  const slice = text.slice(start, end);
  const pattern = terms.length
    ? new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
    : null;
  const parts = (pattern ? slice.split(pattern) : [slice])
    .filter(Boolean)
    .map((part) => ({
      text: part,
      match: terms.includes(part.toLowerCase()),
    }));
  if (start > 0) parts.unshift({ text: '…', match: false });
  if (end < text.length) parts.push({ text: '…', match: false });
  return parts;
}

/**
 * Returns entries containing every term, best first: title matches rank
 * above section headings, which rank above body text.
 */
export function search(
  prepared: readonly Prepared[],
  query: string,
  limit = 20,
): SearchResult[] {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const phrase = query.trim().toLowerCase();
  const results: SearchResult[] = [];
  for (const item of prepared) {
    let score = 0;
    let matched = true;
    for (const term of terms) {
      const inTitle = item.title.includes(term);
      const inSection = item.section.includes(term);
      const inText = item.text.includes(term);
      const inPath = wordStart(item.path, term);
      if (!inTitle && !inSection && !inText && !inPath) {
        matched = false;
        break;
      }
      if (inTitle) score += wordStart(item.title, term) ? 12 : 6;
      if (inSection) score += wordStart(item.section, term) ? 8 : 4;
      if (inText) score += wordStart(item.text, term) ? 2 : 1;
      if (inPath) score += 5;
    }
    if (!matched) continue;
    if (terms.length > 1 && item.text.includes(phrase)) score += 4;
    if (
      terms.length > 1 &&
      `${item.title} ${item.section} ${item.path}`.includes(phrase)
    )
      score += 10;
    // Prefer a page's introduction over its later sections.
    if (!item.entry.s) score += 1;
    results.push({
      entry: item.entry,
      score,
      excerpt: excerpt(item.entry.x, terms),
    });
  }
  return results
    .sort((a, b) => b.score - a.score || a.entry.u.localeCompare(b.entry.u))
    .slice(0, limit);
}
