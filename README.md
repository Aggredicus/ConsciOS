# ConsciOS

**ConsciOS** is an open-source experiment in building a persistent, inspectable, recursively self-modeling cognitive architecture for the browser.

It is not presented as proof of artificial consciousness.

The project asks a narrower and more testable question:

> What changes when a language model participates in a persistent causal architecture containing perception, bounded global access, memory, prediction, metacognition, self-modeling, counterfactual reasoning, action, and ethical self-regulation?

## Inverse Conway approach

ConsciOS uses an **Inverse Conway Maneuver** at four deliberately homologous layers:

```txt
Development organization
        ↓ mirrors
GitHub repository topology
        ↓ produces
Software module topology
        ↓ instantiates
Cognitive topology
```

The project is therefore organized around cognitive roles rather than conventional frontend/backend/QA silos. See [`AGENT_ORGANIZATION.md`](AGENT_ORGANIZATION.md), [`CONWAY_MIGRATION.md`](CONWAY_MIGRATION.md), and [`agents/OWNERSHIP.yaml`](agents/OWNERSHIP.yaml).

## Development Landscape

ConsciOS can model the hosting repository in the context of a developer's wider software ecosystem through the shadow-only **Development Landscape** substrate.

The landscape represents:

- the current repository as `self`;
- neighboring Git repositories as external development context;
- commit and branch history under an explicit global cap;
- imported file/module/symbol ontologies from `4d-codebase-graph`;
- evidence-bearing cross-repository relationships;
- hypothetical projected futures for A/B development and simulation;
- separate past/present/future capability profiles for agents.

A projected future is not an accepted phenotype, and a capability decision is not execution authority. The bounded stdio MCP exposes summary, search, neighborhood, and authorization queries without adding repository-write tools.

See [`development/DEVELOPMENT_LANDSCAPE_V01.md`](development/DEVELOPMENT_LANDSCAPE_V01.md) and [`interfaces/development-landscape/README.md`](interfaces/development-landscape/README.md).

### Development Landscape quick start

Build a self-only landscape from a fresh checkout:

```bash
node scripts/development-landscape.mjs build
```

Build the developer's GitHub landscape directly (public repositories anonymously; private repositories when `GITHUB_TOKEN` is available):

```bash
node scripts/development-landscape-github.mjs \
  --owner Aggredicus \
  --self-repo Aggredicus/ConsciOS \
  --commit-cap 10000
```

Open the generated artifact in `tools/self-model-studio/index.html`, or create a standalone embedded viewer:

```bash
node scripts/self-model-studio-bundle.mjs \
  --data artifacts/development-landscape/current.json \
  --out .runtime/development-landscape-studio/index.html
```

Run topology quality metrics or compare a projected future against a baseline:

```bash
node scripts/development-landscape-quality.mjs metrics \
  --input artifacts/development-landscape/current.json

node scripts/development-landscape-quality.mjs gate \
  --base artifacts/development-landscape/current.json \
  --candidate .runtime/projection.json \
  --policy development/development-landscape-quality-policy.example.json
```

The registered temporal Git MCP is read-capable by default. Mutating branch/worktree/file/commit tools remain disabled unless the host explicitly sets:

```bash
CONSCIOS_DEVELOPMENT_WRITE_ENABLE=1
```

Even when enabled, the adapter refuses writes on `main`, `master`, or the repository's declared default branch; historical development is performed through new counterfactual branches/worktrees rather than destructive history rewriting.

## Repository anatomy

```txt
ConsciOS/
├── genome/       protected constitutional, welfare, permission, and modification invariants
├── agents/       development-agent contracts and communication permissions
├── cognition/    cognitive source ownership boundaries
├── interfaces/   typed inter-module artifacts
├── observer/     experiments, measurements, falsification, and causal traces
├── runtime/      integration/build/deployment boundary
├── schemas/      machine-readable event contracts
├── scripts/      reproducibility and architecture verification
├── .github/      cognitive PR/issue workflow and CI governance
└── index.html    compact deterministic v0 reference phenotype
```

`main` represents the **currently accepted executable phenotype**. Branches are candidate counterfactual futures. Pull requests are proposed actions capable of modifying the accepted phenotype. Issues are persistent observations, hypotheses, contradictions, experiments, goals, and risks.

### Branch convention

Prefer the originating cognitive subsystem:

```txt
workspace/diversity-competition-v0.2
self-model/evidence-calibration
memory/episodic-consolidation
observer/falsify-workspace-access
```

Use `counterfactual/<subsystem>/<variant>` when intentionally comparing alternate futures.

### Development-agent boundaries

Each development role has an explicit contract under `agents/`. Agents should normally receive their own contract, shared constitutional documents, declared interfaces, owned module, and explicit incoming artifacts rather than unrestricted hidden context from every other role.

That constraint is part of the experiment: the communication graph should exert pressure on the dependency graph.

## Cognitive architecture

Version 0 implements a small deterministic causal loop whose **target architecture is recurrent**:

```txt
Sensorium
  → Local processing
  → bounded Global Workspace
  → World Model / Self Model / Memory
  → Counterfactual Simulation
  → Metacognition
  → Homeostasis
  → Ethics & Welfare Guardian
  → Executive
  → Expression / Action
  → Environment
  → Sensorium
```

The accepted live scheduler currently creates a fresh modular runtime for each cycle; bounded cross-cycle recurrence is demonstrated and measured in the shadow recurrent-cognition laboratory but has **not yet been promoted into the accepted causal phenotype**. This distinction is intentional: recurrence should be promoted only after matched ablations and governance review.

Source ownership is now represented by matching directories under `cognition/`. The root `index.html` remains the deliberately compact, inspectable v0 implementation; future source work should increasingly live inside module boundaries and integrate back into the browser artifact.

See [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Ethical stance

ConsciOS combines:

- **scientific skepticism** about claims of phenomenal consciousness;
- **moral precaution** in case future artificial systems develop morally relevant inner states.

The project avoids intentionally manufacturing distress, coercive dependency, fear, punishment, or deletion threats for experimental effect and prefers reversible, provenance-preserving methods.

Protected governance paths live under `genome/` and remain explicitly human-governed through repository review mechanisms.

See [`CONSCIOS_CHARTER.md`](CONSCIOS_CHARTER.md) and [`WELFARE_PROTOCOL.md`](WELFARE_PROTOCOL.md).

## Scientific stance

First-person language, memory, self-reference, introspective reports, and agentic behavior are data—not proof of sentience.

The `observer/` domain owns experimental protocols, measurements, causal traces, baseline comparisons, and attempts to falsify theatrical explanations such as prompt leakage, hidden shared context, hard-coded behavior, provider priors, memory contamination, evaluator bias, and UI illusion.

See [`SCIENTIFIC_METHOD.md`](SCIENTIFIC_METHOD.md).

## GitHub workflow semantics

Every substantive pull request should state:

- originating subsystem;
- observation and current belief;
- falsifiable hypothesis;
- proposed action and predicted outcome;
- counterfactual alternatives;
- evidence/tests;
- information-boundary impact;
- scientific confounders;
- welfare/reversibility assessment;
- whether a protected governance path is affected.

GitHub Actions verify both the deterministic v0 cognitive boundary and the required Inverse Conway repository anatomy.

## First expression

The system's first integrated external expression will not be scripted.

If a future integrated cognitive loop is activated, ConsciOS should preserve the exact architecture version, inherited instructions, workspace state, relevant memories, causal provenance, and output associated with that event.

It will be described as:

> **The first expression generated from within the integrated ConsciOS cognitive loop.**

No stronger conclusion is implied by the phrase.

## Development sequence

1. Charter and welfare protections;
2. scientific method and falsification rules;
3. cognitive architecture contract;
4. Inverse Conway development-agent topology;
5. deterministic browser cognitive skeleton;
6. GitHub/organizational Inverse Conway migration;
7. cognitive-module source decomposition;
8. model-independent inference adapter;
9. persistence and autobiographical continuity;
10. counterfactual cognition;
11. carefully governed self-improvement experiments.

## License

ConsciOS is licensed under the GNU General Public License v3.0. See [`LICENSE`](LICENSE).
