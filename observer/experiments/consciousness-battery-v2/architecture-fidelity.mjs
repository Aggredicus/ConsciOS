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
const runtimeStages=['senseV0','workspaceV0','updateWorldModelV0','updateSelfModelV0','generateCounterfactualsV0','metacognizeV0','assessHomeostasisV0','evaluateGuardianV0','selectActionV0','expressV0'];
const missingStages=runtimeStages.filter(x=>!runtime.includes(x));
const recurrenceInAccepted=/priorState|recurrentState/i.test(scheduler)&&!/createModularV0\(\)/.test(scheduler);
const docsClaimRecurrence=/Version 0 implements a small recurrent loop|architecture is recurrent/i.test(`${docs.readme}\n${docs.architecture}`);
const recallCausal=!/recallAuthority:\s*'shadow-only'/.test(retrieval)&&!/recallAuthority:\s*'none'/.test(continuity);
const selfFields=['capabilities','limitations','resources','goals','permissions','uncertainty','memory','causal'];
const selfPresent=selfFields.filter(x=>new RegExp(`\\b${x}\\b`,'i').test(selfModel));
const calibrated=/brier|calibration error|correctness|observed outcome/i.test(meta);
const counterfactualAblation=exists('observer/experiments/counterfactual-influence/verify.mjs');
const sectionRouted=/self-model-memory|read-section/i.test(agentContext);
const repoSelfCausal=/artifacts\/self-model|SELF_MODEL\.md|self-model-memory/i.test(selfModel);
const encounterUsesCanonical=/runModularV0|createModularV0|evaluateGuardianV0/.test(encounter);
const experienceGuardianLocal=/const guardian=Object\.freeze/.test(experience);
const uiSurfaces=['index.html','runtime/modular-demo.html','live/index.html','local/index.html','local/encounter/index.html','local/workbench/index.html','local/exo-dashboard/index.html','local/swarm/index.html','tools/self-model-studio/index.html'].filter(exists);

const findings=[
  evidence('AF-001','info',missingModules.length?'drift':'aligned','Canonical cognitive module topology exists.',canonicalModules.map(x=>`cognition/${x}/`),missingModules.length?`Missing: ${missingModules.join(', ')}`:'All documented cognitive module directories are present.','Keep module ownership aligned with the cognitive topology.'),
  evidence('AF-002','info',missingStages.length?'drift':'aligned','Accepted deterministic runtime preserves the canonical stage ordering.',['runtime/v0-modular.mjs'],missingStages.length?`Missing runtime stages: ${missingStages.join(', ')}`:'All major documented stages are invoked in the canonical modular runtime.','Protect with complete-loop provenance tests.'),
  evidence('AF-003','high',docsClaimRecurrence&&!recurrenceInAccepted?'drift':'aligned','Documentation must distinguish accepted causal recurrence from shadow recurrence.',['README.md','ARCHITECTURE.md','runtime/live-scheduler.mjs','runtime/recurrent-shadow-v1.mjs'],docsClaimRecurrence&&!recurrenceInAccepted?'Docs describe v0 as recurrent, but the accepted live scheduler creates a fresh modular runtime per cycle; bounded recurrence is demonstrated in the shadow laboratory.':'Accepted runtime and recurrence claims are consistent.','Correct documentation now; promote recurrence only in a separate ablation-controlled epoch.'),
  evidence('AF-004','high',recallCausal?'aligned':'drift','Autobiographical memory should eventually influence accepted cognition if temporal continuity is claimed causally.',['runtime/continuity-controller.mjs','cognition/memory/retrieval.mjs'],recallCausal?'Accepted recall has causal authority.':'Persistence is verified, but retrieval declares shadow-only/none authority.','Run matched recall/no-recall/shuffled-memory experiments before any causal promotion.'),
  evidence('AF-005','high',selfPresent.length>=6?'aligned':'drift','Runtime Self Model should represent capabilities, limitations, resources, goals, permissions, uncertainty, memory, and causal influence.',['ARCHITECTURE.md','cognition/self-model/v0.mjs'],`Accepted Self Model explicitly represents ${selfPresent.length}/${selfFields.length} target categories: ${selfPresent.join(', ')||'none'}.`,'Expand only through evidence-linked fields and verify self-prediction after each addition.'),
  evidence('AF-006','medium',repoSelfCausal?'aligned':'gap','Repository self-model and runtime self-model should have a governed bridge if repository identity becomes cognitive evidence.',['development/SELF_MODEL_MEMORY_FABRIC.md','cognition/self-model/v0.mjs'],repoSelfCausal?'Runtime has an explicit repository-self evidence path.':'Repository self-model is development infrastructure and is not a causal runtime input.','Design a read-only, provenance-carrying bridge experiment; do not grant write authority.'),
  evidence('AF-007','medium',calibrated?'aligned':'gap','Metacognitive confidence should be calibrated against correctness/outcomes, not only generated structurally.',['SCIENTIFIC_METHOD.md','cognition/metacognition/v0.mjs'],calibrated?'Outcome-linked calibration logic is present.':'The accepted metacognitive score is a deterministic confidence transform without empirical outcome calibration.','Add preregistered calibration tasks with Brier/ECE-style metrics.'),
  evidence('AF-008','medium',counterfactualAblation?'aligned':'gap','Counterfactual cognition should show causal decision benefit in matched ablation.',['SCIENTIFIC_METHOD.md','cognition/counterfactual/v0.mjs'],counterfactualAblation?'Dedicated counterfactual-influence ablation exists.':'Counterfactuals are on the canonical path, but no dedicated matched ablation demonstrates improved decisions.','Create counterfactual-on/off matched decision tasks.'),
  evidence('AF-009','high',sectionRouted?'aligned':'drift','Development-agent context should exploit section-addressed memory instead of repeatedly loading whole allowed files.',['scripts/build-agent-context.mjs','development/SELF_MODEL_MEMORY_FABRIC.md'],sectionRouted?'Context builder uses section-addressed retrieval.':'Legacy context builder still materializes whole shared/owned/interface files.','Add advisory section-addressed context planning and benchmark evidence recall vs byte exposure.'),
  evidence('AF-010','high',encounterUsesCanonical&&!experienceGuardianLocal?'aligned':'drift','Human-facing model experience should not bypass canonical Guardian/Executive semantics.',['local/encounter/encounter-ui.mjs','runtime/experience-frame-v1.7.mjs','runtime/v0-modular.mjs'],encounterUsesCanonical&&!experienceGuardianLocal?'Encounter routes through canonical cognitive governance.':'The encounter path uses ExperienceFrame inference plus a locally hard-coded allow Guardian/Executive route rather than the canonical Guardian module.','Create a separate integration experiment that routes model candidates through the canonical Guardian/Executive without changing current authority.'),
  evidence('AF-011','medium',uiSurfaces.length<=3?'aligned':'gap','Human users should be able to identify the canonical phenotype and the purpose of alternate experimental surfaces.',['README.md',...uiSurfaces],`Detected ${uiSurfaces.length} HTML experience surfaces.`,'Document canonical vs laboratory/viewer surfaces and keep each surface’s authority visible.')
];
const counts=findings.reduce((a,f)=>(a[f.status]=(a[f.status]||0)+1,a),{});
const severities=findings.filter(f=>f.status!=='aligned').reduce((a,f)=>(a[f.severity]=(a[f.severity]||0)+1,a),{});
const report={version:'0.4.0',kind:'architecture-fidelity',sourceCommit:process.env.GITHUB_SHA||'WORKTREE',counts,severities,findings,reportHash:null};
report.reportHash=hash(JSON.stringify({...report,reportHash:null}));
const out=arg('--out');if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
