# Development Landscape v0.1 — Temporal Repository Ecosystem

## Status

Shadow-only development infrastructure. This epoch adds a multi-repository temporal ontology, counterfactual projection format, and agent-readable capability policy. It does not grant autonomous merge authority, protected-path authority, or destructive Git-history rewriting.

## Hypothesis

AI development agents should make better, more reusable, and more scientifically testable decisions when they can reason about a repository in the context of:

1. its own historical topology;
2. neighboring repositories in the developer's ecosystem;
3. explicit observed versus inferred relationships;
4. alternative projected future states;
5. declared temporal capabilities that distinguish modeling authority from execution authority.

## Development landscape

A repository is represented as one member of a larger temporal ecosystem:

```text
                         projected futures
                       A       B       C
                        \      |      /
                         \     |     /
PAST ------------------- PRESENT ---------------- FUTURE
  \                         |
   commits / branches       repository:self
                             |
                     developer landscape
                    /        |         \
              sibling     dependency   integration
```

The hosting repository uses role `self`. Other repositories are neighbors, not autobiographical self-state. This prevents a connected GitHub account from being mistaken for one repository's own identity.

## Time semantics

### Past

Past state is observed Git evidence. It is immutable as evidence.

A normal write operation targeted at the past creates a new branch or worktree rooted at the historical commit. It does not rewrite the observed timeline.

### Present

Present state is the currently accepted/checked-out development state. Normal development operations can be authorized by capability profile and remain subject to repository governance.

### Future

Future state is explicitly hypothetical. Agents may construct graph-only projections, simulations, branches, or worktrees without implying acceptance.

This allows broader authority over **possible futures** than over accepted reality.

## v0.1 implementation

### `scripts/development-landscape.mjs`

Provides:

- balanced multi-repository commit ingestion under a global cap;
- commit parent topology;
- branch tips;
- repository-neighbor relationships;
- optional import of structural ontologies, including `4d-codebase-graph` and ConsciOS self-model graphs;
- provenance and completeness metadata;
- deterministic verification;
- declarative past/present/future capability profiles;
- capability authorization checks;
- metadata-only projected future states.

Example:

```bash
node scripts/development-landscape.mjs build \
  --manifest development/development-landscape.example.json \
  --commit-cap 10000 \
  --out artifacts/development-landscape/current.json
```

For a GitHub-owner snapshot produced by `4d-codebase-graph`:

```bash
node scripts/development-landscape.mjs import-4d \
  --input codebase-ontology.json \
  --self-repo Aggredicus/ConsciOS \
  --out artifacts/development-landscape/current.json
```

### `scripts/development-landscape-mcp.mjs`

Read-only stdio MCP surface:

- `development_landscape_summary`
- `development_landscape_search`
- `development_landscape_neighborhood`
- `development_landscape_authorize`

It contains no network listener and no Git write operation.

## 4d-codebase-graph relationship

`4d-codebase-graph` remains the portable collector/viewer skill. ConsciOS treats its ontology as an interchange source rather than replacing the existing deterministic self-model ontology.

A repository entry may provide `ontologyPath` pointing to either:

- a `4d-codebase-graph` ontology (`nodes`, `edges` with `source`/`target`), or
- a ConsciOS self-model graph (`nodes`, `edges` with `from`/`to`).

Imported node IDs are namespaced by repository. The repository node itself is unified with the landscape repository identity.

## Self-Model Studio integration path

Self-Model Studio v0.4 should become a view over the same landscape rather than a separate graph format.

Planned views:

- `Self` — existing ConsciOS self-model;
- `Ecosystem` — multi-repository landscape;
- `History` — past commit topology;
- `Projection` — A/B future states;
- `Diff` — actual or projected structural changes.

The browser Agent API should manipulate camera/playback/selection state while MCP remains the semantic/query interface.

## Counterfactual development ladder

Prefer the cheapest experiment capable of falsifying the hypothesis:

```text
graph-only projection
  -> interface simulation
  -> synthetic patch
  -> isolated branch/worktree
  -> unit/integration tests
  -> agent simulation
  -> A/B experiment
  -> review
  -> candidate merge
```

No later stage is implied by success at an earlier stage.

## Topological quality testing

Future experiments can evaluate architectural change as a time series, including:

- dependency cycles;
- cross-domain coupling;
- ownership-boundary violations;
- duplicate capability emergence;
- module centrality/bottlenecks;
- repository extraction/consolidation candidates;
- communication-graph versus dependency-graph similarity;
- longitudinal Inverse Conway alignment;
- quality metrics across projected A/B futures.

The Observer should record these metrics without selecting an architectural winner in advance.

## Scientific safeguards

1. Every projected state is labeled hypothetical.
2. Imported repository history records completeness/truncation.
3. A global commit cap must never be presented as exhaustive history when truncation occurred.
4. Inferred cross-repository relationships carry confidence and evidence.
5. Full source code is not required in the landscape artifact.
6. Generated landscape artifacts remain observational evidence, not protected genome state.
7. Capability authorization is advisory until an independently governed execution adapter consumes it.

## Acceptance criteria

v0.1 is successful when:

- at least two Git repositories can be represented in one verified artifact;
- a global commit cap is honored and completeness is explicit;
- commit parent edges replay without dangling references;
- repository-neighbor edges are attributable;
- imported ontology nodes are namespaced and do not collide;
- temporal capability checks are deterministic;
- a projected future can be generated without mutating a repository;
- the MCP exposes bounded landscape access and contains no write or network-listener primitive;
- existing ConsciOS self-model and governance behavior remains unchanged.


## Deployment-ready bootstrap

### Self-only local mode

```bash
node scripts/development-landscape.mjs build
```

This succeeds on a normal ConsciOS checkout without any external repository.

### Local multi-repository mode

```bash
node scripts/development-landscape.mjs build \
  --manifest development/development-landscape.example.json \
  --commit-cap 10000
```

Local mode uses `git log --all` and records `localPath` so the separately governed temporal Git adapter can operate on repositories that are actually cloned.

### GitHub-owner mode

```bash
node scripts/development-landscape-github.mjs \
  --owner YOUR_GITHUB_LOGIN \
  --self-repo YOUR_GITHUB_LOGIN/ConsciOS \
  --commit-cap 10000
```

Without a token this discovers public owned repositories. When `GITHUB_TOKEN` is present, owned private repositories are also available subject to token permissions. The token is read from the process environment and is never written to the artifact.

GitHub mode uses a balanced round-robin history sampler and labels its history scope `default-branch`. It must not be described as complete all-ref Git history. Local mode remains the authoritative path for `--all` ref history.

## Governed temporal Git execution

`scripts/development-landscape-git.mjs` and its stdio MCP expose:

- status;
- bounded file reads at historical or present refs;
- capability checks;
- creation of non-protected branches;
- counterfactual worktrees rooted at historical refs;
- bounded UTF-8 file writes in non-protected worktrees;
- commits of already-staged changes.

Mutation requires `CONSCIOS_DEVELOPMENT_WRITE_ENABLE=1`.

The adapter does not expose force push, rebase, reset, branch deletion, merge, or protected-default-branch writes. File writes reject traversal and symlink escapes. Counterfactual worktrees are created under the ignored `.runtime/worktrees/` surface.

This makes temporal authority executable while retaining the distinction:

```text
permission to model
    !=
permission to mutate a worktree
    !=
permission to merge accepted reality
```

## Topological quality gates

`scripts/development-landscape-quality.mjs` provides deterministic metrics for both observed and projected landscapes:

- dependency cycles;
- cross-repository edges;
- low-confidence edges;
- orphan nodes;
- maximum graph degree / bottleneck;
- repository coupling;
- node and edge type counts.

A policy can reject a candidate projection when a metric regresses beyond an allowed delta. The example policy is intentionally conservative and is a starting point, not a universal architectural truth.

## Studio and agent control

Self-Model Studio accepts canonical Development Landscape artifacts directly. Multi-repository nodes are spatially clustered and repository-filterable.

The browser exposes:

```js
ConsciOSStudio.listActions()
ConsciOSStudio.getState()
ConsciOSStudio.command(action, params)
```

and the compatibility alias:

```js
Codebase4D.command(action, params)
```

Supported command classes include repository focus, node selection, search, 2D/3D/4D mode selection, fit-view, and temporal playback control when a ConsciOS temporal-history artifact is loaded. The same interface is available to an embedding parent through `CONSCIOS_STUDIO_COMMAND` / `CONSCIOS_STUDIO_RESPONSE` messages.
