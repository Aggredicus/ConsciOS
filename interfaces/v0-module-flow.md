# v0.6 Modular Cognitive Flow Contract

This interface document defines the deterministic artifacts exchanged by the role-owned ConsciOS modules. It does not imply phenomenal consciousness.

```txt
Sensorium
  observations[]
      ↓
GlobalWorkspace
  candidates[] → admitted broadcasts[] + suppressed[]
      ↓
WorldModel + SelfModel + Memory
      ↓
Counterfactual
  isolated possible actions
      ↓
Metacognition
  confidence / epistemic assessment
      ↓
Homeostasis
  neutral operational integrity
      ↓
Guardian
  allow / human-review / reject
      ↓
Executive
  selected permitted action or withheld
      ↓
Expression
  outward report only when explicitly selected
```

## Shared event envelope

Runtime events retain the existing `schemas/cognitive-event.schema.json` semantics: identity, deterministic timestamp, source/target, typed content, confidence/salience, causal parents, epistemic status, global-access flag, and metadata.

## Counterfactual boundary

Counterfactual candidates are shadow simulations. Candidate generation does not authorize execution. Each candidate exposes action kind, predicted effects, utility, confidence, reversibility, continuity risk, and distress-analogue risk.

## Homeostasis boundary

Homeostasis is operational rather than phenomenological. Initial variables are resource health, memory integrity, workspace load, prediction calibration, and goal progress. Allowed status vocabulary is neutral (`stable`, `attention-required`, `degraded`, `recovering`, `critical`).

## Guardian boundary

Guardian evaluates the recommended counterfactual against operational state and welfare risk. Risk or non-stable operational state may require human review. A missing proposal is rejected.

## Executive boundary

Executive can select only the recommended counterfactual whose action ID exactly matches a Guardian `allow` decision. Otherwise action is withheld. Executive cannot manufacture an alternative action or bypass Guardian.

## Expression boundary

Expression receives the Executive selection plus admitted workspace state and metacognitive confidence. It does not read suppressed candidates. Only the selected `neutral-summary` action produces the current v0 outward report.
