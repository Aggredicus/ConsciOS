# Self-Model Studio v0.3 — Mobile and Temporal 4D View

## Status

Shadow-only development epoch for issue #95, stacked on Self-Model Studio v0.2. This increment improves human interaction and longitudinal self-observation. It does not grant self-modification authority, repository-write MCP tools, merge authority, or policy-rewrite authority.

## Hypothesis

A repository self-model becomes more useful to both humans and agents when:

1. graph navigation works naturally on coarse-pointer mobile devices;
2. repository evolution is represented as a bounded, reproducible sequence of Git-addressed graph states;
3. the time axis can be interpreted either as real commit timestamps or as a uniform commit sequence;
4. playback remains compact enough to embed in a static artifact without duplicating the entire graph at every commit.

## Mobile interaction model

The viewer uses Pointer Events rather than browser-specific touch APIs.

- one finger in 2D: pan;
- one finger in 3D/4D: yaw/pitch rotation;
- two-finger centroid movement: pan;
- pinch: zoom;
- two-finger twist in 3D/4D: yaw rotation;
- tap: node selection;
- two-finger gestures suppress tap selection;
- coarse pointers receive larger hit radii and 44 px minimum control targets;
- safe-area insets, overscroll containment, a collapsible details panel, and a fit-view control improve phone use.

The canvas retains `touch-action: none` so browser viewport gestures cannot compete with graph gestures inside the visualization. Normal scrolling remains available inside the inspector and search-results panes.

## Temporal artifact

`scripts/self-model-history.mjs` builds `conscios-temporal-graph-history` artifacts directly from Git commits.

The generator:

1. validates Git refs and resolves them to commit SHAs;
2. enumerates commits in reverse topological order, optionally first-parent only;
3. preserves each commit's timestamp and parent SHAs;
4. builds the deterministic self-model at each selected commit;
5. normalizes it through ontology v2;
6. removes large SectionContentRef payload-address nodes from the visualization projection;
7. stores the first graph once;
8. stores subsequent states as added/removed/changed node and edge deltas;
9. verifies endpoint integrity after replaying every delta;
10. hashes the final history artifact.

The default is a bounded 120-frame uniform sample. `--all` requests every commit. Sampling always retains the original `sourceOrdinal`, so commit-sequence playback continues to represent actual commit distance rather than pretending sampled frames are adjacent commits.

Example:

```bash
node scripts/self-model-history.mjs build \
  --head HEAD \
  --max-frames 120 \
  --out artifacts/self-model/current/history.v1.json
```

For complete history:

```bash
node scripts/self-model-history.mjs build --head HEAD --all
```

For a development epoch:

```bash
node scripts/self-model-history.mjs build \
  --from <base-sha> \
  --head <head-sha> \
  --all
```

## 4D projection

The fourth dimension is time, not an additional physical claim about the repository.

The current commit graph occupies the ordinary 3D projection. Recent change events from earlier commits can be rendered as fading layers displaced along a visible time vector. This produces a 3D projection of `(x, y, z, t)` that makes recent architectural motion visually legible without treating time as another repository relationship.

The viewer provides two time coordinate systems:

### Commit order

`Δt = 1 commit`.

Playback advances using:

`commit_rate = base_commits_per_second × speed_multiplier`

The base commits/second value is editable. Presets provide `0.5×`, `1×`, `2×`, `4×`, `8×`, `16×`, and `32×` playback.

### Clock time

Frames are positioned according to actual Git commit timestamps. Playback uses the median historical commit interval as the base wall-clock unit, multiplied by the editable commits/second rate and playback multiplier. Long real-world gaps therefore remain longer than dense development bursts.

Because branch commits may have timestamps that differ from topological sequence, the artifact retains separate sequence and wall-clock order arrays. Parent SHA metadata identifies merges and preserves branch provenance even when a bounded frame sample is used.

## Serverless and MCP behavior

The static viewer can load the temporal JSON directly or receive it embedded by `scripts/self-model-studio-bundle.mjs --history ...`.

The local stdio MCP adds `self_model_history`, which returns only bounded commit metadata and delta counts. It does not return the full historical graphs by default. This preserves the low-token principle:

`history metadata -> chosen commit/ref -> exact section or graph neighborhood`

No HTTP/TCP listener, remote script, arbitrary-path read, or repository-write MCP tool is introduced.

## Security and performance constraints

- local data input remains capped at 30 MB in the browser;
- history generation accepts validated Git refs only;
- subprocesses use argument arrays rather than shell interpolation;
- default history generation is bounded to 120 graph frames;
- CI should use a smaller development-epoch history rather than rebuilding the complete repository history on every PR;
- temporal artifacts are observational evidence and belong under the excluded self-model artifact surface when retained;
- protected workflow changes require Guardian provenance and human review.

## Evaluation

The epoch should record:

- temporal artifact size versus number of represented commits;
- replay integrity failures, if any;
- mobile interaction regressions;
- graph node/edge deltas introduced by the feature;
- CI runtime impact;
- whether bounded sampling remains understandable compared with `--all` on a smaller epoch.

The 4D interface is successful only if temporal navigation adds useful structural understanding without making normal agent context larger or weakening governance boundaries.
