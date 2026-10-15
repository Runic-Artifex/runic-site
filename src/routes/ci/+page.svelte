<svelte:head>
  <title>Build status: Runic Artifex</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="status page">
  <h1>Build status</h1>
  <p>
    Checks and workflow results for the Runic SDK are on GitHub, next to the
    code they verify.
  </p>
  <a
    rel="external"
    class="action action--primary"
    href="https://github.com/Runic-Artifex/runic-sdk/actions"
    >Open the SDK workflow results</a
  >
</section>

<style>
  .status {
    display: grid;
    justify-items: start;
    gap: 1.25rem;
    padding-block: clamp(3rem, 10vw, 7rem) 2rem;
  }

  p {
    max-width: 34rem;
    font-size: var(--text-lede);
    color: var(--rune-ink-soft);
  }
</style>
