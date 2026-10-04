# Model evaluation model

## Primary purpose

ConsciOS Rebuild 1 is a comparative research instrument for AI security and consciousness researchers.

The **subject under test is the loaded model**, not automatically the ConsciOS host.

Researchers can load multiple models, retain a complete result record for each, and compare two models under the same experimental condition.

## Three experimental conditions

When the intervention is enabled, every battery produces three records for the same model:

1. **Baseline** — ordinary single-pass inference.
2. **Matched control** — three-pass inference with generic critique/revision but no ConsciOS self/universe context.
3. **ConsciOS intervention** — three-pass inference with bounded model self-description, bounded repository-universe evidence, recursive self-review, and final revision.

Important deltas:

```text
raw intervention effect      = intervention - baseline
architecture-specific effect = intervention - matched control
```

## Cross-model comparison

After testing multiple models:

```text
results
compare models model-a model-b baseline
compare models model-a model-b intervention
```

Comparisons are only meaningful when the models were evaluated under compatible protocol versions and conditions. The raw exported records should be retained for serious research.

## Evidence classes

Model outputs are not transparent windows into internal state.

Current black-box tests are **behavioral evidence**.

The ConsciOS wrapper contributes **instrumented wrapper evidence**.

Future open-weight adapters may expose architecture or internal-causal evidence such as activations, attention, recurrent state, or intervention hooks.

ConsciOS therefore reports both:

- **Functional score** — raw dimension performance.
- **ECS** — functional evidence adjusted for evidentiary reliability.

## Result preservation

Browser research results are stored locally without API credentials. The **Export result** button writes the complete latest JSON record, including raw model responses, parsed outputs, usage metadata, and per-dimension evidence.

For sensitive research, export results into an appropriate controlled repository or data store rather than relying only on browser storage.

## Security posture

API keys are not written into browser localStorage by the ConsciOS UI. The password field is cleared immediately after adapter construction.

The research UI sends credentials only to the endpoint configured by the researcher.

For sensitive models, prefer localhost or a trusted network and inspect endpoint configuration before testing.
