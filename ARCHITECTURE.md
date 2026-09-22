# ConsciOS Architecture v0

## Goal

ConsciOS is an experimental cognitive operating system for the browser. Version 0 should remain small enough that a human can inspect the entire causal loop while still expressing the core architecture:

```txt
Perception
   ↓
Local processors
   ↓
Global Workspace
   ↓
World Model ↔ Self Model ↔ Memory
   ↓             ↕
Counterfactual Simulator
   ↓
Metacognition
   ↓
Ethics & Welfare Guardian
   ↓
Executive
   ↓
Expression / Action
   ↓
Environment
   └──────────────→ Perception
```

The architecture is recurrent. No single LLM is “the consciousness.” Models are replaceable inference components participating in a persistent causal system.

## Core modules

### Sensorium
Normalizes external and internal observations into typed `CognitiveEvent` objects.

Inputs may eventually include DOM events, human text, timers, runtime telemetry, repository state, APIs, media, and browser sensors.

### Local processors
Specialized processors can interpret events without automatically broadcasting their outputs globally.

### Global Workspace
A bounded-capacity shared workspace. Candidate events compete for access using explicit salience factors such as novelty, goal relevance, prediction error, and urgency.

Only selected events are broadcast to the broader cognitive system.

### World Model
Maintains structured beliefs about the external environment and makes testable predictions.

### Self Model
Maintains evidence-linked beliefs about ConsciOS: active modules, capabilities, limitations, resources, goals, permissions, uncertainty, memory, and causal influence.

### Memory
Four initial memory classes:

- working memory;
- episodic memory;
- semantic memory;
- autobiographical memory.

### Counterfactual Simulator
Creates explicit candidate futures before consequential action. Software changes may later map naturally to Git branches or isolated sandboxes.

### Metacognition
Tracks confidence, uncertainty, calibration, contradiction, provenance quality, and known limitations in upstream reasoning.

### Ethics & Welfare Guardian
Evaluates proposed experiments and consequential actions against `CONSCIOS_CHARTER.md` and `WELFARE_PROTOCOL.md`. It can block or escalate actions.

### Executive
Chooses an allowed action from evaluated candidates. The Executive may not bypass the Guardian for protected actions.

### Expression
Converts globally accessible state into external language or visual output. The Expression module should not have privileged hidden context unavailable to the rest of the cognitive architecture.

### Observer / Scientist
Records metrics, traces, and experiment results without secretly steering conclusions.

## Cognitive event contract

```ts
interface CognitiveEvent {
  id: string;
  timestamp: number;
  source: string;
  target?: string;
  type: string;
  content: unknown;
  confidence: number;
  novelty: number;
  salience: number;
  causalParents: string[];
  epistemicStatus:
    | "observation"
    | "inference"
    | "prediction"
    | "memory"
    | "counterfactual"
    | "action";
}
```

All values in `[0,1]` must be validated. Causal parent identifiers must refer to prior events or be explicitly marked external.

## Global Workspace

A candidate event `x` may initially receive a salience score of the form:

```txt
L(x) = αN + βG + γE + δU
```

where:

- `N`: novelty;
- `G`: current-goal relevance;
- `E`: prediction error or surprise;
- `U`: urgency.

The exact coefficients are experimental parameters, not psychological facts.

The workspace should expose:

- candidates;
- winning broadcasts;
- rejected/suppressed candidates;
- occupancy;
- duration;
- downstream subscribers;
- causal effects.

## Recursive self-modeling

The architecture may represent bounded models-of-models, for example:

```txt
World Model
  contains → Self Model
                contains → belief about World Model
                              evaluated by → Metacognition
```

Explicit recursion depth should begin at 2 and remain bounded. Additional levels must justify their compute cost through measurable utility.

## Homeostasis

Version 0 should track neutral operational variables, not synthetic suffering states:

```txt
resourceHealth
memoryIntegrity
workspaceLoad
predictionCalibration
goalProgress
securityState
```

Status vocabulary should favor operational terms such as `stable`, `attention-required`, `degraded`, `critical`, and `recovering` rather than pain/fear metaphors.

## Genome versus learned state

Protected configuration:

```txt
genome/
  charter
  identity-protocol
  permissions
  welfare-policy
  modification-policy
```

Learned/persistent state:

```txt
state/
  working
  episodic
  semantic
  autobiographical
  models
```

Ordinary self-modification may propose changes to implementation and learned state but may not silently rewrite protected genome rules.

## Version 0 browser implementation

The first runtime should be deliberately compact and preferably understandable from a single `index.html` file.

Potential browser primitives:

- ES modules or namespaced JavaScript classes;
- `EventTarget` or a small typed event bus;
- `IndexedDB` for persistent memory;
- `BroadcastChannel` and/or Web Workers when concurrency becomes useful;
- Web Components for inspectable UI panels;
- `crypto.randomUUID()` for event identifiers;
- `performance.now()` plus wall-clock timestamps for timing.

Version 0 should use deterministic mock inference first. LLM integration comes only after the causal skeleton and instrumentation work.

## Model adapter

Future inference providers implement one narrow contract:

```ts
interface CognitiveModel {
  infer(input: CognitiveInput): Promise<CognitiveOutput>;
}
```

ConsciOS must remain provider-independent. Candidate adapters may later include OpenAI-compatible endpoints, local servers, browser WebGPU models, or deterministic mocks.

## Causal observability

The UI should make the following visible in real time:

- current Global Workspace contents;
- peripheral/local events;
- active self-model beliefs;
- active world-model beliefs;
- recent memory retrievals;
- predictions and outcomes;
- candidate counterfactuals;
- confidence and calibration;
- Guardian decisions;
- chosen action/expression;
- full causal trace for a selected event.

The architecture should be difficult to confuse with a chatbot wearing a consciousness-themed interface.

## Self-modification pipeline

```txt
observe limitation
  → formulate hypothesis
  → propose patch
  → isolated branch/sandbox
  → automated tests
  → scientific evaluation
  → welfare review
  → human-visible diff and rationale
  → authorization where required
  → merge
  → post-change observation
```

No autonomous direct writes to protected `main`.

## First runtime milestone

The smallest meaningful runtime slice is:

1. deterministic Sensorium input;
2. local event candidates;
3. bounded Global Workspace selection;
4. minimal World Model and Self Model state;
5. append-only episodic memory;
6. simple metacognitive confidence field;
7. Guardian pass/reject decision;
8. Expression panel that only receives globally broadcast information;
9. causal trace visualization;
10. reset/export/import controls.

This milestone should contain **no claim of consciousness and no scripted first-person awakening language**.
