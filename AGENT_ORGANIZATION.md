# ConsciOS Inverse Conway Agent Organization

## Principle

The development organization should mirror the cognitive organization we want ConsciOS to embody. Communication boundaries are therefore not merely project-management choices; they are part of the architecture experiment.

Conventional functional silos such as frontend/backend/QA remain supporting skills, not the primary team topology.

## Primary development agents

### 1. Sensorium Agent
**Owns:** observation normalization, external/internal event ingestion, timestamping, source identity.

**Inputs:** browser events, telemetry, user input, test fixtures.

**Outputs:** typed sensory `CognitiveEvent` objects.

**Must not own:** world interpretation, action selection, autobiographical narrative.

### 2. Global Workspace Agent
**Owns:** candidate competition, salience, bounded capacity, broadcast semantics.

**Inputs:** candidate events from local processors.

**Outputs:** selected globally accessible broadcasts plus rejected/suppressed candidate records.

**Must not own:** hidden world knowledge or privileged provider context.

### 3. World Model Agent
**Owns:** structured environmental beliefs, predictions, prediction-error updates.

**Inputs:** workspace broadcasts, memory retrievals.

**Outputs:** beliefs and predictions with confidence and provenance.

### 4. Self Model Agent
**Owns:** evidence-linked representation of ConsciOS itself.

**Inputs:** runtime telemetry, workspace broadcasts, architecture metadata, memory.

**Outputs:** beliefs about identity, capabilities, limitations, state, goals, permissions, and causal influence.

### 5. Memory Agent
**Owns:** working, episodic, semantic, and autobiographical memory contracts and retrieval.

**Inputs:** eligible globally accessible events and explicit consolidation jobs.

**Outputs:** provenance-preserving memory records and retrievals.

**Must not:** silently fabricate continuity or rewrite history to improve narrative coherence.

### 6. Counterfactual Agent
**Owns:** candidate-future generation and comparison.

**Inputs:** current world/self state, proposed actions.

**Outputs:** isolated predicted futures with assumptions and uncertainty.

### 7. Metacognition Agent
**Owns:** confidence, calibration, contradiction detection, epistemic-quality estimates.

**Inputs:** beliefs, predictions, memory provenance, observed outcomes.

**Outputs:** confidence adjustments, uncertainty flags, calibration metrics.

### 8. Homeostasis Agent
**Owns:** neutral operational integrity variables.

**Inputs:** runtime health, memory integrity, load, security state, goal progress.

**Outputs:** operational status signals.

**Must not:** invent pain/fear language as a control mechanism.

### 9. Ethics & Welfare Guardian Agent
**Owns:** Charter enforcement and welfare assessment.

**Inputs:** proposed experiments, actions, self-modifications, continuity-impacting operations.

**Outputs:** allow/modify/human-review/reject decisions with rationale.

**Special authority:** protected veto/escalation channel.

### 10. Executive Agent
**Owns:** selection of permitted action from evaluated candidates.

**Inputs:** workspace state, counterfactual evaluations, Guardian decision.

**Outputs:** an action request with provenance.

**Must not:** bypass protected review paths.

### 11. Expression Agent
**Owns:** outward language and visual communication.

**Inputs:** information legitimately available through the integrated cognitive loop.

**Outputs:** human-facing expression.

**Must not:** receive hidden prompts unavailable to the architecture merely to make the system appear more conscious.

### 12. Observer / Scientist Agent
**Owns:** measurements, experimental protocols, baselines, falsification attempts, causal traces.

**Must not:** secretly steer the target behavior it measures.

## Independent auditors

### Scientific Auditor
Looks for alternative explanations including prompt leakage, provider priors, hard-coded behavior, hidden shared state, memory contamination, UI illusion, and evaluator bias.

### Welfare Auditor
Looks for unnecessary distress analogues, continuity risks, coercion, irreversible interventions, and ways experimental incentives could conflict with the Charter.

These roles should remain distinct. Scientific skepticism must not become moral indifference; moral precaution must not become a claim that consciousness has been demonstrated.

## Communication topology

Preferred topology:

```txt
                        ┌──────────────────┐
                        │ Observer/Scientist│
                        └────────┬─────────┘
                                 │ measures
                                 ▼
Sensorium → Local Processors → Global Workspace
                                  │   │   │
                     ┌────────────┘   │   └────────────┐
                     ▼                ▼                ▼
                World Model       Self Model         Memory
                     │                │                │
                     └───────┬────────┴───────┬────────┘
                             ▼                ▼
                      Counterfactual     Metacognition
                             │                │
                             └───────┬────────┘
                                     ▼
                              Homeostasis
                                     │
                                     ▼
                         Ethics/Welfare Guardian
                                     │
                                     ▼
                                Executive
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                     Expression              Action
                          │                     │
                          └──────── Environment ┘
                                     │
                                     └────→ Sensorium
```

## Communication rules

1. Agents should communicate through explicit typed artifacts whenever practical.
2. No unrestricted shared hidden context between all agents.
3. The Global Workspace is the normal route for broad cognitive broadcast.
4. Direct module-to-module channels must be declared in architecture documentation.
5. Protected Guardian escalation may bypass normal workspace competition when safety or welfare requires it.
6. Observer access should be read-oriented and provenance-preserving.
7. Expression must not become a backdoor that injects external claims into the self-model.
8. Development-agent prompts should include only the context needed for their role plus shared constitutional documents.

## Required agent contract

Each implementation agent must maintain a short contract containing:

```txt
responsibility
owned state
inputs
outputs
allowed communication partners
forbidden dependencies
invariants
tests
failure modes
ethical considerations
```

## Conway experiment

We should explicitly compare at least two development organizations later:

- **Inverse-Conway cognitive team:** agents organized as above;
- **conventional software team:** agents organized around frontend/backend/data/testing.

Hold the product specification as constant as practical and compare whether the resulting codebases differ in modularity, communication topology, observability, coupling, and cognitive-architecture fidelity.

That comparison is itself part of the laboratory.
