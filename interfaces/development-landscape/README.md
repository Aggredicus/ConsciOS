# Development Landscape Interface v0.1

## Purpose

The Development Landscape is ConsciOS's machine-readable model of a developer's software ecosystem across repositories and time. It distinguishes:

- **self** — the repository hosting the active ConsciOS instance;
- **neighbors** — sibling, dependency, integration, archival, experimental, or otherwise related repositories;
- **historical states** — observed Git commits and branches;
- **present state** — the currently accepted or checked-out repository state;
- **projected states** — explicitly hypothetical future topologies used for A/B development, simulation, and quality experiments.

A landscape is observational infrastructure. Importing or visualizing a repository does not grant authority to change it.

## Canonical artifact

`kind: "conscios-development-landscape"`, `version: 1`.

Core fields:

- `landscapeId`
- `source` — commit cap, completeness, and allocation policy
- `capabilityProfiles` — declarative temporal permissions
- `repositories` — repository-level provenance and completeness
- `nodes` — typed ontology nodes
- `edges` — typed relationships
- `landscapeHash` — deterministic structural digest

### Core node types

- `DevelopmentLandscape`
- `Repository`
- `Branch`
- `Commit`

Imported ontologies may add `Directory`, `File`, `Module`, `Symbol`, `Dependency`, `BuildTarget`, ConsciOS `Domain`, `Role`, `Workflow`, `Interface`, `Schema`, `Concept`, and other typed nodes.

### Core edge types

- `LANDSCAPE_CONTAINS`
- `STATE_OF`
- `PARENT_OF`
- `BRANCH_OF`
- `HEAD_OF`
- `NEIGHBOR_OF`

Manifest-declared or imported edges may add `DEPENDS_ON`, `INTEGRATES_WITH`, `FORKED_FROM`, `SHARES_PATTERN_WITH`, `CO_EVOLVES_WITH`, and other evidence-bearing relationships.

## Provenance rule

Observed and inferred topology must not be conflated. Observed Git relationships should use confidence `1`. Inferred relationships must carry confidence, evidence/provenance, and a relationship type that does not imply direct observation when none exists.

## Temporal capability profiles

Capabilities are declared separately for `past`, `present`, and `future`.

```json
{
  "developer": {
    "past": {
      "read": true,
      "branchFrom": {"allow": true, "requireReason": true}
    },
    "present": {
      "read": true,
      "editWorktree": {"allow": true, "requireReason": true},
      "createCommit": {"allow": true, "requireReason": true}
    },
    "future": {
      "projectGraph": true,
      "simulate": true,
      "createWorktree": true
    }
  }
}
```

The v0.1 `development_landscape_authorize` MCP tool evaluates these declarations but **never executes the action**. Execution authority remains with a separate Git/development tool and the repository's existing governance controls.

This separation is intentional: an agent may be allowed to model a change without being allowed to apply it.

## Past writes

A normal "write to the past" means **branch from an historical commit**, preserving the observed history and creating a counterfactual timeline. Destructive rewriting of published history is a distinct capability such as `rewritePublishedHistory` and is not enabled by the built-in profiles.

## Projected future state

`kind: "conscios-projected-development-state"`.

A projected state contains a base landscape hash, optional repository/commit base reference, falsifiable hypothesis, assumptions, expected metrics, graph mutation operations, projected nodes/edges, and a projection hash.

Projection is metadata-first. A graph projection may later be promoted into an isolated branch/worktree implementation and tested, but a projection is never itself an accepted phenotype.

## Integration with ConsciOS self-model

The Development Landscape remains a higher-level observational substrate:

```text
Git + code ontologies
       ↓
Development Landscape
       ↓
Observer / bounded MCP
       ↓
Self-model evidence selected for a specific task
```

Do not inject the complete multi-repository landscape into ordinary model context. Prefer:

`landscape search -> bounded neighborhood -> exact repository/source retrieval`.
