# Notebook Context Selection

Status: bounded Workbench context-selection candidate for the v0.5 platform-refactor epoch.

## Observation

AI cells historically had a binary choice: omit previous notebook outputs or include every previous result. The all-context path is simple and reproducible, but context grows monotonically with notebook length and unrelated outputs consume model context.

## Boundary

Context selection operates only on the explicit `previousCellResults(...)` array already visible to the Workbench. It does not search files, memory, hidden prompts, browser history, or connected services.

The selector produces `conscios-context-selection/v1` metadata and the AI request includes that metadata as a separate observation artifact. The selected previous-results artifact remains inspectable.

## Strategies

### relevant · bounded

New AI cells default to this strategy when the user enables **Include previous outputs**.

The selector:

1. tokenizes the visible AI prompt and each prior cell title/type/output;
2. computes deterministic BM25-style lexical relevance with a small title-match bonus;
3. uses recency only as a deterministic tie-breaker;
4. greedily packs ranked complete results under an explicit byte budget and item limit; and
5. restores notebook order before exposing selected results to the model.

No output is silently truncated. A result that cannot fit is omitted and counted in selection provenance.

### semantic-lite · experimental

Runs the same bounded relevance pipeline after expanding prompt terms through a small static synonym graph. The graph is stored directly in `context-selector.mjs`, requires no external service, and exposes both original and expanded terms in provenance.

Semantic-lite exists because the first diagnostic found lexical recall of **1.00** but paraphrase recall of **0.50**. It is deliberately opt-in while broader held-out and model-level tests are still missing.

### recent · bounded

Packs the most recent complete previous outputs first under the same byte/item limits. This is useful when lexical vocabulary is weak but local notebook continuity matters.

### all · legacy

Preserves the historical unbounded behavior. Imported/older AI cells without a `contextStrategy` field are interpreted as `all` so saved notebooks do not silently change semantics.

## Default budget

New AI cells declare:

- `contextStrategy: "relevant"`
- `maxContextBytes: 12000`
- `maxContextItems: 8`

The previous-output path remains opt-in: `includePrevious` defaults to false.

`semantic-lite` is not the default. Passing its synthetic diagnostic is insufficient for default promotion.

## Provenance

When previous outputs are included, the request carries a separate `context-selection` observation with:

- strategy and whether a budget was applied;
- configured byte and item limits;
- candidate, selected, and omitted counts;
- selected byte estimate;
- normalized query terms; and
- per-candidate rank metadata, matched terms, byte size, and selection disposition.

This metadata is also copied into the completed AI cell provenance.

## Scientific limitation

Lexical similarity is not semantic understanding. A BM25-style selector can miss synonym-heavy or conceptually related evidence whose vocabulary differs from the prompt. This implementation therefore remains an explicit Workbench strategy rather than becoming a repository-wide default retrieval system.

Issue #103 remains the appropriate broader experiment for body-aware semantic/lexical repository context routing. The notebook selector provides a smaller controlled substrate and measurements for that work.

## Next measurements

Useful follow-up comparisons should hold model/provider and response budget constant and measure:

- task correctness;
- expected-result recall;
- input/context bytes;
- inference latency;
- irrelevant-context rate;
- omission failures;
- all-context vs relevant vs recent behavior; and
- robustness to synonym/paraphrase prompts.

A smaller context is useful only if the evidence needed for the task remains available.
