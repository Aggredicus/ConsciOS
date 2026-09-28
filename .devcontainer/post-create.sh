#!/usr/bin/env bash
set -euo pipefail

git config --global --add safe.directory "$PWD" >/dev/null 2>&1 || true

echo "ConsciOS development container initialized."
node scripts/development-doctor.mjs

cat <<'EOF'

Common commands:
  python3 -m http.server 8000
      Serve the repository for browser testing.

  node scripts/development-doctor.mjs --verify
      Run the core Inverse Conway and accepted-runtime smoke checks.

  node scripts/build-development-save-state.mjs
      Build a deterministic provider-neutral continuation ZIP under
      .conscios/save-states/.

Optional notebook interface:
  python3 -m pip install --user jupyterlab
  python3 -m jupyter lab --ip=0.0.0.0 --port=8888 --no-browser
EOF
