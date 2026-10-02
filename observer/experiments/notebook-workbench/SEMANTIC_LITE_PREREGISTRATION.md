# Semantic-lite Notebook Context Candidate — preregistration

Status: preregistered shadow/opt-in candidate following the negative paraphrase result in PR #114.

## Triggering observation

The v0.5 notebook-context benchmark measured:

- lexical relevant recall: **1.00**;
- paraphrase relevant recall: **0.50**;
- recent-only recall: **0.00**;
- all-context recall: **1.00**;
- overall relevant byte reduction versus all-context: **57.3%**.

The lexical selector therefore preserved the narrow vocabulary-aligned claim but left a substantial paraphrase gap.

## Candidate

Add a new opt-in `semantic-lite` strategy. It may expand prompt terms through a small, static, inspectable synonym graph before running the existing BM25-style ranking and bounded packing.

The candidate must:

- remain deterministic;
- require no model call, embedding service, vector database, or hidden index;
- expose original and expanded query terms in provenance;
- preserve the same byte/item budget semantics as `relevant`;
- leave `relevant` as the default for new AI cells during this PR;
- preserve `all` and `recent` controls.

## Holdout-style diagnostic

Four new paraphrase tasks will use candidate sets distinct from the PR #114 benchmark. They cover:

1. soil/watering terminology;
2. accelerator/graphics-load terminology;
3. mobile/viewport-overflow terminology;
4. memory/session-restart terminology.

The expected result will not be among the two most recent candidates.

This is still a synthetic, author-created diagnostic, not an independent external corpus.

## Fixed acceptance criteria

At 520 bytes and max 2 selected items:

1. `semantic-lite` expected-result recall >= **0.75**;
2. `semantic-lite` recall > plain `relevant` recall on the new paraphrase tasks;
3. every `semantic-lite` selection stays <= **520 bytes** and <= **2 items**;
4. mean `semantic-lite` selected bytes are >= **40% lower** than `all`;
5. `all` expected-result recall remains **1.00**;
6. existing lexical/relevant benchmark criteria remain unchanged and green.

## Non-promotion rule

Passing this diagnostic permits merging `semantic-lite` only as an **experimental opt-in strategy**. It does not justify making synonym expansion the default. Default promotion requires broader held-out tasks and, eventually, model/provider-matched answer-quality measurements.

## Stop conditions

Do not merge the candidate if it:

- changes existing `relevant`, `recent`, or `all` outputs on their current tests;
- violates byte/item budgets;
- introduces external/hidden retrieval;
- makes provenance less inspectable; or
- requires tuning the acceptance criteria after CI results are observed.
