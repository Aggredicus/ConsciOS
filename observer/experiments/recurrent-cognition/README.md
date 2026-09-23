# v1.4 Recurrent Multi-Cycle Cognition Experiment

## Hypothesis

An explicitly bounded recurrent state from cycle `t` can causally alter processing at cycle `t+1`, producing different prediction error and Global Workspace access for identical current sensory input.

## Fixture

Each cycle receives a runtime-memory observation competing with a neutral environmental event.

- Cycle 1 observes no runtime-memory increase and develops a low next-cycle increase expectation.
- Cycle 2 observes an increase; because that increase was relatively unexpected, prediction error raises the runtime observation's salience and it becomes globally accessible. The next-cycle expectation rises.
- Cycle 3 receives the **same sensory pair as cycle 2**. Under the recurrent expectation, the runtime increase is now less surprising, so its salience falls below the neutral competitor.
- A stateless cycle-3 control receives the exact same sensory pair but uses the neutral prior probability. The runtime event becomes globally accessible again.

Thus current input is held constant while prior recurrent state changes processing.

## Recurrent interface

Only the typed `recurrentState` artifact crosses cycles. It contains bounded World/Self summaries, one prediction summary, the previous Executive action ID, homeostatic status, cycle ID, and a causal anchor ID. The prior event graph, persisted autobiography, model hidden state, and chat history do not cross the boundary.

## Causality

The next cycle's `recurrent.context` event cites the previous cycle's `recurrent.anchor` as a causal parent. Prediction-error candidates cite the context event, yielding an inspectable cross-cycle causal chain.

## Interpretation

The experiment demonstrates functional temporal recurrence and context-dependent processing. It does not demonstrate phenomenal temporal experience or continuous consciousness.
