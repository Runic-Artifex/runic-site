<script lang="ts">
  import { resolve } from '$app/paths';
  import CommandBlock from '#lib/components/CommandBlock.svelte';
  import ContentCard from '#lib/components/ContentCard.svelte';
  import { creatorCommands, defaultSelection } from '#lib/creator.js';
  import { currentRelease } from '#lib/release-docs.js';

  const commands = creatorCommands(
    currentRelease.version,
    'MyApp',
    defaultSelection(),
  );
</script>

<svelte:head>
  <title>Getting started · Runic Artifex</title>
  <meta
    name="description"
    content="Create a desktop app with C# application logic and your choice of web frontend."
  />
  <meta property="og:title" content="Getting started · Runic Artifex" />
  <meta
    property="og:description"
    content="Create a desktop app with C# application logic and your choice of web frontend."
  />
  <meta name="twitter:title" content="Getting started · Runic Artifex" />
  <meta
    name="twitter:description"
    content="Create a desktop app with C# application logic and your choice of web frontend."
  />
</svelte:head>

<div>
  <section class="page-hero shell">
    <p class="eyebrow">Getting started</p>
    <h1>Build your first Runic app.</h1>
    <p class="lede">
      Use C# for application logic and React, Vue, Svelte or Angular for the
      frontend. One command creates a project that connects them and opens your
      app.
    </p>
  </section>
  <section class="content-grid shell">
    <ContentCard
      eyebrow="Before you start"
      title="Install the prerequisites"
      full
    >
      <p>
        You need the <a href="https://dotnet.microsoft.com/download/dotnet/10.0"
          >.NET 10 SDK</a
        >
        and a JavaScript package manager: Node.js 24 with npm or pnpm, or Bun 1.4.
        The creator asks which one to use.
      </p>
      <p>
        The default Runic Desktop host opens your app in a native window with
        the platform WebView: the Edge WebView2 Runtime on Windows, WKWebView on
        macOS, or GTK 3 with WebKitGTK 4.1 on Linux. The CS-WebUI host opens a
        browser window instead, in an installed browser in app mode, on a
        best-effort basis. Run
        <code>dotnet runic doctor</code> in the generated project to check your setup.
      </p>
    </ContentCard>
    <ContentCard
      eyebrow={`SDK ${currentRelease.version}`}
      title="Create and run"
      full
    >
      <CommandBlock command={commands.interactive} />
      <p>
        The creator asks for a project name, frontend, package manager, Window
        host, and ViewModel library, then creates the project and prints the
        next steps. <code>dnx</code> ships with the .NET 10 SDK and runs the creator
        without installing it. Then start the app:
      </p>
      <CommandBlock command={commands.nextSteps.join('\n')} />
      <p>
        <code>dotnet tool restore</code> installs the project's
        <code>dotnet runic</code>
        tool. <code>dotnet runic dev</code>
        restores the .NET and frontend packages, builds the app, starts the frontend
        development server and opens the app. Frontend edits reload in place; C# edits
        rebuild and restart the app. Plain <code>dotnet build</code> and
        <code>dotnet run</code> work too: the first build installs the frontend packages
        and builds the production frontend.
      </p>
      <p>
        Prefer to choose in the browser? <a
          class="text-link"
          href={resolve('/create')}>Put your app together</a
        >
        and copy one command. The creator runs the
        <code>runic-app</code> template, which you can also use directly:
      </p>
      <CommandBlock command={`${commands.install}\n${commands.create}`} />
    </ContentCard>
    <ContentCard eyebrow="Make it yours" title="Change the counter" full>
      <p>
        The generated app contains C# ViewModels, a Window and Views that select
        them, and a frontend in <code>Frontend</code>. The build generates a
        typed client for each ViewModel in <code>Frontend/src/generated</code>;
        it is regenerated on every build and not committed. Change a page, then
        follow its client calls into the ViewModel. The frontend owns rendering;
        .NET owns the application model and operation lifetime.
      </p>
      <p>
        Follow <a
          class="text-link"
          href={resolve('/guides/[...path]', { path: 'application/tutorial' })}
          >Windows and Views, step by step</a
        >
        through the generated project and its tests,
        <a class="text-link" href={resolve('/views')}
          >learn about Windows and Views</a
        >, or explore the
        <a
          class="text-link"
          href="https://github.com/Runic-Artifex/runic-sdk/tree/main/examples/notes-view-first"
          >CommunityToolkit Notes example</a
        > for nested content, editing, and navigation.
      </p>
    </ContentCard>
    <ContentCard eyebrow="Share your app" title="Publish for your platform">
      <pre><code>dotnet publish -c Release -r linux-x64</code></pre>
      <p>
        Use <code>win-x64</code>, <code>osx-arm64</code> or another runtime
        identifier for other platforms; the
        <a class="text-link" href={resolve('/support')}>supported platforms</a>
        page lists them per host. The publish folder contains the executable and a
        <code>www</code> folder with the built frontend; distribute the whole folder.
        Users need no JavaScript runtime or package manager, only a browser or the
        platform WebView.
      </p>
    </ContentCard>
    <ContentCard eyebrow="Your choices" title="Choose a host and MVVM library">
      <p>
        The creator asks for the host and the ViewModel library. Runic Desktop
        is the default and first-class host: native windows, embedded WebViews,
        file dialogs and other platform services (<code
          >--host desktop-gtk4</code
        >
        uses GTK 4 on Linux). CS-WebUI opens a browser window and is supported on
        a best-effort basis. ReactiveUI is the default ViewModel library; CommunityToolkit.Mvvm
        is supported too.
        <a
          class="text-link"
          href={resolve('/guides/[...path]', {
            path: 'application/choosing',
          })}>Choosing a host and MVVM library</a
        >
        compares them. To distribute a Desktop app, follow
        <a
          class="text-link"
          href={resolve('/guides/[...path]', {
            path: 'desktop/shipping',
          })}>ship a Desktop application</a
        >.
      </p>
    </ContentCard>
    <ContentCard eyebrow="Existing project" title="Add one capability">
      <p>
        You can adopt Application Views, Desktop, or Assets separately. The <a
          class="text-link"
          href={resolve('/packages')}>package catalog</a
        > lists the packages for each goal. Command Line and Translations have their
        own installation guidance.
      </p>
      <p>
        <a
          class="text-link"
          href={resolve('/guides/[...path]', {
            path: 'application/existing-app',
          })}>Add Runic to an existing app</a
        >
        or
        <a
          class="text-link"
          href={resolve('/guides/[...path]', { path: 'assets' })}
          >embed and serve a frontend with Runic Assets</a
        >.
      </p>
      <p>
        Application Views uses explicit Window and View types. Its build tooling
        emits the C# attachments and TypeScript client modules for those
        contracts.
      </p>
    </ContentCard>
    <ContentCard eyebrow="Next steps" title="Keep building">
      <p>
        Read the <a class="text-link" href={currentRelease.url} rel="external"
          >release notes</a
        >
        when upgrading preview versions. Keep Runic packages on the same version.
        For SDK contributions, use the
        <a
          class="text-link"
          href="https://github.com/Runic-Artifex/runic-sdk/blob/main/CONTRIBUTING.md"
          >contributor guide</a
        >.
      </p>
    </ContentCard>
  </section>
</div>
