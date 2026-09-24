import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { loadOwnership,COGNITIVE_ROLES,AUDIT_ROLES,OBSERVER_ROLE } from './conway-lib.mjs';

const modules = ['sensorium','workspace','world-model','self-model','memory','counterfactual','metacognition','homeostasis','guardian','executive','expression'];
const contracts = ['sensorium','workspace','world-model','self-model','memory','counterfactual','metacognition','homeostasis','guardian','executive','expression','observer-scientist','scientific-auditor','welfare-auditor'];

for (const m of modules) assert.ok(existsSync(`cognition/${m}/MODULE.md`), `missing cognitive module boundary: ${m}`);
for (const a of contracts) assert.ok(existsSync(`agents/${a}.agent.yaml`), `missing development-agent contract: ${a}`);
for (const p of [
  'agents/OWNERSHIP.yaml','agents/ORCHESTRATION_POLICY.md','agents/BOUNDARY_EXCEPTIONS.json',
  'audits/README.md','audits/scientific/README.md','audits/welfare/README.md',
  'genome/README.md','interfaces/README.md','observer/README.md','runtime/README.md',
  '.github/PULL_REQUEST_TEMPLATE.md','.github/CODEOWNERS','.github/ISSUE_TEMPLATE/observation.yml',
  '.github/ISSUE_TEMPLATE/hypothesis.yml','.github/ISSUE_TEMPLATE/governance.yml'
]) assert.ok(existsSync(p), `missing Inverse Conway artifact: ${p}`);

const agents=loadOwnership();
for (const name of [...COGNITIVE_ROLES,OBSERVER_ROLE,...AUDIT_ROLES]) assert.ok(agents.has(name),`ownership map missing ${name}`);

const orchestration = readFileSync('agents/ORCHESTRATION_POLICY.md','utf8');
for (const rule of ['Agent initialization','Handoffs are artifacts','Observer separation','Guardian escalation','Context-expansion rule']) assert.ok(orchestration.includes(rule), `orchestration policy missing ${rule}`);

const pr = readFileSync('.github/PULL_REQUEST_TEMPLATE.md','utf8');
for (const heading of ['Originating subsystem','Observation','Hypothesis','Predicted outcome','Counterfactual alternatives','Scientific risks / confounders','Welfare assessment','Protected-path declaration']) assert.ok(pr.includes(heading), `PR template missing ${heading}`);

const codeowners = readFileSync('.github/CODEOWNERS','utf8');
for (const protectedPath of ['/genome/','/CONSCIOS_CHARTER.md','/WELFARE_PROTOCOL.md','/agents/OWNERSHIP.yaml','/audits/']) assert.ok(codeowners.includes(protectedPath), `CODEOWNERS missing protected path ${protectedPath}`);

console.log(`Inverse Conway structure verification passed: ${modules.length} cognitive modules, ${contracts.length} role contracts, two independent auditor domains, scoped orchestration, and protected governance paths.`);
