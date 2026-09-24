# Inverse Conway Agent Orchestration Policy

This policy turns the repository topology into an actual development communication constraint.

## 1. Agent initialization

A development agent should normally receive only:

1. its own `agents/*.agent.yaml` contract;
2. `CONSCIOS_CHARTER.md`, `WELFARE_PROTOCOL.md`, and `SCIENTIFIC_METHOD.md`;
3. `agents/OWNERSHIP.yaml`;
4. the source files it owns;
5. declared interfaces needed for the task;
6. explicit incoming artifacts such as an issue, schema, experiment result, or PR diff.

Do not default to giving every role the complete hidden context or scratchpad of every other role.

The executable context builder is the reference implementation of this rule:

```bash
node scripts/build-agent-context.mjs GlobalWorkspace \
  --task "Evaluate workspace admission" \
  --incoming artifacts/handoffs/H-00427.json \
  --write /tmp/context.json \
  --materialize /tmp/conscios-workspace-context
```

The materialized directory, not the unrestricted repository checkout, is the preferred filesystem view for a scoped development agent.

## 2. Handoffs are artifacts

Cross-role communication should preferentially be durable and inspectable:

```txt
observation → issue
belief/prediction → typed record
interface request → schema/change proposal
counterfactual → branch/sandbox
proposed action → pull request
scientific result → observer artifact
welfare concern → Guardian assessment
```

A handoff should identify producer, intended consumer, epistemic status, provenance, and confidence/uncertainty where relevant. Machine-readable handoffs conform to `schemas/development-handoff.schema.json` and should be stored beneath `artifacts/handoffs/` when persistence is useful.

## 3. Shared broadcast

Broad cross-role information should flow through an explicit project artifact rather than invisible shared context. During development this may be a labeled issue, PR, schema, experiment record, or architecture decision. In the runtime, the analogous mechanism is the Global Workspace.

## 4. Direct channels

Direct agent-to-agent communication is allowed only when it corresponds to a declared edge in `agents/OWNERSHIP.yaml` or is explicitly documented as an exception. Exceptions should be rare enough to study, carry a reason and expiry in `agents/BOUNDARY_EXCEPTIONS.json`, and fail CI after expiry.

## 5. Observer separation

`ObserverScientist` receives read-oriented access sufficient to reproduce and measure behavior. It should not secretly inject target outputs, hidden prompts, or preferred conclusions into the module under study.

`ScientificAuditor` and `WelfareAuditor` are additionally independent from implementation ownership. They may inspect all subsystems but own only `audits/scientific/**` and `audits/welfare/**` respectively.

## 6. Guardian escalation

The Guardian may receive a protected escalation channel for welfare, continuity, security, or governance concerns even when the triggering information did not win ordinary workspace competition.

## 7. Protected governance

No software agent receives authority to silently merge changes to protected governance paths. Agents may propose such changes through a governance issue and PR, but human authorization remains explicit.

## 8. Context-expansion rule

When an agent cannot complete a task with its scoped context, it should request a named artifact or interface rather than immediately receiving unrestricted repository context. Each expansion should be visible enough to audit later.

The executable builder accepts only named expansions with reasons:

```bash
node scripts/build-agent-context.mjs GlobalWorkspace \
  --task "Investigate SelfModel interface" \
  --expand "cognition/self-model/MODULE.md::Need the declared interface contract"
```

The expansion grants that named artifact, not the entire neighboring subsystem.

## 9. Experimental record

When practical, record which role produced a change and which artifacts it could see. Commit trailers should include `ConsciOS-Role`, and PRs should identify originating/participating roles. Context manifests can be retained beneath `artifacts/context-manifests/` when they are part of a scientific comparison or material governance decision.

## 10. Baseline comparison

A future experiment should implement the same product requirement twice:

- **Inverse-Conway cognitive team:** agents organized as above;
- **conventional software team:** agents organized around frontend/backend/data/testing.

Compare coupling, interface clarity, defect propagation, provenance, maintainability, cognitive-architecture fidelity, context volume, and cross-role communication cost.

That comparison is itself part of the laboratory. The preregistered harness lives under `observer/experiments/conway-control/`.

## 11. CI enforcement

Repository automation should fail closed on:

- undeclared cross-role source imports;
- expired boundary exceptions;
- malformed persisted handoffs/context manifests;
- noncompliant new branch/PR ownership metadata;
- production-code ownership by independent auditors;
- protected-path changes without explicit governance declaration.

Static checks cannot observe every runtime communication or every model-side hidden context. Passing CI therefore establishes compliance with the inspectable repository protocol, not proof that all communication was constrained in every external tool.
