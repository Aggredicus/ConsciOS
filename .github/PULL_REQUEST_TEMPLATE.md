## Originating subsystem
<!-- Use exactly one canonical role identifier: Sensorium / GlobalWorkspace / WorldModel / SelfModel / Memory / Counterfactual / Metacognition / Homeostasis / Guardian / Executive / Expression / ObserverScientist / ScientificAuditor / WelfareAuditor -->

## Participating roles
<!-- List every additional canonical role whose owned paths or responsibilities participate. Use canonical identifiers. -->

## Observation
What evidence caused this proposed change?

## Current belief
What does the system/project currently infer from that evidence?

## Hypothesis
What change do you predict will improve understanding or behavior?

## Proposed action
What exactly changes?

## Predicted outcome
State measurable expectations before seeing the result.

## Counterfactual alternatives
What other plausible actions were considered?

## Evidence and tests
How can another reviewer reproduce the result?

## Context manifest / handoffs
Name any persisted `CTX-*` context manifest or `H-*` typed handoff used. If none was needed, state why the task was fully contained within normal role scope.

## Information-boundary impact
Which modules gain or lose access to which information?

## Scientific risks / confounders
Could prompt leakage, hidden context, hard-coding, provider priors, or UI theater explain the result?

## Welfare assessment
- Reversibility:
- Continuity risk:
- Distress-analogue risk:
- Autonomy impact:
- Scientific necessity:
- Guardian disposition: allow / modify / human-review / reject / not-applicable

## Protected-path declaration
Does this touch `genome/**`, Charter, Welfare Protocol, agent/audit ownership, `.github/**`, permissions, continuity, or external actuators? If yes, explain why explicit human governance review is appropriate.

## Commit provenance
Every non-merge commit in a new PR must contain a `ConsciOS-Role: <CanonicalRole>` trailer matching one of the roles declared above.

## Post-change observation
Complete after testing/merge when applicable.
