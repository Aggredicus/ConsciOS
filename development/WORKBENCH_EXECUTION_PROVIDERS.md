# Workbench Execution Providers

Status: accepted browser-side execution boundary for the v0.5 platform-refactor epoch.

## Purpose

The Cognitive Workbench now separates **what a notebook cell requests** from **where/how that request executes**. Executable cells cross the `conscios-execution/v1` provider boundary before any JavaScript worker, Pyodide runtime, or explicit HTTP tool bridge is invoked.

This is an engineering boundary. It does not grant cognitive authority, repository authority, host access, or evidence of consciousness.

## Contract

An execution provider declares:

- a stable provider `id` and label;
- a location such as `browser-worker`, `browser-main-thread`, or a declared HTTP endpoint;
- the cell types it supports;
- explicit capability metadata; and
- an asynchronous `execute(cell, context, options)` operation.

Results use `conscios-execution-result/v1` and include provider provenance.

The router has **no silent fallback**. If a cell explicitly requests an execution provider that is unavailable or incompatible, execution fails visibly. If more than one provider can execute a cell and none is selected explicitly, execution also fails rather than making a hidden routing decision.

## Current providers

| Provider | Cell types | Location | Boundary |
| --- | --- | --- | --- |
| `browser-javascript` | JavaScript | Web Worker | no host filesystem; worker-isolated |
| `browser-python` | Python | Pyodide in browser | no host filesystem; browser network policy |
| `http-tool-bridge` | tool/procedure cells | declared HTTP endpoint | authority remains defined by that endpoint |

AI and conversation cells remain on the independent `InferenceProvider` / `CognitiveModel` boundary. Execution providers do not replace or bypass model provenance.

## Why this matters

Previously, `workbench.mjs` directly chose JavaScript, Python, or tool transport with cell-type branches. That made future sandbox/container backends require UI-level transport logic. The new boundary makes the Workbench depend on a small provider contract instead.

Future governed Linux/container execution can therefore be introduced as another provider in shadow mode without changing the semantics of existing browser cells.

## Next experiment

The next v0.5 increment should add a **local sandbox provider candidate** behind this contract, with the following defaults:

- network disabled unless explicitly requested and allowed;
- no privileged containers;
- no host network;
- no Docker/Podman socket mounted into the guest;
- only a per-sandbox workspace mount;
- bounded CPU, memory, PID count, runtime, and captured output;
- explicit image allowlist or policy;
- provenance for image, command, limits, timing, and exit status;
- cancellation and cleanup that are independently testable.

That candidate should begin in shadow/opt-in mode and must not gain protected repository or host authority from being an execution provider.
