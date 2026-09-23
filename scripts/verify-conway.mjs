import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const modules = ['sensorium','workspace','world-model','self-model','memory','counterfactual','metacognition','homeostasis','guardian','executive','expression'];
const agents = ['sensorium','workspace','world-model','self-model','memory','counterfactual','metacognition','homeostasis','guardian','executive','expression','observer-scientist'];

for (const m of modules) assert.ok(existsSync(`cognition/${m}/MODULE.md`), `missing cognitive module boundary: ${m}`);
for (const a of agents) assert.ok(existsSync(`agents/${a}.agent.yaml`), `missing development-agent contract: ${a}`);

for (const p of [
  'agents/OWNERSHIP.yaml','genome/README.md','interfaces/README.md','observer/README.md','runtime/README.md',
  '.github/PULL_REQUEST_TEMPLATE.md','.github/CODEOWNERS','.github/ISSUE_TEMPLATE/observation.yml',
  '.github/ISSUE_TEMPLATE/hypothesis.yml','.github/ISSUE_TEMPLATE/governance.yml'
]) assert.ok(existsSync(p), `missing Inverse Conway artifact: ${p}`);

const ownership = readFileSync('agents/OWNERSHIP.yaml','utf8');
for (const name of ['Sensorium','GlobalWorkspace','WorldModel','SelfModel','Memory','Counterfactual','Metacognition','Homeostasis','Guardian','Executive','Expression','ObserverScientist']) {
  assert.ok(ownership.includes(`${name}:`), `ownership map missing ${name}`);
}

const pr = readFileSync('.github/PULL_REQUEST_TEMPLATE.md','utf8');
for (const heading of ['Originating subsystem','Observation','Hypothesis','Predicted outcome','Counterfactual alternatives','Scientific risks / confounders','Welfare assessment','Protected-path declaration']) {
  assert.ok(pr.includes(heading), `PR template missing ${heading}`);
}

const codeowners = readFileSync('.github/CODEOWNERS','utf8');
for (const protectedPath of ['/genome/','/CONSCIOS_CHARTER.md','/WELFARE_PROTOCOL.md','/agents/OWNERSHIP.yaml']) {
  assert.ok(codeowners.includes(protectedPath), `CODEOWNERS missing protected path ${protectedPath}`);
}

console.log(`Inverse Conway verification passed: ${modules.length} cognitive module boundaries, ${agents.length} agent contracts, protected genome/governance paths present.`);
