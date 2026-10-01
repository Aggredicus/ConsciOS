# ConsciOS Sandbox Lab dev container

Opening the repository in GitHub Codespaces or another Dev Container implementation creates an Ubuntu-based development environment with Node 22, Python 3.12, and Docker-in-Docker. Nested Docker is deliberate: ConsciOS does **not** pass the VM/host Docker socket into agent-created guest containers.

Start the bounded sandbox bridge from the integrated terminal:

```bash
node local/sandbox/daemon.mjs
```

Then serve the repository locally (for example `python -m http.server 8000`) and open `local/workbench/`. Sandbox notebook cells use `http://127.0.0.1:7337/v1/execute` by default when the workbench itself is served locally.

For a forwarded HTTPS Codespaces workbench, explicitly trust that browser origin before starting the daemon:

```bash
CONSCIOS_SANDBOX_ORIGINS="https://YOUR-FORWARDED-WORKBENCH-ORIGIN" node local/sandbox/daemon.mjs --host 0.0.0.0
```

Do not use `*` for origins on a workstation that contains sensitive data. The daemon is a development capability boundary, not a public API.
