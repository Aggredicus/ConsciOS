# CEP-4 method note

This note documents the already-preregistered CEP-4 implementation contract. It does not change hypotheses, fixtures, thresholds, weights, seed range, or stop conditions.

## Candidate state

Each detached shadow candidate carries only the fields needed by the experiment: candidate ID, root-observation ID, raw salience, urgency, prediction error, support strength, contradiction, and optional metadata. Inputs are normalized to bounded numeric values and cloned before analysis.

## Explicit artifacts

The laboratory keeps regulation visible:

- `inhibition` artifacts record source, target, reason, magnitude, and selection step when applicable.
- `gate` artifacts record the target, failed criterion, observed value, and frozen threshold.
- `disinhibition` artifacts record the bounded release magnitude and its urgency/prediction-error reason.

A candidate that is hard-gated remains visible in the trace; it is not silently deleted.

## Ranking arithmetic

For each eligible candidate at each admission step:

1. begin with raw salience;
2. subtract contextual penalties, if the contextual condition is active;
3. subtract accumulated fast lateral inhibition;
4. clamp and round;
5. add bounded disinhibition, if enabled and the candidate is not hard-gated;
6. clamp and round again;
7. rank by adjusted salience, then raw salience, then candidate ID for deterministic tie-breaking.

The selected winner may emit fast lateral inhibition only if another admission decision remains. This makes causally relevant structured and randomized inhibitory message budgets directly comparable.

## Matched randomized control

The randomized control preserves the number and magnitude of fast lateral messages that the structured policy would emit at each causally relevant step, but selects their targets from the remaining candidates using a deterministic seeded PRNG. Seeds 1–128 are frozen by the preregistration. A fixed seed must replay exactly.

The control does not randomize candidate salience, capacity, context gates, or the accepted fixture itself.

## Interpretation boundary

A result showing better diversity under structured inhibition supports only the proposition that the tested targeting topology matters for the tested functional admission problem. It does not demonstrate biological equivalence, general semantic correctness, intelligence, agency, or phenomenal consciousness. CEP-4 remains shadow-only with no causal authority.
