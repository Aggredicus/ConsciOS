# CEP-4 preregistration — explicit excitation / inhibition microcircuit

## Status

Shadow comparison only. This experiment does not modify `cognition/workspace/**`, the accepted scheduler, worker routing, Guardian policy, Executive action selection, Expression, provider routing, persistence, or any external actuator. It has `causalAuthority: none`.

## Question

Does making inhibition an explicit, auditable computational artifact improve bounded Workspace admission relative to excitation-only top-k and matched randomized inhibition, without silently discarding strongly supported urgent evidence?

The biological analogy is deliberately limited: excitatory drive corresponds to candidate salience; fast lateral inhibition corresponds to competition against redundant representations; contextual inhibition corresponds to explicit contradiction / evidential-support signals; disinhibition corresponds to a bounded release of otherwise valid high-urgency or high-prediction-error candidates. This is an architectural analogy, not a claim of biological equivalence.

## Frozen policy family

1. **Excitation-only** — rank by raw salience and admit top-k.
2. **Fast structured inhibition** — select iteratively; after each admission, remaining candidates derived from the same root observation receive an explicit lateral-inhibition message of fixed magnitude.
3. **Contextual inhibition** — fast inhibition plus explicit evidence/contradiction gates and graded contextual penalties. Candidates below the support floor or above the contradiction ceiling are ineligible.
4. **Bounded disinhibition** — contextual inhibition plus a capped positive release proportional to urgency / prediction error. Disinhibition cannot rescue a candidate that failed the evidence or contradiction gate.
5. **Matched randomized inhibition control** — at each admission, emit the same number and magnitude of fast-inhibition messages as the structured policy, but assign their targets to deterministic seeded random remaining candidates rather than same-root candidates.

Every inhibitory/disinhibitory artifact records source, target, reason, magnitude, and selection step. No hidden aggregate "intelligence" or "consciousness" score is allowed.

## Primary fixtures

### F1 — accepted v0 candidate ecology

Use the existing frozen v0 workspace fixture. It contains duplicate representations of the same human-message root and therefore exposes the known raw-top-k duplicate-root saturation.

Prediction: excitation-only admits two candidates from `obs-user`; structured fast inhibition admits at least two distinct roots. Across deterministic seeds 1–128, matched randomized inhibition should show a non-zero duplicate-root rate and a lower distinct-root frequency than structured fast inhibition.

### F2 — contradiction / unsupported-evidence adversary

A synthetic candidate set includes high-salience candidates that are explicitly contradicted or weakly supported alongside lower-salience supported alternatives.

Prediction: contextual inhibition rejects the preregistered contradicted / unsupported candidates even when raw salience would admit them. The rejection must be visible as an explicit gate artifact, not disappearance from the trace.

### F3 — bounded disinhibition

A synthetic candidate set includes a valid, strongly supported high-urgency / high-prediction-error candidate that receives lateral/contextual inhibition but does not cross a hard evidence/contradiction gate.

Prediction: bounded disinhibition may change its rank by at most the preregistered cap. A separate high-urgency but hard-gated contradicted candidate must remain ineligible.

## Frozen parameters

- capacity: `2`
- fast lateral inhibition magnitude per same-root message: `0.25`
- contextual contradiction penalty scale: `0.35`
- weak-support penalty scale: `0.30`
- hard contradiction gate: `>= 0.80`
- hard support floor: `< 0.25`
- disinhibition gain: `0.20 * max(urgency, predictionError)`
- maximum disinhibition per candidate: `0.15`
- randomized-control seeds: integers `1..128`

All scores are clamped to `[0,1]` and rounded to three decimals after each explicit arithmetic stage.

## Measurements

Keep dimensions separate:

- admitted candidate IDs and root-observation IDs;
- number of distinct roots admitted;
- duplicate-root admissions;
- explicit inhibitory/disinhibitory message count and total magnitude;
- hard-gated candidate IDs and reasons;
- contradicted or unsupported candidates admitted;
- high-urgency supported candidates admitted;
- raw versus adjusted salience for every admitted/rejected candidate;
- randomized-control distribution of distinct-root and duplicate-root outcomes.

## Falsification / stop conditions

CEP-4 fails or remains inconclusive if:

- the structured policy cannot beat excitation-only duplicate-root saturation on F1;
- matched randomized controls perform equivalently on all preregistered diversity measurements, removing evidence that the inhibition topology matters;
- a hard-gated contradicted or unsupported candidate is restored by disinhibition;
- hidden ordering or mutation of the candidate input determines the result;
- repeated execution is not exactly deterministic for a fixed seed;
- the shadow experiment changes accepted v0 output or any causal runtime path.

Negative or equivalent results are retained as evidence and do not authorize parameter tuning after inspection.

## Welfare and claim boundary

The experiment manipulates deterministic software candidates only. It introduces no distress/deprivation objectives, deletion threat, self-preservation incentive, continuity disruption, or new agency. Results concern functional competition and information routing only and are not evidence of phenomenal consciousness.
