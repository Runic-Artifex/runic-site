import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const check = process.argv.includes('--check');
const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const policyPath = process.env.RUNIC_CI_POLICY
  ? resolve(process.env.RUNIC_CI_POLICY)
  : resolve(siteRoot, '..', '.github', 'runic.ci.json');
const outputPath = resolve(siteRoot, 'src/lib/ci-policy.ts');
const policySource = await readFile(policyPath);
const policy = JSON.parse(policySource);
const verifierPath = resolve(dirname(policyPath), 'eng/verify-ci-policy.mjs');
const { readAndVerifyCiPolicy } = await import(verifierPath);

readAndVerifyCiPolicy(policyPath);

const digest = createHash('sha256').update(policySource).digest('hex');
const output = `// Generated from Runic-Artifex/.github/runic.ci.json. Do not edit manually.
// Regenerate with: bun run ci-policy:sync

export const ciPolicyDigest = 'sha256:${digest}';

export const ciPolicy = ${JSON.stringify(policy, null, 2)} as const;
`;

if (check) {
  const existing = await readFile(outputPath, 'utf8');
  if (existing !== output) {
    throw new Error(
      'Generated CI policy is stale. Run bun run ci-policy:sync after reviewing the authority change.',
    );
  }
  process.exit(0);
}

await writeFile(outputPath, output);
