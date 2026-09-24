import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  loadOwnership,walkFiles,roleForPath,importSpecifiers,resolveRelativeImport,
  loadBoundaryExceptions,communicationAllowed,COGNITIVE_ROLES,AUDIT_ROLES,OBSERVER_ROLE
} from './conway-lib.mjs';

const root=process.cwd();
const agents=loadOwnership(root);
const exceptions=loadBoundaryExceptions(root);
const files=walkFiles(root);
const edges=new Map();
const violations=[];
const now=Date.now();

function exceptionFor(source,target) {
  return exceptions.find(e=>e.source===source && e.target===target);
}

for (const exception of exceptions) {
  assert.equal(typeof exception.source,'string','boundary exception requires source');
  assert.equal(typeof exception.target,'string','boundary exception requires target');
  assert.equal(typeof exception.reason,'string','boundary exception requires reason');
  assert.equal(typeof exception.expires,'string','boundary exception requires expires');
  const expiry=Date.parse(exception.expires);
  assert.ok(Number.isFinite(expiry),'boundary exception expires must be an ISO date');
  assert.ok(expiry>now,`expired boundary exception: ${exception.source} -> ${exception.target}`);
}

for (const file of files) {
  const sourceRole=roleForPath(file,agents);
  if (!sourceRole) continue;
  const source=fs.readFileSync(path.join(root,file),'utf8');
  for (const specifier of importSpecifiers(source)) {
    const target=resolveRelativeImport(root,file,specifier);
    if (!target) continue;
    const targetRole=roleForPath(target,agents);
    if (targetRole && targetRole!==sourceRole) {
      const key=`${sourceRole}->${targetRole}`;
      if (!edges.has(key)) edges.set(key,{sourceRole,targetRole,examples:[]});
      if (edges.get(key).examples.length<5) edges.get(key).examples.push(`${file} -> ${target}`);
      if (!communicationAllowed(sourceRole,targetRole,agents) && !exceptionFor(sourceRole,targetRole)) {
        violations.push(`undeclared role edge ${sourceRole} -> ${targetRole}: ${file} imports ${target}`);
      }
    }

    if (COGNITIVE_ROLES.includes(sourceRole)) {
      const forbiddenRoots=['runtime/','live/','observer/','audits/'];
      if (forbiddenRoots.some(prefix=>target.startsWith(prefix))) {
        const targetLabel=targetRole||target.split('/')[0];
        if (!exceptionFor(sourceRole,targetLabel)) violations.push(`cognitive implementation ${file} imports outward integration/audit path ${target}`);
      }
    }
  }
}

for (const role of [...COGNITIVE_ROLES,OBSERVER_ROLE,...AUDIT_ROLES]) assert.ok(agents.has(role),`ownership graph missing ${role}`);
for (const auditor of AUDIT_ROLES) {
  const owned=agents.get(auditor).owns;
  assert.ok(owned.every(p=>p.startsWith('audits/')),`${auditor} must not own production implementation`);
}

if (violations.length) {
  console.error('Inverse Conway boundary violations:\n'+violations.map(v=>` - ${v}`).join('\n'));
  process.exit(1);
}

const rendered=[...edges.values()].sort((a,b)=>`${a.sourceRole}${a.targetRole}`.localeCompare(`${b.sourceRole}${b.targetRole}`));
console.log(`Inverse Conway boundary verification passed across ${files.length} source files.`);
console.log(`Observed ${rendered.length} cross-role import edges; all are declared or read-oriented observations.`);
for (const edge of rendered) console.log(`  ${edge.sourceRole} -> ${edge.targetRole}: ${edge.examples[0]}`);
