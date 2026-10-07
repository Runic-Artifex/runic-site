// Maps guide source files to site paths. Dependency-free, so client pages can
// link guides without bundling the Markdown renderer.

/** Where guide sources and other docs files live on GitHub. */
export const docsSourceUrl =
  'https://github.com/Runic-Artifex/runic-site/blob/main/docs/';
const githubGuidesPattern =
  /^https:\/\/github\.com\/Runic-Artifex\/runic-site\/(?:blob|tree)\/main\/docs\/guides\/([^?#]*)(#.*)?$/;

/** Maps `a/README.md` to `a` and `a/b.md` to `a/b`. */
export function guidePath(file: string): string {
  if (!file.endsWith('.md')) throw new Error(`${file} is not a Markdown guide`);
  if (file === 'README.md') return '';
  return file.endsWith('/README.md')
    ? file.slice(0, -'/README.md'.length)
    : file.slice(0, -'.md'.length);
}

export function guideHref(file: string): string {
  const path = guidePath(file);
  return path ? `/guides/${path}/` : '/guides/';
}

/**
 * Maps a GitHub URL of a portal guide source to its site path, keeping the
 * fragment. Returns null for other URLs. Guide anchors match GitHub's, so a
 * link into a section keeps working after the move.
 */
export function siteHrefForGitHubGuide(url: string): string | null {
  const guide = githubGuide(url);
  return guide ? `${guideHref(guide.file)}${guide.hash}` : null;
}

export function githubGuide(url: string) {
  const match = githubGuidesPattern.exec(url);
  if (!match) return null;
  const [, rest, hash = ''] = match;
  const file =
    rest === '' || rest.endsWith('/')
      ? `${rest}README.md`
      : rest.endsWith('.md')
        ? rest
        : `${rest}/README.md`;
  return { file, hash };
}
