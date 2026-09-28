import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const verify = args.has('--verify') || args.has('--ci');
const ci = args.has('--ci');
let failures = 0;

function ok(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`✗ ${message}`);
}

function commandExists(command, versionArgs = ['--version'], required = true) {
  const result = spawnSync(command, versionArgs, { encoding: 'utf8' });
  if (result.status === 0) {
    const firstLine = `${result.stdout || result.stderr}`.trim().split(/\r?\n/)[0];
    ok(`${command}: ${firstLine || 'available'}`);
    return true;
  }
  if (required) fail(`${command} is unavailable`);
  else console.warn(`! ${command} is unavailable (optional outside the dev container)`);
  return false;
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (Number.isFinite(nodeMajor) && nodeMajor >= 20) ok(`Node ${process.versions.node}`);
else fail(`Node 20+ required; found ${process.versions.node}`);

commandExists('git');
const requireContainerTools = ci || process.env.CONSCIOS_DEV_ENV === 'devcontainer';
commandExists('python3', ['--version'], requireContainerTools);
commandExists('gh', ['--version'], requireContainerTools);

const requiredFiles = [
  'CONSCIOS_CHARTER.md',
  'WELFARE_PROTOCOL.md',
  'SCIENTIFIC_METHOD.md',
  'AGENT_ORGANIZATION.md',
  'development/DEVELOPMENT_EPOCH_PROTOCOL.md',
  'development/CLOUD_DELEGATION_PROTOCOL.md',
  'governance/path-policy.json',
  'scripts/build-development-save-state.mjs',
];

for (const file of requiredFiles) {
  if (fs.existsSync(file)) ok(file);
  else fail(`missing ${file}`);
}

const gitState = spawnSync('git', ['status', '--short', '--branch'], { encoding: 'utf8' });
if (gitState.status === 0) {
  const lines = gitState.stdout.trim().split(/\r?\n/).filter(Boolean);
  console.log(`\nGit state:\n${lines.length ? lines.join('\n') : '(clean detached state)'}`);
} else {
  fail('could not inspect Git state');
}

if (verify) {
  const checks = [
    ['scripts/verify-conway.mjs'],
    ['scripts/verify-conway-boundaries.mjs'],
    ['scripts/verify-v0.mjs'],
    ['observer/experiments/cloud-delegation-v1/verify.mjs'],
    ['observer/experiments/browser-entrypoints/verify.mjs'],
  ];

  console.log('\nCore verification:');
  for (const [script] of checks) {
    const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
    if (result.status === 0) ok(script);
    else fail(`${script} failed`);
  }
}

if (failures > 0) {
  console.error(`\nConsciOS development doctor found ${failures} problem(s).`);
  process.exit(1);
}

console.log('\nConsciOS development substrate is ready.');
console.log('Serve browser surfaces: python3 -m http.server 8000');
console.log('Build continuation ZIP: node scripts/build-development-save-state.mjs');
console.log('Run core verification: node scripts/development-doctor.mjs --verify');
