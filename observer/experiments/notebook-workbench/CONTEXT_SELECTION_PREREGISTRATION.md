# Notebook Context Selection Benchmark — preregistration

Status: ObserverScientist diagnostic for the v0.5 platform-refactor epoch.

The production selector already exists when this benchmark is added. This is therefore a **post-implementation diagnostic/replication**, not a claim that the treatment was preregistered before design. Acceptance criteria below are fixed before CI is observed for this benchmark PR.

## Question

Can the bounded `relevant` notebook strategy recover clearly lexical-matched prior results while using materially fewer previous-output bytes than the legacy `all` strategy?

A second exploratory question asks how the same deterministic lexical selector behaves on paraphrase/synonym prompts whose vocabulary differs from the expected result.

## Conditions

Each task contains five prior notebook results and one expected result.

For each task, compare:

- `relevant`: BM25-style lexical ranking, 520-byte budget, max 2 items;
- `recent`: same budget/items, recency ordering only;
- `all`: legacy unbounded previous-output context.

The expected result is intentionally not among the two most recent candidates.

## Fixed primary criteria

The benchmark is considered technically healthy when all of these hold:

1. lexical-task `relevant` expected-result recall is **>= 0.75**;
2. lexical-task `relevant` recall is strictly greater than lexical-task `recent` recall;
3. every bounded `relevant` result stays at or below **520 bytes** and **2 items**;
4. mean `relevant` selected bytes are at least **40% lower** than `all`;
5. `all` retains expected-result recall of **1.0** as a control.

These criteria test the narrow lexical/budget claim only.

## Exploratory paraphrase condition

Four additional prompts describe the same target concepts using deliberately different vocabulary.

No pass threshold is assigned to paraphrase recall in this diagnostic. Low recall is retained as negative evidence rather than repaired inside the benchmark PR. If paraphrase recall is materially lower than lexical recall, a later candidate may test controlled synonym expansion or another deterministic semantic layer on a separate holdout set.

## Confound controls

- same candidate sets per strategy;
- same budget/item limit for the bounded strategies;
- no model calls;
- no embeddings or external retrieval;
- no hidden context;
- deterministic ordering and tie-breaking;
- expected IDs are declared in the fixture before CI output is inspected.

## Interpretation boundary

Reduced bytes are not sufficient evidence of better model performance. This benchmark measures retrieval availability and context cost, not downstream answer correctness. A future model/provider-matched experiment is required before promoting broader semantic retrieval defaults.
