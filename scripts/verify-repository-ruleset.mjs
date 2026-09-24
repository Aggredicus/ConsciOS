import assert from 'node:assert/strict';
const required=process.argv.includes('--required');const repo=process.env.GITHUB_REPOSITORY||'Aggredicus/ConsciOS';const token=process.env.GITHUB_TOKEN;
const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(token)headers.Authorization=`Bearer ${token}`;
const api=async url=>{const r=await fetch(url,{headers});if(!r.ok)throw new Error(`GitHub ruleset API ${r.status}: ${await r.text()}`);return r.json()};
let summaries=[];try{summaries=await api(`https://api.github.com/repos/${repo}/rulesets`)}catch(error){if(required)throw error;console.warn(String(error));process.exit(0)}
const active=summaries.filter(x=>x.enforcement==='active');
if(!active.length){const msg='No active repository ruleset found. Follow .github/RULESET_SETUP.md.';if(required)throw new Error(msg);console.warn(msg);process.exit(0)}
let compliant=false;
for(const summary of active){const detail=await api(`https://api.github.com/repos/${repo}/rulesets/${summary.id}`);const rules=new Set((detail.rules||[]).map(x=>x.type));const includes=detail.conditions?.ref_name?.include||[];const targetsMain=includes.some(x=>x==='refs/heads/main'||x==='~DEFAULT_BRANCH');
  if(targetsMain&&rules.has('pull_request')&&rules.has('required_status_checks')&&rules.has('deletion')&&rules.has('non_fast_forward')){compliant=true;break}}
assert.ok(compliant,'Active ruleset exists, but no ruleset targeting main contains pull_request, required_status_checks, deletion, and non_fast_forward protections.');
console.log('Live GitHub main-ruleset verification passed.');
