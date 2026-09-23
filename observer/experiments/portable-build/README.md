# v0.5 Portable Modular Build Experiment

## Hypothesis
Deployment compactness and Inverse Conway source modularity can coexist. A deterministic zero-dependency builder should be able to package the role-owned module graph into one browser HTML file without changing cognition.

## Method

- `runtime/portable-build-manifest.json` is the explicit packaging graph.
- `scripts/build-portable.mjs` reads the real cognitive/runtime source files.
- Relative imports are rewritten only at build time to stable `@conscios/*` import-map IDs.
- Transformed modules are embedded as base64 `data:` module URLs.
- The modular browser HTML becomes a single-file artifact with an inline import map and bootstrap.
- A SHA-256 source digest binds the artifact to the manifest and source texts.
- CI builds twice to verify byte-for-byte reproducibility and publishes the generated HTML as a workflow artifact.

## Boundaries

The generated HTML is deployment output, not source-of-truth and not a new cognitive architecture. Root `index.html` remains the original v0 control phenotype. No network access, model provider, persistence, actuator, or phenomenology claim is added.
