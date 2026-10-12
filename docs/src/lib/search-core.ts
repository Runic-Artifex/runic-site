// Offline site search. The build writes a small index of titles, headings and
// short texts, term shards that map words to the entries containing them, and
// the longer section texts as separate files. The browser loads the index on
// the first search, then only the shards of the query's terms and the texts it
// shows, and ranks the results without a search service.

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

/** An index entry: its text is inline when short, else in a text file. */
export type IndexedEntry = Omit<SearchEntry, 'x'> & { readonly x?: string };

export type SearchIndex = {
  readonly version: 2;
  readonly entries: IndexedEntry[];
};

/** Maps each word of the longer texts to the entries containing it. */
export type TermShard = Record<string, number[]>;

export type SearchResult = {
  readonly entry: IndexedEntry;
  readonly score: number;
  readonly excerpt: readonly { text: string; match: boolean }[];
};

export type SearchResponse = {
  /** Number of entries matching every term. */
  readonly total: number;
  readonly results: readonly SearchResult[];
};

/** Texts up to this length stay in the index. */
export const inlineTextLength = 200;
/** Shard counts for terms of two characters and of three or more. */
const shardCounts = { 2: 64, 3: 256 } as const;

export const searchIndexPath = 'search-index.json';
export const termShardPath = (key: string) => `search-index/terms/${key}.json`;
export const searchTextPath = (id: number) => `search-index/text/${id}.json`;

const separator = /[^\p{L}\p{N}_.#+-]+/u;

export function searchTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(separator)
        .map((term) => term.replace(/^[.-]+|[.-]+$/g, ''))
        .filter(Boolean),
    ),
  ];
}

function shardKey(gram: string) {
  let hash = 0;
  for (const char of gram)
    hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
  const size = [...gram].length as 2 | 3;
  return `${size}-${hash % shardCounts[size]}`;
}

/**
 * The shard holding every word that contains `term`, keyed by its first two
 * or three characters. Terms are runs of word characters, so a term occurs in
 * a text exactly when it occurs in one of the text's words. One-character
 * terms have no shard; they match titles, headings and paths only.
 */
export function termShardKey(term: string): string | null {
  const chars = [...term];
  return chars.length < 2 ? null : shardKey(chars.slice(0, 3).join(''));
}

export function allTermShardKeys(): string[] {
  return Object.entries(shardCounts).flatMap(([size, count]) =>
    Array.from({ length: count }, (_, index) => `${size}-${index}`),
  );
}

/** Splits entries into the index, the term shards and the longer texts. */
export function buildSearchIndex(entries: readonly SearchEntry[]) {
  const index: SearchIndex = { version: 2, entries: [] };
  const shards = new Map<string, TermShard>(
    // Words such as `constructor` must not resolve to Object.prototype.
    allTermShardKeys().map((key) => [key, Object.create(null)]),
  );
  const texts = new Map<number, string>();
  entries.forEach((entry, id) => {
    if (entry.x.length <= inlineTextLength) {
      index.entries.push(entry);
      return;
    }
    const { x, ...rest } = entry;
    index.entries.push(rest);
    texts.set(id, x);
    for (const word of new Set(x.toLowerCase().split(separator))) {
      const chars = [...word];
      const keys = new Set<string>();
      for (const size of [2, 3])
        for (let start = 0; start + size <= chars.length; start++)
          keys.add(shardKey(chars.slice(start, start + size).join('')));
      for (const key of keys) (shards.get(key)![word] ??= []).push(id);
    }
  });
  return { index, shards, texts };
}

type Prepared = {
  id: number;
  entry: IndexedEntry;
  title: string;
  section: string;
  /** Lowercase inline text, or null when the text is in a separate file. */
  text: string | null;
  /** Page path as words, so `host selection` finds `/desktop/host-selection/`. */
  path: string;
};

function prepare(index: SearchIndex): Prepared[] {
  if (index.version !== 2) throw new Error('Unsupported search index');
  return index.entries.map((entry, id) => ({
    id,
    entry,
    title: entry.t.toLowerCase(),
    section: (entry.s ?? '').toLowerCase(),
    text: entry.x === undefined ? null : entry.x.toLowerCase(),
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

type Match = { item: Prepared; score: number };

const byRank = (a: Match, b: Match) =>
  b.score - a.score || a.item.entry.u.localeCompare(b.item.entry.u);

/** Loads index files by their path relative to the site root. */
export type SearchLoader = (path: string) => Promise<unknown>;

export class SiteSearch {
  readonly #load: SearchLoader;
  #index: Promise<Prepared[]> | undefined;
  readonly #shards = new Map<string, Promise<TermShard>>();
  readonly #texts = new Map<number, Promise<string>>();

  constructor(load: SearchLoader) {
    this.#load = load;
  }

  #cached<K, V>(cache: Map<K, Promise<V>>, key: K, path: string) {
    let value = cache.get(key);
    if (!value) {
      value = this.#load(path) as Promise<V>;
      value.catch(() => cache.delete(key));
      cache.set(key, value);
    }
    return value;
  }

  #text(item: Prepared) {
    return item.entry.x !== undefined
      ? Promise.resolve(item.entry.x)
      : this.#cached(this.#texts, item.id, searchTextPath(item.id));
  }

  /** Entries whose longer text contains `term`, and whether at a word start. */
  async #textMatches(term: string) {
    const key = termShardKey(term);
    const matches = new Map<number, boolean>();
    if (!key) return matches;
    const shard = await this.#cached(this.#shards, key, termShardPath(key));
    for (const [word, ids] of Object.entries(shard)) {
      if (!word.includes(term)) continue;
      const start = wordStart(word, term);
      for (const id of ids) matches.set(id, matches.get(id) || start);
    }
    return matches;
  }

  /**
   * Returns the number of entries containing every term and the best `limit`
   * of them: title matches rank above section headings, which rank above
   * body text.
   */
  async search(query: string, limit = 20): Promise<SearchResponse> {
    const terms = searchTerms(query);
    if (!terms.length) return { total: 0, results: [] };
    const phrase = query.trim().toLowerCase();
    this.#index ??= (this.#load(searchIndexPath) as Promise<SearchIndex>)
      .then(prepare)
      .catch((error: unknown) => {
        this.#index = undefined;
        throw error;
      });
    const [prepared, ...textMatches] = await Promise.all([
      this.#index,
      ...terms.map((term) =>
        this.#textMatches(term).then((matches) => ({ term, matches })),
      ),
    ]);
    const matches: Match[] = [];
    // Separate texts that may still gain the phrase bonus.
    const pending: Match[] = [];
    for (const item of prepared) {
      let score = 0;
      let matched = true;
      for (const { term, matches } of textMatches) {
        const inTitle = item.title.includes(term);
        const inSection = item.section.includes(term);
        const inText =
          item.text === null
            ? matches.get(item.id)
            : [...term].length > 1 && item.text.includes(term)
              ? wordStart(item.text, term)
              : undefined;
        const inPath = wordStart(item.path, term);
        if (!inTitle && !inSection && inText === undefined && !inPath) {
          matched = false;
          break;
        }
        if (inTitle) score += wordStart(item.title, term) ? 12 : 6;
        if (inSection) score += wordStart(item.section, term) ? 8 : 4;
        if (inText !== undefined) score += inText ? 2 : 1;
        if (inPath) score += 5;
      }
      if (!matched) continue;
      if (terms.length > 1 && item.text?.includes(phrase)) score += 4;
      if (
        terms.length > 1 &&
        `${item.title} ${item.section} ${item.path}`.includes(phrase)
      )
        score += 10;
      // Prefer a page's introduction over its later sections.
      if (!item.entry.s) score += 1;
      const match = { item, score };
      matches.push(match);
      if (terms.length > 1 && item.text === null) pending.push(match);
    }
    // The phrase bonus can only lift a separate text near the cut-off into
    // the results, so load just those texts.
    matches.sort(byRank);
    const cutoff = matches[limit - 1]?.score ?? -Infinity;
    await Promise.all(
      pending
        .filter((match) => match.score + 4 >= cutoff)
        .map(async (match) => {
          const text = (await this.#text(match.item)).toLowerCase();
          if (text.includes(phrase)) match.score += 4;
        }),
    );
    const best = matches.sort(byRank).slice(0, limit);
    return {
      total: matches.length,
      results: await Promise.all(
        best.map(async ({ item, score }) => ({
          entry: item.entry,
          score,
          excerpt: excerpt(await this.#text(item), terms),
        })),
      ),
    };
  }
}
