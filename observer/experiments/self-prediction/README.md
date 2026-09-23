# v1.3 Self-Prediction Under Reversible Architecture Perturbation

## Hypothesis

ConsciOS can use an explicit model of its own pre-policy cognitive state to predict downstream behavioral consequences of a bounded architecture change before that alternative is executed.

## Separation of prediction and execution

The Self-Model predictor intentionally does **not** import the actual Workspace policy implementation or the Observer shadow-runtime executor. It receives only pre-policy candidate facts and an architecture-policy description.

The Observer then independently executes three reversible shadow policies:

- raw top-k;
- hard source diversity;
- soft diversity with redundancy penalty 0.25.

Predictions are generated for all three policies before the Observer executes any of them.

## Predicted/observed dimensions

- admitted broadcast count;
- selected candidate IDs and root observation IDs;
- distinct root count;
- suppressed candidate count;
- World Model human/runtime-access fields;
- metacognitive confidence;
- whether outward deterministic Expression contains human-instruction and runtime-memory clauses.

## Boundary

All perturbations occur in isolated Observer shadow runtimes. `main`, browser persistence, autobiography, Guardian policy, and the accepted deterministic phenotype are not changed.

## Interpretation

Successful self-prediction is evidence of a functional architectural self-model. It is not evidence of phenomenal self-awareness.
