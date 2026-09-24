# Required GitHub `main` ruleset

The repository contains policy-as-code in `.github/rulesets/main.expected.json`, but GitHub repository rules are an administrative server-side setting and cannot be created by the repository source itself.

Create one active branch ruleset targeting `main` with these requirements:

1. require changes through pull requests;
2. require at least one approval;
3. require CODEOWNERS review for owned files;
4. dismiss stale approvals when new commits are pushed;
5. require conversation resolution;
6. require branches/status checks to be up to date;
7. require the Inverse Conway structure, boundary, development-artifact, and PR-provenance checks;
8. block force pushes;
9. block branch deletion.

After enabling it, run **Verify repository ruleset** from Actions. `scripts/verify-repository-ruleset.mjs --required` checks the live GitHub configuration rather than merely checking this file.

Protected governance remains human-owned through `.github/CODEOWNERS`. Conceptual AI roles are enforced separately through `agents/OWNERSHIP.yaml` and CI.
