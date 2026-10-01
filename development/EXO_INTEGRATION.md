# exo integration provenance

ConsciOS can use **exo** as an explicit distributed inference provider. exo supplies physical compute topology and model execution; ConsciOS retains cognitive-role topology, context selection, provenance, governance, and user-facing orchestration.

## Upstream source and license

- Upstream project: https://github.com/exo-explore/exo
- ConsciOS development copy: https://github.com/Aggredicus/exo
- Upstream baseline used for this integration: `21a54c5ea0230a3bec1e1a786d200126c7e34ec6`
- License: Apache License 2.0
- Upstream license notice: `Copyright 2025 Exo Technologies Ltd`

The exo license permits use, modification, and distribution subject to the Apache-2.0 terms. ConsciOS documentation and UI must not imply that Exo Technologies Ltd endorses ConsciOS. If exo source files are modified or redistributed, preserve the Apache-2.0 license and relevant notices and mark modified files as required by the license.

## Architectural boundary

```text
ConsciOS browser/workbench
        |
        v
InferenceProvider / CognitiveModel contract
        |
        +-- browser-local WebGPU/WASM
        |
        +-- exo provider ---- HTTP ----> exo cluster
        |
        +-- future explicit providers
```

exo is an **inference provider**, not a ConsciOS cognitive role. Connecting a node or cluster does not grant it GlobalWorkspace, Guardian, Executive, Expression, repository, credential, filesystem, or governance authority.

## Native exo application surface

`local/exo-dashboard/` is now an application shell around exo's **native dashboard**, not a reduced ConsciOS recreation. The app tabs route the embedded surface to exo's own pages:

- **Chat & Generate** → `/`
- **Downloads** → `/downloads`
- **Integrations** → `/integrations`
- **Traces** → `/traces`
- **Advanced** → `/advanced`
- **Acceptance Test** → ConsciOS-owned compatibility and inference gate

This keeps exo feature ownership upstream: when the native exo dashboard evolves, ConsciOS does not need to clone its controls. The default endpoint is `http://localhost:52415`; a query parameter such as `?endpoint=http://192.168.1.10:52415` can override it, and the last valid endpoint is persisted locally in the browser.

Browser security still applies. An HTTPS-hosted ConsciOS page cannot frame or fetch an HTTP exo endpoint because that is active mixed content. For the in-app experience, serve ConsciOS locally over HTTP on the trusted network or expose exo over HTTPS. The UI retains an **Open native exo** escape hatch rather than bypassing browser protections.

## API surface used

The provider and acceptance gate use exo's public HTTP API:

- `GET /node_id` for coordinator identity;
- `GET /state` for bounded cluster-status discovery;
- `GET /v1/feature-flags` to confirm the current integration-era API surface;
- `GET /v1/models` for model discovery;
- `GET /v1/models?status=downloaded` for acceptance-test model selection;
- `POST /v1/chat/completions` for text inference.

ConsciOS sends only context artifacts explicitly declared in the `CognitiveModel` request. There is no silent provider fallback. A failed or unavailable exo endpoint must remain an explicit failed provider state.

## Acceptance gate

The **Acceptance Test** tab is the runtime milestone for this integration. It runs five checks in order:

1. **Node identity** — `GET /node_id` returns a non-empty identity.
2. **Cluster state** — `GET /state` returns a JSON state object.
3. **Current API surface** — `GET /v1/feature-flags` succeeds.
4. **Downloaded model** — `GET /v1/models?status=downloaded` returns at least one model.
5. **Neural inference** — ConsciOS sends a small non-streaming request to `POST /v1/chat/completions` and receives non-empty assistant text.

The UI reports **PASS · exo is ready inside ConsciOS** only after all five checks succeed. A reachable HTTP server by itself is not a pass. If step 4 fails, use the native **Downloads** tab to download a small compatible model and rerun the test. The acceptance test does not silently download a model.

This gate intentionally validates the path the Workbench depends on: browser → exo HTTP API → downloaded model → actual model response. It does not claim that every model, accelerator, or multi-node topology has been exhaustively tested.

## Scientific interpretation

Provider portability is an engineering property. Different providers, models, quantizations, devices, and distributed topologies can produce different numerical and behavioral results. Successful distributed inference does not establish phenomenal consciousness.
