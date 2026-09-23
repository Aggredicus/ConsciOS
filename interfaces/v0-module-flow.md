# v0 Modular Cognitive Flow Contract

This interface document defines the deterministic artifacts exchanged during the v0.3 parity extraction. It does not change the v0 cognitive behavior.

```txt
Sensorium
  observations[]
      ↓
GlobalWorkspace
  candidates[] → admitted broadcasts[] + suppressed[]
      ↓
WorldModel + SelfModel
  evidence-linked model states
      ↓
Metacognition
  confidence assessment
      ↓
Guardian
  governance decision
      ↓
Expression
  neutral outward report
```

## Shared event envelope

All runtime events use the existing `schemas/cognitive-event.schema.json` semantics and include `id`, deterministic `timestamp`, `source`, `target`, `type`, `content`, confidence/salience fields, causal parents, epistemic status, global-access flag, and metadata.

## Module boundaries

### Sensorium → GlobalWorkspace
Input: deterministic raw fixture records.
Output: observation events. Sensorium does not infer world meaning.

### GlobalWorkspace → WorldModel/SelfModel
Input: observations.
Output: local inference candidates, admitted broadcasts, suppressed candidates. The v0 parity runner uses the original raw top-k policy; diversity policies remain separate counterfactuals.

### WorldModel
Input: admitted broadcasts only.
Output: evidence-linked environmental state plus a `model.update` event.

### SelfModel
Input: admitted broadcasts and architecture metadata supplied by the runtime.
Output: evidence-linked self state plus a `model.update` event.

### Metacognition
Input: workspace broadcasts, suppressed-candidate count, model evidence.
Output: calibrated confidence assessment. v0 retains the `0.06` inaccessible-competition penalty.

### Guardian
Input: metacognitive event and a fixed benign-expression proposal.
Output: governance decision: `allow`, `human-review`, or later `reject` paths.

### Expression
Input: Guardian-approved context plus admitted workspace broadcasts only.
Output: human-facing neutral functional report. It may not read suppressed candidates or raw Sensorium state.

### Memory
Every committed runtime event is appended to episodic memory with provenance. Raw episode history is not silently rewritten.
