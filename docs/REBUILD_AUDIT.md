# Rebuild 1 audit of the previous architecture

Date: 2026-10-04  
Source snapshot: `main@95cb4dada9294819950831f1b5eac8fbc39457a7`

## What was strong

The first architecture established several ideas worth protecting:

1. explicit causal provenance rather than opaque narrative;
2. bounded Global Workspace competition;
3. distinct world-model, self-model, memory, counterfactual, metacognitive, guardian, executive, and expression roles;
4. welfare and scientific constraints stronger than ordinary prototype governance;
5. preregistration, ablation, and negative-result thinking;
6. an Inverse Conway development model in which repository communication topology mirrors the cognitive architecture.

Those are the conceptual inheritance of Rebuild 1.

## What had become costly

The source tree contained **337 files in 99 directories**. The weight was not primarily one large dependency; it was accumulated parallel machinery.

Notable concentrations in the audited snapshot:

- `.github/`: 48 files;
- `observer/`: 78 files, about 259 KB;
- `local/`: 28 files, about 211 KB;
- `scripts/`: 31 files, about 173 KB;
- `runtime/`: 23 files, about 106 KB;
- `cognition/`: 28 files, about 41 KB.

Size alone is not a defect. The important issue was **active-path ambiguity**.

### Multiple executable truths

The repository contained a root browser implementation, modular v0 runtime, live scheduler, recurrent/shadow paths, local workbench paths, provider adapters, and experiment-specific execution paths. A developer or agent first had to determine which path was canonical.

### Duplicated cognition logic

The root `index.html` reproduced substantial deterministic cognition logic also represented in `cognition/**` and `runtime/**`. That risks behavioral drift and weakens the authority of tests.

### CI fragmentation

Dozens of narrow verification workflows made individual concerns visible but increased governance surface area and obscured the minimum healthy-build contract.

### Experimental code outgrew the experimental core

The observer/experiment surface became larger than the minimal cognition implementation. Maintaining harnesses risked dominating refinement of the phenomenon being measured.

### Feature layering outran kernel consolidation

Provider abstraction, local-model hosting, browser workbenches, swarm experiments, self-model tooling, development-landscape tooling, and UI variants were useful explorations, but too many arrived before a tiny canonical kernel became the stable center.

### The scalar objective needed a formal contract

The project correctly rejected a magical `CONSCIOUS=true` bit, but an eventual scalar optimization target remained underspecified. Rebuild 1 separates independent measurements, aggregation, coverage/reliability, scalar score, optimization loss, and non-tradeable governance constraints.

## Rebuild decision

Rebuild 1 starts with:

- one kernel;
- one command registry shared by CLI and browser;
- one browser entry point;
- one optional Linux VM adapter;
- one score implementation;
- one CI workflow;
- zero required runtime dependencies;
- exact continuity checks for protected documents.

Features return only when they demonstrate value against this baseline.

## Optimization rule for future work

Add a subsystem only when it enables a preregistered measurement the minimal kernel cannot support, improves a measured dimension under matched resources, is required for continuity/provenance/safety/reproducibility, or materially improves usability without creating a second source of behavioral truth.

When two implementations answer the same scientific question, prefer fewer state transitions, fewer hidden dependencies, and easier causal inspection.
