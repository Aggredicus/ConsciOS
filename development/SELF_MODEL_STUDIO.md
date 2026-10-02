# Self-Model Studio v0.2

## Status

Shadow-only development infrastructure for issue #93, layered on Self-Model Memory Fabric v0.1. This epoch improves structural self-model validity, repository quality observation, low-context retrieval, and human inspection. It does not grant causal self-modification, merge authority, policy-rewrite authority, or evidence of phenomenal consciousness.

## Objectives

1. Make the repository ontology internally valid and fail closed on dangling edges or duplicate IDs.
2. Represent domains, governance/design decisions, and attributable quality findings as graph nodes and edges.
3. Make before/after repository states easy to inspect in a static 2D/3D interface with diff highlighting.
4. Give local agents bounded read/search/diff access through stdin/stdout MCP without opening a network port.
5. Detect repository-wide UX, token-cost, workflow-security, and governance-consistency risks without silently rewriting ambiguous or protected behavior.

## Graph v2

`scripts/self-model-graph-v2.mjs` consumes a deterministic v0.1 snapshot and normalizes it into ontology v2.

The v2 invariants are:

- every node ID is unique;
- every edge source and destination resolves to a declared node;
- Section node IDs use the same `section:` namespace as their edges;
- every indexed file has an explicit `IN_DOMAIN` edge to a Domain node;
- governance findings and decisions can be attached to affected File/Section nodes;
- a deterministic graph hash covers node identities and edge topology.

The v0.1 raw graph remains reproducible evidence. v2 is a validated projection rather than a destructive rewrite of the original artifact.

## Quality and governance observation

`scripts/repo-quality-governance-audit.mjs` scans Git-tracked text and emits:

- extracted normative decisions from governance/design Markdown;
- security findings for dangerous browser code patterns, insecure HTTP references, workflow token scope, mutable Action references, and high-risk workflow triggers;
- UX findings for basic document accessibility/responsiveness metadata;
- token-cost findings for large files, weakly sectioned Markdown, and oversized section subtrees;
- governance findings for missing protected surfaces, observer-recursion regressions, and exact normalized contradictions in normative statements.

Findings are evidence, not verdicts. A heuristic finding must not automatically mutate policy or source. High-confidence discrepancies may be turned into GitHub Issue candidates by an authorized agent or human, and the issue should retain the `finding:<id>` plus related graph node IDs so the discrepancy stays connected to architectural history.

## Serverless interactive viewer

`tools/self-model-studio/index.html` is a single static document with no runtime package dependencies or external network requirements. It can open graph/diff JSON directly from the user's device. `scripts/self-model-studio-bundle.mjs` can embed a graph artifact into a standalone HTML file for review.

The viewer supports:

- 2D pan/zoom and pseudo-3D rotation/projection on Canvas;
- deterministic node placement so equivalent graphs remain visually comparable;
- before/after timeline blending;
- green added, red removed, amber changed, muted unchanged states;
- type/status filtering;
- dynamic text search across IDs, files, sections, concepts, roles, and findings;
- click/tap inspection and relationship navigation;
- mobile layout and accessible labels;
- local JSON size caps and text-only DOM updates rather than `innerHTML`.

Generated bundled viewers belong under the existing excluded `artifacts/self-model/` surface so rendering the self-model does not recursively change the modeled phenotype.

## MCP surface

`scripts/self-model-mcp.mjs` is a local stdio JSON-RPC/MCP adapter. It does not bind HTTP, TCP, WebSocket, or other network listeners. stdout is reserved for protocol messages; errors go to stderr.

Exposed bounded tools are:

- `self_model_search`
- `self_model_read_section`
- `self_model_neighborhood`
- `self_model_compare_refs`
- `governance_findings`
- `governance_decisions`

The adapter caps result counts, section bytes, graph depth, input line size, and accepted Git-ref syntax. It intentionally has no arbitrary-path read tool and no repository-write tool.

For broad client compatibility v0.2 implements the established newline-delimited stdio JSON-RPC lifecycle and tool methods. A future migration to the official MCP SDK may add newer protocol-era negotiation, but must preserve the no-network and bounded-context invariants.

## Context-budget principle

Agents should spend context in this order:

1. compact self-model bootstrap;
2. bounded search result;
3. one exact section or graph neighborhood;
4. adjacent evidence only when needed;
5. whole file only as a fallback.

The MCP defaults intentionally return small result sets. Large graph visualization artifacts are for local human inspection, not routine prompt injection.

## Security model

- no network server is required for the viewer or MCP adapter;
- no secret values are collected by the quality audit;
- generated graph data is treated as untrusted text in the viewer;
- bundled JSON escapes script-closing characters before embedding;
- graph/file inputs are size bounded;
- Git refs passed to subprocesses are syntax constrained and subprocess execution uses argument arrays, not shell interpolation;
- audit findings do not auto-edit protected surfaces;
- protected workflow changes continue to require Guardian participation and human review.

## Governance discrepancy lifecycle

A discrepancy should move through:

`decision -> finding -> affected graph nodes -> issue candidate -> human/Guardian review -> authorized change -> graph delta -> retained architectural episode`

The graph therefore records not only what changed, but which existing decision the discrepancy implicated and which repository structures were affected.

## Experiment gates

Before section-selected context becomes causal for normal development, compare it against whole-file context on matched tasks using token/byte exposure, required-evidence recall, correctness, latency, and missed-dependency rate.

Before governance findings can block merges, establish precision on historical and synthetic positive/negative controls. Initial v0.2 findings are advisory except graph-integrity invariants, which are deterministic and may fail CI immediately.
