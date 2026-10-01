import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CELL_TYPES,DEFAULT_CONTEXT_BUDGET_BYTES,DEFAULT_SANDBOX_ENDPOINT,createCell,createNotebook,previousCellResults,serializedBytes} from '../../../local/workbench/notebook-engine.mjs';
import {normalizeRelativePath,normalizeRunSpec,normalizeTopologySpec} from '../../../local/sandbox/policy.mjs';
import {buildContainerRunArgs} from '../../../local/sandbox/engine.mjs';

for(const type of ['shell','container','topology'])assert.ok(CELL_TYPES[type],`missing sandbox notebook cell ${type}`);
assert.equal(createCell('shell').config.endpoint,DEFAULT_SANDBOX_ENDPOINT);
assert.equal(createCell('shell').config.action,'sandbox-run');
assert.equal(createCell('topology').config.action,'sandbox-topology');
assert.match(createCell('container').source,/ubuntu:24\.04/);

const notebook=createNotebook({title:'bounded-context'});
for(let i=0;i<20;i++)notebook.cells.push({...createCell('markdown',{title:`result-${i}`}),output:{text:'x'.repeat(8000),i}});
const selected=previousCellResults(notebook,notebook.cells.length,{maxBytes:DEFAULT_CONTEXT_BUDGET_BYTES,maxCells:8});
assert.ok(selected.length<=8);
assert.ok(serializedBytes(selected)<=DEFAULT_CONTEXT_BUDGET_BYTES,`selected context exceeded ${DEFAULT_CONTEXT_BUDGET_BYTES} bytes`);
assert.equal(selected.at(-1).title,'result-19','bounded context should prefer the most recent evidence');

assert.equal(normalizeRelativePath('src/app.js'),'src/app.js');
assert.throws(()=>normalizeRelativePath('../escape'),/escapes workspace/);
assert.throws(()=>normalizeRelativePath('/etc/passwd'),/relative path/);
assert.throws(()=>normalizeRunSpec({network:'host'}),/not allowed|unknown|network mode/);
assert.throws(()=>normalizeRunSpec({image:'https://example.com/image'}),/invalid container image/);
const strict=normalizeRunSpec({image:'ubuntu:24.04',command:['bash','-lc','echo ok'],files:[{path:'hello.txt',content:'hello'}]});
const args=buildContainerRunArgs(strict,{workspace:'/tmp/work',name:'conscios-test'});
for(const required of ['--cpus','--memory','--pids-limit','--security-opt','no-new-privileges:true','--cap-drop=ALL','--read-only','--network','none'])assert.ok(args.includes(required),`strict docker args missing ${required}`);
for(const forbidden of ['--privileged','--network=host','/var/run/docker.sock'])assert.ok(!args.join(' ').includes(forbidden),`unsafe docker arg present: ${forbidden}`);

const dev=normalizeRunSpec({profile:'dev',network:'bridge',command:'echo writable'});
const devArgs=buildContainerRunArgs(dev,{workspace:'/tmp/work',name:'conscios-dev'});
assert.ok(!devArgs.includes('--read-only'),'dev profile should permit an ephemeral writable root filesystem');
assert.ok(!devArgs.includes('--cap-drop=ALL'),'dev profile should retain ordinary container capabilities for package/build tooling');
assert.ok(devArgs.includes('no-new-privileges:true'));

const isolated=normalizeRunSpec({network:'sandbox',networkName:'sandbox',command:['true']});
const serviceArgs=buildContainerRunArgs(isolated,{workspace:'/tmp/work',networkName:'conscios-net-test',networkAlias:'api',name:'conscios-api-test',detach:true,remove:false});
const aliasIndex=serviceArgs.indexOf('--network-alias');
assert.ok(aliasIndex>=0,'service run args must declare a stable network alias');
assert.equal(serviceArgs[aliasIndex+1],'api');
assert.ok(aliasIndex<serviceArgs.indexOf(isolated.image),'network alias must be a Docker run option before the image');

const topology=normalizeTopologySpec({services:[{name:'api',image:'alpine:3.20',command:['sh','-lc','httpd -f -p 8080 -h /workspace']}],tests:[{name:'probe',image:'alpine:3.20',command:['true']}],internet:false});
assert.equal(topology.services.length,1);assert.equal(topology.tests.length,1);assert.equal(topology.internet,false);
assert.throws(()=>normalizeTopologySpec({services:[{name:'api'},{name:'api'}]}),/duplicate topology service/);

const daemon=readFileSync('local/sandbox/daemon.mjs','utf8');
const engine=readFileSync('local/sandbox/engine.mjs','utf8');
const devcontainer=readFileSync('.devcontainer/devcontainer.json','utf8');
assert.match(daemon,/CONSCIOS_SANDBOX_ORIGINS/,'sandbox daemon must enforce explicit browser-origin policy');
assert.match(engine,/--internal/,'offline multi-service topology should use an internal container network');
assert.match(engine,/no-new-privileges:true/);
assert.ok(!engine.includes('/var/run/docker.sock'),'sandbox engine must not mount the host Docker socket into guest containers');
assert.match(devcontainer,/docker-in-docker/,'Codespaces/devcontainer must use nested Docker rather than host-socket passthrough');

console.log('Sandbox Workbench verification passed: bounded notebook context, strict/dev container profiles, safe paths/resources, stable service DNS aliases, origin-bounded daemon, isolated topology network, and Docker-in-Docker development environment.');
