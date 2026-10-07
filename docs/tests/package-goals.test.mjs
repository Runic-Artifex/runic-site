import assert from 'node:assert/strict';
import test from 'node:test';

import activeSdkRelease from '../src/lib/active-sdk-release.json' with { type: 'json' };
import { packageGoals } from '../src/lib/package-goals.ts';
import { createReleaseDocs } from '../src/lib/release-docs-core.ts';

test('every goal composes published catalog packages and links a guide', () => {
  const catalog = new Set(
    createReleaseDocs(activeSdkRelease).catalogRows.map((row) => row.name),
  );
  assert.equal(
    new Set(packageGoals.map((goal) => goal.id)).size,
    packageGoals.length,
  );
  for (const goal of packageGoals) {
    assert.ok(goal.packages.length > 0, goal.id);
    for (const { name } of goal.packages)
      assert.ok(catalog.has(name), `${goal.id}: ${name} is not in the catalog`);
    if ('href' in goal.guide) {
      // Guides are portal pages; tests/link-check.test.mjs resolves them.
      assert.match(goal.guide.href, /^\/guides\/[^#]+\/(#.+)?$/, goal.id);
    }
  }
  const covered = new Set(packageGoals.map((goal) => goal.id));
  for (const id of ['new-app', 'existing-app', 'assets', 'desktop', 'test'])
    assert.ok(covered.has(id), id);
});
