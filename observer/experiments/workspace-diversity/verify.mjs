import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { comparePolicies } from '../../../cognition/workspace/policies.mjs';

const fixture = JSON.parse(readFileSync('experiments/v0-fixture.json', 'utf8'));
const result = comparePolicies(fixture, 0.25);

assert.equal(result.candidates.length, 7, 'candidate count changed unexpectedly');
assert.deepEqual(result.raw.metrics.roots, ['obs-user', 'obs-user'], 'raw top-k baseline should preserve v0 duplicate-root saturation');
assert.deepEqual(result.diverse.metrics.roots, ['obs-user', 'obs-runtime'], 'hard source diversity should represent two distinct root observations');
assert.deepEqual(result.soft.metrics.roots, ['obs-user', 'obs-runtime'], 'soft penalty 0.25 should prefer the runtime observation over a repeated user root');
assert.equal(result.raw.metrics.distinctRootObservations, 1);
assert.equal(result.diverse.metrics.distinctRootObservations, 2);
assert.equal(result.soft.metrics.distinctRootObservations, 2);
assert.ok(result.raw.metrics.totalRawSalience > result.diverse.metrics.totalRawSalience, 'diversity should expose the expected salience tradeoff in this fixture');
assert.equal(new Set(result.candidates.map(x => x.id)).size, result.candidates.length, 'candidate IDs must be unique');

const repeat = comparePolicies(fixture, 0.25);
assert.deepEqual(result, repeat, 'policy comparison must be exactly deterministic');

console.log(JSON.stringify({ raw: result.raw.metrics, diverse: result.diverse.metrics, soft: result.soft.metrics }, null, 2));
console.log('ConsciOS workspace-policy verification passed.');
