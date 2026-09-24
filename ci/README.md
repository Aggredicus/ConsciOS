# Role-aware CI routing

`subsystems.json` maps conceptual development roles to fast verifier scripts. `scripts/run-subsystem-ci.mjs` determines directly changed owners, expands to one-hop declared communication neighbors, and runs the deduplicated verifier set.

This fast path does **not** replace the full repository regression suite. It makes the immediate feedback topology mirror the cognitive/development topology while the existing independent workflows remain the final integration net.
