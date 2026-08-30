import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { releaseAuthorityPin } from './release-authority-pin.mjs';

const check = process.argv.includes('--check');
const scriptDirectory = fileURLToPath(new URL('.', import.meta.url));
const siteRoot = resolve(scriptDirectory, '..');
const authorityPath = process.env.RUNIC_RELEASE_MANIFEST
  ? resolve(process.env.RUNIC_RELEASE_MANIFEST)
  : resolve(siteRoot, '..', '.github', 'runic.release.json');
const outputPath = resolve(siteRoot, 'src/lib/release-status.ts');
const authorityRoot = dirname(authorityPath);

if (!/^[a-f0-9]{40}$/.test(releaseAuthorityPin.revision)) {
  throw new Error('Release authority revision must be a 40-character SHA-1.');
}

function digest(source) {
  return createHash('sha256').update(source).digest('hex');
}

function assertPinnedFile(name, source) {
  const expected = releaseAuthorityPin.files[name].sha256;

  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error(`Pinned ${name} digest must be a SHA-256 value.`);
  }

  if (digest(source) !== expected) {
    throw new Error(
      `Pinned ${name} digest does not match ${releaseAuthorityPin.revision}.`,
    );
  }
}

let authorityRevision;

try {
  authorityRevision = execFileSync(
    'git',
    ['-C', authorityRoot, 'rev-parse', 'HEAD'],
    { encoding: 'utf8' },
  ).trim();
} catch {
  throw new Error(`Release authority is unavailable at ${authorityRoot}.`);
}

if (authorityRevision !== releaseAuthorityPin.revision) {
  throw new Error(
    `Release authority revision must be ${releaseAuthorityPin.revision}, received ${authorityRevision}.`,
  );
}

const source = await readFile(authorityPath);
assertPinnedFile('manifest', source);
const manifest = JSON.parse(source);
const schemaSource = await readFile(
  resolve(authorityRoot, releaseAuthorityPin.files.schema.path),
);
const verifierPath = resolve(
  authorityRoot,
  releaseAuthorityPin.files.verifier.path,
);
const verifierSource = await readFile(verifierPath);
assertPinnedFile('schema', schemaSource);
assertPinnedFile('verifier', verifierSource);
const schema = JSON.parse(schemaSource);
const { verify } = await import(verifierPath);
const verificationErrors = verify(manifest, schema);

if (verificationErrors.length) {
  throw new Error(
    `Release authority verification failed:\n${verificationErrors.join('\n')}`,
  );
}

const train = manifest.compatibilityTrains?.find(({ id }) => id === 'v1.0');

if (!train) {
  throw new Error(
    'Release authority does not define the v1.0 compatibility train.',
  );
}

const trainVersions = train.lanes.flatMap(({ versions }) => versions);
const distributions = manifest.distributions ?? [];
const entries = [...trainVersions, ...distributions];
const allUnassigned = entries.every(
  ({ version }) => version?.state === 'unassigned' && version.value === null,
);

if (!allUnassigned) {
  throw new Error(
    'Release status integration needs an explicit published-status mapping before v1.0 assignments can be advertised.',
  );
}

const output = `// Generated from ${releaseAuthorityPin.repository}@${releaseAuthorityPin.revision}. Do not edit manually.\n// Regenerate with: npm run release-status:sync\n\nexport const releaseStatus = {\n  authority: {\n    repository: '${releaseAuthorityPin.repository}',\n    revision: '${releaseAuthorityPin.revision}',\n    manifestDigest:\n      'sha256:${releaseAuthorityPin.files.manifest.sha256}',\n    schemaDigest:\n      'sha256:${releaseAuthorityPin.files.schema.sha256}',\n    verifierDigest:\n      'sha256:${releaseAuthorityPin.files.verifier.sha256}',\n  },\n  train: {\n    id: '${train.id}',\n    publication: 'unassigned',\n    assignedVersions: 0,\n    assignedDistributions: 0,\n  },\n} as const;\n`;

if (check) {
  const existing = await readFile(outputPath, 'utf8');

  if (existing !== output) {
    throw new Error(
      'Generated release status is stale. Run npm run release-status:sync after reviewing the authority change.',
    );
  }

  process.exit(0);
}

await writeFile(outputPath, output);
