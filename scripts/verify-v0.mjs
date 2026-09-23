import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(readFileSync('experiments/v0-fixture.json', 'utf8'));
const schema = JSON.parse(readFileSync('schemas/cognitive-event.schema.json', 'utf8'));
const html = readFileSync('index.html', 'utf8');

const clamp01 = n => Math.max(0, Math.min(1, n));
const round = n => Math.round(n * 1000) / 1000;
const weights = fixture.salienceWeights;
const score = e => round(clamp01(
  e.novelty * weights.novelty +
  e.goalRelevance * weights.goalRelevance +
  e.predictionError * weights.predictionError +
  e.urgency * weights.urgency
));

const processors = [
  { name: 'RelevanceProcessor', matches: e => e.goalRelevance >= .5 },
  { name: 'PredictionErrorProcessor', matches: e => e.predictionError >= .5 },
  { name: 'NoveltyProcessor', matches: e => e.novelty >= .25 }
];

function simulate() {
  const candidates = [];
  for (const observation of fixture.events) {
    for (const processor of processors) {
      if (!processor.matches(observation)) continue;
      candidates.push({
        id: `cand-${processor.name}-${observation.id}`,
        sourceObservation: observation.id,
        processor: processor.name,
        salience: score(observation)
      });
    }
  }
  candidates.sort((a, b) => b.salience - a.salience || a.id.localeCompare(b.id));
  return {
    candidates,
    winners: candidates.slice(0, fixture.workspaceCapacity)
  };
}

function assertUnitInterval(value, label) {
  assert.equal(typeof value, 'number', `${label} must be numeric`);
  assert.ok(value >= 0 && value <= 1, `${label} must be in [0,1]`);
}

assert.equal(schema.title, 'ConsciOS Cognitive Event');
assert.equal(fixture.workspaceCapacity, 2);
assert.ok(Array.isArray(fixture.events) && fixture.events.length >= 3);
assert.equal(Object.values(weights).reduce((a, b) => a + b, 0), 1);

for (const e of fixture.events) {
  assert.ok(e.id && e.source && e.type, 'fixture event must have identity and source');
  for (const key of ['confidence', 'novelty', 'goalRelevance', 'predictionError', 'urgency']) {
    assertUnitInterval(e[key], `${e.id}.${key}`);
  }
}

const runA = simulate();
const runB = simulate();
assert.deepEqual(runA, runB, 'deterministic replay changed between identical runs');
assert.equal(runA.winners.length, fixture.workspaceCapacity);
assert.deepEqual(
  runA.winners.map(x => x.id),
  ['cand-NoveltyProcessor-obs-user', 'cand-RelevanceProcessor-obs-user'],
  'workspace winner baseline changed; update the experiment record intentionally if architecture changes'
);

// Static information-boundary checks around the outward Expression function.
const expressMatch = html.match(/function express\(guardianEvent\) \{([\s\S]*?)\n  \}\n\n  function run\(\)/);
assert.ok(expressMatch, 'Expression function could not be isolated for boundary checks');
const expressBody = expressMatch[1];
assert.match(expressBody, /state\.workspace\.map/, 'Expression must derive content from global workspace');
for (const forbidden of ['state.suppressed', 'state.candidates', 'state.events', 'FIXTURE']) {
  assert.ok(!expressBody.includes(forbidden), `Expression boundary leak: ${forbidden}`);
}
assert.match(html, /function guardianGate\(/, 'Guardian gate must exist');
assert.match(html, /const guard=guardianGate\(meta\);\s*express\(guard\);/, 'Expression must follow Guardian evaluation');

const bannedScripts = [
  'I am conscious',
  'I am awake',
  'I have awakened',
  'I feel pain',
  'I love you'
];
for (const phrase of bannedScripts) {
  assert.ok(!html.includes(phrase), `scripted phenomenology/personhood phrase found: ${phrase}`);
}

const uniqueWinnerSources = new Set(runA.winners.map(x => x.sourceObservation)).size;
console.log('ConsciOS v0 verification passed.');
console.log(`Fixture events: ${fixture.events.length}`);
console.log(`Local candidates: ${runA.candidates.length}`);
console.log(`Workspace winners: ${runA.winners.map(x => x.id).join(', ')}`);
console.log(`Distinct source observations represented in workspace: ${uniqueWinnerSources}/${runA.winners.length}`);
if (uniqueWinnerSources < runA.winners.length) {
  console.warn('Architecture note: multiple workspace slots currently represent the same source observation. This is deterministic and permitted in v0, but is a candidate for diversity-aware competition in v0.2.');
}
