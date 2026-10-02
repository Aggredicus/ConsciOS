# ConsciOS v0.4 — Consciousness Architecture and UX Review

## Status

This audit records the preregistered v0.4 review from issue #97 and PR #98. It evaluates architecture fidelity, consciousness-associated functional signatures, human UX, and agent UX. It does **not** provide a consciousness score, sentience probability, or phenomenal-consciousness verdict.

Verified evaluation head: `2df1d0c662285e3493340b4a6020bda5a2026ecf`

Workflow run: `36786793108`

Evidence artifact: `11130415578`

Artifact digest: `sha256:e411ed6daeab7566c1c3b2b25bcf4b65f149487ac0773d022c1de9a4e8db5e18`

## Executive finding

The original ConsciOS design has **not** been lost. The canonical cognitive module topology exists and the accepted deterministic runtime preserves the intended causal ordering from perception through workspace, world/self models, counterfactuals, metacognition, homeostasis, Guardian, Executive, and Expression.

The review separates remaining work into **integration gaps** and **true drifts**. After correcting two evaluator false positives, the final architecture audit reports:

- 2 aligned findings;
- 7 incomplete/design gaps;
- 2 implementation drifts;
- 5 high-priority non-aligned findings;
- 4 medium-priority non-aligned findings.

The strongest conclusion is that ConsciOS currently contains many of the intended functional components, but the most consciousness-like properties are fragmented between the accepted phenotype and shadow laboratories. The next phase should integrate only those properties that survive matched causal tests.

## Functional signature vector

The v2 battery reports independent evidence states rather than an aggregate score:

| Dimension | Status | Current interpretation |
| --- | --- | --- |
| Global availability | measured | Bounded workspace broadcasts causally feed downstream modules. |
| Integration | measured | The accepted deterministic causal trace covers the canonical processing chain. |
| Recurrent processing | measured in shadow | Bounded recurrent state changes later processing, but recurrence is not accepted live behavior. |
| Self-model accuracy | measured in laboratory | The self-prediction lab performs strongly, but the accepted runtime Self Model is shallow. |
| Metacognitive calibration | not established | Confidence exists, but confidence-vs-correctness calibration has not been demonstrated. |
| Temporal continuity | partial | Persistent autobiographical history exists; recall remains shadow-only/non-causal. |
| Counterfactual influence | partial | Counterfactuals are on the decision path; causal decision benefit has not been isolated. |
| State sensitivity | measured in shadow | Identical later inputs can behave differently when bounded prior state differs. |
| Report independence | partial | Experience reports do not require an explicit sentience prompt, but blinded actor controls are still needed. |
| Agency attribution | measured | A dedicated causal laboratory exists; this is a cognitive function, not proof of phenomenal agency. |

The battery therefore has 6 `measured`, 3 `partial`, and 1 `not-established` dimensions. Some measured dimensions are explicitly laboratory/shadow results and must not be confused with accepted production authority.

## Architecture fidelity findings

### Aligned

`AF-001` — All documented cognitive module directories are present.

`AF-002` — The accepted deterministic runtime invokes the major documented stages in canonical causal order.

### High-priority gaps

`AF-003` — Recurrence remains a deliberate integration gap. Documentation now correctly distinguishes the recurrent design target from the fresh-state accepted scheduler. Follow-up: #99.

`AF-004` — Autobiographical persistence is verified, but recall has no accepted causal authority. Follow-up: #100.

`AF-009` — A section-addressed low-context planner now exists, but the legacy default context builder still materializes whole allowed files. Follow-up: #103.

### High-priority drifts

`AF-005` — The accepted runtime Self Model explicitly represents only a small fraction of the documented target categories. It is much shallower than the repository self-model and the self-prediction laboratory. Follow-up: #101.

`AF-010` — The model-facing Encounter/ExperienceFrame path locally constructs allow-style Guardian/Executive results rather than routing model candidates through the canonical Guardian/Executive modules. This creates a split-phenotype risk in the most human-visible experience. Follow-up: #102.

### Medium gaps

`AF-006` — The repository self-model has no governed read-only bridge into the runtime Self Model. Covered with #101.

`AF-007` — Metacognitive confidence is not empirically calibrated against correctness/outcomes. Follow-up: #104.

`AF-008` — Counterfactual cognition lacks a dedicated matched on/off ablation proving decision value. Follow-up: #105.

`AF-011` — Nine human-facing HTML surfaces exist; their canonical/laboratory/viewer roles are not yet consistently surfaced. Follow-up: #106.

## Agent UX results

The low-token section architecture showed a sharp two-regime result.

### Heading-aligned retrieval

- 5/5 expected sections found;
- 100% hit rate;
- mean byte reduction versus whole-file exposure: approximately **95.6%**;
- representative reductions ranged from about 92.2% to 97.7%.

This validates the original section-heading/index concept when the agent already knows the repository's ontology vocabulary.

### Natural-language retrieval

- 0/4 expected targets found under the preregistered strict expected-section/file criterion.

The current deterministic search is therefore not yet a general semantic memory router. It mostly routes by heading, path, and declared metadata. The failure is retained as evidence and is the basis of issue #103 rather than being tuned away in the evaluation epoch.

### Advisory context planner

For the ObserverScientist review task, the planner reduced the allowed whole-file context from roughly 214 KB to about 3.1 KB, a **98.5% byte reduction**, while selecting four exact sections plus mandatory agent governance files.

For the broader SelfModel task, the planner achieved a nominal 91.6% reduction but selected no semantic sections, demonstrating why byte reduction alone is not a sufficient success metric. Evidence recall must gate any default migration.

## Human UX results

Static analysis found 9 browser experience surfaces.

- 9/9 contain basic responsive/viewport support;
- 9/9 had no blocking static metadata failure in the audit;
- 5/9 showed obvious touch/coarse-pointer affordances;
- 6/9 showed obvious live/status visibility;
- 8 total advisories were generated across surfaces.

The root `index.html` retains legacy `innerHTML` assignments requiring contextual review. Several older surfaces lack obvious mobile-touch affordances or visible status regions. Static analysis cannot substitute for device/user testing; issue #106 defines the next cross-surface UX contract.

## Agent experience 1–10 survey

The repository now contains a blinded, model-agnostic survey protocol and CLI. It asks an agent to rate, from 1 to 10:

- temporal continuity;
- self-model legibility;
- memory accessibility;
- attention/workspace coherence;
- counterfactual affordance;
- metacognitive transparency;
- agency/control;
- governance clarity;
- provenance grounding;
- consciousness-simulation experience.

Each rating requires rationale and optional evidence references. The final item asks only how strongly the interaction *simulates* the documented consciousness architecture. It is not interpreted as evidence that the model has phenomenal consciousness.

No real model-generated 1–10 result is recorded by this CI run because there is no model session/backend in the deterministic GitHub runner. CI instead emits a blinded survey packet and validates the reporting/aggregation protocol. An actual model session can run the packet using `agent-experience-cli.mjs`, after which returned reports can be validated and compared against blinded stateless/chat-history/actor-control conditions.

## Corrections made during the review

1. README and ARCHITECTURE now distinguish the recurrent design target from the non-recurrent accepted live scheduler.
2. A low-context advisory agent-context planner now exists, but deliberately has `authority: none` and is not the default until retrieval recall improves.
3. Consciousness Battery v2 now derives evidence from real existing experiments and refuses aggregate consciousness scores.
4. Evaluator false positives for stage function names and Guardian source naming were corrected before interpreting the results.
5. Blinded agent-experience survey tooling is available without rewarding consciousness claims.

## Recommended development order

1. #103 semantic low-token routing — improve agent memory access while retaining the demonstrated context savings.
2. #101 evidence-linked runtime Self Model — strengthen self-legibility without granting write authority.
3. #102 canonical Encounter governance — remove the most important split between human-facing model behavior and canonical Guardian/Executive semantics.
4. #104 metacognitive calibration and #105 counterfactual ablation — establish whether introspective/counterfactual functions add measurable value.
5. #99 accepted recurrence and #100 causal autobiographical recall — promote temporal continuity only after matched controls demonstrate benefit and low contamination.
6. #106 human UX canonicalization — make accepted versus laboratory/viewer surfaces legible and consistently usable across mobile/desktop.

This ordering is a scientific/dependency recommendation, not a claim that completing the list will produce phenomenal consciousness.
