#!/usr/bin/env bun
// Refreshes the checked-in API reference inputs in docs/sources/api/ for the
// active SDK release (src/lib/active-sdk-release.json). Run it by hand after
// a release; the portal build only reads its output and never runs it.
//
//   bun docs/scripts/sync-api-inputs.mjs
//
// NuGet packages: downloads each published .nupkg, verifies it against the
// SHA-512 that nuget.org's catalog records, then runs tools/ApiExtractor
// (System.Reflection.Metadata, no package code is loaded) over the highest
// net target framework. npm packages: downloads each published tarball,
// verifies its dist.integrity and extracts the exported API of every typed
// entry point with the TypeScript compiler API. Requires dotnet, network
// access and the docs dependencies.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';
import release from '../src/lib/active-sdk-release.json' with { type: 'json' };
import { digestInputs } from './source-inputs.mjs';
import { finishApiPackages } from './api-postprocess.mjs';

const docsRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.join(docsRoot, 'sources/api');
const manifestPath = path.join(docsRoot, 'sources/api-inputs.json');
const work = await mkdtemp(path.join(tmpdir(), 'runic-api-inputs-'));

async function fetchOk(url) {
  const response = await fetch(url);
  assert.ok(response.ok, `${url}: HTTP ${response.status}`);
  return response;
}

const fetchJson = async (url) => (await fetchOk(url)).json();
const fetchBytes = async (url) =>
  Buffer.from(await (await fetchOk(url)).arrayBuffer());

async function syncNuGet(packages) {
  const pins = [];
  const ids = [];
  for (const { identity } of packages) {
    const lower = identity.toLowerCase();
    const version = release.version.toLowerCase();
    const registration = await fetchJson(
      `https://api.nuget.org/v3/registration5-gz-semver2/${lower}/${version}.json`,
    );
    const catalog = await fetchJson(registration.catalogEntry);
    assert.equal(catalog.packageHashAlgorithm, 'SHA512', identity);
    const bytes = await fetchBytes(registration.packageContent);
    const sha512 = createHash('sha512').update(bytes).digest('base64');
    assert.equal(sha512, catalog.packageHash, `${identity}: SHA-512 mismatch`);
    const file = path.join(work, `${lower}.${version}.nupkg`);
    await writeFile(file, bytes);
    ids.push(`${identity}=${file}`);
    pins.push({
      ecosystem: 'nuget',
      package: identity,
      version: catalog.version,
      url: registration.packageContent,
      sha512,
    });
  }

  const project = path.join(docsRoot, 'tools/ApiExtractor');
  execFileSync(
    'dotnet',
    ['build', project, '-c', 'Release', '-nologo', '-v', 'q'],
    { stdio: 'inherit' },
  );
  const extracted = path.join(work, 'dotnet');
  execFileSync(
    'dotnet',
    [
      path.join(project, 'bin/Release/net10.0/ApiExtractor.dll'),
      extracted,
      ...ids,
    ],
    { stdio: 'inherit' },
  );
  const result = [];
  for (const pin of pins) {
    const api = JSON.parse(
      await readFile(path.join(extracted, `${pin.package}.json`), 'utf8'),
    );
    assert.equal(api.version, pin.version);
    result.push({ pin: { ...pin, framework: api.framework }, api });
  }
  return result;
}

/** Files of an npm tarball (ustar, with pax path records), keyed by path. */
function untar(gzip) {
  const archive = gunzipSync(gzip);
  const files = new Map();
  let paxPath;
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, length) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/s, '');
    const size = Number.parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1) || '0';
    const prefix = field(345, 155);
    const name =
      paxPath ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    const body = archive.subarray(offset + 512, offset + 512 + size);
    paxPath = undefined;
    if (type === 'x') {
      paxPath = /\d+ path=([^\n]*)\n/.exec(body.toString('utf8'))?.[1];
    } else if (type === '0') {
      files.set(name.replace(/^[^/]+\//, ''), body.toString('utf8'));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

function typeEntries(manifest) {
  const entries = [];
  const exportsField = manifest.exports;
  const typesOf = (target) => {
    if (typeof target === 'string')
      return target.endsWith('.d.ts') ? target : null;
    if (target && typeof target === 'object')
      return typesOf(target.types ?? target.import ?? target.default ?? null);
    return null;
  };
  if (exportsField && typeof exportsField === 'object') {
    for (const [subpath, target] of Object.entries(exportsField)) {
      const types = typesOf(target);
      if (types && !subpath.includes('*')) entries.push([subpath, types]);
    }
  } else if (manifest.types ?? manifest.typings) {
    entries.push(['.', manifest.types ?? manifest.typings]);
  }
  return entries.map(([subpath, types]) => ({
    module:
      subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`,
    file: path.posix.normalize(types),
  }));
}

async function syncNpm(packages) {
  const tarballs = [];
  for (const { identity } of packages) {
    const metadata = await fetchJson(
      `https://registry.npmjs.org/${identity.replace('/', '%2f')}/${release.version}`,
    );
    const bytes = await fetchBytes(metadata.dist.tarball);
    const [algorithm, expected] = metadata.dist.integrity.split('-');
    assert.equal(algorithm, 'sha512', identity);
    assert.equal(
      createHash('sha512').update(bytes).digest('base64'),
      expected,
      `${identity}: integrity mismatch`,
    );
    tarballs.push({
      pin: {
        ecosystem: 'npm',
        package: identity,
        version: metadata.version,
        url: metadata.dist.tarball,
        integrity: metadata.dist.integrity,
      },
      files: untar(bytes),
    });
  }
  return tarballs.map((tarball) => ({
    pin: tarball.pin,
    api: extractTypeScript(tarball, tarballs),
  }));
}

/** JSDoc display parts and tags in the portal's documentation node format. */
function jsDocNodes(parts, resolveLink) {
  const nodes = [];
  const pushText = (text) => {
    // Markdown fences and inline code in JSDoc text.
    const pieces = text.split(/(```[\s\S]*?```|`[^`\n]+`)/);
    for (const piece of pieces) {
      if (!piece) continue;
      if (piece.startsWith('```'))
        nodes.push({ pre: piece.replace(/^```\w*\n?|```$/g, '').trimEnd() });
      else if (piece.startsWith('`')) nodes.push({ c: piece.slice(1, -1) });
      else if (typeof nodes.at(-1) === 'string')
        nodes[nodes.length - 1] += piece;
      else nodes.push(piece);
    }
  };
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part.kind === 'link') continue;
    if (part.kind === 'linkName') {
      const name = part.text.trim();
      const label =
        parts[index + 1]?.kind === 'linkText' ? parts[++index].text.trim() : '';
      const id = resolveLink(name);
      nodes.push(
        id ? { see: id, ...(label ? { t: label } : {}) } : { c: label || name },
      );
    } else if (part.kind === 'linkText') pushText(part.text);
    else pushText(part.text);
  }
  const normalized = nodes
    .map((node) =>
      typeof node === 'string' ? node.replace(/\s+/g, ' ') : node,
    )
    .filter((node) => node !== '');
  if (typeof normalized[0] === 'string')
    normalized[0] = normalized[0].trimStart();
  if (typeof normalized.at(-1) === 'string')
    normalized[normalized.length - 1] = normalized.at(-1).trimEnd();
  return normalized.filter((node) => node !== '');
}

function symbolDocs(symbol, checker, resolveLink) {
  const docs = {};
  const summary = jsDocNodes(
    symbol.getDocumentationComment(checker),
    resolveLink,
  );
  if (summary.length) docs.summary = summary;
  const params = [];
  const typeparams = [];
  let obsolete;
  for (const tag of symbol.getJsDocTags(checker)) {
    const parts = tag.text ?? [];
    if (
      tag.name === 'param' ||
      tag.name === 'typeParam' ||
      tag.name === 'template'
    ) {
      const nameIndex = parts.findIndex(
        (part) =>
          part.kind === 'parameterName' || part.kind === 'typeParameterName',
      );
      const name = nameIndex >= 0 ? parts[nameIndex].text : '';
      const rest = parts.filter((_, index) => index !== nameIndex);
      const doc = jsDocNodes(rest, resolveLink).map((node, index) =>
        index === 0 && typeof node === 'string'
          ? node.replace(/^\s*-\s*/, '')
          : node,
      );
      (tag.name === 'param' ? params : typeparams).push({ name, doc });
    } else if (tag.name === 'returns' || tag.name === 'return') {
      docs.returns = jsDocNodes(parts, resolveLink);
    } else if (tag.name === 'remarks') {
      docs.remarks = jsDocNodes(parts, resolveLink);
    } else if (tag.name === 'example') {
      const text = parts.map((part) => part.text).join('');
      docs.example = [
        { pre: text.replace(/^\s*```\w*\n?|```\s*$/g, '').trim() },
      ];
    } else if (tag.name === 'deprecated') {
      obsolete = parts
        .map((part) => part.text)
        .join('')
        .trim();
    } else if (tag.name === 'see') {
      const nodes = jsDocNodes(parts, resolveLink);
      const see = nodes.find((node) => typeof node === 'object' && node.see);
      if (see) (docs.seealso ??= []).push(see.see);
    }
  }
  if (params.length) docs.params = params;
  if (typeparams.length) docs.typeparams = typeparams;
  return { docs: Object.keys(docs).length ? docs : undefined, obsolete };
}

const printer = ts.createPrinter({ removeComments: true });

function printDeclaration(node, sourceFile) {
  const text = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  return text
    .replace(/^export\s+(default\s+)?/, '')
    .replace(/^declare\s+/, '')
    .trim();
}

function headerOnly(node, sourceFile) {
  const factory = ts.factory;
  let empty = node;
  if (ts.isInterfaceDeclaration(node))
    empty = factory.updateInterfaceDeclaration(
      node,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      [],
    );
  else if (ts.isClassDeclaration(node))
    empty = factory.updateClassDeclaration(
      node,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      [],
    );
  else if (ts.isEnumDeclaration(node))
    empty = factory.updateEnumDeclaration(node, node.modifiers, node.name, []);
  else if (ts.isModuleDeclaration(node))
    return `namespace ${node.name.getText(sourceFile)}`;
  return printDeclaration(empty, sourceFile).replace(/\s*\{\s*\}\s*;?$/, '');
}

function declarationKind(declaration) {
  if (ts.isClassDeclaration(declaration)) return 'class';
  if (ts.isInterfaceDeclaration(declaration)) return 'interface';
  if (ts.isTypeAliasDeclaration(declaration)) return 'type';
  if (ts.isEnumDeclaration(declaration)) return 'enum';
  if (ts.isFunctionDeclaration(declaration)) return 'function';
  if (ts.isVariableDeclaration(declaration)) return 'const';
  if (ts.isModuleDeclaration(declaration)) return 'namespace';
  return 'value';
}

/** Splits printed TypeScript into text and links to exported names. */
function linkSignature(text, linkFor) {
  const parts = [];
  for (const piece of text.split(/([A-Za-z_$][\w$]*)/)) {
    if (!piece) continue;
    const id = /^[A-Z]/.test(piece) ? linkFor(piece) : null;
    if (id) parts.push([piece, id]);
    else if (typeof parts.at(-1) === 'string') parts[parts.length - 1] += piece;
    else parts.push(piece);
  }
  return parts;
}

function extractTypeScript(tarball, allTarballs) {
  const files = new Map();
  for (const other of allTarballs)
    for (const [name, content] of other.files)
      files.set(`/node_modules/${other.pin.package}/${name}`, content);
  const root = `/node_modules/${tarball.pin.package}`;
  const manifest = JSON.parse(tarball.files.get('package.json'));
  const entries = typeEntries(manifest);
  const options = {
    noLib: true,
    types: [],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    allowJs: false,
    skipLibCheck: true,
    noEmit: true,
  };
  const host = ts.createCompilerHost(options);
  host.fileExists = (name) => files.has(name);
  host.readFile = (name) => files.get(name);
  host.directoryExists = (name) =>
    [...files.keys()].some((file) => file.startsWith(`${name}/`));
  host.getDirectories = () => [];
  host.realpath = (name) => name;
  host.getCurrentDirectory = () => '/';
  host.getSourceFile = (name, languageVersion) =>
    files.has(name)
      ? ts.createSourceFile(name, files.get(name), languageVersion, true)
      : undefined;
  const program = ts.createProgram(
    entries.map((entry) => path.posix.join(root, entry.file)),
    options,
    host,
  );
  const checker = program.getTypeChecker();

  const types = [];
  const exported = new Map();
  const modules = [];
  // First pass: names, so signatures and {@link} can resolve.
  const plan = [];
  for (const entry of entries) {
    const sourceFile = program.getSourceFile(path.posix.join(root, entry.file));
    assert.ok(sourceFile, `${tarball.pin.package}: missing ${entry.file}`);
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;
    modules.push(entry.module);
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const name = symbol.getName();
      const id = `npm:${entry.module}:${name}`;
      plan.push({ entry, symbol, name, id });
      if (!exported.has(name)) exported.set(name, id);
    }
  }
  const linkFor = (name) => exported.get(name.split('.')[0]) ?? null;

  for (const { entry, symbol, name, id } of plan) {
    const target =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    const declarations = target.getDeclarations() ?? [];
    const external = declarations.find((declaration) => {
      const file = declaration.getSourceFile().fileName;
      return !file.startsWith(`${root}/`);
    });
    if (external || !declarations.length) {
      const from = external
        ?.getSourceFile()
        .fileName.match(/^\/node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1];
      types.push({
        id,
        namespace: entry.module,
        name,
        kind: 'reexport',
        signature: [`export { ${name} } from '${from ?? 'unknown'}'`],
        ...(from ? { reexport: `npm:${from}:${name}` } : {}),
      });
      continue;
    }
    const primary = declarations[0];
    const sourceFile = primary.getSourceFile();
    const kind = declarationKind(primary);
    const signatures =
      kind === 'class' ||
      kind === 'interface' ||
      kind === 'enum' ||
      kind === 'namespace'
        ? [headerOnly(primary, sourceFile)]
        : declarations.map((declaration) =>
            printDeclaration(
              ts.isVariableDeclaration(declaration)
                ? declaration.parent.parent
                : declaration,
              sourceFile,
            ),
          );
    const { docs, obsolete } = symbolDocs(target, checker, linkFor);
    const type = {
      id,
      namespace: entry.module,
      name,
      kind,
      signature: linkSignature(signatures.join('\n'), linkFor),
    };
    if (obsolete !== undefined) type.obsolete = obsolete;
    if (docs) type.docs = docs;
    if (kind === 'class' || kind === 'interface' || kind === 'enum') {
      const members = [];
      for (const declaration of declarations) {
        for (const member of declaration.members ?? []) {
          if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Private)
            continue;
          if (member.name && ts.isPrivateIdentifier(member.name)) continue;
          const memberName = member.name
            ? member.name.getText(sourceFile)
            : ts.isConstructorDeclaration(member)
              ? 'constructor'
              : ts.isCallSignatureDeclaration(member)
                ? '(call)'
                : ts.isIndexSignatureDeclaration(member)
                  ? '[index]'
                  : '(construct)';
          const memberSymbol =
            member.symbol ?? checker.getSymbolAtLocation(member.name);
          const memberDocs = memberSymbol
            ? symbolDocs(memberSymbol, checker, linkFor)
            : {};
          const entryMember = {
            id: `${id}.${memberName}`,
            kind:
              ts.isMethodSignature(member) || ts.isMethodDeclaration(member)
                ? 'method'
                : ts.isConstructorDeclaration(member)
                  ? 'constructor'
                  : ts.isEnumMember(member)
                    ? 'value'
                    : 'property',
            name: memberName,
            signature: linkSignature(
              printDeclaration(member, sourceFile),
              linkFor,
            ),
          };
          if (memberDocs.obsolete !== undefined)
            entryMember.obsolete = memberDocs.obsolete;
          if (memberDocs.docs) entryMember.docs = memberDocs.docs;
          members.push(entryMember);
        }
      }
      // Overloads share an id; number the repeats.
      const seen = new Map();
      for (const member of members) {
        const count = seen.get(member.id) ?? 0;
        seen.set(member.id, count + 1);
        if (count) member.id = `${member.id}~${count}`;
      }
      if (members.length) type.members = members;
    }
    types.push(type);
  }
  types.sort((a, b) => a.id.localeCompare(b.id));
  return {
    package: tarball.pin.package,
    version: tarball.pin.version,
    modules,
    types,
  };
}

try {
  const packages = release.packages.filter(
    (entry) =>
      entry.installKind === 'nuget-package' ||
      entry.installKind === 'npm-package',
  );
  const nuget = await syncNuGet(
    packages.filter((entry) => entry.ecosystem === 'nuget'),
  );
  const npm = await syncNpm(
    packages.filter((entry) => entry.ecosystem === 'npm'),
  );
  const all = [
    ...nuget.map((item) => ({ ...item, ecosystem: 'dotnet' })),
    ...npm.map((item) => ({ ...item, ecosystem: 'npm' })),
  ];
  finishApiPackages(all.map((item) => item.api));

  await rm(outputRoot, { recursive: true, force: true });
  const pins = [];
  for (const item of all) {
    const file = `${item.ecosystem}/${item.api.package.replace('/', '__')}.json`;
    await mkdir(path.join(outputRoot, item.ecosystem), { recursive: true });
    await writeFile(
      path.join(outputRoot, file),
      `${JSON.stringify(item.api)}\n`,
    );
    pins.push({ ...item.pin, file });
  }
  const manifest = {
    release: release.version,
    extractors: {
      dotnet: 'tools/ApiExtractor (System.Reflection.Metadata)',
      npm: `TypeScript ${ts.version} compiler API`,
    },
    packages: pins,
    contentDigest: await digestInputs(
      outputRoot,
      pins.map((pin) => pin.file),
    ),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Synchronized ${pins.length} API inputs for ${release.version}.`);
} finally {
  await rm(work, { recursive: true, force: true });
}
