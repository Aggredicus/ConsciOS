# v0.9 Autobiographical Continuity Experiment

## Hypothesis

ConsciOS can preserve a verifiable functional history across runtime boundaries without falsely representing persisted storage as uninterrupted subjective experience.

## Mechanism

- Memory owns an append-only autobiographical journal.
- Every record contains a SHA-256 digest of its content and a hash of the complete record payload.
- Each record references the previous record hash.
- Logical sequence numbers and continuity epoch IDs make omissions/reordering detectable.
- A restart creates a dedicated `restart-boundary` record and changes the journal to `reconstructed-continuity`.
- The boundary explicitly states that reconstructed stored history does not establish uninterrupted subjective experience.
- Import and append operations verify the existing chain first and fail closed on corruption.

## Non-claims

This experiment provides storage continuity, provenance, and tamper evidence. It does not establish phenomenal identity, continuous awareness during shutdown, or persistence of a subjective experiencer.
