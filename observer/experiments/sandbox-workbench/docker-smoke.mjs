import assert from 'node:assert/strict';
import {detectContainerEngine,runContainerJob,runTopology} from '../../../local/sandbox/engine.mjs';

const engine=detectContainerEngine();
if(!engine){
  if(process.env.CONSCIOS_REQUIRE_DOCKER==='1')throw new Error('Docker/Podman is required for this smoke test but no engine is available');
  console.log('Sandbox Docker smoke skipped: no Docker/Podman engine available.');
  process.exit(0);
}

const single=await runContainerJob({
  image:'alpine:3.20',profile:'strict',network:'none',
  files:[{path:'fixture.txt',content:'workspace-ok'}],
  command:['sh','-lc','printf single-ok: && cat /workspace/fixture.txt'],timeoutMs:30_000
},{engine:engine.engine});
assert.equal(single.exitCode,0,single.stderr);assert.equal(single.stdout,'single-ok:workspace-ok');assert.equal(single.network,'none');

const topology=await runTopology({
  internet:false,settleMs:250,
  services:[{name:'api',image:'python:3.12-alpine',profile:'strict',command:['python','-m','http.server','8080','--directory','/workspace']}],
  tests:[{name:'probe',image:'alpine:3.20',profile:'strict',command:['sh','-lc','for i in 1 2 3 4 5; do wget -qO- http://api:8080/ >/dev/null 2>&1 && printf topology-ok && exit 0; sleep 1; done; exit 1'],timeoutMs:15_000}]
},{engine:engine.engine});
assert.equal(topology.ok,true,JSON.stringify(topology,null,2));assert.equal(topology.tests[0].exitCode,0);assert.match(topology.tests[0].stdout,/topology-ok/);
console.log(`Sandbox Docker smoke passed on ${engine.engine} ${engine.version}: bounded workspace mounts, isolated single-container execution, stable service DNS, and multi-container networking are functional.`);
