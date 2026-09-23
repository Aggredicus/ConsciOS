# Cognitive Source Topology

These directories are software ownership boundaries corresponding to the ConsciOS cognitive organization. Cross-module dependencies must use declared interfaces or be documented explicitly.

Current modules: `sensorium`, `workspace`, `world-model`, `self-model`, `memory`, `counterfactual`, `metacognition`, `homeostasis`, `guardian`, `executive`, and `expression`.

The v0 implementation remains in root `index.html` as a compact inspectable baseline. New source work should increasingly originate inside these boundaries and compile/integrate into the browser artifact rather than expanding the monolith indefinitely.
