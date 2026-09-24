import fs from 'node:fs';
import path from 'node:path';

export const COGNITIVE_ROLES = Object.freeze([
  'Sensorium','GlobalWorkspace','WorldModel','SelfModel','Memory','Counterfactual',
  'Metacognition','Homeostasis','Guardian','Executive','Expression'
]);
export const AUDIT_ROLES = Object.freeze(['ScientificAuditor','WelfareAuditor']);
export const OBSERVER_ROLE = 'ObserverScientist';

function list(value='') {
  const trimmed=value.trim();
  if (!trimmed) return [];
  return trimmed.split(',').map(x=>x.trim()).filter(Boolean);
}

export function parseOwnershipYaml(text) {
  const agents=new Map();
  const line=/^\s{2}([A-Za-z][A-Za-z0-9]+):\s*\{([^\n]+)\}\s*$/gm;
  for (const match of text.matchAll(line)) {
    const [,name,body]=match;
    const read=(key)=>{
      const m=body.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
      return m?list(m[1]):[];
    };
    agents.set(name,{name,owns:read('owns'),communicatesWith:read('communicates_with'),observes:read('observes')});
  }
  if (!agents.size) throw new Error('No agents parsed from agents/OWNERSHIP.yaml');
  return agents;
}

export function loadOwnership(root=process.cwd()) {
  return parseOwnershipYaml(fs.readFileSync(path.join(root,'agents/OWNERSHIP.yaml'),'utf8'));
}

export function ownershipRoots(agents) {
  const roots=[];
  for (const agent of agents.values()) {
    for (const glob of agent.owns) {
      const root=glob.replace(/\/\*\*.*$/,'').replace(/\/$/,'');
      roots.push({root,role:agent.name});
    }
  }
  return roots.sort((a,b)=>b.root.length-a.root.length);
}

export function roleForPath(file,agents) {
  const normalized=file.split(path.sep).join('/').replace(/^\.\//,'');
  for (const item of ownershipRoots(agents)) {
    if (normalized===item.root || normalized.startsWith(`${item.root}/`)) return item.role;
  }
  return null;
}

export function walkFiles(root,starts=['cognition','observer','audits']) {
  const files=[];
  const visit=(relative)=>{
    const full=path.join(root,relative);
    if (!fs.existsSync(full)) return;
    const stat=fs.statSync(full);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full)) visit(path.join(relative,name));
    } else if (/\.(?:mjs|js|cjs|ts|tsx|jsx)$/.test(relative)) files.push(relative.split(path.sep).join('/'));
  };
  for (const start of starts) visit(start);
  return files.sort();
}

export function importSpecifiers(source) {
  const found=[];
  const patterns=[
    /(?:import|export)\s+(?:[^'\";]*?\s+from\s+)?['\"]([^'\"]+)['\"]/g,
    /import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) found.push(m[1]);
  return [...new Set(found)];
}

export function resolveRelativeImport(root,sourceFile,specifier) {
  if (!specifier.startsWith('.')) return null;
  const base=path.resolve(root,path.dirname(sourceFile),specifier);
  const candidates=[base,`${base}.mjs`,`${base}.js`,`${base}.cjs`,`${base}.ts`,path.join(base,'index.mjs'),path.join(base,'index.js')];
  const existing=candidates.find(p=>fs.existsSync(p) && fs.statSync(p).isFile());
  const resolved=existing||base;
  return path.relative(root,resolved).split(path.sep).join('/');
}

export function loadBoundaryExceptions(root=process.cwd()) {
  const file=path.join(root,'agents/BOUNDARY_EXCEPTIONS.json');
  if (!fs.existsSync(file)) return [];
  const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
  if (!Array.isArray(parsed.exceptions)) throw new Error('BOUNDARY_EXCEPTIONS.json requires exceptions[]');
  return parsed.exceptions;
}

export function isObserved(sourceRole,targetRole,agents) {
  const source=agents.get(sourceRole);
  return Boolean(source && (source.observes.includes('all') || source.observes.includes(targetRole)));
}

export function communicationAllowed(sourceRole,targetRole,agents) {
  if (!sourceRole || !targetRole || sourceRole===targetRole) return true;
  const source=agents.get(sourceRole);
  return Boolean(source && (source.communicatesWith.includes(targetRole) || isObserved(sourceRole,targetRole,agents)));
}
