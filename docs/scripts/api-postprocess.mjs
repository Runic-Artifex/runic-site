// Completes extracted API models across packages before they are checked in:
// resolves <inheritdoc/> from base types, interfaces or an explicit cref, and
// documents positional record properties from their <param> docs.

const kindOf = (id) => id.slice(0, id.indexOf(':'));

function memberSuffix(type, member) {
  const prefix = `${type.id.slice(2)}.`;
  const body = member.id.slice(member.id.indexOf(':') + 1);
  return body.startsWith(prefix) ? body.slice(prefix.length) : null;
}

/** Mutates the package models in place. */
export function finishApiPackages(packages) {
  const types = new Map();
  const entries = new Map();
  for (const api of packages)
    for (const type of api.types) {
      types.set(type.id, type);
      entries.set(type.id, type);
      for (const member of type.members ?? []) entries.set(member.id, member);
    }

  // Positional records document their properties as <param> of the type or
  // its primary constructor.
  for (const type of types.values()) {
    if (type.kind !== 'record' && type.kind !== 'record struct') continue;
    const params = new Map();
    for (const source of [
      type,
      ...(type.members ?? []).filter((m) => m.kind === 'constructor'),
    ])
      for (const param of source.docs?.params ?? [])
        if (param.doc.length && !params.has(param.name))
          params.set(param.name, param.doc);
    for (const member of type.members ?? [])
      if (
        member.kind === 'property' &&
        !member.docs?.summary &&
        params.has(member.name)
      )
        member.docs = { ...member.docs, summary: params.get(member.name) };
  }

  function ancestors(type) {
    const result = [];
    const queue = [type.base, ...(type.interfaces ?? [])].filter(Boolean);
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
      const ancestor = types.get(id);
      if (ancestor)
        queue.push(
          ...[ancestor.base, ...(ancestor.interfaces ?? [])].filter(Boolean),
        );
    }
    return result;
  }

  const pending = [];
  for (const type of types.values()) {
    if (type.docs?.inheritdoc)
      pending.push({
        entry: type,
        candidates: () =>
          type.docs.inheritdoc.cref
            ? [type.docs.inheritdoc.cref]
            : ancestors(type),
      });
    for (const member of type.members ?? [])
      if (member.docs?.inheritdoc)
        pending.push({
          entry: member,
          candidates: () => {
            if (member.docs.inheritdoc.cref)
              return [member.docs.inheritdoc.cref];
            const suffix = memberSuffix(type, member);
            return suffix === null
              ? []
              : ancestors(type).map(
                  (ancestor) =>
                    `${kindOf(member.id)}:${ancestor.slice(2)}.${suffix}`,
                );
          },
        });
  }

  const framework = /^[A-Z]:(?:System|Microsoft)\./;
  const objectMembers = new Map([
    ['ToString', 'M:System.Object.ToString'],
    ['Equals(System.Object)', 'M:System.Object.Equals(System.Object)'],
    ['GetHashCode', 'M:System.Object.GetHashCode'],
  ]);
  // Framework interfaces that declare commonly implemented members.
  const frameworkDeclarers = new Map([
    ['Dispose', 'System.IDisposable'],
    ['DisposeAsync', 'System.IAsyncDisposable'],
    ['PropertyChanged', 'System.ComponentModel.INotifyPropertyChanged'],
    ['PropertyChanging', 'System.ComponentModel.INotifyPropertyChanging'],
    ['ErrorsChanged', 'System.ComponentModel.INotifyDataErrorInfo'],
    ['GetErrors', 'System.ComponentModel.INotifyDataErrorInfo'],
    ['HasErrors', 'System.ComponentModel.INotifyDataErrorInfo'],
    [
      'CollectionChanged',
      'System.Collections.Specialized.INotifyCollectionChanged',
    ],
  ]);

  // Chains resolve over repeated passes.
  for (let changed = true; changed;) {
    changed = false;
    for (const item of pending) {
      if (!item.entry.docs?.inheritdoc) continue;
      const source = item
        .candidates()
        .map((id) => entries.get(id))
        .find((candidate) => candidate?.docs && !candidate.docs.inheritdoc);
      if (!source) continue;
      const own = { ...item.entry.docs };
      delete own.inheritdoc;
      item.entry.docs = { ...source.docs, ...own };
      item.entry.inherited = source.id;
      changed = true;
    }
  }

  // Documentation inherited from .NET itself: point at Microsoft Learn.
  for (const item of pending) {
    const inheritdoc = item.entry.docs?.inheritdoc;
    if (!inheritdoc || inheritdoc.cref) continue;
    const body = item.entry.id.slice(2);
    const key = `${body.replace(/\(.*$/, '').split('.').at(-1)}${/\(.*\)$/.exec(body)?.[0] ?? ''}`;
    // Several framework ancestors could declare the member; only link when
    // the declaring one is certain.
    const fromFramework =
      item.entry.id.startsWith('M:') && objectMembers.has(key)
        ? objectMembers.get(key)
        : (() => {
            const matches = item
              .candidates()
              .filter((id) => framework.test(id));
            if (matches.length === 1) return matches[0];
            const declarer = frameworkDeclarers.get(key.replace(/\(.*$/, ''));
            return declarer
              ? matches.find((id) => id.slice(2).startsWith(`${declarer}.`))
              : undefined;
          })();
    if (fromFramework) inheritdoc.cref = fromFramework;
  }
}
