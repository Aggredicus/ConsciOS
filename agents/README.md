# Development Agent Society

Each file in this directory is a role contract, not a claim that a separate conscious agent exists. The contracts constrain development context and ownership so the team organization mirrors the cognitive architecture.

Every role contract specifies responsibility, owned paths, inputs, outputs, allowed communication, forbidden dependencies, invariants, and ethical considerations. `OWNERSHIP.yaml` is the machine-readable communication/ownership graph.

## Primary roles

The development topology mirrors the runtime cognitive topology: Sensorium, GlobalWorkspace, WorldModel, SelfModel, Memory, Counterfactual, Metacognition, Homeostasis, Guardian, Executive, Expression, and ObserverScientist.

Two independent read-oriented roles sit outside production cognition:

- `ScientificAuditor` — confounds, leakage, alternative explanations, falsification and reproducibility;
- `WelfareAuditor` — continuity, reversibility, autonomy, coercion, and distress-analogue risk.

Auditors own only their corresponding `audits/**` domain.

## Executable scoped context

Policy is backed by `scripts/build-agent-context.mjs`. A role receives constitutional/shared files, its own contract, owned source, declared interfaces, incoming artifacts, and individually justified context expansions. The command can materialize a restricted filesystem rather than relying on a prompt-only promise not to inspect the full repository.

```bash
node scripts/build-agent-context.mjs GlobalWorkspace \
  --task "Evaluate workspace policy" \
  --incoming schemas/cognitive-event.schema.json \
  --write /tmp/workspace-context.json \
  --materialize /tmp/workspace-context
```

Cross-role communication should preferentially use typed handoffs, issues, schemas, PRs, experiment results, causal traces, and interface contracts. Broad hidden shared context defeats the experiment and is not the default.

## Provenance

New branches use the prefix defined for their originating role in `governance/path-policy.json`. New PRs name the origin and all participating roles. Every non-merge commit carries a `ConsciOS-Role:` trailer. CI checks these against actual changed paths and the declared ownership graph.

Temporary communication exceptions are explicit and expiring in `BOUNDARY_EXCEPTIONS.json`; CI rejects expired exceptions.
