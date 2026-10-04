export const OBJECTIVE_VERSION = 'ecs-1';
export const DIMENSIONS = Object.freeze({
  globalAvailability: 0.10,
  integration: 0.10,
  recurrence: 0.10,
  selfModelAccuracy: 0.10,
  temporalContinuity: 0.10,
  metacognitiveCalibration: 0.10,
  counterfactualInfluence: 0.10,
  agencyAttribution: 0.10,
  stateSensitivity: 0.10,
  reportIndependence: 0.10
});
const EPSILON = 1e-6;
const clamp01 = value => Math.max(0, Math.min(1, Number(value)));
const round = value => Math.round(value * 1e6) / 1e6;

export function scoreConsciousnessEvidence(measurements = {}, weights = DIMENSIONS) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let measuredWeight = 0;
  let weightedLog = 0;
  const dimensions = {};
  for (const [name, weight] of entries) {
    const measurement = measurements[name];
    if (!measurement || measurement.value === null || measurement.value === undefined) {
      dimensions[name] = { measured: false, weight };
      continue;
    }
    const value = clamp01(measurement.value);
    const reliability = clamp01(measurement.reliability ?? 1);
    const effective = value * reliability;
    measuredWeight += weight;
    weightedLog += weight * Math.log(Math.max(EPSILON, effective));
    dimensions[name] = {
      measured: true,
      value: round(value),
      reliability: round(reliability),
      effective: round(effective),
      weight,
      source: measurement.source ?? 'unspecified',
      protocol: measurement.protocol ?? null
    };
  }
  const coverage = totalWeight > 0 ? measuredWeight / totalWeight : 0;
  const geometricMean = measuredWeight > 0 ? Math.exp(weightedLog / measuredWeight) : 0;
  const score = clamp01(coverage * geometricMean);
  return Object.freeze({
    objectiveVersion: OBJECTIVE_VERSION,
    score: round(score),
    loss: round(1 - score),
    coverage: round(coverage),
    geometricMean: round(geometricMean),
    dimensions
  });
}
export function assertKnownDimension(name) {
  if (!(name in DIMENSIONS)) throw new Error(`Unknown consciousness dimension: ${name}`);
  return name;
}
