# Required GitHub `main` ruleset

The repository contains policy-as-code in `.github/rulesets/main.expected.json`, but GitHub repository rules are an administrative server-side setting and cannot be created by repository source code or the currently connected GitHub integration.

## Current solo-maintainer mode

ConsciOS currently has one trusted human maintainer. GitHub does not allow an author to approve their own pull request, so requiring one approval or CODEOWNERS approval now would deadlock legitimate merges.

Create one active branch ruleset targeting `main` with these requirements:

1. require changes through pull requests;
2. set required approvals to **0 while solo-maintainer mode is active**;
3. do **not** require CODEOWNERS approval while there is no second trusted human reviewer;
4. require conversation resolution;
5. require branches/status checks to be up to date;
6. require the Inverse Conway structure, boundary, development-artifact, PR-provenance, role-aware CI, phenotype, and Conway-control checks;
7. block force pushes;
8. block branch deletion.

Human governance is still explicit in solo-maintainer mode: protected paths require a Guardian-origin/participating role, an affirmative protected-path declaration, compliant commit provenance, green CI, and an intentional human merge action. `CODEOWNERS` documents human ownership even though server-side CODEOWNERS review is not yet mandatory.

## Upgrade when a second trusted human reviewer exists

At that point, change the ruleset to:

- required approvals: **1**;
- require CODEOWNERS review: **on**;
- dismiss stale approvals when new commits are pushed.

After enabling or changing the ruleset, run **Verify repository ruleset** from Actions. `scripts/verify-repository-ruleset.mjs --required` checks the live GitHub configuration rather than merely checking this file.
