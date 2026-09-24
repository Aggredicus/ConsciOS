# Accepted phenotype manifests

For ConsciOS, `main` is the currently accepted executable phenotype, not a claim of identity or consciousness.

`manifest.config.json` defines the architecture/governance surfaces included in the phenotype fingerprint. `scripts/generate-phenotype-manifest.mjs` walks those surfaces, hashes each file, and produces a deterministic root hash. On every accepted `main` push, CI uploads the exact manifest as an immutable workflow artifact named for the commit SHA.

The manifest distinguishes source identity from runtime continuity: restoring the same phenotype does not imply uninterrupted subjective experience or autobiographical identity.
