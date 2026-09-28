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

## API surface used

The initial provider intentionally depends only on exo's public HTTP API:

- `GET /state` for bounded cluster-status discovery;
- `GET /v1/models` for model discovery;
- `POST /v1/chat/completions` for text inference.

ConsciOS sends only context artifacts explicitly declared in the `CognitiveModel` request. There is no silent provider fallback. A failed or unavailable exo endpoint must remain an explicit failed provider state.

## Scientific interpretation

Provider portability is an engineering property. Different providers, models, quantizations, devices, and distributed topologies can produce different numerical and behavioral results. Successful distributed inference does not establish phenomenal consciousness.
