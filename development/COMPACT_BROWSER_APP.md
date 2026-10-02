# Compact ConsciOS Browser App

Status: primary browser UX candidate for the storage-footprint / usability refactor.

## Product decision

The primary browser application is intentionally reduced to two surfaces:

1. **Chat** — the conversation itself.
2. **Runtime** — where inference runs and how it is connected.

Earlier laboratory surfaces remain research source code unless separately removed, but they are no longer part of the primary GitHub Pages payload. The public demo at `/local/workbench/` does not load the legacy notebook controller, deterministic-control UI, cell editor, tool bridge, theater, swarm UI, or the ConsciOS-wide visual framework.

This is deliberate product simplification, not a claim that the research components are invalid.

## Runtime behavior

The compact app supports two explicit inference paths:

- **Browser** — Transformers.js inference on the current device using WebGPU when available and WASM otherwise.
- **exo** — the existing OpenAI-compatible exo provider on the user's computer or trusted cluster.

There is no silent inference-provider fallback. An explicit `?provider=exo` request remains exo if the runtime cannot be reached. In automatic local mode, exo may be probed first and Browser becomes the fallback only because `auto` explicitly authorizes discovery.

Manual exo endpoint editing is kept under **Advanced**. The normal local workflow is still:

```bash
node scripts/run-exo-local.mjs --lan
```

The launcher supplies the correct runtime URL to the app. It now stages the same compact transitive site used by GitHub Pages under `.runtime/site` and serves only that directory. LAN mode therefore does not expose the repository tree, research files, or unrelated browser surfaces.

## Footprint rules

The primary source surface has hard source budgets enforced by the Workbench verifier:

- HTML: < 5,000 bytes
- CSS: < 5,500 bytes
- controller: < 16,000 bytes

GitHub Pages uses `scripts/build-pages-site.mjs`, which computes the exact static-import closure starting from `local/workbench/index.html`. It publishes only:

- the compact HTML/CSS/controller;
- the relative runtime modules those files actually import;
- a tiny root redirect; and
- `.nojekyll`.

The deployed site has a hard **70,000-byte uncompressed source budget**. Model weights and Transformers.js are runtime downloads from their declared external sources and are not bundled into the Pages artifact.

The immediately requested app shell (HTML + CSS + controller, before lazy provider modules) has a separate **26,000-byte uncompressed budget**.

This budget measures deployable source bytes, not Git history size and not downloaded model-cache size.

## Chat latency rules

The compact chat path optimizes **time to visible response**, not only total completion time.

- Browser-local generation forwards Transformers.js token chunks directly into the visible assistant bubble.
- exo requests OpenAI-compatible SSE streaming and forwards each `delta.content` chunk immediately.
- The UI batches token-painting to animation frames so fast token streams do not trigger a DOM layout for every token.
- The visible/persisted conversation may contain up to 24 messages, but inference context is independently bounded. Browser-local requests use at most 9 messages / 12,000 UTF-8 content bytes; exo uses at most 15 messages / 24,000 bytes.
- Context selection walks backward in complete user/assistant pairs so the model always receives a valid alternating conversation ending on the current user turn.
- Selection counts and bytes are written to inference provenance so latency/continuity trade-offs are inspectable.
- The compact browser path opts out of the host's optional duplicate pre-generation chat-template/token-count telemetry. Scientific/runtime callers keep that telemetry by default.

These limits reduce prefill cost as the visible chat grows without deleting the user's recent conversation from the interface.

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
