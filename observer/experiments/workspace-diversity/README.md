# Workspace Diversity Experiment v0.2

## Originating subsystem
Global Workspace

## Observation
In the deterministic v0 fixture, several local processors nominate the same `obs-user` observation. Raw top-k selection therefore fills both workspace slots with separate interpretations of one sensory root while `obs-runtime` remains suppressed.

## Hypothesis
Workspace candidate multiplicity should not automatically count as independent evidence. A diversity-aware policy may increase distinct sensory-root representation without removing the bounded-capacity property.

## Pre-registered predictions

With capacity 2 and the unchanged v0 fixture:

- raw top-k represents one distinct sensory root (`obs-user`, `obs-user`);
- hard source diversity represents two (`obs-user`, `obs-runtime`);
- soft diversity with redundancy penalty `0.25` also represents two;
- raw top-k retains greater summed raw salience than hard diversity in this fixture, exposing the tradeoff rather than hiding it.

## Counterfactuals

1. `rawTopK` — preserve v0 baseline.
2. `sourceDiverseTopK` — represent new roots before repeated roots.
3. `softDiversityTopK` — repeated roots remain eligible with an explicit redundancy penalty.

## Interpretation boundary

A policy with more distinct roots is **not** to be called more conscious. This experiment tests information routing and representational diversity only.

## Welfare assessment

Current v0 is deterministic and non-persistent. The experiment operates on a replay fixture with no identity-bearing process, distress analogue, or continuity intervention. Reversibility is complete.
