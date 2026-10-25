import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  creatorCommands,
  creatorOptions,
  creatorTexts,
  creatorToggles,
  defaultSelection,
  isValidApplicationId,
  isValidProjectName,
  templateReplacements,
  templateSymbols,
  viewCommand,
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
      ['--linux-gtk', '3'],
      ['--view-models', 'reactiveui'],
    ],
  );
  assert.ok(
    creatorOptions.every((option) => option.choices.length >= 2),
    'every option is a choice',
  );
  assert.deepEqual(
    creatorOptions[0].choices.map((choice) => choice.value),
    ['react', 'vue', 'svelte', 'sveltekit', 'angular'],
  );
});

test('picker toggles are the template Boolean parameters', () => {
  assert.deepEqual(
    creatorToggles.map((toggle) => [toggle.flag, toggle.defaultValue]),
    [
      ['--tests', false],
      ['--nix', false],
      ['--packaging', false],
      ['--restore', false],
    ],
  );
  assert.equal(defaultSelection().tests, 'false');
});

test('picker text options are the template text parameters', () => {
  assert.deepEqual(
    creatorTexts.map((text) => text.flag),
    ['--application-id'],
  );
  assert.equal(defaultSelection().applicationId, '');
});

test('a given application ID follows the toggles and replaces the default', () => {
  const selection = {
    ...defaultSelection(),
    restore: 'true',
    applicationId: ' org.example.Notes ',
  };
  const commands = creatorCommands('1.2.3', 'MyApp', selection);
  assert.equal(
    commands.creator,
    'dnx Runic.Create@1.2.3 -- MyApp --frontend react --package-manager npm --host desktop --linux-gtk 3 --view-models reactiveui --restore --application-id org.example.Notes',
  );
  assert.match(
    commands.create,
    / --view-models reactiveui --restore --application-id org\.example\.Notes$/,
  );
  assert.deepEqual(
    templateReplacements(selection, 'MyApp').find(
      ([token]) => token === '__RUNIC_APPLICATION_ID__',
    ),
    ['__RUNIC_APPLICATION_ID__', 'org.example.Notes'],
  );
  // Left out, the template derives com.example. and the project name.
  assert.deepEqual(
    templateReplacements(defaultSelection(), 'My-App').find(
      ([token]) => token === '__RUNIC_APPLICATION_ID__',
    ),
    ['__RUNIC_APPLICATION_ID__', 'com.example.MyApp'],
  );
  assert.doesNotMatch(
    creatorCommands('1.2.3', 'MyApp', defaultSelection()).creator,
    /--application-id|--restore/,
  );
  assert.ok(isValidApplicationId('org.example.Notes'));
  assert.ok(!isValidApplicationId('Notes'));
  assert.ok(!isValidApplicationId('org.example.my-notes'));
  assert.ok(!isValidApplicationId('org.2example.Notes'));
  assert.ok(!isValidApplicationId(`org.${'a'.repeat(50)}`));
});

test('the runic-view item template command follows the ViewModel choice', () => {
  assert.equal(
    viewCommand('Settings', defaultSelection()),
    'dotnet new runic-view --name Settings --view-models reactiveui',
  );
  assert.equal(
    viewCommand(
      'Preferences',
      { ...defaultSelection(), viewModels: 'toolkit' },
      true,
    ),
    'dotnet new runic-view --name Preferences --view-models toolkit --window',
  );
});

test('the SvelteKit frontend renders cleanly and loads the Views client', () => {
  const symbols = templateSymbols({
    ...defaultSelection(),
    frontend: 'sveltekit',
  });
  for (const path of [
    'frontends/sveltekit/src/routes/+page.svelte',
    'frontends/sveltekit/src/app.html',
  ])
    assert.doesNotMatch(
      renderTemplate(read(path), symbols),
      /^\s*(#|<!--#)(if|elif|else|endif)\b/m,
      path,
    );
  assert.match(
    read('frontends/sveltekit/src/app.html'),
    /<script src="runic-views\.js">/,
  );
});

test('the tests toggle adds its flag and the test command', () => {
  const commands = creatorCommands('1.2.3', 'MyApp', {
    ...defaultSelection(),
    tests: 'true',
  });
  assert.equal(
    commands.creator,
    'dnx Runic.Create@1.2.3 -- MyApp --frontend react --package-manager npm --host desktop --linux-gtk 3 --view-models reactiveui --tests',
  );
  assert.equal(
    commands.create,
    'dotnet new runic-app --name MyApp --frontend react --package-manager npm --host desktop --linux-gtk 3 --view-models reactiveui --tests',
  );
  assert.deepEqual(commands.nextSteps, [
    'cd MyApp',
    'dotnet tool restore',
    'dotnet runic dev',
    'dotnet test --project MyApp.Tests',
  ]);
  const project = renderTemplate(
    read('RunicWindowApp.csproj'),
    templateSymbols({ ...defaultSelection(), tests: 'true' }),
  );
  assert.match(project, /Tests/);
  assert.doesNotMatch(
    renderTemplate(
      read('RunicWindowApp.Tests/WorkspaceWindowTests.cs'),
      templateSymbols({ ...defaultSelection(), tests: 'true' }),
    ),
    /^\s*(#|<!--#)(if|elif|else|endif)\b/m,
  );
});

test('the nix toggle adds its flag and a flake for the chosen host', () => {
  const selection = {
    ...defaultSelection(),
    packageManager: 'bun',
    host: 'desktop',
    linuxGtk: '4',
    nix: 'true',
  };
  assert.match(
    creatorCommands('1.2.3', 'MyApp', selection).create,
    / --host desktop --linux-gtk 4 .* --nix$/,
  );
  const flake = templateReplacements(selection).reduce(
    (text, [token, value]) => text.replaceAll(token, value),
    renderTemplate(read('flake.nix'), templateSymbols(selection)),
  );
  assert.match(flake, /packageManager = "bun";/);
  assert.match(flake, /host = "desktop-gtk4";/);
  assert.match(flake, /hash = lib\.fakeHash;/);
  // The preview replaces __RUNIC_NUGET_VERSION__ with the selected release.
  assert.doesNotMatch(
    flake.replaceAll('__RUNIC_NUGET_VERSION__', '1.2.3'),
    /__[A-Z_]+__|^\s*#(if|else|endif)\b/m,
  );
  assert.match(
    renderTemplate(read('RunicWindowApp.csproj'), templateSymbols(selection)),
    /<RestorePackagesWithLockFile>true</,
  );
});

test('commands match the creator and the template', () => {
  // Like Runic.Create, a CS-WebUI project leaves out --linux-gtk.
  const commands = creatorCommands('1.2.3', 'MyApp', {
    ...defaultSelection(),
    frontend: 'svelte',
    host: 'cswebui',
    linuxGtk: '4',
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
  // Text after a markup directive on its line stays, as in the README.
  assert.equal(
    renderTemplate(
      [
        '<!--#if (host == "cswebui") -->',
        'cswebui',
        '<!--#else -->',
        'other',
        '<!--#endif --> Shared text.',
      ].join('\n'),
      symbols,
    ),
    'other\nShared text.',
  );
});

test('computed template symbols follow the host choice', () => {
  const computed = (host, linuxGtk = '3') => {
    const { desktopHost, gtk4, nixHost } = templateSymbols({
      ...defaultSelection(),
      host,
      linuxGtk,
    });
    return [desktopHost, gtk4, nixHost];
  };
  assert.deepEqual(computed('cswebui'), ['false', 'false', 'cswebui']);
  assert.deepEqual(computed('cswebui', '4'), ['false', 'false', 'cswebui']);
  assert.deepEqual(computed('desktop'), ['true', 'false', 'desktop']);
  assert.deepEqual(computed('desktop', '4'), ['true', 'true', 'desktop-gtk4']);
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
  for (const frontend of ['react', 'vue', 'svelte', 'sveltekit', 'angular'])
    for (const [host, linuxGtk] of [
      ['cswebui', '3'],
      ['desktop', '3'],
      ['desktop', '4'],
    ])
      for (const viewModels of ['toolkit', 'reactiveui']) {
        const symbols = templateSymbols({
          frontend,
          packageManager: 'npm',
          host,
          linuxGtk,
          viewModels,
        });
        const desktop = host !== 'cswebui';
        const gtk4 = desktop && linuxGtk === '4';
        const files = Object.fromEntries(
          sources.map((path) => [path, renderTemplate(read(path), symbols)]),
        );
        for (const [path, content] of Object.entries(files))
          assert.doesNotMatch(
            content,
            /^\s*(#|<!--#)(if|elif|else|endif)\b/m,
            `${path} ${host} ${linuxGtk} ${viewModels}`,
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
          files['Program.cs'].includes('.WithGtk4(ApplicationIdentity.Id)'),
          gtk4,
        );
        assert.equal(
          files['RunicWindowApp.csproj'].includes('Runic.Desktop.Gtk4'),
          gtk4,
        );
        // Every host loads the host-neutral Views client.
        for (const index of [
          'frontends/react/index.html',
          'frontends/angular/src/index.html',
        ]) {
          assert.match(files[index], /<script src="runic-views\.js">/);
          assert.doesNotMatch(
            files[index],
            /runic-desktop-views\.js|runic-cswebui\.js/,
          );
        }
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
