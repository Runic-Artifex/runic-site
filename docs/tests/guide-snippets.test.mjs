// Verifies the code blocks of the portal guides against the pinned SDK snapshot
// in sources/sdk, without .NET, a network or a sibling checkout.
//
// Every fenced block in docs/guides names how it is checked with
// `docs-test=<kind>` in its info string:
//
//   ```sh docs-test=commands
//   ```csharp docs-test=template:Program.cs host=desktop
//   ```ts docs-test=source:examples/notes-view-first/Frontend/test/notes.test.ts
//   ```xml docs-test=readme:packages/dotnet/Runic.Assets/README.md
//   ```sh docs-test=skip:sdk-repository-workflow
//
// - `commands`: every line is a command the portal or the template documents:
//   the creator and template commands that `creatorCommands` builds from the
//   template's own declarations, a package install command for a catalog
//   package or a package the template references, or a command from the
//   generated README. `<VERSION>` stands for the release version.
// - `template:<path>`: an excerpt of a runic-app template file, rendered for
//   the selection given as `symbol=value` (or `flag=value`) arguments over
//   the template defaults, with the project named `MyApp`. The SDK's template
//   acceptance suite builds and runs every variant, so this code is compiled.
// - `source:<path>`: an excerpt of compiled SDK code in the snapshot, such as
//   an example or its tests, which SDK CI builds and runs. READMEs are not
//   accepted here.
// - `readme:<path>`: an excerpt of an SDK README in the snapshot. This only
//   keeps the guide in step with the package documentation; SDK CI does not
//   compile README code.
// - `skip:<reason>`: not checked, with a one-word reason such as
//   `sdk-repository-workflow`. Quickstart guides may not skip.
//
// An excerpt may skip source lines with a line containing only `...`,
// `// ...`, `# ...` or `<!-- ... -->`. Each part must match consecutive source
// lines; indentation may differ by a constant amount. Guides use fenced code
// blocks only.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import activeSdkRelease from '../src/lib/active-sdk-release.json' with { type: 'json' };
import {
  creatorCommands,
  creatorOptions,
  defaultSelection,
  templateSourceName,
  templateSymbols,
} from '../src/lib/creator.ts';
import {
  createReleaseDocs,
  packageInstallCommand,
  snapshotPackageRenames,
} from '../src/lib/release-docs-core.ts';
import { renderTemplate } from '../src/lib/template-conditions.ts';

const guidesRoot = new URL('../guides/', import.meta.url);
const snapshotRoot = new URL('../sources/sdk/', import.meta.url);
const templateRoot = new URL(
  'tools/Runic.Application.Templates/content/runic-app/',
  snapshotRoot,
);

/** Guides whose every code block must be verified; they may not skip. */
export const quickstartGuides = [
  'application/getting-started/README.md',
  'application/tutorial/README.md',
  'application/existing-app.md',
  'application/package-consumer.md',
  'assets/README.md',
];

const projectName = 'MyApp';
const versionSentinel = '0.0.0-docs-version';
const versionPlaceholder = '<VERSION>';

export function parseBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const open = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(lines[index]);
    if (!open) continue;
    const [, indent, fence, info] = open;
    const body = [];
    let end = index + 1;
    for (; end < lines.length; end++) {
      if (lines[end].trim().startsWith(fence)) break;
      body.push(lines[end].slice(indent.length));
    }
    const words = info.trim().split(/\s+/).filter(Boolean);
    const test = words.find((word) => word.startsWith('docs-test='));
    // Any other spelling of the attribute, such as docs-tests= or docs_test=.
    const misspelled = words.filter(
      (word) => word !== test && /^docs?[-_]?tests?\b/i.test(word),
    );
    const options = Object.fromEntries(
      words
        .filter((word) => word !== test && word.includes('='))
        .map((word) => word.split('=', 2)),
    );
    blocks.push({
      line: index + 1,
      language: words[0] ?? '',
      test: test?.slice('docs-test='.length),
      misspelled,
      options,
      code: body.join('\n'),
    });
    index = end;
  }
  return blocks;
}

function selectionFor(options) {
  const selection = defaultSelection();
  for (const [key, value] of Object.entries(options)) {
    const option = creatorOptions.find(
      (candidate) => candidate.symbol === key || candidate.flag === `--${key}`,
    );
    assert.ok(option, `unknown template option ${key}`);
    assert.ok(
      option.choices.some((choice) => choice.value === value),
      `${key}=${value} is not a template choice`,
    );
    selection[option.symbol] = value;
  }
  return selection;
}

function readSnapshot(path) {
  assert.ok(!path.split('/').includes('..'), path);
  return readFileSync(new URL(path, snapshotRoot), 'utf8');
}

function renderTemplateFile(path, selection) {
  assert.ok(!path.split('/').includes('..'), path);
  return renderTemplate(
    readFileSync(new URL(path, templateRoot), 'utf8'),
    templateSymbols(selection),
  )
    .replaceAll(templateSourceName, projectName)
    .replaceAll('__RUNIC_NUGET_VERSION__', versionPlaceholder)
    .replaceAll('__RUNIC_NPM_VERSION__', versionPlaceholder);
}

const gap = /^\s*(?:\.\.\.|\/\/ \.\.\.|# \.\.\.|<!-- \.\.\. -->)\s*$/;

function dedent(lines) {
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => /^\s*/.exec(line)[0].length);
  const common = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(common).trimEnd());
}

/** Returns the source line after the excerpt, or throws if it is not one. */
export function assertExcerpt(code, source, label) {
  const sourceLines = source.split('\n');
  const parts = [[]];
  for (const line of code.split('\n'))
    if (gap.test(line)) parts.push([]);
    else parts.at(-1).push(line);
  let from = 0;
  for (const part of parts) {
    while (part.length && !part[0].trim()) part.shift();
    while (part.length && !part.at(-1).trim()) part.pop();
    if (!part.length) continue;
    const expected = dedent(part).join('\n');
    let found = -1;
    for (let start = from; start + part.length <= sourceLines.length; start++)
      if (
        dedent(sourceLines.slice(start, start + part.length)).join('\n') ===
        expected
      ) {
        found = start;
        break;
      }
    assert.notEqual(
      found,
      -1,
      `${label}: this part is not in the source (after line ${from}):\n${expected}`,
    );
    from = found + part.length;
  }
  return from;
}

// .NET SDK commands that need no Runic input.
const dotnetCommands = ['dotnet new tool-manifest'];

function documentedCommands() {
  const commands = new Set(dotnetCommands);
  // Creator and template commands for every selection the template declares.
  const selections = creatorOptions.reduce(
    (all, option) =>
      all.flatMap((selection) =>
        option.choices.map((choice) => ({
          ...selection,
          [option.symbol]: choice.value,
        })),
      ),
    [{}],
  );
  for (const selection of selections) {
    const generated = creatorCommands(versionSentinel, projectName, selection);
    for (const command of [
      generated.interactive,
      generated.creator,
      generated.install,
      generated.create,
      ...generated.nextSteps,
    ])
      commands.add(command.replaceAll(versionSentinel, versionPlaceholder));
    // README commands of every generated variant.
    const readme = renderTemplateFile('README.md', selection);
    for (const block of parseBlocks(readme))
      if (block.language === 'sh')
        for (const line of block.code.split('\n'))
          if (line.trim()) commands.add(line.trim());
    for (const [, code] of readme.matchAll(/`(dotnet [^`]+)`/g))
      commands.add(code);
    // Third-party packages at the versions the template references.
    const project = renderTemplateFile('RunicWindowApp.csproj', selection);
    for (const [, name, version] of project.matchAll(
      /<PackageReference Include="([^"]+)" Version="([^"]+)"/g,
    ))
      if (version !== versionPlaceholder)
        commands.add(`dotnet add package ${name} --version ${version}`);
  }
  // Every catalog package at the release version, and under its new ID when
  // the pinned snapshot renamed it.
  const version = { state: 'published', value: versionSentinel };
  for (const row of createReleaseDocs(activeSdkRelease).catalogRows)
    for (const name of [row.name, snapshotPackageRenames[row.name]])
      if (name)
        commands.add(
          packageInstallCommand({ ...row, name, version }).replaceAll(
            versionSentinel,
            versionPlaceholder,
          ),
        );
  return commands;
}

function verifyBlock(block, label, commands) {
  const [kind, ...rest] = block.test.split(':');
  const path = rest.join(':');
  switch (kind) {
    case 'commands':
      assert.deepEqual(block.options, {}, `${label}: commands take no options`);
      for (const line of block.code.split('\n')) {
        const command = line.trim();
        if (!command || command.startsWith('#')) continue;
        assert.ok(
          commands.has(command),
          `${label}: '${command}' is not a documented command`,
        );
      }
      return;
    case 'template':
      assertExcerpt(
        block.code,
        renderTemplateFile(path, selectionFor(block.options)),
        `${label} (${path})`,
      );
      return;
    case 'source':
    case 'readme':
      assert.deepEqual(block.options, {}, `${label}: ${kind} takes no options`);
      assert.equal(
        /(^|\/)README\.md$/.test(path),
        kind === 'readme',
        `${label}: quote README.md files with readme:, compiled code with source:`,
      );
      assertExcerpt(block.code, readSnapshot(path), `${label} (${path})`);
      return;
    case 'skip':
      assert.match(path, /^[a-z][a-z-]*$/, `${label}: skip needs a reason`);
      return;
    default:
      assert.fail(`${label}: unknown docs-test kind '${kind}'`);
  }
}

/** Line numbers of indented code blocks, which cannot carry a docs-test kind. */
export function indentedCodeBlocks(markdown) {
  const found = [];
  let fence = null;
  let blank = true;
  let code = false;
  let list = false;
  markdown.split('\n').forEach((line, index) => {
    const indent = line.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
    const marker = line.trimStart().match(/^(`{3,}|~{3,})/)?.[1];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length)
        fence = null;
      return;
    }
    if (marker && indent < 4) {
      fence = marker;
      return;
    }
    if (!line.trim()) {
      blank = true;
      return;
    }
    const starts = indent >= 4 && !list && blank && !code;
    code = indent >= 4 && !list && (blank || code);
    if (starts) found.push(index + 1);
    if (!code && indent < 4)
      list = /^\s*([-*+]|\d+[.)])\s/.test(line) || (list && indent > 0);
    blank = false;
  });
  return found;
}

function guideFiles(directory = guidesRoot, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? guideFiles(
          new URL(`${entry.name}/`, directory),
          `${prefix}${entry.name}/`,
        )
      : entry.name.endsWith('.md')
        ? [`${prefix}${entry.name}`]
        : [],
  );
}

test('every guide code block names its check', () => {
  for (const guide of guideFiles()) {
    const markdown = readFileSync(new URL(guide, guidesRoot), 'utf8');
    assert.deepEqual(
      indentedCodeBlocks(markdown),
      [],
      `${guide}: use fenced code blocks so they can name a docs-test kind`,
    );
    for (const block of parseBlocks(markdown)) {
      const label = `${guide}:${block.line}`;
      assert.deepEqual(
        block.misspelled,
        [],
        `${label}: write docs-test=<kind>`,
      );
      assert.ok(
        block.test,
        `${label} needs a docs-test kind (see tests/guide-snippets.test.mjs)`,
      );
    }
  }
  for (const guide of quickstartGuides) {
    const blocks = parseBlocks(
      readFileSync(new URL(guide, guidesRoot), 'utf8'),
    );
    assert.ok(blocks.length > 0, `${guide} has no code blocks`);
    for (const block of blocks)
      assert.ok(
        !block.test.startsWith('skip'),
        `${guide}:${block.line}: quickstart blocks may not skip`,
      );
  }
});

test('tagged guide code blocks match the pinned SDK snapshot', () => {
  const commands = documentedCommands();
  let verified = 0;
  for (const guide of guideFiles()) {
    const markdown = readFileSync(new URL(guide, guidesRoot), 'utf8');
    for (const block of parseBlocks(markdown).filter((block) => block.test)) {
      verifyBlock(block, `${guide}:${block.line}`, commands);
      verified++;
    }
  }
  assert.ok(verified > 0);
});

test('app-facing guides import only the root Views entry', () => {
  // Generated clients own the generated-code entry points; applications and
  // their tests use the root entry and the mock Bridge.
  for (const guide of guideFiles()) {
    const markdown = readFileSync(new URL(guide, guidesRoot), 'utf8');
    assert.doesNotMatch(
      markdown,
      /@runic-artifex\/views\/(?!mock\b)[\w/-]+/,
      `${guide} imports a generated-only Views entry`,
    );
  }
});

test('the snippet checker rejects edited and reordered excerpts', () => {
  const source = 'a\n  b\n  c\nd\ne';
  assert.equal(assertExcerpt('b\nc', source, 'dedent'), 3);
  assert.equal(assertExcerpt('a\n...\nd', source, 'gap'), 4);
  assert.throws(() => assertExcerpt('b\nd', source, 'adjacent'));
  assert.throws(() => assertExcerpt('d\n// ...\na', source, 'order'));
  const [block] = parseBlocks(
    '```cs docs-test=template:Views.cs host=desktop\nx\n```',
  );
  assert.deepEqual(
    [block.language, block.test, block.options, block.code],
    ['cs', 'template:Views.cs', { host: 'desktop' }, 'x'],
  );
  assert.throws(() => selectionFor({ host: 'electron' }));
  assert.deepEqual(
    parseBlocks('```sh docs-tests=commands\nx\n```')[0].misspelled,
    ['docs-tests=commands'],
  );
  assert.deepEqual(
    indentedCodeBlocks('Text\n\n    code\n\n- item\n\n    continued\n'),
    [3],
  );
  assert.throws(() =>
    verifyBlock(
      {
        test: 'source:tools/Runic.Assets.Packer/README.md',
        options: {},
        code: '',
      },
      'readme as source',
      new Set(),
    ),
  );
  assert.throws(() =>
    verifyBlock(
      { test: 'skip', options: {}, code: '' },
      'no reason',
      new Set(),
    ),
  );
  const commands = documentedCommands();
  assert.ok(commands.has('dnx Runic.Create@<VERSION>'));
  assert.ok(
    commands.has(
      'dotnet new runic-app --name MyApp --frontend svelte --package-manager bun --host desktop --view-models reactiveui',
    ),
  );
  assert.ok(
    !commands.has(
      'dotnet new runic-app --name MyApp --host desktop --frontend svelte --package-manager bun --view-models reactiveui',
    ),
  );
  assert.ok(
    commands.has('dotnet add package Runic.Assets --version <VERSION>'),
  );
  assert.ok(
    !commands.has('dotnet add package Runic.Translations --version <VERSION>'),
  );
});
