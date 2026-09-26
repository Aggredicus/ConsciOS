# Cortical worker laboratory v1

This directory contains the first isolated-runtime experiment for the Cortical Ecology Prototype (CEP-3 / issue #33).

## Scope

The laboratory isolates four roles in independent Worker realms:

- `Sensorium` — creates the frozen v0 observations and may emit them only through phenotype-bound envelopes toward the cortex.
- `GlobalWorkspace` — accepts validated candidate envelopes, performs the existing bounded top-k competition, and returns admitted broadcasts plus suppressed candidate IDs.
- `WorldModel` — accepts admitted `workspace.broadcast` envelopes only.
- `SelfModel` — accepts admitted `workspace.broadcast` envelopes only.

The Executive laboratory host currently performs the existing deterministic local candidate construction between Sensorium and Workspace. That bridge is explicit technical debt, not a claim that CEP-3 fully distributes the cognitive graph.

## Isolation rules

1. Workers communicate through `postMessage` only. No shared mutable cognition state is provided.
2. Initial workers do not use `SharedArrayBuffer`.
3. `fetch`, `WebSocket`, `EventSource`, and `XMLHttpRequest` are disabled in each worker realm by the shared endpoint before requests are handled.
4. Every worker recompiles the supplied shadow regulatory program and verifies the expected runtime phenotype hash before accepting cognitive work.
5. Cognitive messages use `CognitiveEnvelopeV1` and fail closed on phenotype, role/domain, epistemic-authority, causal-parent, capability, schema, TTL, or byte-budget violations.
6. World/Self workers reject raw observations, candidates, and suppression context even if the host attempts to include those fields.
7. Worker errors are returned explicitly to the host. The host does not synthesize a successful cognitive result after a worker rejection or non-zero exit.
8. All workers are terminated after each laboratory run.

## Authority boundary

This laboratory has `causalAuthority: none`. Its outputs are experimental evidence only and are not consumed by the accepted scheduler, Guardian, Executive action selection, Expression, persistence, provider routing, or external actuators.

The root browser application remains unchanged. Promotion to an accepted runtime requires later CEP gates, independent audit, explicit human authorization, and resolution of Gate 0 governance enforcement.

## Verification

`observer/experiments/cortical-ecology-v1/verify-workers.mjs` uses real Node worker threads to exercise the same worker entry modules. It checks exact deterministic parity with the accepted v0 prefix, repeated-run trace equivalence, a suppressed secret sentinel, forged phenotype rejection, undeclared-context rejection, wrong-phenotype configuration rejection, and static role-import/network/shared-memory constraints.

Passing these tests demonstrates the tested functional/runtime boundaries. It does not establish phenomenal consciousness or constitute a general security proof.
