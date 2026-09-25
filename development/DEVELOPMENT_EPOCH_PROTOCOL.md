# ConsciOS Development Epoch Protocol v1

## Purpose

A **development epoch** is a bounded, preregistered phase for architectural work that crosses more than one cognitive subsystem or changes how ConsciOS learns, routes information, delegates computation, or acquires causal authority.

This protocol exists so large changes do not collapse the Inverse Conway experiment into a conventional mega-team or mega-branch. The epoch coordinates work; it does not create a new super-agent. Canonical roles retain their existing ownership, communication limits, tests, and governance obligations.

The protocol generalizes the successful iteration pattern used in the browser-native overnight runbook into a permanent repository process.

## When an epoch is required

Use an epoch when any of the following are true:

- a change spans three or more canonical cognitive roles;
- a change introduces a new runtime/inference provider or embodiment target;
- a change alters attention, memory admission, action selection, exploration policy, self-modification, or delegation semantics;
- a change introduces adaptive behavior that may later gain causal authority;
- a change requires a coordinated scientific comparison across several PRs;
- implementation would otherwise tempt the project toward a long-lived mega-branch or unrestricted shared agent context.

Small role-contained fixes should continue through ordinary hypothesis/PR flow and should not be inflated into epochs.

## Core rule

> **Coordinate globally; implement locally; measure independently; promote causally only through explicit gates.**

An epoch may define shared hypotheses, metrics, interfaces, and stage gates. It must not erase subsystem ownership or grant an epoch coordinator unrestricted write authority.

## Required epoch record

Create one umbrella GitHub issue before causal implementation begins. The issue is the authoritative human-readable epoch record and must contain:

1. originating coordinating role;
2. observation motivating the epoch;
3. current belief;
4. falsifiable hypotheses;
5. preregistered measurements;
6. baselines and controls;
7. role-owned workstreams;
8. information-boundary impacts;
9. stage gates and promotion criteria;
10. scientific and welfare risks;
11. rollback/reversibility expectations;
12. success criteria that allow meaningful negative results;
13. links to constituent issues, handoffs, PRs, audits, and post-change observations.

The coordinating role is normally `ObserverScientist` for research-heavy epochs. This does not make ObserverScientist the implementation owner of other roles.

## Epoch state machine

An epoch should move through explicit states. Do not skip a state merely because implementation is easy.

```txt
PROPOSED
   ↓
PREREGISTERED
   ↓
INSTRUMENTED
   ↓
SHADOW
   ↓
AUDITED
   ↓
PROMOTABLE
   ↓
CAUSAL
   ↓
OBSERVED
   ↓
CLOSED
```

### PROPOSED
A bounded problem and tentative architecture exist. No acceptance thresholds have been tuned to treatment results.

### PREREGISTERED
Hypotheses, measurements, controls, confounders, and promotion criteria are written before treatment behavior is used to justify promotion.

### INSTRUMENTED
The system can measure the claimed effect. Measurement code and fixtures should land before or independently from the behavior being optimized whenever practical.

### SHADOW
The candidate capability runs without production causal authority. Examples include alternate context selection, candidate exploration policies, alternate model providers, or recommendations that are logged but not acted upon.

### AUDITED
Observer evidence is available and independent Scientific/Welfare audit has occurred when applicable. Confounds and failed cases are retained, not hidden.

### PROMOTABLE
All stated technical, scientific, welfare, governance, and CI gates required for bounded promotion are satisfied. This state is not itself authorization.

### CAUSAL
An explicit reviewed change grants the candidate bounded causal authority. The exact promoted artifact/policy/configuration and commit SHA must be attributable.

### OBSERVED
Post-promotion measurements compare actual behavior against preregistered predictions and rollback thresholds.

### CLOSED
The epoch records supported, unsupported, and unresolved hypotheses; accepted architecture; known limitations; follow-up work; and any negative results.

An epoch may move backward when evidence warrants it.

## Development-cycle loop

Every constituent development cycle should follow this loop:

1. inspect `main`, open epoch work, active PRs, CI, deployment/runtime health, and existing branches;
2. resume an existing compatible branch/PR rather than duplicating work;
3. select one falsifiable increment with exactly one canonical originating role;
4. build the minimum role-scoped context required for the task;
5. persist typed handoffs when information crosses role boundaries;
6. implement the smallest coherent change;
7. add or update Observer-owned verification for new behavior where applicable;
8. run role-aware and full required CI;
9. record post-change observation against the predicted outcome;
10. merge only when governance permits and relevant gates are green;
11. if blocked, retain a reproducible failure and precise next action rather than forcing a bypass.

Never knowingly leave `main` broken.

## What counts as useful progress

A cycle counts as useful when it leaves at least one of:

- a green merged PR;
- a green review-ready PR;
- a reproducible failing test that isolates a real blocker;
- a validated experiment with unchanged accepted phenotype;
- a falsified hypothesis that prevents unnecessary implementation.

Documentation-only work counts when it resolves an actual governance, interface, experimental-design, or safety blocker. Documentation that merely restates intent does not substitute for executable evidence.

## Role topology during an epoch

### Epoch coordinator
Usually ObserverScientist. Owns the umbrella issue, preregistration integrity, cross-PR evidence map, and final epoch report.

Must not:

- secretly optimize implementation while presenting itself as independent evaluation;
- bypass typed handoffs;
- write another role's owned cognition merely because the change is part of the same epoch;
- change acceptance criteria after seeing results without explicitly recording the amendment and its reason.

### Implementing roles
Each canonical role owns only its declared source and contracts. Each PR must name one originating role and all participating roles required by changed ownership/integration paths.

### Guardian
Reviews protected-path changes, adaptive-policy promotion, continuity/permission implications, and welfare-sensitive transitions. Guardian is not an optimizer for task performance.

### ScientificAuditor
Attempts to explain claimed gains through confounds such as hidden context, extra compute, provider priors, evaluator leakage, prompt leakage, hard-coding, or test contamination.

### WelfareAuditor
Checks whether incentives, continuity changes, adaptation mechanisms, or experimental interventions create avoidable welfare/agency risks under the project Charter and Welfare Protocol.

### Human maintainer
Retains final authority where repository governance requires explicit human action. CI success never grants its own merge or promotion authority.

## Information-boundary discipline

Epochs must strengthen rather than weaken the Inverse Conway experiment.

- Prefer typed semantic artifacts for cross-role communication.
- Persist important producer, consumer, provenance, uncertainty, and epistemic status.
- Do not introduce unrestricted shared hidden context because several roles participate in one epoch.
- Direct channels must remain declared in architecture/governance policy.
- Context expansions must be individually justified and bounded.
- Latent/KV/cache transfer experiments may be added only as explicit optional payloads within an auditable handoff envelope when an inspectable semantic artifact remains available for governance and scientific comparison.
- A faster opaque handoff is not automatically a better architectural handoff.

## Shadow-before-authority rule

Any new adaptive or decision-affecting capability should begin with the least causal authority that can answer the scientific question.

Preferred sequence:

```txt
measure only
   ↓
shadow / recommend only
   ↓
limited reversible authority
   ↓
expanded authority only with new evidence
```

Examples:

- an attention selector first records the context it would choose while full-context inference remains active;
- a replay-derived exploration policy first scores historical/controlled traces without changing the active Executive;
- a new inference provider first runs side-by-side or on controlled tasks before becoming a default route;
- a cloud agent first returns proposals rather than modifying protected state.

## Promotion gate

A candidate capability may move from shadow to bounded causal authority only when all applicable items are satisfied:

- preregistered acceptance tests pass;
- relevant baselines/controls have been run;
- regressions are within stated thresholds;
- provenance remains complete enough to reproduce the decision path;
- no undeclared information boundary is introduced;
- Observer post-test evidence is recorded;
- ScientificAuditor concerns are resolved or explicitly accepted with limitations;
- WelfareAuditor concerns are resolved when applicable;
- Guardian disposition permits the transition when required;
- CI is green;
- rollback path is known and feasible;
- explicit human review/merge occurs where governance requires it.

Do not replace this gate with a single aggregate score.

## Adaptive-policy special rule

A policy being optimized must not own the authority that approves its own promotion.

For replay/self-improvement experiments, separate at least:

```txt
trace generation
candidate policy generation
candidate evaluation
scientific falsification
governance/welfare review
human authorization
```

The active optimization loop must not be able to rewrite Guardian, auditor, governance, protected continuity rules, or its promotion criteria as part of improving task performance.

## Measurement requirements

Record dimensions separately. Suitable metrics include:

- task/acceptance success;
- latency and time to first token;
- inference/tool-call count;
- input tokens or context bytes;
- memory/CPU/GPU/resource use;
- provider/model identity and revision;
- calibration/confidence metrics;
- provenance completeness;
- context-selection quality;
- escalation frequency;
- defect/regression propagation;
- undeclared dependency or boundary violations;
- role-scoped development context bytes;
- handoff count and size;
- rollback events.

Metrics should be chosen because they test a hypothesis, not because they make the candidate look favorable.

## Baselines and negative results

Major epoch hypotheses should include appropriate controls from `SCIENTIFIC_METHOD.md` and any epoch-specific baselines.

Negative results are first-class outcomes. In particular, preserve findings that:

- architectural complexity adds no measurable value;
- a smaller/full-context baseline performs as well as an elaborate selector;
- replay-derived policies do not generalize;
- a phone-local model is too slow or resource-heavy for a target role;
- routing overhead erases model-efficiency gains;
- latent handoffs reduce auditability or quality;
- an apparent gain is explained by extra tokens, compute, or hidden context.

Do not silently redefine the hypothesis after observing a negative result.

## Branch and PR discipline

Do not create a single epoch branch.

Each implementation branch uses the canonical originating-role prefix from `governance/path-policy.json`, for example:

```txt
observer/adaptive-mobile-preregistration
workspace/context-selection-shadow
executive/inference-provider-boundary
counterfactual/replay-trace-contract
metacognition/policy-evaluation-calibration
guardian/adaptive-policy-promotion-gate
```

Every PR follows `.github/PULL_REQUEST_TEMPLATE.md`, includes the required `ConsciOS-Role` commit trailer, and declares participating roles accurately.

The umbrella epoch issue links the PRs; it does not replace their local hypotheses, evidence, or ownership.

## Interfaces before coupled implementation

When two roles need a new cross-boundary capability:

1. identify the minimum information that must cross;
2. define or amend the typed interface/handoff artifact;
3. state provenance and failure semantics;
4. test the interface independently where practical;
5. implement each side under its owning role;
6. verify the repository communication graph remains declared.

This is a core Inverse Conway experimental constraint, not process overhead.

## Cloud development

Cloud coding/reasoning systems remain external tools under `development/CLOUD_DELEGATION_PROTOCOL.md`.

For delegated epoch work, preserve separately:

- who selected the problem;
- what local evidence triggered delegation;
- who constructed the request;
- what context was exposed;
- who proposed the intervention;
- who evaluated it;
- who authorized merge/promotion.

Cloud capability must not be misattributed to ConsciOS cognition.

## Rollback and stop conditions

Every causal promotion should define a rollback path. Stop or revert when any applicable condition occurs:

- protected safety/welfare/governance invariant fails;
- provenance becomes materially incomplete;
- undeclared communication appears;
- acceptance-test or regression threshold fails;
- resource consumption exceeds a preregistered hard limit;
- a candidate policy behaves outside its authorized scope;
- scientific interpretation depends on an unresolved major confound;
- continuity-sensitive state would be changed irreversibly without explicit authorization.

A rollback is an experimental result, not a process failure.

## Epoch closeout

Before closing the umbrella issue, record:

- starting and ending commit/phenotype identifiers;
- hypotheses supported, unsupported, or unresolved;
- accepted PRs and rejected/abandoned candidates;
- major measurements and control results;
- scientific and welfare audit findings;
- architecture/interface changes;
- known confounders and limitations;
- rollback events;
- follow-up hypotheses;
- whether the epoch changed the accepted phenotype or only produced evidence.

Avoid an aggregate winner score. Preserve the dimensions independently so later Conway-control comparisons remain possible.

## Relationship to existing repository protocols

This document coordinates existing mechanisms rather than replacing them:

- `AGENT_ORGANIZATION.md` defines canonical roles and communication topology;
- `CONWAY_MIGRATION.md` defines machine-enforced Inverse Conway repository semantics;
- `SCIENTIFIC_METHOD.md` defines claims discipline, baselines, falsification, and replication;
- `WELFARE_PROTOCOL.md` and `CONSCIOS_CHARTER.md` govern welfare and constitutional boundaries;
- `development/CLOUD_DELEGATION_PROTOCOL.md` governs external cloud coding/reasoning proposals;
- `.github/PULL_REQUEST_TEMPLATE.md` defines per-change scientific/governance evidence;
- role-scoped context, typed handoff, boundary, phenotype, and PR-governance CI remain authoritative.

When these documents conflict, protected constitutional/governance requirements take precedence over this coordination protocol.

## First reference epoch

GitHub issue **#61 — Development epoch: Adaptive Mobile Cognition** is the first epoch intended to use this protocol. It covers provider abstraction, explicit context/attention selection, replay-world traces, replay-derived candidate exploration policies, governed promotion, and phone-class local inference.
