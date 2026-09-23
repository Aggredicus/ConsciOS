# v0.7 CognitiveModel Adapter Experiment

## Purpose

Establish a replaceable inference boundary before any real language model is permitted into ConsciOS.

## What this experiment tests

- explicit context manifests rather than implicit all-context access;
- provider/model identity and hidden-state declarations;
- typed success, timeout, and error behavior;
- deterministic replay;
- malformed output rejection;
- preservation of causal source IDs;
- absence of network/provider/API-key capabilities;
- separation between inference infrastructure and outward Expression.

## What this experiment does not do

- connect OpenAI, Ollama, WebGPU, llama.cpp, or any external/local generative model;
- alter the v0.6 causal loop;
- give Expression direct model access;
- create persistent model identity;
- consume the reserved First Expression Protocol;
- provide evidence of artificial consciousness.
