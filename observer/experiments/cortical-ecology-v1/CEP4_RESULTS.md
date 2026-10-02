# CEP-4 result record

## Run identity

This record summarizes the first GitHub role-aware execution of the preregistered CEP-4 excitation/inhibition shadow experiment. No frozen parameter, seed range, fixture, threshold, or hypothesis was changed after the preregistration and before this result.

## Accepted v0 candidate ecology

Capacity remained 2.

### Excitation-only

- admitted: `cand-NoveltyProcessor-obs-user`, `cand-RelevanceProcessor-obs-user`
- represented roots: `obs-user`, `obs-user`
- distinct roots: 1
- duplicate-root admissions: 1

### Structured same-root lateral inhibition

- admitted: `cand-NoveltyProcessor-obs-user`, `cand-NoveltyProcessor-obs-runtime`
- represented roots: `obs-user`, `obs-runtime`
- distinct roots: 2
- causally relevant fast-inhibition messages: 1
- total fast-inhibition magnitude: 0.25

### Matched randomized inhibition

The frozen deterministic seed range was 1–128. Every run used the same causally relevant fast-inhibition message count and magnitude as the structured condition, while randomizing the target.

- runs: 128
- duplicate-root runs: 108
- duplicate-root rate: 0.844
- full-diversity runs: 20
- full-diversity rate: 0.156

Under this fixture, structured targeting produced the preregistered full-diversity outcome while most matched randomized target assignments retained duplicate-root admission. This supports the limited functional claim that *where* the inhibition is targeted matters for this bounded admission problem; it does not establish biological equivalence or general cognitive superiority.

## Contextual contradiction/support fixture

Excitation-only admitted the two preregistered high-salience adversaries:

- `contradicted-hot`
- `unsupported-hot`

Contextual inhibition explicitly hard-gated both and admitted:

- `supported-a`
- `supported-b`

The rejected candidates remain visible in gate/inhibition artifacts rather than disappearing from the trace.

## Bounded-disinhibition fixture

Without disinhibition, contextual inhibition admitted:

- `anchor`
- `steady-alternative`

With bounded disinhibition, the policy admitted:

- `anchor`
- `urgent-repeat`

The valid urgent repeat received the preregistered maximum release of 0.15. `contradicted-urgent` remained hard-gated and received no disinhibition artifact, satisfying the preregistered non-bypass condition.

## Invariants

- accepted deterministic ConsciOS runtime output remained unchanged;
- candidate inputs were not mutated;
- fixed randomized seeds replayed exactly;
- candidate input order did not change the structured admitted outcome;
- no experimental result entered the accepted Workspace or any downstream causal runtime path;
- experiment causal authority remained `none`.

## Interpretation and next boundary

CEP-4 supplies positive evidence for continuing to study explicit inhibitory artifacts in shadow or controlled worker experiments. It does **not** authorize changing accepted Workspace behavior. Any promotion would require a separate preregistered comparison on broader fixtures, interaction testing with worker boundaries/support-plane signals, audit, and the unresolved Gate-0 governance prerequisite.
