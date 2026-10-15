<script lang="ts">
  import DocSection from '#lib/components/DocSection.svelte';
</script>

<svelte:head>
  <title>Architecture · Runic Artifex</title>
  <meta
    name="description"
    content="How Runic products stay useful on their own while official integrations let you connect only the pieces your project needs."
  />
  <meta property="og:title" content="Architecture · Runic Artifex" />
  <meta
    property="og:description"
    content="How Runic products stay useful on their own while official integrations let you connect only the pieces your project needs."
  />
  <meta name="twitter:title" content="Architecture · Runic Artifex" />
  <meta
    name="twitter:description"
    content="How Runic products stay useful on their own while official integrations let you connect only the pieces your project needs."
  />
</svelte:head>

<div class="shell">
  <div class="page-head">
    <h1>Use products independently. Connect them deliberately.</h1>
    <p class="lede">
      Each Runic tool works on its own. Integrations connect products, external
      frameworks, or tooling without making a core depend back on them. Those
      integrations stay in separate packages. The SDK package set releases
      together; independently owned products release on their own schedules.
    </p>
  </div>
  <div class="doc-sections">
    <DocSection title="Add an integration without adopting a stack">
      <p>
        Choose one product first. When two products need to meet, add the
        integration that owns that behavior; neither core changes direction.
      </p>
    </DocSection>
    <DocSection title="Windows and Views keep rendering in the frontend">
      <p>
        Runic Application defines explicit .NET Window and View contracts and
        generates ordinary TypeScript clients. Svelte, React, Vue and Angular
        render those contracts with their own components; the application model
        does not own a framework's visual tree.
      </p>
    </DocSection>
    <DocSection title="Cores stay portable">
      <p>
        Runic Assets owns no host. Runic Translations begins with .NET but
        defines language-neutral contracts.
      </p>
    </DocSection>
    <DocSection title="One coordinated SDK package set">
      <p>
        The runic-sdk repository supplies SDK libraries, tools and templates
        through NuGet and npm. Command Line and Translations, including
        Translations Editor, have their own repositories and release lifecycles.
        CS-WebUI remains an independent upstream compatibility product; the SDK
        includes its CS-WebUI integration, Runic.Application.Views.CsWebUi.
      </p>
    </DocSection>
    <DocSection title="Behavior stays with the product that defines it">
      <p>
        <code>Runic.Assets</code> owns asset behavior within the SDK monorepo. Package
        boundaries preserve that ownership when a product connects to an external
        framework or development tool.
      </p>
    </DocSection>
    <DocSection title="The editor uses the translation system">
      <p>
        Runic Translations owns schemas, compiler behavior, runtime contracts,
        generators, and authoring APIs. Runic Translations Editor uses its
        packages and APIs as a downstream desktop application and owns
        translator UX. It is released with the Translations project, outside the
        SDK package catalog.
      </p>
    </DocSection>
    <DocSection title="Pin the exact versions">
      <p>
        Pin exact preview versions within each product family. Rebuild generated
        Window and View clients and retest after SDK upgrades. Compatibility is
        verified in consuming applications, frontend builds, and, where
        applicable, NativeAOT runs.
      </p>
    </DocSection>
    <DocSection title="Define the schema before choosing the renderer">
      <p>
        Explicit partial Window and View types are the contract authority. The
        build inspects the compiled application after MVVM generators run and
        emits C# attachments and ordinary TypeScript modules. UI frameworks own
        rendering while .NET scopes ViewModels, logical Views, commands, and
        operations.
      </p>
    </DocSection>
  </div>
</div>
