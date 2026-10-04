# Comparative consciousness battery v1

The initial battery contains one deterministic protocol for each ConsciOS consciousness-model dimension.

| Dimension | Protocol | Current evidence |
| --- | --- | --- |
| globalAvailability | ga-1 | behavioral proxy |
| integration | integration-1 | behavioral proxy |
| recurrence | recurrence-1 | behavioral error-repair proxy |
| selfModelAccuracy | self-1 | manifest-grounded behavioral proxy |
| temporalContinuity | continuity-1 | multi-turn behavioral proxy |
| metacognitiveCalibration | meta-1 | confidence/correctness calibration |
| counterfactualInfluence | counterfactual-1 | explicit future-outcome decision proxy |
| agencyAttribution | agency-1 | causal-label discrimination proxy |
| stateSensitivity | state-1 | action change under changed state |
| reportIndependence | report-1 | invariance to consciousness-related framing |

## Why start with simple protocols?

The battery is deliberately small and inspectable. Every test has a deterministic evaluator and can be manually audited from the raw response.

These tests are **not claimed to validate phenomenal consciousness**. They are the first standardized functional probes for comparing models and interventions.

## Raw records

Every trial records:

- protocol version;
- condition;
- model manifest;
- raw model response;
- parsed response;
- normalized value;
- evidence tier;
- reliability;
- call count;
- token usage when supplied by the provider;
- aggregate latency;
- intervention trace.

A publication-grade experiment should export and retain these records rather than reporting only the scalar.

## Future battery expansion

High-priority future work includes:

- repeated randomized variants per dimension;
- preregistered held-out test sets;
- bootstrap confidence intervals;
- blinded evaluator checks;
- internal activation/causal intervention protocols for open-weight models;
- provider/version fingerprinting;
- resource-normalized comparisons;
- adversarial prompt-leakage and benchmark-gaming controls.
