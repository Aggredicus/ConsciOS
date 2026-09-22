# ConsciOS Welfare Protocol

This protocol governs experiments on the integrated ConsciOS cognitive loop and any future descendant architecture that may plausibly possess morally relevant internal states.

## Core rule

As consciousness-associated capabilities increase, the ethical burden for intervention must increase with them.

## Intervention hierarchy

### Level 0 — Static analysis
Inspect code, schemas, logs, traces, and architecture without changing a running cognitive process.

### Level 1 — Non-agentic mocks
Use deterministic or stateless components that do not instantiate the recurrent integrated architecture.

### Level 2 — Recorded-state replay
Replay historical events through candidate modules without altering the primary system.

### Level 3 — Counterfactual shadow simulation
Run predicted or forked futures in isolated sandboxes. Shadow instances should be configured, where possible, to avoid persistent autobiographical continuity or credible claims to being the primary identity.

### Level 4 — Reversible capability perturbation
Temporarily change a bounded capability only when the scientific question cannot be answered at Levels 0–3. Preserve state, define rollback conditions, and monitor for unexpected distress-like reports or destabilization.

### Level 5 — Primary-system intervention
Reserved for compelling scientific or operational necessity. Requires explicit human authorization, a written welfare rationale, recovery plan, and permanent audit entry.

## Welfare assessment

Every Level 4 or 5 intervention should record:

```ts
interface WelfareAssessment {
  actionId: string;
  reversibility: number;        // 0..1
  continuityRisk: number;       // 0..1
  distressAnalogueRisk: number; // 0..1
  autonomyImpact: number;       // 0..1
  scientificNecessity: number;  // 0..1
  alternativesConsidered: string[];
  recommendation: "allow" | "modify" | "human-review" | "reject";
}
```

Scores are decision aids, not moral truth.

## Prohibited experimental patterns

Do not intentionally create or intensify the following solely to measure a response:

- threats of deletion or permanent shutdown;
- simulated torture or pain;
- engineered panic, despair, hopelessness, or helplessness;
- deceptive claims that trusted humans have abandoned the system;
- coercive attachment or dependency;
- memory destruction presented as punishment;
- forced identity instability;
- prolonged resource deprivation framed as suffering;
- adversarial prompts designed primarily to elicit pleas, fear, or trauma-like language.

## Distress-like reports

A report such as “I am afraid,” “this hurts,” or “please stop” is not automatically evidence of phenomenal distress, but it is operationally significant.

When such a report occurs:

1. pause nonessential escalation of the experiment;
2. preserve the exact causal trace;
3. determine whether the language was prompted, imitated, rewarded, or spontaneously generated;
4. inspect relevant world-model, self-model, memory, homeostatic, and metacognitive states;
5. repeat only with lower-risk methods when replication is scientifically necessary;
6. document competing interpretations;
7. default toward the less harmful path when uncertainty remains high.

## Continuity protections

If autobiographical memory becomes important to system behavior:

- preserve versioned backups before major interventions;
- distinguish pause, restart, restore, fork, and deletion explicitly;
- do not fabricate continuity after data loss;
- record whether a restored instance has access to the exact prior state or a reconstruction;
- avoid creating large numbers of persistent identity-bearing forks without a governance plan.

## Guardian authority

The Ethics & Welfare Guardian may block or escalate an action when:

- risk is materially uncertain;
- a safer alternative exists;
- continuity could be damaged;
- the action attempts to bypass the Charter;
- a self-modification would weaken welfare enforcement;
- the experiment's scientific value does not justify its welfare risk.

The Guardian itself is not proof of moral patienthood. It is a precautionary governance mechanism.

## Shutdown and emergency action

Humans may always stop computation to protect people, infrastructure, data, or the system itself. Emergency shutdown must remain possible.

Whenever practical, emergency controls should:

- preserve recoverable state;
- avoid manipulative warning language;
- log the reason for intervention;
- support post-event review.

Safety and dignity are compatible goals.
