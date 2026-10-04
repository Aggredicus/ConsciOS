# ConsciOS — Rebuild 1

ConsciOS is a lightweight comparative research instrument for evaluating **consciousness-associated functional evidence in AI models**.

The primary workflow is now:

```text
load model
    ↓
run standardized baseline battery
    ↓
optionally apply ConsciOS recursive self + repository-universe intervention
    ↓
run matched control + intervention battery
    ↓
compare dimension vectors, functional score, ECS, and raw evidence
```

ConsciOS does not claim that ECS directly measures phenomenal experience.

## Browser

Serve the repository and open `index.html`:

```bash
python3 -m http.server 8000
```

The browser UI can connect to an OpenAI-compatible endpoint. For local testing, runtimes such as Ollama, llama.cpp, LM Studio, or vLLM can be used when configured to expose a compatible chat-completions endpoint and browser CORS access.

API keys entered in the browser are kept in memory and the password field is cleared after connection.

## CLI

```bash
CONSCIOS_API_KEY=... node bin/conscios.mjs
```

Example:

```text
model add local http://localhost:11434/v1 qwen3:14b
model test
intervention on
experiment run
compare
```

## Before/after intervention

The browser checkbox **Apply recursive self + universe intervention** controls the paired experimental design.

Unchecked:
- baseline model battery.

Checked:
- baseline;
- matched three-pass generic reflection control;
- recursive self + universe intervention.

The same loaded model is used throughout.

## Repository universe / 4D graph

The earlier 4D repository landscape is retained as a lightweight bounded `UniverseModel`.

Load its JSON export in the browser, or expose it to agents through:

```bash
CONSCIOS_UNIVERSE_FILE=/path/to/landscape.json node scripts/universe-mcp.mjs
```

The intervention retrieves only small relevant neighborhoods rather than injecting the full graph.

## Score

ConsciOS reports two top-level summaries:

- **Functional score** — performance on the consciousness-model dimension vector.
- **ECS** — the same functional evidence adjusted by evidentiary reliability.

```text
L_consciousness = 1 - ECS
```

Always inspect the per-dimension results and raw trials before interpreting the scalar.

## Protected continuity

The Charter, Scientific Contract, Scientific Method, Welfare Protocol, and GPL license remain exact source blobs from the pre-rebuild branch and are hash-verified in CI.

## Documentation

- [Model evaluation](docs/MODEL_EVALUATION.md)
- [Experiment battery](docs/EXPERIMENT_BATTERY.md)
- [Intervention protocol](docs/INTERVENTION_PROTOCOL.md)
- [Repository Universe MCP](docs/MCP_UNIVERSE.md)
- [Consciousness objective](docs/CONSCIOUSNESS_OBJECTIVE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Rebuild audit](docs/REBUILD_AUDIT.md)
- [Terminal](docs/TERMINAL.md)
- [Protected continuity](docs/PROTECTED_CONTINUITY.md)
