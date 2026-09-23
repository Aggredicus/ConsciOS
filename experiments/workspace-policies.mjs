export const defaultProcessors = Object.freeze([
  { name: 'RelevanceProcessor', matches: e => e.goalRelevance >= 0.5 },
  { name: 'PredictionErrorProcessor', matches: e => e.predictionError >= 0.5 },
  { name: 'NoveltyProcessor', matches: e => e.novelty >= 0.25 }
]);

export function salience(event, weights) {
  const raw =
    event.novelty * weights.novelty +
    event.goalRelevance * weights.goalRelevance +
    event.predictionError * weights.predictionError +
    event.urgency * weights.urgency;
  return Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 1000;
}

export function buildCandidates(events, weights, processors = defaultProcessors) {
  const candidates = [];
  for (const observation of events) {
    for (const processor of processors) {
      if (!processor.matches(observation)) continue;
      candidates.push({
        id: `cand-${processor.name}-${observation.id}`,
        processor: processor.name,
        rootObservationId: observation.id,
        salience: salience(observation, weights)
      });
    }
  }
  return candidates.sort((a, b) => b.salience - a.salience || a.id.localeCompare(b.id));
}

function assertCapacity(capacity) {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('capacity must be a positive integer');
}

export function rawTopK(candidates, capacity) {
  assertCapacity(capacity);
  return candidates.slice(0, capacity).map(candidate => ({ ...candidate, adjustedSalience: candidate.salience, policyReason: 'top-k' }));
}

export function sourceDiverseTopK(candidates, capacity) {
  assertCapacity(capacity);
  const selected = [];
  const seenRoots = new Set();
  const deferred = [];
  for (const candidate of candidates) {
    if (seenRoots.has(candidate.rootObservationId)) deferred.push(candidate);
    else {
      selected.push({ ...candidate, adjustedSalience: candidate.salience, policyReason: 'new-root' });
      seenRoots.add(candidate.rootObservationId);
    }
    if (selected.length === capacity) return selected;
  }
  for (const candidate of deferred) {
    selected.push({ ...candidate, adjustedSalience: candidate.salience, policyReason: 'capacity-fill-repeat-root' });
    if (selected.length === capacity) break;
  }
  return selected;
}

export function softDiversityTopK(candidates, capacity, redundancyPenalty = 0.25) {
  assertCapacity(capacity);
  if (redundancyPenalty < 0 || redundancyPenalty > 1) throw new Error('redundancyPenalty must be in [0,1]');
  const remaining = candidates.map(x => ({ ...x }));
  const selected = [];
  const counts = new Map();
  while (remaining.length && selected.length < capacity) {
    const ranked = remaining
      .map(candidate => {
        const repeats = counts.get(candidate.rootObservationId) ?? 0;
        const adjustedSalience = Math.round(Math.max(0, candidate.salience - repeats * redundancyPenalty) * 1000) / 1000;
        return { ...candidate, adjustedSalience, repeats };
      })
      .sort((a, b) => b.adjustedSalience - a.adjustedSalience || b.salience - a.salience || a.id.localeCompare(b.id));
    const winner = ranked[0];
    selected.push({ ...winner, policyReason: winner.repeats ? `redundancy-penalty-${redundancyPenalty}` : 'first-root-representation' });
    counts.set(winner.rootObservationId, winner.repeats + 1);
    const index = remaining.findIndex(x => x.id === winner.id);
    remaining.splice(index, 1);
  }
  return selected;
}

export function policyMetrics(winners) {
  return {
    winnerCount: winners.length,
    distinctRootObservations: new Set(winners.map(x => x.rootObservationId)).size,
    totalRawSalience: Math.round(winners.reduce((sum, x) => sum + x.salience, 0) * 1000) / 1000,
    totalAdjustedSalience: Math.round(winners.reduce((sum, x) => sum + (x.adjustedSalience ?? x.salience), 0) * 1000) / 1000,
    winnerIds: winners.map(x => x.id),
    roots: winners.map(x => x.rootObservationId)
  };
}

export function comparePolicies(fixture, redundancyPenalty = 0.25) {
  const candidates = buildCandidates(fixture.events, fixture.salienceWeights);
  const capacity = fixture.workspaceCapacity;
  const raw = rawTopK(candidates, capacity);
  const diverse = sourceDiverseTopK(candidates, capacity);
  const soft = softDiversityTopK(candidates, capacity, redundancyPenalty);
  return {
    candidates,
    raw: { winners: raw, metrics: policyMetrics(raw) },
    diverse: { winners: diverse, metrics: policyMetrics(diverse) },
    soft: { winners: soft, metrics: policyMetrics(soft) }
  };
}
