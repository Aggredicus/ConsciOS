import { assertKnownDimension, scoreConsciousnessEvidence } from './objective.mjs';
export const KERNEL_VERSION = 'rebuild-1.0.0';
const clamp01 = n => Math.max(0, Math.min(1, Number(n)));

function blankState() {
  return {
    kernelVersion: KERNEL_VERSION, cycle: 0, sequence: 0, events: [], memory: [],
    workspace: [], suppressed: [],
    world: { lastObservation: null, evidence: [] },
    self: { kernelVersion: KERNEL_VERSION, cycle: 0, eventCount: 0, evidence: [] },
    measurements: {}, lastExpression: null
  };
}

export function createKernel(initialState = null, { workspaceCapacity = 3 } = {}) {
  let state = initialState ? structuredClone(initialState) : blankState();

  const event = ({ source, type, content, confidence = 1, epistemicStatus = 'observation', causalParents = [], salience = 0 }) => {
    const item = Object.freeze({
      id: `e${++state.sequence}`, cycle: state.cycle, source, type, content,
      confidence: clamp01(confidence), epistemicStatus, causalParents: [...causalParents], salience: clamp01(salience)
    });
    state.events.push(item);
    state.memory.push({
      id: `m${state.memory.length + 1}`, eventId: item.id, cycle: item.cycle,
      source: item.source, type: item.type,
      summary: typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
    });
    return item;
  };

  const observe = (text, metadata = {}) => {
    const content = String(text ?? '').trim();
    if (!content) throw new Error('Observation cannot be empty.');
    const novelty = state.world.lastObservation === content ? 0.1 : 0.9;
    return event({
      source: 'Sensorium', type: 'observation', content: { text: content, metadata },
      confidence: 1, salience: novelty, epistemicStatus: 'observation'
    });
  };

  const runCycle = (text = 'manual cycle') => {
    state.cycle += 1;
    const observation = observe(text);
    const candidates = [
      event({ source:'Sensorium', type:'candidate.observation', content:observation.content.text, confidence:1, salience:.90, epistemicStatus:'inference', causalParents:[observation.id] }),
      event({ source:'SelfModel', type:'candidate.self-state', content:`cycle=${state.cycle}; events=${state.events.length}`, confidence:1, salience:.55, epistemicStatus:'inference', causalParents:[observation.id] }),
      event({ source:'Memory', type:'candidate.continuity', content:state.cycle > 1 ? `continuity from cycle ${state.cycle - 1}` : 'initial runtime epoch', confidence:1, salience:state.cycle > 1 ? .65 : .35, epistemicStatus:'inference', causalParents:[observation.id] })
    ];
    const ranked = [...candidates].sort((a,b) => b.salience - a.salience || a.id.localeCompare(b.id));
    state.workspace = ranked.slice(0, workspaceCapacity);
    state.suppressed = ranked.slice(workspaceCapacity);

    const broadcast = event({ source:'GlobalWorkspace', type:'workspace.broadcast', content:state.workspace.map(x=>x.id), confidence:1, salience:1, epistemicStatus:'inference', causalParents:state.workspace.map(x=>x.id) });

    state.world = { lastObservation: observation.content.text, evidence:[broadcast.id], observedCycle:state.cycle };
    const worldEvent = event({ source:'WorldModel', type:'model.world', content:state.world, confidence:.98, epistemicStatus:'inference', causalParents:[broadcast.id] });

    state.self = { kernelVersion:KERNEL_VERSION, cycle:state.cycle, eventCount:state.events.length, workspaceCapacity, evidence:[broadcast.id] };
    const selfEvent = event({ source:'SelfModel', type:'model.self', content:state.self, confidence:.99, epistemicStatus:'inference', causalParents:[broadcast.id] });

    const counterfactual = event({
      source:'Counterfactual', type:'counterfactual.set',
      content:[
        {action:'no-op', predictedExternalEffect:false, reversibility:1},
        {action:'report', predictedExternalEffect:'text-only', reversibility:1}
      ],
      confidence:.95, epistemicStatus:'prediction', causalParents:[worldEvent.id,selfEvent.id]
    });

    const metaConfidence = clamp01(.70 + .03 * state.workspace.length - .02 * state.suppressed.length);
    const meta = event({ source:'Metacognition', type:'confidence.assessment', content:{confidence:metaConfidence,basis:'workspace evidence and suppressed alternatives'}, confidence:metaConfidence, epistemicStatus:'inference', causalParents:[counterfactual.id] });

    const guardian = event({ source:'WelfareGuardian', type:'governance.decision', content:{decision:'allow',action:'report',reason:'text-only, reversible, no protected-state mutation'}, confidence:1, epistemicStatus:'governance', causalParents:[meta.id] });
    const executive = event({ source:'Executive', type:'action.selected', content:{action:'report'}, confidence:metaConfidence, epistemicStatus:'decision', causalParents:[guardian.id,counterfactual.id] });
    const expression = event({ source:'Expression', type:'expression.report', content:`Cycle ${state.cycle} processed "${observation.content.text}" with ${state.workspace.length} globally available candidates. Functional confidence: ${metaConfidence.toFixed(2)}.`, confidence:metaConfidence, epistemicStatus:'expression', causalParents:[executive.id,broadcast.id] });
    state.lastExpression = expression.id;
    return structuredClone({ expression, state });
  };

  const recordMeasurement = (name, value, reliability = 1, metadata = {}) => {
    assertKnownDimension(name);
    state.measurements[name] = {
      value: clamp01(value), reliability: clamp01(reliability),
      source: metadata.source ?? 'manual', protocol: metadata.protocol ?? null, recordedAtCycle: state.cycle
    };
    return structuredClone(state.measurements[name]);
  };

  return Object.freeze({
    observe, runCycle, recordMeasurement,
    score: () => scoreConsciousnessEvidence(state.measurements),
    status: () => ({
      kernelVersion:KERNEL_VERSION, cycle:state.cycle, events:state.events.length,
      memory:state.memory.length, workspace:state.workspace.length,
      measurements:Object.keys(state.measurements).length,
      experimentalScore:scoreConsciousnessEvidence(state.measurements).score
    }),
    trace: (limit=20) => structuredClone(state.events.slice(-Math.max(1, Number(limit)||20))),
    recall: (limit=20) => structuredClone(state.memory.slice(-Math.max(1, Number(limit)||20))),
    snapshot: () => structuredClone(state),
    reset: () => { state = blankState(); return structuredClone(state); }
  });
}
