# Compact ConsciOS Browser App

Status: primary browser UX candidate for the storage-footprint / usability refactor.

## Product decision

The primary browser application is intentionally reduced to two surfaces:

1. **Chat** — the conversation itself.
2. **Runtime** — where inference runs and how it is connected.

Earlier laboratory surfaces remain research source code unless separately removed, but they are no longer part of the primary GitHub Pages payload. The public demo at `/local/workbench/` does not load the legacy notebook controller, deterministic-control UI, cell editor, tool bridge, theater, swarm UI, or the ConsciOS-wide visual framework.

This is deliberate product simplification, not a claim that the research components are invalid.

## Runtime behavior

The compact app supports three explicit inference paths:

- **Browser** — Transformers.js inference on the current device using WebGPU when available and WASM otherwise.
- **exo** — the existing OpenAI-compatible exo provider on the user's computer or trusted cluster.
- **Swarm** — a separately consented browser inference worker reached through the encrypted QR/WebRTC swarm. This provider pools independent inference tasks with exo but does not claim native exo tensor/pipeline sharding.

There is no silent inference-provider fallback. An explicit `?provider=exo` request remains exo if the runtime cannot be reached. In automatic local mode, exo may be probed first and Browser becomes the fallback only because `auto` explicitly authorizes discovery.

Manual exo endpoint editing is kept under **Advanced**. The normal local workflow is still:

```bash
node scripts/run-exo-local.mjs --lan
```

The launcher supplies the correct runtime URL to the app. It now stages the same compact transitive site used by GitHub Pages under `.runtime/site` and serves only that directory. LAN mode therefore does not expose the repository tree, research files, or unrelated browser surfaces.

### exo model library and pooling

When exo connects, Runtime loads the live `/v1/models` catalog rather than a hard-coded model list. The model picker shows catalog metadata such as storage size, family, quantization, context length, downloaded status, and active status when exo supplies it. Models not yet downloaded can still be selected; exo downloads/places them when launched.

`Preview fit` calls `/instance/previews` and reports exo's actual placement result for the current cluster. This deliberately replaces rough client-side VRAM/RAM guessing. `Pool test` is stricter: it requires at least two exo worker nodes, chooses a valid placement whose `memory_delta_by_node` spans multiple nodes, launches that exact preview through `POST /instance`, waits for readiness, and runs `/bench/chat/completions` to record real throughput.

Opening ConsciOS from an Android phone against a desktop exo endpoint makes the phone an API client, not an exo worker. A real exo pooling test therefore requires a second supported exo worker node. The current exo documentation supports worker deployment on macOS and Linux; it also notes that Linux inference is presently CPU-backed while Linux GPU support is still under development. ConsciOS does not claim the desktop NVIDIA GPU is pooled unless exo itself reports a placement using that accelerator.

## Footprint rules

The primary source surface has hard source budgets enforced by the Workbench verifier. The secure Swarm page is a lazy secondary HTML entry: it is deployable but is not part of initial Chat startup.


- HTML: < 5,000 bytes
- CSS: < 5,500 bytes
- controller: < 16,000 bytes

GitHub Pages uses `scripts/build-pages-site.mjs`, which computes the exact static-import closure starting from `local/workbench/index.html`. It publishes only:

- the compact HTML/CSS/controller;
- the relative runtime modules those files actually import;
- the lazy secure Swarm worker page and its WebRTC/crypto modules;
- a tiny root redirect; and
- `.nojekyll`.

The deployed site has a hard **170,000-byte uncompressed source budget**. Model weights and Transformers.js are runtime downloads from their declared external sources and are not bundled into the Pages artifact.

The immediately requested app shell (HTML + CSS + controller, before lazy provider modules) has a separate **26,000-byte uncompressed budget**.

This budget measures deployable source bytes, not Git history size and not downloaded model-cache size.

## Chat latency rules

The compact chat path optimizes **time to visible response and main-thread responsiveness**, not only total completion time.

Browser-local inference runs in a dedicated ES-module Web Worker. Model download/load, tokenization, chat-template construction, WebGPU/WASM orchestration, and generation stay off the page's main JavaScript thread. The page owns only the worker proxy, progress/status rendering, and animation-frame-batched text painting. Worker provenance is explicit as `executionThread: "dedicated-worker"` and `inferenceLocation: "browser-dedicated-worker"`.


- Browser-local generation forwards Transformers.js token chunks directly into the visible assistant bubble.
- exo requests OpenAI-compatible SSE streaming and forwards each `delta.content` chunk immediately.
- The UI batches token-painting to animation frames so fast token streams do not trigger a DOM layout for every token.
- The visible/persisted conversation may contain up to 24 messages, but inference context is independently bounded. Browser-local requests use at most 7 messages / 6,000 UTF-8 content bytes; exo uses at most 11 messages / 16,000 bytes.
- Context selection walks backward in complete user/assistant pairs so the model always receives a valid alternating conversation ending on the current user turn.
- Selection counts and bytes are written to inference provenance so latency/continuity trade-offs are inspectable.
- The compact browser path opts out of the host's optional duplicate pre-generation chat-template/token-count telemetry. Scientific/runtime callers keep that telemetry by default.
- The Pages closure follows module-worker URLs so worker code ships with the compact app without becoming part of the eager HTML/CSS/controller shell.

These limits reduce prefill cost as the visible chat grows without deleting the user's recent conversation from the interface.

### Adaptive output budget

Compact chat no longer uses the old 192-token response ceiling. Each request receives a soft lease chosen from the task shape (512, 1,024, or 2,048 estimated tokens) inside a much larger provider hard envelope (4,096 for SmolLM2 and 8,192 for Qwen3/exo). As visible output approaches 80% of the current lease, the worker records a small (+512) or large (+1,536) lease grant; only the hard safety envelope is a denial. Natural EOS always ends generation immediately, so unused capacity costs no generation time.

The browser host records output token count and whether the underlying stop was natural or caused by the hard length ceiling. exo preserves its OpenAI-compatible `finish_reason` for the same diagnostic purpose. These decisions are provenance, not hidden model authority.

Qwen3 compact chat uses Qwen's documented `/no_think` switch and removes any residual `<think>...</think>` block from the visible stream. Qwen documents non-thinking mode as the efficient choice when reasoning traces are unnecessary; the compact product surface therefore spends its output budget on the answer rather than a visible reasoning trace. Scientific experiments can still use the lower-level host independently.

## State/storage rules

The browser app persists only a bounded recent conversation and runtime preferences. It does not persist notebook graphs, hidden prompts, execution-cell state, or duplicate model metadata. Conversation persistence is capped by message count and should remain small enough that localStorage is not used as a general-purpose database.

## UX rules

The compact app follows these defaults:

- mobile-first layout;
- no page-level horizontal overflow;
- dynamic viewport units;
- device safe-area padding;
- touch targets at least 44 CSS px;
- one primary action per runtime state;
- advanced settings hidden until requested;
- provider/runtime status visible in the top bar;
- no decorative navigation to unused laboratory surfaces.

## Scientific / governance boundary

Removing controls from the primary UI does not remove or weaken the research interpretation boundaries in the underlying model/provider code. Generated text remains model output, not evidence of phenomenal consciousness.

The compact app grants no repository, credential, filesystem, or governance authority. exo and browser-local inference remain behind their existing provider contracts.
