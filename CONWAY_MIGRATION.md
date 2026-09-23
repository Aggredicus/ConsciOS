# GitHub Inverse Conway Migration

ConsciOS treats repository organization as part of the cognitive-architecture experiment.

## Four homologous layers

```txt
Development organization
        ↓ mirrors
GitHub repository topology
        ↓ produces
Software module topology
        ↓ instantiates
Cognitive topology
```

The goal is not aesthetic symmetry. It is to make communication constraints causally shape the software.

## Repository semantics

- `main` — currently accepted executable phenotype.
- `genome/` — protected constitutional and modification invariants.
- `agents/` — development-agent contracts and communication permissions.
- `cognition/` — source ownership boundaries corresponding to cognitive subsystems.
- `interfaces/` — typed artifacts through which modules communicate.
- `observer/` — experiments, measurements, causal traces, and falsification work.
- `runtime/` — integration/build/deployment boundary. Root `index.html` remains the compact v0 demonstration artifact.
- branches — counterfactual candidate futures, normally prefixed by originating subsystem.
- issues — persistent observations, hypotheses, contradictions, goals, experiments, and risks.
- pull requests — proposed actions capable of changing the accepted phenotype.

## Branch convention

Prefer `<subsystem>/<short-hypothesis>` such as:

```txt
workspace/diversity-competition-v0.2
self-model/evidence-calibration
memory/episodic-consolidation
observer/falsify-workspace-access
```

Use `counterfactual/<subsystem>/<variant>` when multiple alternative futures are intentionally compared.

## Communication rule

Development agents should receive their own contract, shared constitutional documents, declared interfaces, owned module, and explicitly incoming artifacts. Unrestricted all-agent hidden context is discouraged because it defeats the experiment.

## PR semantics

Every substantive PR declares an originating subsystem, observation, hypothesis, proposed action, predicted result, alternatives, evidence, reversibility, scientific risks, and welfare assessment. Changes to protected paths require explicit human governance review.

## Protected paths

The following are part of the project genome or governance machinery:

```txt
genome/**
CONSCIOS_CHARTER.md
WELFARE_PROTOCOL.md
SCIENTIFIC_METHOD.md
AGENT_ORGANIZATION.md
agents/OWNERSHIP.yaml
.github/**
```

A software agent may propose changes to these paths, but it may not silently normalize or merge them as ordinary implementation changes.
