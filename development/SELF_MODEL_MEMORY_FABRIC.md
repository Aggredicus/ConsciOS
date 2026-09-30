# Self-Model Memory Fabric v0.1

## Status

Shadow-only development infrastructure for issue #91. This subsystem provides deterministic repository indexing, exact section retrieval, architectural graph material, and graph deltas. It does not authorize runtime self-modification or make claims about phenomenal consciousness.

## Design objective

Treat the Git repository as durable, attributable development memory while minimizing model context. Structural knowledge should be computed without model tokens whenever possible. Semantic model calls, when introduced later, should operate only on changed or ambiguous graph regions.

## Memory hierarchy

1. **Bootstrap** — `SELF_MODEL.md` is a compact orientation surface.
2. **File index** — path, kind, owner/domain when deterministically available, byte/line counts, and content hash.
3. **Section index** — Markdown heading hierarchy with stable section ID, exact line ranges, content hashes, and optional ConsciOS metadata.
4. **Concept index** — deterministic concept nodes derived from headings and explicit metadata.
5. **Ontology** — typed repository/file/section/content-reference/concept/role nodes and edges.
6. **Architectural delta** — added, removed, renamed, or changed files and sections between Git refs.
7. **Future episodic memory** — retained snapshots plus the event/reason that caused each meaningful state transition.

Generated artifacts are excluded from source indexing so observation does not recursively change the observed repository model.

## Section identity and line ranges

A Markdown section has a stable address of the form:

```text
path/to/file.md::parent-heading/child-heading
```

Duplicate sibling headings receive a deterministic `~2`, `~3`, ... suffix. An explicit ID may be declared directly above a heading:

```markdown
<!-- conscios:
id: self-model.accuracy
domain: association
role: SelfModel
concepts: self-model, metacognition, calibration
-->
### Self Model Accuracy
```

The index stores both:

- `ownEndLine`: the line before the next heading of any level; this matches a minimal “cat this section” retrieval.
- `subtreeEndLine`: the line before the next heading of equal or higher level; this retrieves a section plus its child sections.

Line numbers are a fast cache, not identity. The retriever reparses the requested Git ref/worktree, resolves the section ID, materializes the exact range, and verifies its SHA-256 hash. If a persisted index is stale, retrieval fails closed and instructs the agent to rebuild it.

## Virtual content nodes

The persistent graph contains `SectionContentRef` nodes rather than duplicating source text. A content node stores a hash, byte count, and resolver. `self-model-memory.mjs read` materializes a transient `SectionMaterialization` containing the exact source string when an agent actually needs it.

This preserves the requested file → section → content-node ontology without storing a second copy of the repository inside its own memory index.

## Low-token agent protocol

Agents should follow this sequence before opening a large document:

1. Read the compact self-model bootstrap.
2. Search the persisted JSONL directly with `rg` when convenient, or run `node scripts/self-model-memory.mjs search "<concept>"`. The CLI uses `artifacts/self-model/current` when present and falls back to a deterministic worktree build.
3. Select the smallest relevant stable section ID.
4. Run `node scripts/self-model-memory.mjs read '<section-id>'`.
5. Use `--mode subtree` only if child sections are needed.
6. Expand to neighboring sections or the whole file only when evidence is insufficient.
7. Preserve section ID, Git ref, path, line range, and hash for material evidence used in a proposed change.

The accepted whole-file context builder remains unchanged in v0.1. Section selection is therefore advisory/shadow-only until Gate 3 context-selection evidence and governance permit a causal change.

## Commands

```bash
# Build a persistent current snapshot
node scripts/self-model-memory.mjs build --out artifacts/self-model/current

# Search headings/concepts without embeddings
node scripts/self-model-memory.mjs search "self model accuracy"

# Retrieve only one section
node scripts/self-model-memory.mjs read 'ARCHITECTURE.md::architecture/self-model'

# Retrieve a section and all children
node scripts/self-model-memory.mjs read 'ARCHITECTURE.md::architecture/self-model' --mode subtree

# Read the same stable section at an older Git ref
node scripts/self-model-memory.mjs read 'ARCHITECTURE.md::architecture/self-model' --ref <sha>

# Capture before/after models and their structural delta
node scripts/self-model-memory.mjs snapshot --base <sha> --head <sha> --out artifacts/self-model/snapshots/<event>

# Compare two repository states
node scripts/self-model-memory.mjs diff --base <sha> --head <sha>

# Reproducibility / exact-range verification
node scripts/self-model-memory.mjs verify
```

## Snapshot triggers for later gated automation

A future persistence workflow should retain snapshots for:

- PR base and PR head;
- immediately pre-merge and post-merge;
- release/tag and rollback/revert;
- file add/delete/rename/move;
- section add/delete/move or explicit stable-ID change;
- ownership or information-boundary changes;
- public interface/schema/workflow changes;
- agent-role, skill, or communication-topology changes;
- dependency-boundary changes;
- large graph-topology deltas such as a new cycle or high-centrality node.

Ordinary formatting, comments, and local-variable-only edits need not create permanent architectural episodes unless they change an indexed section hash intentionally selected for retention.

## Future semantic layer

The deterministic graph should remain the source of structural truth. A later bounded semantic pass may summarize only changed sections or graph neighborhoods and cache the result by content hash. Unchanged content must never be summarized again merely because a new agent session begins.

A target cost model is therefore proportional to changed semantic regions rather than total repository size.

## Governance boundary

Fast cognition or an external coding model may inspect this fabric and propose modifications. It may not use the fabric to rewrite protected genome/regulation, Guardian/auditor invariants, grant itself permissions, authorize promotion, or merge its own changes. Existing role ownership, typed handoffs, CI, audits, and human authorization remain authoritative.
