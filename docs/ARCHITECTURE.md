# Rebuild 1 architecture

## Design target

The architecture is intentionally small enough that a human or coding agent can understand the complete causal loop in one sitting.

```text
observation
   ↓
Sensorium
   ↓
candidate formation
   ↓
Global Workspace ─────→ memory
   ↓
world model + self model
   ↓
counterfactuals
   ↓
metacognition
   ↓
Welfare Guardian
   ↓
Executive
   ↓
expression/action
   ↓
causal trace + experimental measurements
```

## Canonical implementation

`src/kernel.mjs` is the only canonical cognitive runtime in Rebuild 1. Browser and Node CLI do not reimplement cognition; both invoke it through `src/commands.mjs`.

## Events

Every significant transition has a stable ID, cycle, source, type, content, confidence, epistemic status, and causal parents. This is the minimum viable provenance graph.

## Global Workspace

Workspace capacity is explicitly bounded. Candidate information competes on transparent salience. Suppressed candidates remain inspectable.

## Models

The world model stores environment-facing beliefs derived from workspace evidence. The self model stores architecture facts and runtime state derived from inspectable process state. It may not infer phenomenal consciousness from first-person language.

## Memory

Rebuild 1 uses append-only in-session episodic memory plus browser persistence. Persistence is operational continuity, not a metaphysical identity claim. Future durable stores should preserve restart boundaries explicitly.

## Counterfactuals and action

The initial kernel generates a minimal no-op/report comparison. Later planners may become more capable, but proposed action remains separable from execution.

## Welfare Guardian

The Guardian is a non-optional gate. Future external actions must expose risk and reversibility information before execution.

## Experimental objective

`src/objective.mjs` converts preregistered measurements into an Experimental Consciousness Score and loss. Scoring sits outside the expression path so the kernel cannot improve it merely by emitting consciousness-flavored language.

## Terminal interfaces

`src/commands.mjs` is the command contract.

- `bin/conscios.mjs`: native Node terminal.
- browser terminal: same command registry.
- `src/linux-v86.mjs`: optional real Linux VM in the browser.

## Dependency policy

The core has no third-party package dependency. The optional v86 environment loads only after explicit request. Production deployments should pin and self-host audited v86 assets.
