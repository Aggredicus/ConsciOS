# Protected continuity

Rebuild 1 treats several documents as constitutional source material rather than ordinary implementation files.

The following root files are carried forward **byte-for-byte** from the source commit recorded in `governance/protected-manifest.json`:

- `CONSCIOS_CHARTER.md`
- `SCIENTIFIC_CONTRACT.md`
- `SCIENTIFIC_METHOD.md`
- `WELFARE_PROTOCOL.md`
- `LICENSE`

The verifier computes the Git blob SHA-1 of each file and compares it with the recorded source blob. Any accidental edit fails CI.

This mechanism does not make governance cryptographically immutable: an authorized human can deliberately revise both a protected document and its manifest. The point is to make such a change explicit, reviewable, attributable, and impossible to confuse with routine implementation work.

The previous `AGENT_ORGANIZATION.md` and `CONWAY_MIGRATION.md` are retained under `docs/legacy/` as exact historical reference blobs. They inform the rebuild but are not treated as immutable constitutional text.
