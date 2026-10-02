# Development Landscape v0.1 verification

This experiment verifies the structural claims of the Development Landscape substrate without granting it production causal authority.

The verifier creates two temporary Git repositories and checks:

- multi-repository ingestion;
- global commit-cap enforcement;
- explicit truncation/completeness;
- parent topology;
- repository-neighbor relationships;
- temporal capability authorization with reason requirements;
- non-destructive future projection;
- MCP source syntax and no network-listener primitives.

Run:

```bash
node observer/experiments/development-landscape/verify.mjs
```
