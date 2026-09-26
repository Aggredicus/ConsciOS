# Accepted phenotype manifests

For ConsciOS, `main` is the currently accepted executable phenotype, not a claim of identity or consciousness.

`manifest.config.json` defines the architecture/governance surfaces included in the accepted **source phenotype** fingerprint. `scripts/generate-phenotype-manifest.mjs` walks those surfaces, hashes each file, and produces a deterministic root hash. On every accepted `main` push, CI uploads the exact manifest as an immutable workflow artifact named for the commit SHA.

The Cortical Ecology Prototype adds a separate **runtime phenotype** concept. `cortical-ecology-program.v1.json` is a reviewed, shadow-only regulatory program that can be compiled into a deterministic runtime phenotype hash describing active cognitive roles, logical domains, declared communication edges, capability contexts, provider permissions, and resource budgets. That runtime hash is carried by `CognitiveEnvelopeV1` messages so a future isolated host can reject messages produced for the wrong phenotype.

These identities have different purposes and must not be conflated:

- the accepted source phenotype root identifies the reviewed executable/governance source surfaces;
- the runtime phenotype hash identifies one compiled regulatory program used by an execution host;
- the current CEP-2 runtime phenotype has `causalAuthority: none` and is used only for post-hoc shadow validation;
- changing or compiling a runtime phenotype does not authorize it, merge it, or mutate the accepted `main` phenotype.

Both phenotype identities distinguish software/configuration identity from runtime continuity: restoring the same source or runtime phenotype does not imply uninterrupted subjective experience or autobiographical identity.
