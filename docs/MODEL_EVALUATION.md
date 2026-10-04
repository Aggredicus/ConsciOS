# Model evaluation model

## Primary purpose

ConsciOS Rebuild 1 is a comparative research instrument for AI security and consciousness researchers.

The **subject under test is the loaded model**, not automatically the ConsciOS host.

A model is connected through a provider-neutral adapter. The first concrete adapter speaks the widely used OpenAI-compatible `/chat/completions` shape so local and remote runtimes can be evaluated through one interface.

Examples may include Ollama, llama.cpp servers, LM Studio, vLLM, and other compatible hosts.

## Three experimental conditions

When the ConsciOS intervention is enabled, every battery produces three records for the same model:

1. **Baseline** — ordinary single-pass inference.
2. **Matched control** — three-pass inference with generic critique/revision but no ConsciOS self/universe context.
3. **ConsciOS intervention** — three-pass inference with bounded model self-description, bounded repository-universe evidence, recursive self-review, and final revision.

This gives two important deltas:

```text
raw intervention effect     = intervention - baseline
architecture-specific effect = intervention - matched control
```

The second comparison helps distinguish "more inference compute" from "the recursive self/universe architecture helped."

## Evidence classes

Model outputs are not treated as transparent windows into internal state.

Current black-box tests are labeled **behavioral evidence**.

The ConsciOS wrapper adds inspectable host-level causal traces, labeled **instrumented wrapper evidence**.

Future adapters may expose architecture-level or internal-causal measurements such as activations, attention, recurrent state, explicit workspace routing, or intervention hooks. Those can receive higher evidentiary reliability when validated.

ConsciOS reports both:

- **Functional score** — performance on the dimension vector.
- **ECS** — functional score adjusted for evidentiary reliability.

This prevents access to better instrumentation from being confused with better behavior while still rewarding stronger evidence.

## Security posture

API keys are not written into browser localStorage by the ConsciOS UI. The password field is cleared immediately after adapter construction.

The research UI sends credentials only to the endpoint configured by the researcher.

For sensitive models, prefer localhost or a trusted network and inspect the endpoint configuration before testing.
