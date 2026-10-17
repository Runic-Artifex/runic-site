<script lang="ts">
  import { resolve } from '$app/paths';
  import DocSection from '#lib/components/DocSection.svelte';
  import {
    hostName,
    operatingSystemNames,
    requirementLabel,
    supportFor,
    supportMatrix,
    supportRids,
    supportStatuses,
    supportStatusLabels,
  } from '#lib/support-matrix.js';

  const description =
    'Which runtime identifiers each Runic Window host supports, which ones Runic CI verifies, and what target machines need.';
  const notes = supportMatrix.hosts.flatMap((host) =>
    host.targets
      .filter((target) => target.status !== 'ci-verified')
      .map((target) => ({ host: host.name, ...target })),
  );
</script>

<svelte:head>
  <title>Supported platforms · Runic Artifex</title>
  <meta name="description" content={description} />
  <meta property="og:title" content="Supported platforms · Runic Artifex" />
  <meta property="og:description" content={description} />
  <meta name="twitter:title" content="Supported platforms · Runic Artifex" />
  <meta name="twitter:description" content={description} />
</svelte:head>
<div class="shell">
  <div class="page-head">
    <h1>Supported platforms</h1>
    <p class="lede">
      Support for each Window host and runtime identifier (RID). Runtime
      identifiers that are not listed are unsupported. Run
      <code>dotnet runic doctor --rid &lt;rid&gt;</code> to check a project
      against the same data. What Runic promises from 1.0 is in the
      <a href={resolve('/support/policy')}>versioning and support policy</a>.
    </p>
  </div>
  <div class="doc-sections doc-sections--wide">
    <DocSection title="Hosts and runtime identifiers">
      <!-- The scrollable table region must be reachable by keyboard. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-scroll support-matrix"
        tabindex="0"
        role="region"
        aria-label="Support by host and runtime identifier"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">RID</th>
              {#each supportMatrix.hosts as host (host.id)}
                <th scope="col">{host.name}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each supportRids as rid (rid)}
              <tr>
                <th scope="row"><code>{rid}</code></th>
                {#each supportMatrix.hosts as host (host.id)}
                  {@const entry = supportFor(host, rid)}
                  <td data-status={entry.status} title={entry.reason}
                    >{supportStatusLabels[entry.status]}</td
                  >
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <dl class="support-statuses">
        {#each supportStatuses as status (status)}
          <dt>{supportStatusLabels[status]}</dt>
          <dd>{supportMatrix.statuses[status]}</dd>
        {/each}
      </dl>
    </DocSection>
    <DocSection title="Platform requirements">
      <!-- The scrollable table region must be reachable by keyboard. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="Platform requirements"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">OS</th>
              <th scope="col">Host</th>
              <th scope="col">Requirement</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {#each supportMatrix.requirements as requirement (requirement.id)}
              <tr>
                <td>{operatingSystemNames[requirement.os]}</td>
                <td>{requirement.hosts.map(hostName).join(', ')}</td>
                <td>{requirementLabel(requirement)}</td>
                <td>{requirement.note}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </DocSection>
    <DocSection title="Targets that CI does not verify">
      <ul class="support-notes">
        {#each notes as note (`${note.host}-${note.rid}`)}
          <li>
            <strong>{note.host}, <code>{note.rid}</code></strong>
            ({supportStatusLabels[note.status]}): {note.reason}
            {#if note.remediation}{note.remediation}{/if}
          </li>
        {/each}
      </ul>
      <p>
        Choose a host with the <a
          href={resolve('/guides/[...path]', {
            path: 'desktop/host-selection',
          })}>host selection guide</a
        >. The matrix comes from
        <a
          href="https://github.com/Runic-Artifex/runic-sdk/blob/main/eng/support.json"
          rel="external">eng/support.json</a
        >
        in the SDK, which also generates the SDK README table and the data that
        <code>dotnet runic doctor</code> reads.
      </p>
    </DocSection>
  </div>
</div>

<style>
  .support-matrix td[data-status='ci-verified'] {
    font-weight: 600;
  }

  .support-matrix td[data-status='unsupported'] {
    color: var(--rune-ink-soft);
  }

  .support-statuses {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.4rem 1.25rem;
    margin: 1.5rem 0 0;
    font-size: var(--text-ui);
  }

  .support-statuses dt {
    font-weight: 600;
  }

  .support-statuses dd {
    margin: 0;
    color: var(--rune-ink-soft);
  }

  @media (max-width: 40rem) {
    .support-statuses {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.15rem;
    }

    .support-statuses dd + dt {
      margin-top: 0.6rem;
    }
  }

  .support-notes li + li {
    margin-top: 0.6em;
  }
</style>
