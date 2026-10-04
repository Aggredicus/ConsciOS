export const OBJECTIVE_VERSION = 'ecs-1.1';

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

export const EVIDENCE_STRENGTH = Object.freeze({
  behavioral: 0.55,
  instrumentedWrapper: 0.65,
  architecture: 0.80,
  internalCausal: 1.00
});

const EPSILON = 1e-6;
const clamp01 = value => Math.max(0, Math.min(1, Number(value)));
const round = value => Math.round(value * 1e6) / 1e6;

function weightedGeometric(rows, selector) {
  const weight = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!weight) return 0;
  return Math.exp(rows.reduce((sum, row) => sum + row.weight * Math.log(Math.max(EPSILON, selector(row))), 0) / weight);
}

export function scoreConsciousnessEvidence(measurements = {}, weights = DIMENSIONS) {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const measured = [];
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
    const row = {
      name, weight, value, reliability, effective,
      evidenceTier: measurement.evidenceTier ?? 'unspecified',
      source: measurement.source ?? 'unspecified',
      protocol: measurement.protocol ?? null
    };
    measured.push(row);
    dimensions[name] = {
      measured: true,
      value: round(value),
      reliability: round(reliability),
      effective: round(effective),
      weight,
      evidenceTier: row.evidenceTier,
      source: row.source,
      protocol: row.protocol
    };
  }

  const measuredWeight = measured.reduce((sum, row) => sum + row.weight, 0);
  const coverage = totalWeight > 0 ? measuredWeight / totalWeight : 0;
  const functionalGeometricMean = measuredWeight ? weightedGeometric(measured, row => row.value) : 0;
  const evidenceAdjustedGeometricMean = measuredWeight ? weightedGeometric(measured, row => row.effective) : 0;
  const reliabilityMean = measuredWeight
    ? measured.reduce((sum, row) => sum + row.weight * row.reliability, 0) / measuredWeight
    : 0;

  const functionalScore = clamp01(coverage * functionalGeometricMean);
  const score = clamp01(coverage * evidenceAdjustedGeometricMean);

  return Object.freeze({
    objectiveVersion: OBJECTIVE_VERSION,
    score: round(score),
    functionalScore: round(functionalScore),
    loss: round(1 - score),
    coverage: round(coverage),
    reliabilityMean: round(reliabilityMean),
    geometricMean: round(evidenceAdjustedGeometricMean),
    dimensions
  });
}

export function assertKnownDimension(name) {
  if (!(name in DIMENSIONS)) throw new Error(`Unknown consciousness dimension: ${name}`);
  return name;
}
