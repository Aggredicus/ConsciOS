# Cortical Ecology v1 — Gate 1 preregistration

## Status

Measurement-only. This experiment has **no causal authority** and does not change the accepted runtime, prompt/context contents, salience, candidate ordering, Workspace policy, Guardian policy, routing, or outward expression.

This is the shared baseline layer for AMC Gate 1 (#63) and Cortical Ecology Prototype Gate CEP-1. Adaptive attention, replay-derived policy changes, cache eviction/transfer, worker isolation, and phone-native routing remain out of scope.

## Observation

ConsciOS has several plausible mobile/local-first optimization targets, but the current repository does not derive a common set of efficiency, provenance, recurrence, and action-path measurements from raw traces. Optimizing before those dimensions are observable risks selecting an assumed bottleneck.

## Hypothesis

A treatment-neutral Observer layer can characterize current deterministic and recurrent fixtures without changing accepted cognitive outputs. Missing platform telemetry can be represented explicitly as unavailable rather than guessed.

## Frozen measurements

The baseline records dimensions separately:

- serialized input/context bytes where exact source objects exist;
- input-token count only when a tokenizer/provider reports it;
- stable/repeated prefix bytes and identifiers where exact repeated inputs exist;
- provider/cache working-set telemetry only when exposed by the provider;
- event count and event-type/source distributions;
- duplicate event IDs and broken causal-parent references;
- cross-domain causal-edge counts;
- suppressed-candidate downstream leakage checks where suppressed state exists;
- recurrent-state serialized size;
- recurrent versus stateless matched-input divergence;
- Guardian → Executive → Expression action-path completeness;
- provenance-field completeness for the event schema actually emitted by the fixture;
- model/provider identity, TTFT, generation throughput, model load size/time, peak memory, and device/backend capability only when actually reported;
- inference/tool-call, exploration-branch, and local/remote escalation counts only when the fixture exposes those concepts.

No aggregate efficiency, intelligence, or consciousness score is produced.

## Baselines

1. `runModularV0()` — accepted deterministic one-shot loop.
2. `createLiveScheduler()` — stage-wise deterministic loop using the same existing cognition path.
3. `runRecurrentLaboratoryV1()` — repeated-history recurrent fixture with an identical-input stateless comparison.

## Invariants

1. Measurement must be a pure read of fixture output.
2. Existing deterministic output is cloned before measurement and must remain deeply equal afterward.
3. Every unavailable platform/provider value is encoded as `{ status: "unavailable", value: null, reason }`.
4. Deterministic structural traces must replay exactly after explicitly nondeterministic timing/resource fields are excluded.
5. The Observer must not infer token counts from bytes, infer cache hits from repeated text, infer memory pressure from object size, or infer provider latency from unrelated wall-clock measurements.
6. Suppressed-information leakage checks are evidence about the inspected trace only; they are not a general security proof.

## Predicted outcome

The current deterministic path should preserve exact replay and a complete Guardian → Executive → Expression chain. The recurrent fixture should show matched-input divergence attributable to declared prior state while keeping recurrent state bounded. Provider-level timing, token, cache, GPU/CPU memory, thermal, and battery telemetry are expected to remain unavailable until an inference provider explicitly supplies them.

## Falsification / stop conditions

Gate 1 fails if measurement mutates accepted output, deterministic replay ceases to be structurally equivalent, causal ancestry is broken, duplicate event IDs prevent trace attribution, suppressed candidates visibly leak into downstream semantic state, or unavailable telemetry is silently converted into a measured numeric value.

A failure is retained as evidence. It does not authorize changing the runtime to make the measurement pass.

## Welfare and claim boundary

This experiment observes deterministic software traces and does not introduce distress, deprivation, deletion threat, coercion, self-preservation incentives, or continuity disruption. Results are functional software measurements and are not evidence of phenomenal consciousness.
