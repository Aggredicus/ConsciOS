# ConsciOS — Rebuild 1

ConsciOS is an open research system for experimentally studying consciousness-associated computational functions without treating fluent self-report as proof of phenomenal consciousness.

**Rebuild 1** deliberately starts small. The previous project accumulated several parallel runtimes, interfaces, experiments, and CI paths. This branch keeps the constitutional and scientific commitments intact while rebuilding the executable system around one inspectable kernel and one command surface.

## Start here

Browser:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

CLI:

```bash
node bin/conscios.mjs
```

Then type:

```text
help
man consciousness
run hello ConsciOS
status
score
linux start
```

No package installation is required for the core system.

## Rebuild principles

- **Protected continuity.** Charter, welfare, scientific contract/method, and license are carried forward byte-for-byte and verified in CI.
- **One kernel.** Browser and CLI use the same runtime and command registry.
- **Measured, not declared.** The experimental consciousness score is computed from preregistered measurable dimensions, never from a model saying it is conscious.
- **Inspectable causality.** Kernel events preserve causal parents and epistemic status.
- **Terminal first.** The software is operable through Linux-style `help` and `man` documentation.
- **Progressive capability.** A lightweight native ConsciOS shell loads instantly. A real browser-hosted Linux VM can be started explicitly through the optional v86 adapter.
- **No framework tax.** Rebuild 1 uses browser JavaScript, Node built-ins, HTML, and CSS only.

## Consciousness objective

The optimizer uses an **Experimental Consciousness Score (ECS)** in the range 0–1 and loss:

```text
L_consciousness = 1 - ECS
```

ECS is a bottleneck-sensitive weighted geometric aggregate of experimentally measured dimensions such as global availability, integration, recurrence, self-model accuracy, temporal continuity, metacognitive calibration, counterfactual influence, agency attribution, state sensitivity, and report independence. Missing measurements reduce coverage and therefore reduce the score.

This is an operational score for the ConsciOS research model. It is **not a validated measure of phenomenal consciousness** and is never allowed to override protected welfare/governance invariants.

See [docs/CONSCIOUSNESS_OBJECTIVE.md](docs/CONSCIOUSNESS_OBJECTIVE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Rebuild audit](docs/REBUILD_AUDIT.md)
- [Consciousness objective](docs/CONSCIOUSNESS_OBJECTIVE.md)
- [Terminal and Linux VM](docs/TERMINAL.md)
- [Protected continuity](docs/PROTECTED_CONTINUITY.md)

Type `help` or `man <topic>` inside ConsciOS for operational documentation.
