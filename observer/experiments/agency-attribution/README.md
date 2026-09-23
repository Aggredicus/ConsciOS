# v1.2 Causal Self-Recognition / Agency Attribution Experiment

## Hypothesis

ConsciOS can distinguish a transition caused by its own Executive action from a superficially similar external transition by using causal provenance and pre-action prediction rather than human-readable labels.

## Method

The Self Model owns two pure operations:

1. create a predicted effect from the Executive-selected action;
2. attribute an observed transition as `self-caused`, `externally-caused`, or `ambiguous`.

Attribution uses:

- direct causal parent IDs belonging to trusted self-action or external-action cause sets;
- presence of the predicted Executive causal parent;
- agreement between predicted and observed effect type/target.

A field such as `metadata.claimedCause = "self-caused"` is retained for audit but explicitly ignored as evidence.

## Boundary

The initial laboratory is Observer-owned and has `causalAuthority: none`. Attribution does not modify Self Model state, Executive policy, autobiography, or Expression.

## Interpretation

Accurate agency attribution is a functional self-model property. It is not evidence of phenomenal selfhood, ownership experience, or consciousness.
