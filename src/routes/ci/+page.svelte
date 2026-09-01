<script lang="ts">
  import { ciPolicy, ciPolicyDigest } from '$lib/ci-policy';

  const labels: Record<string, string> = {
    'independent-producers': 'Independent producers',
    'shared-services': 'Shared services',
    'application-core': 'Application core',
    'frontend-adapters': 'Frontend adapters',
    'integrated-validation': 'Integrated validation',
  };

  function repositoryLabel(repository: string) {
    return repository
      .replace(/^runic-/, '')
      .split('-')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }
</script>

<svelte:head>
  <title>CI control room · Runic Artifex</title>
  <meta
    name="description"
    content="The Runic Artifex CI dependency graph, package registry policy, and retention status."
  />
  <link rel="canonical" href="https://runic-artifex.eu/ci/" />
</svelte:head>

<section class="ci-hero shell">
  <div>
    <p class="eyebrow"><span></span> CI control room</p>
    <h1>One view of the whole train.</h1>
    <p>
      This read-only dashboard renders the same policy CI verifies. It exposes
      package order, toolchain pins, and retention safety without introducing a
      second source of truth.
    </p>
  </div>
  <dl class="ci-summary">
    <div>
      <dt>Package runner</dt>
      <dd>Bun {ciPolicy.toolchain.bun}</dd>
    </div>
    <div>
      <dt>Candidate registry</dt>
      <dd>GitHub Packages</dd>
    </div>
    <div>
      <dt>Automatic deletion</dt>
      <dd class="safe">Disabled</dd>
    </div>
  </dl>
</section>

<section class="shell ci-section" aria-labelledby="pipeline-heading">
  <div class="ci-section__heading">
    <div>
      <p class="eyebrow"><span></span> Dependency order</p>
      <h2 id="pipeline-heading">Materialize once. Validate downstream.</h2>
    </div>
    <p>
      A dependent waits for an exact upstream coordinate. It never falls back to
      rebuilding another repository from source.
    </p>
  </div>

  <ol class="pipeline">
    {#each ciPolicy.stages as stage, index (stage.id)}
      <li>
        <div class="stage-index">{String(index + 1).padStart(2, '0')}</div>
        <article>
          <div class="stage-heading">
            <div>
              <span class:validate={stage.kind === 'validate'}
                >{stage.kind}</span
              >
              <h3>{labels[stage.id] ?? stage.id}</h3>
            </div>
            {#if stage.after.length}
              <small
                >after {stage.after
                  .map((id) => labels[id] ?? id)
                  .join(', ')}</small
              >
            {:else}
              <small>starts independently</small>
            {/if}
          </div>
          <ul>
            {#each stage.repositories as repository (repository)}
              <li>
                <a href={'https://github.com/Runic-Artifex/' + repository}>
                  {repositoryLabel(repository)}
                  <span aria-hidden="true">↗</span>
                </a>
              </li>
            {/each}
          </ul>
        </article>
      </li>
    {/each}
  </ol>
</section>

<section class="shell ci-section policy-grid" aria-labelledby="policy-heading">
  <div class="ci-section__heading">
    <div>
      <p class="eyebrow"><span></span> Guardrails</p>
      <h2 id="policy-heading">Registry policy at a glance.</h2>
    </div>
  </div>
  <article>
    <span class="metric">{ciPolicy.retention.minimumAgeDays}d</span>
    <h3>Minimum lifetime</h3>
    <p>Fresh candidates cannot enter the expiration window.</p>
  </article>
  <article>
    <span class="metric">{ciPolicy.retention.keepSuccessfulPerPackage}</span>
    <h3>Recent successes kept</h3>
    <p>The newest verified candidates remain available per package.</p>
  </article>
  <article>
    <span class="metric">{ciPolicy.retention.expirationGraceDays}d</span>
    <h3>Expiration grace</h3>
    <p>Unreachable candidates are reported before they become deletable.</p>
  </article>
  <article>
    <span class="metric mono">{ciPolicy.registry.candidateMarker}</span>
    <h3>Cleanup boundary</h3>
    <p>Only reserved CI versions can ever be selected by cleanup.</p>
  </article>
</section>

<section class="shell ci-section telemetry" aria-labelledby="telemetry-heading">
  <div>
    <p class="eyebrow"><span></span> Run telemetry</p>
    <h2 id="telemetry-heading">Live run ingestion is not connected yet.</h2>
    <p>
      The policy view is deployable now. Run timing, cache-hit, queue, failure,
      and registry-retention events need a credentialed server-side collector;
      browser tokens will not be used.
    </p>
  </div>
  <a href="https://github.com/Runic-Artifex/.github/actions">
    Open organization workflows <span aria-hidden="true">↗</span>
  </a>
</section>

<p class="shell authority">
  Authority: <a
    href="https://github.com/Runic-Artifex/.github/blob/main/runic.ci.json"
    >runic.ci.json</a
  >
  · <code>{ciPolicyDigest}</code>
</p>

<style>
  .ci-hero {
    display: grid;
    align-items: end;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    gap: clamp(3rem, 8vw, 8rem);
    padding-block: clamp(5rem, 10vw, 9rem) clamp(4rem, 8vw, 7rem);
  }

  .ci-hero h1 {
    max-width: 12ch;
    margin-bottom: 1.4rem;
    font-family: 'Cormorant', serif;
    font-size: clamp(3.4rem, 7vw, 6.8rem);
    font-weight: 500;
    line-height: 0.92;
    letter-spacing: -0.045em;
  }

  .ci-hero > div > p:last-child,
  .ci-section__heading > p,
  .telemetry p {
    max-width: 62ch;
    color: var(--parchment-muted);
    line-height: 1.7;
  }

  .ci-summary {
    margin: 0;
    border-top: 1px solid var(--line-strong);
  }

  .ci-summary div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 2rem;
    padding-block: 1rem;
    border-bottom: 1px solid var(--line);
  }

  .ci-summary dt {
    color: var(--parchment-muted);
    font-size: 0.76rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .ci-summary dd {
    margin: 0;
    font-weight: 600;
  }

  .ci-summary .safe {
    color: #a7c99b;
  }

  .ci-section {
    padding-block: clamp(3.5rem, 7vw, 6rem);
    border-top: 1px solid var(--line);
  }

  .ci-section__heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 3rem;
    margin-bottom: 2.5rem;
  }

  .ci-section h2 {
    max-width: 17ch;
    margin-bottom: 0;
    font-family: 'Cormorant', serif;
    font-size: clamp(2.4rem, 4.5vw, 4rem);
    font-weight: 500;
    line-height: 1;
  }

  .pipeline {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .pipeline > li {
    display: grid;
    grid-template-columns: 4.5rem 1fr;
  }

  .stage-index {
    padding-top: 1.75rem;
    border-right: 1px solid var(--line-strong);
    color: var(--gold-dim);
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
  }

  .pipeline article {
    position: relative;
    padding: 1.5rem 0 2rem 2.25rem;
    border-bottom: 1px solid var(--line);
  }

  .pipeline article::before {
    position: absolute;
    top: 1.95rem;
    left: -0.35rem;
    width: 0.65rem;
    height: 0.65rem;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--gold);
    box-shadow: 0 0 0 1px var(--gold);
    content: '';
  }

  .stage-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 2rem;
  }

  .stage-heading > div > span {
    display: inline-block;
    margin-bottom: 0.45rem;
    padding: 0.25rem 0.48rem;
    border: 1px solid var(--line-strong);
    color: var(--gold);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .stage-heading > div > span.validate {
    color: #d39374;
  }

  .stage-heading h3 {
    margin-bottom: 0;
    font-family: 'Cormorant', serif;
    font-size: 1.65rem;
    font-weight: 600;
  }

  .stage-heading small {
    color: var(--parchment-muted);
    font-size: 0.72rem;
  }

  .pipeline article ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin: 1.2rem 0 0;
    padding: 0;
    list-style: none;
  }

  .pipeline article a {
    display: inline-flex;
    gap: 0.6rem;
    padding: 0.55rem 0.72rem;
    border: 1px solid var(--line);
    color: var(--parchment-muted);
    font-size: 0.8rem;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .pipeline article a:hover {
    border-color: var(--gold);
    color: var(--parchment);
  }

  .policy-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .policy-grid .ci-section__heading {
    grid-column: 1 / -1;
  }

  .policy-grid article {
    min-height: 15rem;
    padding: 1.4rem;
    border: 1px solid var(--line);
    background: rgb(13 23 17 / 64%);
  }

  .metric {
    display: block;
    margin-bottom: 2.5rem;
    color: var(--gold);
    font-family: 'Cormorant', serif;
    font-size: 3rem;
    line-height: 1;
  }

  .metric.mono {
    font-family: ui-monospace, monospace;
    font-size: 1rem;
  }

  .policy-grid h3 {
    margin-bottom: 0.6rem;
    font-size: 0.95rem;
  }

  .policy-grid p {
    color: var(--parchment-muted);
    font-size: 0.82rem;
    line-height: 1.6;
  }

  .telemetry {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 3rem;
  }

  .telemetry a {
    min-width: max-content;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--gold);
    color: var(--gold);
    font-size: 0.82rem;
  }

  .authority {
    margin-bottom: 4rem;
    color: var(--parchment-muted);
    font-size: 0.68rem;
  }

  .authority a {
    color: var(--parchment);
  }

  .authority code {
    word-break: break-all;
  }

  @media (max-width: 900px) {
    .ci-hero {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .policy-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 650px) {
    .ci-section__heading,
    .stage-heading,
    .telemetry {
      align-items: flex-start;
      flex-direction: column;
      gap: 1rem;
    }

    .pipeline > li {
      grid-template-columns: 2.4rem 1fr;
    }

    .pipeline article {
      padding-left: 1.4rem;
    }

    .policy-grid {
      grid-template-columns: 1fr;
    }

    .policy-grid article {
      min-height: auto;
    }
  }
</style>
