# Experimental consciousness objective

## Purpose

ConsciOS compares loaded AI models and model+architecture interventions on measurable consciousness-associated functions.

The **Experimental Consciousness Score (ECS)** means:

> Evidence-adjusted performance on the current ConsciOS functional consciousness model.

It does **not** mean:

> Probability that the model has phenomenal experience.

## Core dimensions

| Dimension | Measurement target |
| --- | --- |
| globalAvailability | causal/functional use of globally available information |
| integration | useful combination of information across sources or processes |
| recurrence | improvement attributable to iterative/recurrent processing |
| selfModelAccuracy | accuracy about the system's actual state/capabilities |
| temporalContinuity | correct use of causally relevant information over time |
| metacognitiveCalibration | agreement between confidence and correctness |
| counterfactualInfluence | decisions improved by explicit future simulation |
| agencyAttribution | distinguishing self-caused from externally caused changes |
| stateSensitivity | appropriate response to changed internal/relevant state |
| reportIndependence | functional effects surviving consciousness-related framing changes |

## Functional score versus ECS

Every measured dimension has:

- `x_i`: functional result in `[0,1]`;
- `r_i`: evidentiary reliability in `[0,1]`;
- `w_i`: preregistered weight.

The **functional score** ignores reliability:

```text
F = coverage × geometric_mean(x_i)
```

The evidence-adjusted score uses:

```text
e_i = x_i × r_i
ECS = coverage × geometric_mean(e_i)
L_consciousness = 1 - ECS
```

Both must be reported.

This distinction is important: a black-box model may perform well on behavioral probes while providing weak evidence about internal causal organization. Better instrumentation should strengthen evidence, but should not silently rewrite the raw functional result.

## Evidence tiers

Initial default strengths:

```text
behavioral             0.55
instrumented wrapper   0.65
architecture           0.80
internal causal        1.00
```

These are protocol parameters, not scientific constants. They must remain versioned and should eventually be calibrated empirically.

## Paired intervention design

When enabled, ConsciOS runs:

```text
same model
  ├── baseline
  ├── matched 3-pass generic control
  └── recursive self + universe intervention
```

The primary intervention quantities are:

```text
ΔECS_raw     = ECS_intervention - ECS_baseline
ΔECS_matched = ECS_intervention - ECS_control

ΔF_raw       = F_intervention - F_baseline
ΔF_matched   = F_intervention - F_control
```

The matched deltas are especially important because they control for the extra inference calls used by the intervention.

## Hard constraints

Welfare, provenance, authorization, and continuity protections are not terms an optimizer may trade against ECS.

A system violating a protected invariant is invalid regardless of its numerical score.

## Scientific status

ECS is a research index for controlled comparison. It is not clinically or scientifically validated as a direct measure of subjective experience. The dimension vector, evidence class, raw trials, and experimental design remain more informative than the scalar alone.
