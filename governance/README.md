# Repository governance

This directory contains machine-readable development-governance policy for the Inverse Conway experiment.

- `path-policy.json` maps canonical roles to branch prefixes and integration/protected paths.
- `legacy-pr-exceptions.json` contains only explicit, expiring exceptions for PRs opened before enforcement existed.

GitHub server-side branch/ruleset state is specified under `.github/rulesets/` and documented in `.github/RULESET_SETUP.md`. The live server setting is intentionally audited separately because repository files cannot enforce GitHub administration by themselves.

Governance policy constrains how code is changed; it does not grant any AI role authority to merge protected changes or modify the Charter/Welfare Protocol without explicit human action.
