import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  creatorCommands,
  creatorOptions,
  defaultSelection,
  isValidProjectName,
  templateSymbols,
} from '../src/lib/creator.ts';
import { evaluate, renderTemplate } from '../src/lib/template-conditions.ts';

const template = new URL(
  '../sources/sdk/tools/Runic.Application.Templates/content/runic-app/',
  import.meta.url,
);
const read = (path) => readFileSync(new URL(path, template), 'utf8');

test('picker options are the template choice parameters in order', () => {
  assert.deepEqual(
    creatorOptions.map((option) => [option.flag, option.defaultValue]),
    [
      ['--frontend', 'react'],
      ['--package-manager', 'npm'],
      ['--host', 'desktop'],
      ['--view-models', 'reactiveui'],
    ],
  );
  assert.ok(
    creatorOptions.every((option) => option.choices.length >= 2),
    'every option is a choice',
  );
});

test('commands match the creator and the template', () => {
  const commands = creatorCommands('1.2.3', 'MyApp', {
    ...defaultSelection(),
    frontend: 'svelte',
    host: 'cswebui',
  });
  assert.equal(commands.interactive, 'dnx Runic.Create@1.2.3');
  assert.equal(
    commands.creator,
    'dnx Runic.Create@1.2.3 -- MyApp --frontend svelte --package-manager npm --host cswebui --view-models reactiveui',
  );
  assert.equal(
    commands.install,
    'dotnet new install Runic.Application.Templates@1.2.3',
  );
  assert.equal(
    commands.create,
    'dotnet new runic-app --name MyApp --frontend svelte --package-manager npm --host cswebui --view-models reactiveui',
  );
  assert.deepEqual(commands.nextSteps, [
    'cd MyApp',
    'dotnet tool restore',
    'dotnet runic dev',
  ]);
  assert.ok(isValidProjectName('Company.App-2'));
  assert.ok(!isValidProjectName('2App'));
  assert.ok(!isValidProjectName('my app'));
});

test('conditions support the template engine operators', () => {
  const symbols = { host: 'desktop', viewModels: 'toolkit' };
  assert.ok(evaluate('host == "desktop"', symbols));
  assert.ok(
    evaluate('(host == \'desktop\' && viewModels != "reactiveui")', symbols),
  );
  assert.ok(
    !evaluate('host == "cswebui" || viewModels == "reactiveui"', symbols),
  );
  assert.ok(
    evaluate('(enabled) && host != "cswebui"', { ...symbols, enabled: 'true' }),
  );
  assert.ok(!evaluate('enabled', { ...symbols, enabled: 'false' }));
  assert.throws(
    () => evaluate('missing == "x"', symbols),
    /Unknown template symbol/,
  );
  assert.equal(
    renderTemplate(
      [
        'a',
        '#if (host == "desktop")',
        'desktop',
        '#elif (host == "cswebui")',
        'cswebui',
        '#else',
        'other',
        '#endif',
        '  <!--#if (viewModels == "reactiveui") -->',
        'reactive',
        '  <!--#endif -->',
        'z',
      ].join('\n'),
      symbols,
    ),
    'a\ndesktop\nz',
  );
});

test('computed template symbols follow the host choice', () => {
  const computed = (host) => {
    const { desktopHost, gtk4 } = templateSymbols({
      ...defaultSelection(),
      host,
    });
    return [desktopHost, gtk4];
  };
  assert.deepEqual(computed('cswebui'), ['false', 'false']);
  assert.deepEqual(computed('desktop'), ['true', 'false']);
  assert.deepEqual(computed('desktop-gtk4'), ['true', 'true']);
});

test('every template file renders cleanly for every host and ViewModel choice', () => {
  const sources = [
    'Program.cs',
    'WorkspaceServices.cs',
    'Views.cs',
    'WorkspaceViewModel.cs',
    'RunicWindowApp.csproj',
    'README.md',
    'frontends/react/index.html',
    'frontends/angular/src/index.html',
  ];
  for (const frontend of ['react', 'vue', 'svelte', 'angular'])
    for (const host of ['cswebui', 'desktop', 'desktop-gtk4'])
      for (const viewModels of ['toolkit', 'reactiveui']) {
        const symbols = templateSymbols({
          frontend,
          packageManager: 'npm',
          host,
          viewModels,
        });
        const desktop = host !== 'cswebui';
        const files = Object.fromEntries(
          sources.map((path) => [path, renderTemplate(read(path), symbols)]),
        );
        for (const [path, content] of Object.entries(files))
          assert.doesNotMatch(
            content,
            /^\s*(#|<!--#)(if|elif|else|endif)\b/m,
            `${path} ${host} ${viewModels}`,
          );
        assert.equal(
          files['Program.cs'].includes('return RunicDesktopHost.Run('),
          desktop,
        );
        assert.equal(
          files['Program.cs'].includes('return RunicCsWebUiHost.Run('),
          !desktop,
        );
        assert.equal(
          files['Program.cs'].includes('.WithGtk4()'),
          host === 'desktop-gtk4',
        );
        assert.equal(
          files['RunicWindowApp.csproj'].includes('Runic.Desktop.Gtk4'),
          host === 'desktop-gtk4',
        );
        assert.equal(
          files['frontends/react/index.html'].includes(
            'runic-desktop-views.js',
          ),
          desktop,
        );
        assert.equal(
          files['WorkspaceViewModel.cs'].includes('ReactiveObject'),
          viewModels === 'reactiveui',
        );
        assert.equal(
          files['RunicWindowApp.csproj'].includes(
            'Runic.Application.Views.ReactiveUI',
          ),
          viewModels === 'reactiveui',
        );
        assert.equal(
          files['WorkspaceServices.cs'].includes(
            'AddRunicReactiveModelContext()',
          ),
          viewModels === 'reactiveui',
        );
        // The optional test project stays off unless --tests is passed.
        assert.doesNotMatch(files['RunicWindowApp.csproj'], /Tests/);
      }
});
