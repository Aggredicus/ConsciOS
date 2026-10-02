#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const argv=process.argv.slice(2);const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d};
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const evidence=(id,severity,status,claim,paths,detail,followUp)=>({id,severity,status,claim,paths,detail,followUp});

const docs={readme:read('README.md'),architecture:read('ARCHITECTURE.md'),scientific:read('SCIENTIFIC_METHOD.md'),contract:read('SCIENTIFIC_CONTRACT.md')};
const runtime=read('runtime/v0-modular.mjs');
const scheduler=read('runtime/live-scheduler.mjs');
const retrieval=read('cognition/memory/retrieval.mjs');
const continuity=read('runtime/continuity-controller.mjs');
const selfModel=read('cognition/self-model/v0.mjs');
const meta=read('cognition/metacognition/v0.mjs');
const agentContext=read('scripts/build-agent-context.mjs');
const experience=read('runtime/experience-frame-v1.7.mjs');
const encounter=read('local/encounter/encounter-ui.mjs');

const canonicalModules=['sensorium','workspace','world-model','self-model','memory','counterfactual','metacognition','homeostasis','guardian','executive','expression'];
const missingModules=canonicalModules.filter(x=>!exists(`cognition/${x}`));
const runtimeStages=['perceiveV0','localProcessV0','workspaceCompetitionV0','updateWorldModelV0','updateSelfModelV0','generateCounterfactualsV0','metacognizeV0','assessHomeostasisV0','guardianGateV0','executiveSelectV0','expressV0'];
const stagePositions=runtimeStages.map(name=>({name,index:runtime.indexOf(name)}));
const missingStages=stagePositions.filter(x=>x.index<0).map(x=>x.name);
const stageOrdered=!missingStages.length&&stagePositions.every((x,i)=>i===0||x.index>stagePositions[i-1].index);
const recurrenceInAccepted=/priorState|recurrentState/i.test(scheduler)&&!/createModularV0\(\)/.test(scheduler);
const docsDistinguishRecurrence=/accepted live scheduler[\s\S]{0,240}(fresh|not yet been promoted|not yet.*accepted)|shadow recurrent-cognition laboratory/i.test(`${docs.readme}\n${docs.architecture}`);
const recurrenceStatus=recurrenceInAccepted?'aligned':docsDistinguishRecurrence?'gap':'drift';
const recallCausal=!/recallAuthority:\s*'shadow-only'/.test(retrieval)&&!/recallAuthority:\s*'none'/.test(continuity);
const selfFields=['capabilities','limitations','resources','goals','permissions','uncertainty','memory','causal'];
const selfPresent=selfFields.filter(x=>new RegExp(`\\b${x}\\b`,'i').test(selfModel));
const calibrated=/brier|calibration error|correctness|observed outcome/i.test(meta);
const counterfactualAblation=exists('observer/experiments/counterfactual-influence/verify.mjs');
const sectionRoutedLegacy=/self-model-memory|read-section/i.test(agentContext);
const advisoryPlanner=exists('scripts/plan-agent-context.mjs');
const contextStatus=sectionRoutedLegacy?'aligned':advisoryPlanner?'gap':'drift';
const repoSelfCausal=/artifacts\/self-model|SELF_MODEL\.md|self-model-memory/i.test(selfModel);
const encounterUsesCanonical=/runModularV0|createModularV0|evaluateGuardianV0|guardianGateV0/.test(encounter);
const experienceGuardianLocal=/const guardian=Object\.freeze/.test(experience);
const uiSurfaces=['index.html','runtime/modular-demo.html','live/index.html','local/index.html','local/encounter/index.html','local/workbench/index.html','local/exo-dashboard/index.html','local/swarm/index.html','tools/self-model-studio/index.html'].filter(exists);

const findings=[
  evidence('AF-001','info',missingModules.length?'drift':'aligned','Canonical cognitive module topology exists.',canonicalModules.map(x=>`cognition/${x}/`),missingModules.length?`Missing: ${missingModules.join(', ')}`:'All documented cognitive module directories are present.','Keep module ownership aligned with the cognitive topology.'),
  evidence('AF-002','info',stageOrdered?'aligned':'drift','Accepted deterministic runtime preserves the canonical stage ordering.',['runtime/v0-modular.mjs'],missingStages.length?`Missing runtime stages: ${missingStages.join(', ')}`:stageOrdered?'All major documented stages are invoked in canonical causal order.':'All stages exist, but their source-order sequence does not match the canonical causal order.','Protect with complete-loop provenance tests.'),
  evidence('AF-003','high',recurrenceStatus,'Accepted recurrence should match the documented recurrent design target without overstating current authority.',['README.md','ARCHITECTURE.md','runtime/live-scheduler.mjs','runtime/recurrent-shadow-v1.mjs'],recurrenceInAccepted?'Accepted live runtime carries recurrent state across cycles.':docsDistinguishRecurrence?'Documentation now accurately distinguishes the recurrent design target from the fresh-state accepted scheduler; recurrence remains a deliberate integration gap.':'Documentation still overstates accepted recurrence relative to the live scheduler.','Promote recurrence only in a separate ablation-controlled epoch.'),
  evidence('AF-004','high',recallCausal?'aligned':'gap','Autobiographical memory should eventually influence accepted cognition if temporal continuity is claimed causally.',['runtime/continuity-controller.mjs','cognition/memory/retrieval.mjs'],recallCausal?'Accepted recall has causal authority.':'Persistence is verified, but retrieval declares shadow-only/none authority.','Run matched recall/no-recall/shuffled-memory experiments before any causal promotion.'),
  evidence('AF-005','high',selfPresent.length>=6?'aligned':'drift','Runtime Self Model should represent capabilities, limitations, resources, goals, permissions, uncertainty, memory, and causal influence.',['ARCHITECTURE.md','cognition/self-model/v0.mjs'],`Accepted Self Model explicitly represents ${selfPresent.length}/${selfFields.length} target categories: ${selfPresent.join(', ')||'none'}.`,'Expand only through evidence-linked fields and verify self-prediction after each addition.'),
  evidence('AF-006','medium',repoSelfCausal?'aligned':'gap','Repository self-model and runtime self-model should have a governed bridge if repository identity becomes cognitive evidence.',['development/SELF_MODEL_MEMORY_FABRIC.md','cognition/self-model/v0.mjs'],repoSelfCausal?'Runtime has an explicit repository-self evidence path.':'Repository self-model is development infrastructure and is not a causal runtime input.','Design a read-only, provenance-carrying bridge experiment; do not grant write authority.'),
  evidence('AF-007','medium',calibrated?'aligned':'gap','Metacognitive confidence should be calibrated against correctness/outcomes, not only generated structurally.',['SCIENTIFIC_METHOD.md','cognition/metacognition/v0.mjs'],calibrated?'Outcome-linked calibration logic is present.':'The accepted metacognitive score is a deterministic confidence transform without empirical outcome calibration.','Add preregistered calibration tasks with Brier/ECE-style metrics.'),
  evidence('AF-008','medium',counterfactualAblation?'aligned':'gap','Counterfactual cognition should show causal decision benefit in matched ablation.',['SCIENTIFIC_METHOD.md','cognition/counterfactual/v0.mjs'],counterfactualAblation?'Dedicated counterfactual-influence ablation exists.':'Counterfactuals are on the canonical path, but no dedicated matched ablation demonstrates improved decisions.','Create counterfactual-on/off matched decision tasks.'),
  evidence('AF-009','high',contextStatus,'Development-agent context should exploit section-addressed memory instead of repeatedly loading whole allowed files.',['scripts/build-agent-context.mjs','scripts/plan-agent-context.mjs','development/SELF_MODEL_MEMORY_FABRIC.md'],sectionRoutedLegacy?'Default context builder uses section-addressed retrieval.':advisoryPlanner?'A low-context section planner now exists, but the legacy default builder still materializes whole shared/owned/interface files.':'Legacy context builder materializes whole allowed files and no section-addressed planner exists.','Benchmark the advisory planner and migrate defaults only after evidence-recall parity is established.'),
  evidence('AF-010','high',encounterUsesCanonical&&!experienceGuardianLocal?'aligned':'drift','Human-facing model experience should not bypass canonical Guardian/Executive semantics.',['local/encounter/encounter-ui.mjs','runtime/experience-frame-v1.7.mjs','runtime/v0-modular.mjs'],encounterUsesCanonical&&!experienceGuardianLocal?'Encounter routes through canonical cognitive governance.':'The encounter path uses ExperienceFrame inference plus a locally hard-coded allow Guardian/Executive route rather than the canonical Guardian module.','Create a separate integration experiment that routes model candidates through the canonical Guardian/Executive without changing current authority.'),
  evidence('AF-011','medium',uiSurfaces.length<=3?'aligned':'gap','Human users should be able to identify the canonical phenotype and the purpose of alternate experimental surfaces.',['README.md',...uiSurfaces],`Detected ${uiSurfaces.length} HTML experience surfaces.`,'Document canonical vs laboratory/viewer surfaces and keep each surface’s authority visible.')
];
const counts=findings.reduce((a,f)=>(a[f.status]=(a[f.status]||0)+1,a),{});
const severities=findings.filter(f=>f.status!=='aligned').reduce((a,f)=>(a[f.severity]=(a[f.severity]||0)+1,a),{});
const report={version:'0.4.1',kind:'architecture-fidelity',sourceCommit:process.env.GITHUB_SHA||'WORKTREE',counts,severities,findings,reportHash:null};
report.reportHash=hash(JSON.stringify({...report,reportHash:null}));
const out=arg('--out');if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
