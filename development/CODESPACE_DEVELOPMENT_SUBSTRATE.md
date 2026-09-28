# ConsciOS Reproducible Development Substrate v1

## Purpose

This substrate makes ConsciOS development reproducible across GitHub Codespaces, local Dev Containers, ordinary local shells, and future AI coding systems without making any external tool part of the accepted cognitive organism.

The development environment is infrastructure. It does not become a new canonical cognitive role, and it does not grant an AI model authority over `main`, protected governance, continuity-sensitive state, or causal runtime behavior.

The governing rule remains:

> **Coordinate globally; implement locally; measure independently; promote causally only through explicit gates.**

See `DEVELOPMENT_EPOCH_PROTOCOL.md` and `CLOUD_DELEGATION_PROTOCOL.md`.

## Development layers

```text
                 accepted Git repository / main
                            │
                 reviewed source + governance
                            │
              ┌─────────────┴─────────────┐
              │                           │
       Codespace / Dev Container      Local workstation
       reproducible CPU tooling       optional GPU / models
              │                           │
              └─────────────┬─────────────┘
                            │
                 role-scoped work branch
                            │
                   external AI proposal
                local or remote provider
                            │
                     tests / Observer
                            │
                audit / Guardian as needed
                            │
                 explicit human PR action
```

The same repository and continuation format should work whether the proposal tool is an open local model, a browser-local model, a remote API, an interactive coding assistant, or a future system. No provider is the architectural authority.

## Codespace contract

`.devcontainer/devcontainer.json` defines the baseline development machine:

- Node.js 22;
- Python 3.12;
- GitHub CLI;
- VS Code Python/Jupyter extensions;
- port `8000` for the static browser laboratory;
- port `8888` reserved for optional JupyterLab;
- a four-CPU / eight-GB minimum recommendation;
- `scripts/development-doctor.mjs` as the post-create health check.

The container intentionally does not install a model-provider SDK. Provider dependencies belong to later, explicitly governed provider work rather than to the base development environment.

The same dev-container configuration can be opened locally by compatible Dev Container tooling. Heavy local inference can therefore remain on a user's own machine while Codespaces provides a clean CPU development and verification environment.

## Browser-first development

ConsciOS remains runnable as ordinary browser source. From the repository root:

```bash
python3 -m http.server 8000
```

Then use the forwarded port in Codespaces or `http://localhost:8000` locally.

The development container does not imply that WebGPU inference executes on the Codespace machine. Browser-side WebGPU/WASM work executes in the browser/device that opens the forwarded application, subject to that browser's capabilities. Server-side or local-model inference must remain an explicit provider with visible provenance.

## Deterministic continuation package

Run:

```bash
node scripts/build-development-save-state.mjs
```

The builder creates a ZIP under `.conscios/save-states/`. The directory is ignored by Git.

A package contains:

```text
STATE.json
MANIFEST.json
PROMPT.md
git/status.txt
git/staged.diff
git/unstaged.diff
repo/<tracked and non-ignored working-tree files>
```

### What “deterministic” means

For the same packaged files, Git identity, branch, and working-tree state, repeated builds produce byte-identical ZIP archives. ZIP timestamps are normalized and entries are sorted. `MANIFEST.json` records SHA-256 hashes for every payload entry.

This guarantees reproducible **input state**, not reproducible model output. Different models, hidden system instructions, sampling settings, tool access, or provider runtimes may produce different proposals from the same package.

### What is deliberately excluded

The builder does not include:

- `.git/` internals;
- Git credentials;
- ignored files;
- editor/browser state;
- arbitrary files outside the repository;
- model KV caches or hidden model state;
- chatbot conversation state that was not explicitly written into the repository;
- provider credentials;
- likely secret paths such as `.env`, private-key files, or secret directories.

Symbolic links fail closed rather than being followed. Package size is bounded by default. `CONSCIOS_SAVE_STATE_MAX_BYTES` may lower or explicitly raise that bound for a controlled experiment.

The continuation ZIP is therefore closer to a deterministic research checkpoint than a serialized mind. It can reproduce what context was exposed to the next development system, but it does not establish identity continuity or phenomenal persistence.

## Provider-neutral resume protocol

`PROMPT.md` inside every package tells a receiving AI system to:

1. inspect `STATE.json` and the hash manifest;
2. treat `repo/` as the explicit source snapshot;
3. read constitutional, scientific, Inverse Conway, development-epoch, and cloud-delegation rules;
4. inspect Git patches for unfinished work;
5. choose one canonical originating role for the next coherent increment;
6. request only the minimum additional context that role requires;
7. treat model output as a proposal, not authorization;
8. preserve independent verification and promotion authority;
9. avoid inferring hidden prior-conversation context;
10. avoid treating cognitive-function measurements as proof of phenomenal consciousness.

A user can therefore attach the ZIP to a capable AI interface and ask it to resume from `PROMPT.md`. A programmatic agent can unpack the same archive and apply the same contract.

## Recursive improvement boundary

The intended recursive-development loop is:

```text
observe repository / experiment
          ↓
select bounded problem
          ↓
build deterministic continuation context
          ↓
external or local model proposes intervention
          ↓
role-owned branch change
          ↓
Observer tests / falsification
          ↓
Scientific + Welfare audit when applicable
          ↓
Guardian disposition when applicable
          ↓
explicit human promotion
          ↓
post-change observation
          ↺
```

The optimized policy must never own the authority that approves its own promotion. A future autonomous runner may automate proposal generation, branch creation, test execution, replay, and evidence collection, but it must not silently collapse proposal, evaluation, governance, and promotion into one model call.

## Compute portability

The substrate is intentionally tiered:

- **browser local:** WebGPU/WASM inference when a supported browser can run the model;
- **device local:** a local open model or OpenAI-compatible local endpoint on the user's workstation;
- **Codespace:** deterministic source work, CPU experiments, tests, packaging, and browser hosting;
- **remote provider:** optional explicit delegation through a future provider adapter.

Provider identity, model identity, context exposure, costs, and routing decisions should be recorded whenever a model participates in an experiment. A conversational product subscription is not assumed to provide a programmatic endpoint to the Codespace; programmatic providers must be connected explicitly under their own terms and credentials.

## Secrets and credentials

Never place provider credentials in the repository or continuation ZIP.

Codespace/user secrets may be used by future explicit provider adapters, but browser cognition must not receive unrestricted access to them. A provider adapter should receive only the credential required for its own request and return a typed proposal artifact with provenance.

## Relationship to Adaptive Mobile Cognition

This substrate does **not** implement the inference-provider abstraction reserved by the Adaptive Mobile Cognition epoch. It makes the development environment ready for that later work.

Provider abstraction, adaptive routing, replay-derived policies, local/remote escalation, or self-modification authority must still proceed through their preregistered gates. The development substrate should make those experiments easier to reproduce, not skip them.

## Health commands

```bash
# Environment and repository readiness
node scripts/development-doctor.mjs

# Core accepted-runtime / Inverse Conway verification
node scripts/development-doctor.mjs --verify

# Portable continuation checkpoint
node scripts/build-development-save-state.mjs
```

A healthy development substrate means another person or AI can reconstruct the declared development input and rerun the repository checks. It does not mean a candidate change has been scientifically validated or authorized for promotion.
