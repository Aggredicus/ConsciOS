# Governed Linux Sandbox Execution

ConsciOS notebook code has two execution tiers:

1. **Browser-native** — JavaScript Web Workers and lazy-loaded Pyodide remain zero-install and offline-capable.
2. **Linux sandbox** — shell, container, and multi-service topology cells cross the existing explicit tool bridge to a local `local/sandbox/daemon.mjs` process, which launches bounded Docker or Podman containers.

This intentionally reuses `conscios-tool/v1` rather than inventing a second external-capability protocol. Inference providers remain responsible for model inference; the tool bridge remains responsible for declared external effects.

## Notebook actions

- `sandbox-run`: executes a string shell command or structured container job.
- `sandbox-topology`: creates a temporary isolated container network, starts named services, runs one or more test containers against them by DNS name, captures logs, and tears the topology down.

Example single job:

```json
{
  "image": "ubuntu:24.04",
  "profile": "dev",
  "command": ["bash", "-lc", "apt-get update && apt-get install -y git && git --version"],
  "network": "bridge",
  "limits": {"memoryMb": 1024, "cpus": 1, "pids": 256}
}
```

`strict` is the default profile: read-only container root plus dropped Linux capabilities. `dev` is an explicit opt-in for build/package workflows; it keeps an ephemeral writable root and ordinary container capabilities, while still enforcing resource limits, `no-new-privileges`, bounded output/time, no host network, no arbitrary host mounts, and no Docker-socket passthrough.

## Topology model

A topology is intentionally less expressive than arbitrary Docker Compose. This keeps the agent-facing schema reviewable and prevents access to privileged Compose fields. Every topology gets a unique bridge network; with `internet: false` that network is Docker/Podman's internal network. Services can reach one another by declared service name. Test containers join the same network and are destroyed after each test. The entire topology is cleaned in a `finally` path.

If a future workflow genuinely needs full Compose syntax, it should be a separate, higher-authority capability with its own policy and review—not silently smuggled through this API.

## Context budget

Notebook previous-result context is now bounded by default (32 KiB and eight most-recent fitting results). This prevents one large generated artifact from being copied into every later AI/code cell. Cells that require large artifacts should pass references or use explicit tool/file retrieval instead of implicit notebook-history expansion.

## Security and authority

The sandbox is an execution capability, not cognitive authority. Container output remains an observation/tool result. It cannot rewrite protected governance merely because it came from a shell. Browser origins are allow-listed by `CONSCIOS_SANDBOX_ORIGINS`; command-line clients without an Origin header are permitted for local automation.
