# Real Browser Model Gate v2 — preregistration

Status: ObserverScientist repair of a repeatedly flaky real-model CI gate.

## Triggering evidence

The real-browser model job failed twice on the same assertion while all deterministic browser-host tests passed:

- PR #115 attempt: prompt `Reply only MOON.` produced `Sun.`; a targeted rerun passed.
- post-merge `main`: the same MOON assertion again produced `Sun.`.

The gate uses a 360M parameter instruction model with real browser/WASM inference. Exact one-word instruction compliance is therefore a **model-behavior measurement**, not a deterministic transport invariant.

## Problem

The current test conflates two claims:

1. **integration claim** — a real local neural model can download, load, receive the explicit Workbench prompt, produce non-empty output, and return correct local-provider provenance; and
2. **behavioral claim** — this small model always follows arbitrary exact-token SUN/MOON/DAY/NIGHT instructions.

Only the first claim should be a hard browser-host CI gate. The second should remain measured and visible, but model-quality variation must not make otherwise-correct browser infrastructure appear broken.

## Revised hard gate

The real-browser job must fail unless all of these hold:

- the browser-local provider becomes ready;
- the declared model repository is actually requested over the network;
- at least three real AI-cell inferences finish with status `ok`;
- every gated inference returns non-empty assistant text;
- the Workbench cell source exactly equals the prompt submitted for that inference;
- every gated result reports `browser-transformers-local` provenance and the expected model ID;
- every gated result carries the AI-cell prompt artifact in causal-source provenance;
- a second-stage prompt is deterministically chosen from the **actual first neural output**, and that second-stage inference succeeds.

These are transport/integration/provenance properties that the browser host owns.

## Behavioral diagnostic

The test still runs exact-token probes such as SUN and MOON and reports separately:

- exact instruction-compliance count;
- whether distinct prompts produced distinct normalized outputs; and
- whether the dynamically selected second-stage target was followed exactly.

Those measurements are printed but do not independently fail the integration gate.

## Scientific boundary

This change is not permission to ignore behavioral regressions. Exact-token compliance is retained as evidence, but it is no longer mislabeled as a deterministic browser-host requirement. Model-behavior thresholds should live in a separate replicated benchmark with multiple models/seeds/tasks if they are to gate model promotion.

## Stop conditions

Do not merge if the revised test can pass without real model download/inference, loses prompt/provenance assertions, hides the behavioral diagnostic, or weakens deterministic unit tests that already prove explicit prompt delivery into the generation input.
