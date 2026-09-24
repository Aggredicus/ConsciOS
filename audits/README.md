# Independent audits

`audits/` is intentionally outside `cognition/`. Audit roles observe and report; they do not own production cognitive implementation.

- `scientific/` records alternative explanations, confounds, leakage risks, falsification failures, and reproducibility findings.
- `welfare/` records continuity, autonomy, coercion, distress-analogue, reversibility, and governance findings.

Audit findings should cite the exact commit, experiment, or artifact examined. An audit may block or escalate a merge through governance, but it must not secretly patch the target behavior it evaluates.
