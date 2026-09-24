# Development communication artifacts

ConsciOS development roles should exchange durable, inspectable artifacts instead of unrestricted hidden shared context.

- `handoffs/` — typed producer → consumer transfers conforming to `schemas/development-handoff.schema.json`.
- `context-manifests/` — exact file/context sets exposed to a development role, conforming to `schemas/agent-context-manifest.schema.json`.
- `examples/` — non-authoritative fixtures used by CI and documentation.

A handoff records provenance and epistemic status; it does not grant write authority. A context expansion must name the additional artifact and a reason. Broad "give me the whole repository" expansion is intentionally not representable by the context builder.
