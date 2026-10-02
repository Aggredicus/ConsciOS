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

`local/exo-dashboard/` is an application shell around exo's **native dashboard**, not a reduced ConsciOS recreation. The visible app tabs expose exo's current dashboard areas:

- **Chat & Generate**
- **Downloads**
- **Integrations**
- **Traces**
- **Advanced**
- **Acceptance Test** — ConsciOS-owned runtime gate
- **Run exo** — local runtime onboarding

The exo dashboard uses SvelteKit hash routing, so ConsciOS maps the named tabs to exo's native `/#/...` routes while keeping API requests on normal HTTP paths.

This keeps exo feature ownership upstream: when the native exo dashboard evolves, ConsciOS does not need to recreate all of its controls.

## Runtime discovery and launching

The user should not need to invent an endpoint. ConsciOS uses the normal exo port, `52415`, and stores the last explicit runtime address in browser local storage.

The hosted GitHub Pages build is static and therefore **cannot spawn a native exo process, Docker daemon, or ML runtime**. It can connect to an already-running runtime only when browser local-network and mixed-content policy permits it.

For a reliable local experience, the repository includes:

```bash
node scripts/run-exo-local.mjs
```

The launcher:

1. verifies the documented exo prerequisites (`git`, Node/npm, `uv`, Rust + nightly toolchain; Xcode command-line tooling on macOS);
2. clones `Aggredicus/exo` into the ignored `.runtime/exo` directory when needed;
3. builds exo's native dashboard when needed;
4. installs the documented backend dependencies (`mlx` on macOS, `mlx-cpu` on Linux);
5. runs `uv run exo`;
6. serves the ConsciOS repository locally; and
7. prints a Workbench URL with the correct exo runtime address preselected.

For a phone or tablet on the same trusted Wi-Fi:

```bash
node scripts/run-exo-local.mjs --lan
```

LAN mode prints a URL containing the computer's detected private IPv4 address for both ConsciOS and exo. exo itself binds its API to `0.0.0.0` on its configured port. Do not expose these development ports directly to the public Internet.

Native Windows is not currently documented by upstream exo; use WSL2/Linux or another supported exo host. Upstream currently documents Linux inference through its CPU backend, while macOS uses MLX.

## Browser security boundary

An HTTPS-hosted page cannot reliably reach arbitrary HTTP devices on the user's private LAN. Browser mixed-content and local-network-access rules remain authoritative. ConsciOS does not attempt to bypass them.

For phone use, serving ConsciOS locally over HTTP from the exo computer keeps both the interface and exo endpoint within the same trusted LAN context. The hosted page retains explicit setup guidance instead of presenting a nonfunctional endpoint field as though a backend already existed.

## API surface used

The provider and acceptance gate use exo's public HTTP API:

- `GET /node_id` for coordinator identity;
- `GET /state` for cluster-state discovery;
- `GET /v1/feature-flags` to confirm the current API surface;
- `GET /v1/models?status=downloaded` for executable-model discovery;
- `POST /place_instance` to place a selected downloaded model when no active instance exists;
- `GET /instance/await` to wait until placement is ready;
- `POST /v1/chat/completions` for text inference.

The Workbench provider now discovers **downloaded** models rather than presenting every known model card as immediately executable. Before inference, it reuses an existing active model instance when present; otherwise it asks exo to place the model and waits for exo to report readiness. There is no silent inference-provider fallback.

In browsers, the provider wraps the supplied fetch implementation rather than storing native `window.fetch` and invoking it as an object method. This preserves the browser receiver semantics required by Chromium/WebKit and is covered by the browser integration gate.

## Runtime Center

The Workbench and exo application shell expose a **Runtime Center** backed by the same bounded `/state` and downloaded-model APIs used by the provider. It reports:

- observed cluster node count;
- aggregate available RAM;
- downloaded and active model counts;
- per-node friendly name, hardware identifiers, RAM usage, GPU utilization, temperature, and system power when exo reports those fields; and
- the observation timestamp and runtime address.

Runtime telemetry is observational. ConsciOS does not infer unsupported hardware properties when exo omits a field.

## Acceptance gate

The **Acceptance Test** tab is the runtime milestone for this integration. It verifies, in order:

1. **Node identity** — `GET /node_id` returns a non-empty identity.
2. **Cluster state** — `GET /state` returns a JSON state object.
3. **Current API surface** — `GET /v1/feature-flags` succeeds.
4. **Downloaded model** — `GET /v1/models?status=downloaded` returns at least one model.
5. **Runnable instance + neural inference** — ConsciOS reuses or places the selected model instance, waits for readiness, then sends a small non-streaming `POST /v1/chat/completions` request and requires non-empty assistant text.

The UI reports **PASS · exo is ready inside ConsciOS** only after all checks succeed. A reachable HTTP server by itself is not a pass. The acceptance test does not silently download model weights; use exo's native **Downloads** view first if no model is available.

## Simulated CI runtime

Real accelerator execution cannot be reproduced inside every CI runner, so ConsciOS maintains a second acceptance layer that is explicitly labeled simulated. `observer/experiments/exo-runtime-sim/verify.mjs` starts a local HTTP server that implements the specific exo endpoints ConsciOS uses, then verifies real HTTP transport, runtime resource parsing, downloaded-model discovery, automatic instance placement/readiness, and chat completion through `ExoInferenceProvider`.

The responsive-browser verification additionally drives the Workbench and exo Acceptance Test in headless Chromium against a simulated exo server. This catches browser integration regressions without pretending the simulation proves MLX/CUDA execution, LAN discovery, accelerator performance, or multi-node networking. Those remain real-hardware acceptance requirements.

## Responsive interface contract

The exo and Workbench surfaces follow `development/RESPONSIVE_HTML_STANDARD.md` and the shared `local/conscios-ui.css` baseline. Application-level horizontal overflow is treated as a defect. Intentional wide controls, tab strips, and navigation remain within bounded internal scrollers on narrow screens.

## Scientific interpretation

Provider portability and distributed inference are engineering properties. Different providers, models, quantizations, devices, and distributed topologies can produce different numerical and behavioral results. Successful distributed inference does not establish phenomenal consciousness.
