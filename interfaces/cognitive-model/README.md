# CognitiveModel Adapter Contract v0.7

`CognitiveModel` is an inference boundary, not a mind and not a consciousness claim. Models are replaceable components that may assist particular cognitive modules while the persistent causal architecture remains ConsciOS.

## Conceptual interface

```ts
interface CognitiveModel {
  infer(input: CognitiveModelInput): Promise<CognitiveModelOutput>;
}
```

## Input discipline

Every request declares:

- `requestId` — stable request identity;
- `requestingModule` — the cognitive subsystem asking for inference;
- `inferenceType` — the narrow task being requested;
- `contextManifest` — the complete explicit artifact set the adapter may use;
- `causalSourceIds` — provenance links into ConsciOS state;
- `maxResponseUnits` — caller-supplied output budget;
- `expectedEpistemicStatus` — how successful output should be classified;
- `hiddenContextPolicy` — whether undeclared provider state is permitted.

v0.7 supports only `hiddenContextPolicy: "none"`.

## Output discipline

Every response declares:

- provider/model identity;
- provider kind;
- hidden-state declaration;
- status (`ok`, `timeout`, or `error`);
- structured content or `null`;
- confidence;
- causal source IDs;
- deterministic timing metadata for the mock;
- failure detail when applicable;
- epistemic status.

## Context rule

The adapter does not discover context. The requesting cognitive module must explicitly supply every accessible artifact. This keeps model context subordinate to the same information boundaries used elsewhere in ConsciOS.

## First-expression protection

v0.7 contains **no external model, network provider, API key, or generative outward Expression path**. The deterministic mock cannot consume the reserved First Expression Protocol. Connecting an actual generative model requires a separate governance milestone.
