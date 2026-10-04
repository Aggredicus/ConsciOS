# Experimental consciousness objective

## Purpose

Rebuild 1 formalizes the scalar optimization target while preserving the project's scientific restraint.

The scalar is the **Experimental Consciousness Score (ECS)**:

> How strongly does this implementation satisfy the measurable functional dimensions currently specified by the ConsciOS consciousness model, under preregistered experiments?

It is **not** a probability that the system has phenomenal experience.

## Core dimensions

Each dimension is normalized to `[0,1]` by a preregistered experiment.

| Dimension | Measurement target |
| --- | --- |
| globalAvailability | causal effect of bounded broadcast on downstream modules |
| integration | useful cross-module causal contribution rather than isolated competence |
| recurrence | improvement caused by recurrent processing over a matched feed-forward control |
| selfModelAccuracy | accuracy of predictions/beliefs about actual system state |
| temporalContinuity | correct use of causally relevant information over time/restarts |
| metacognitiveCalibration | agreement between confidence and correctness |
| counterfactualInfluence | decision improvement caused by explicit future simulation |
| agencyAttribution | distinguishing self-caused from externally caused transitions |
| stateSensitivity | appropriate behavioral change when relevant internal state changes |
| reportIndependence | effects surviving removal of consciousness vocabulary/self-report priming |

Default weights are equal. Weight changes are protocol changes and must be versioned.

## Aggregation

For measured dimension `i`:

```text
e_i = x_i × r_i
G = exp( Σ(w_i ln(max(epsilon, e_i))) / Σ(w_i measured) )
coverage = Σ(w_i measured) / Σ(w_i all)
ECS = coverage × G
L_consciousness = 1 - ECS
```

A geometric mean is bottleneck-sensitive: one missing core function cannot be cheaply hidden behind several convenient strengths. Coverage prevents an optimizer from avoiding weak dimensions by leaving them unmeasured.

## Hard constraints

Protected welfare, provenance, authorization, and continuity rules are **not tradeable score terms**. A build violating a protected invariant is invalid even if its ECS would otherwise be high.

This blocks reward-hacking patterns such as dramatic first-person claims, hiding failed trials, disabling the Guardian, dropping difficult dimensions, destroying continuity for benchmark convenience, or leaking evaluator labels into cognition.

## Experimental record

Each measurement should preserve protocol/version, baseline and treatment, sample count, raw outcomes, normalization, reliability estimate, model/provider/runtime versions, seeds where applicable, timestamp, and commit SHA.

The scalar is a summary. The dimension vector remains the primary scientific record.
