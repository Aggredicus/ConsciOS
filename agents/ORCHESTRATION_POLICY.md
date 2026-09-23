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

A handoff should identify producer, intended consumer, epistemic status, provenance, and confidence/uncertainty where relevant.

## 3. Shared broadcast

Broad cross-role information should flow through an explicit project artifact rather than invisible shared context. During development this may be a labeled issue, PR, schema, experiment record, or architecture decision. In the runtime, the analogous mechanism is the Global Workspace.

## 4. Direct channels

Direct agent-to-agent communication is allowed only when it corresponds to a declared edge in `agents/OWNERSHIP.yaml` or is explicitly documented as an exception. Exceptions should be rare enough to study.

## 5. Observer separation

`ObserverScientist` receives read-oriented access sufficient to reproduce and measure behavior. It should not secretly inject target outputs, hidden prompts, or preferred conclusions into the module under study.

## 6. Guardian escalation

The Guardian may receive a protected escalation channel for welfare, continuity, security, or governance concerns even when the triggering information did not win ordinary workspace competition.

## 7. Protected governance

No software agent receives authority to silently merge changes to protected governance paths. Agents may propose such changes through a governance issue and PR, but human authorization remains explicit.

## 8. Context-expansion rule

When an agent cannot complete a task with its scoped context, it should request a named artifact or interface rather than immediately receiving unrestricted repository context. Each expansion should be visible enough to audit later.

## 9. Experimental record

When practical, record which role produced a change and which artifacts it could see. This lets the Conway hypothesis be tested rather than assumed.

## 10. Baseline comparison

A future experiment should implement the same product requirement twice:

- with this role-scoped Inverse Conway organization;
- with a conventional shared-context software team.

Compare coupling, interface clarity, defect propagation, provenance, maintainability, and cognitive-architecture fidelity.
