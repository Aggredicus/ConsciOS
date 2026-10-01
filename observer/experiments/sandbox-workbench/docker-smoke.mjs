import assert from 'node:assert/strict';
import {detectContainerEngine,runContainerJob,runTopology} from '../../../local/sandbox/engine.mjs';

const engine=detectContainerEngine();
if(!engine){
  if(process.env.CONSCIOS_REQUIRE_DOCKER==='1')throw new Error('Docker/Podman is required for this smoke test but no engine is available');
  console.log('Sandbox Docker smoke skipped: no Docker/Podman engine available.');
  process.exit(0);
}

const single=await runContainerJob({image:'alpine:3.20',profile:'strict',network:'none',command:['sh','-lc','printf single-ok'],timeoutMs:30_000},{engine:engine.engine});
assert.equal(single.exitCode,0,single.stderr);assert.equal(single.stdout,'single-ok');assert.equal(single.network,'none');

const topology=await runTopology({
  internet:false,settleMs:250,
  services:[{name:'api',image:'alpine:3.20',profile:'strict',files:[{path:'health',content:'pong\n'}],command:['sh','-lc','httpd -f -p 8080 -h /workspace']}],
  tests:[{name:'probe',image:'alpine:3.20',profile:'strict',command:['sh','-lc','for i in 1 2 3 4 5; do value=$(wget -qO- http://api:8080/health 2>/dev/null) && [ "$value" = pong ] && printf topology-ok && exit 0; sleep 1; done; exit 1'],timeoutMs:15_000}]
},{engine:engine.engine});
assert.equal(topology.ok,true,JSON.stringify(topology,null,2));assert.equal(topology.tests[0].exitCode,0);assert.match(topology.tests[0].stdout,/topology-ok/);
console.log(`Sandbox Docker smoke passed on ${engine.engine} ${engine.version}: isolated single-container execution and service-name topology networking are functional.`);
