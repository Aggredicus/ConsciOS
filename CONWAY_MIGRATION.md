# GitHub Inverse Conway Migration v2

ConsciOS treats repository organization as part of the cognitive-architecture experiment. The v2 migration moves this from a naming convention to a machine-enforced development protocol.

## Four homologous layers

```txt
Development organization
        ↓ constrains
GitHub repository topology
        ↓ produces
Software dependency topology
        ↓ instantiates
Cognitive topology
```

The goal is not aesthetic symmetry. It is to make communication constraints causally shape the software and leave enough evidence to test whether that happened.

## Repository semantics

- `main` — currently accepted executable phenotype; not a claim of identity or consciousness.
- `genome/` — protected constitutional and modification invariants.
- `agents/` — development-role contracts, communication permissions, scoped-context policy, and expiring boundary exceptions.
- `cognition/` — source ownership boundaries corresponding to cognitive subsystems.
- `interfaces/` — typed artifacts through which modules communicate.
- `artifacts/` — typed development handoffs and retained context manifests.
- `observer/` — experiments, measurements, causal traces, falsification work, and the matched Conway control laboratory.
- `audits/` — independent Scientific and Welfare audit findings; auditors own no production cognition.
- `runtime/` — embodied integration boundary.
- `phenotype/` — deterministic fingerprint definition for accepted executable architecture.
- `governance/` — machine-readable path/branch/provenance policy.
- `ci/` — role-aware fast-path test routing.
- branches — counterfactual candidate futures, prefixed by the canonical originating role.
- issues — persistent observations, hypotheses, interface requests, handoffs, experiments, and risks.
- pull requests — proposed actions capable of changing the accepted phenotype.

## What CI now enforces

### Source communication graph

`scripts/verify-conway-boundaries.mjs` derives cross-role relative-import edges from source and compares them with `agents/OWNERSHIP.yaml`. Undeclared coupling fails CI. Cognitive implementation may not import outward integration/audit paths. Temporary exceptions require a reason and future expiry in `agents/BOUNDARY_EXCEPTIONS.json`.

### Role-scoped development context

`scripts/build-agent-context.mjs` can create both a SHA-256 context manifest and a materialized filesystem containing only:

1. constitutional/shared artifacts;
2. the role contract;
3. role-owned source;
4. declared interfaces;
5. explicit incoming artifacts;
6. individually named context expansions with reasons.

Example:

```bash
node scripts/build-agent-context.mjs GlobalWorkspace \
  --task "Evaluate workspace admission" \
  --incoming artifacts/handoffs/H-00427.json \
  --write /tmp/context.json \
  --materialize /tmp/conscios-workspace
```

`verify-agent-context.mjs` proves a Workspace context does not silently gain Runtime or SelfModel implementation and that a named expansion stays limited to the named artifact.

### Typed handoffs

Cross-role development transfers can be persisted under `artifacts/handoffs/` using `schemas/development-handoff.schema.json`. A handoff records producer, consumer, epistemic status, provenance, uncertainty, and artifact paths. CI rejects undeclared producer→consumer communication.

### PR, branch, path, and commit provenance

For new PRs:

- `## Originating subsystem` must name exactly one canonical role;
- the branch prefix must match that role;
- every role whose owned/integration paths change must be declared in `## Participating roles`;
- protected-path changes require Guardian participation and an affirmative governance declaration;
- every non-merge commit must carry `ConsciOS-Role: <CanonicalRole>`.

Pre-enforcement open PRs are handled only through explicit expiring entries in `governance/legacy-pr-exceptions.json`.

### Independent auditors

`ScientificAuditor` and `WelfareAuditor` are first-class roles with read-oriented observation scope and ownership only under `audits/scientific/**` and `audits/welfare/**`. They can report/escalate but cannot secretly modify the target implementation they assess.

### Role-aware CI

`ci/subsystems.json` maps roles to fast verifier scripts. A PR runs tests for directly changed roles plus one-hop declared communication neighbors and ObserverScientist. This supplements rather than replaces the complete regression suite.

### Accepted phenotype manifests

`scripts/generate-phenotype-manifest.mjs` hashes the architecture/governance/runtime surfaces and computes a deterministic root hash. Every accepted `main` push uploads the exact phenotype manifest as a workflow artifact keyed by commit SHA.

### Fail-closed negative controls

`observer/experiments/conway-enforcement/verify.mjs` proves that CI rejects:

- an undeclared SelfModel → Guardian import;
- an expired boundary exception;
- a PR commit missing cognitive-role provenance.

The same fixtures are then made compliant and must pass.

## Branch convention

Use `<canonical-prefix>/<short-hypothesis>`, for example:

```txt
workspace/diversity-competition
self-model/evidence-calibration
memory/episodic-consolidation
observer/falsify-workspace-access
guardian/governance-policy
scientific-auditor/provider-confound-review
```

The authoritative prefix map is `governance/path-policy.json`.

## GitHub server-side `main` protection

Repository source cannot create an administrative GitHub ruleset by itself. `.github/rulesets/main.expected.json` and `.github/RULESET_SETUP.md` define the desired live configuration, and `Verify repository ruleset` audits the GitHub setting directly.

While ConsciOS has only one trusted human maintainer, the expected ruleset uses **solo-maintainer mode**: PRs and required checks are mandatory, but required approval count and CODEOWNERS review remain zero/off because GitHub does not allow authors to approve their own PRs. When a second trusted human reviewer exists, turn on one approval and mandatory CODEOWNERS review.

## Matched Conway control experiment

The repository now preregisters a future matched comparison in `observer/experiments/conway-control/`:

- **inverse-conway:** scoped role context + typed handoffs + declared ownership/communication;
- **conventional:** frontend/backend/data/testing organization with shared repository context.

Both conditions should share the same starting commit, product requirement, acceptance tests, model family where practical, and time/turn budget. Metrics are reported separately: coupling, undeclared dependencies, cycles, context bytes, handoffs, defect propagation, regression failures, merge conflicts, architecture violations, and acceptance-test success. There is deliberately no aggregate winner score.

## Scientific limitations

Passing these checks establishes compliance with the inspectable repository protocol. It does not prove that an external development tool exposed no hidden context, nor that static imports capture every runtime communication. Those limitations are why context manifests, handoff records, matched controls, and independent audits remain part of the experiment.

## Protected paths

The governance/genome layer includes at least:

```txt
genome/**
CONSCIOS_CHARTER.md
WELFARE_PROTOCOL.md
SCIENTIFIC_METHOD.md
AGENT_ORGANIZATION.md
agents/**
audits/**
.github/**
```

Software agents may propose changes there, but protected changes remain explicitly governed and human-merged.
