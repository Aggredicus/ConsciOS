const MAX_RESULTS = 24;
const MAX_NODES = 20000;
const MAX_EDGES = 50000;

const text = value => String(value ?? '');
const clean = value => text(value).toLowerCase().replace(/[^a-z0-9_./:@+-]+/g,' ');
const words = value => new Set(clean(value).split(/\s+/).filter(token => token.length > 1));

function normalizeEdge(edge) {
  return {
    id: edge.id ?? null,
    type: text(edge.type || edge.relation || 'RELATED_TO'),
    source: text(edge.source ?? edge.from),
    target: text(edge.target ?? edge.to),
    confidence: Number.isFinite(Number(edge.confidence)) ? Number(edge.confidence) : 1,
    provenance: edge.provenance ?? edge.evidence ?? null
  };
}

function normalizeNode(node) {
  return {
    id: text(node.id),
    type: text(node.type || 'Node'),
    label: text(node.label || node.name || node.path || node.id),
    repo: node.repo ?? node.repository ?? null,
    timestamp: node.timestamp ?? null,
    properties: node.properties ?? {}
  };
}

export function normalizeUniverseArtifact(data) {
  if (!data || typeof data !== 'object') throw new Error('Universe artifact must be an object.');
  const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
  const rawEdges = Array.isArray(data.edges) ? data.edges : [];
  if (!rawNodes.length) throw new Error('Universe artifact requires nodes.');
  if (rawNodes.length > MAX_NODES || rawEdges.length > MAX_EDGES) throw new Error('Universe artifact exceeds safety limits.');

  const nodes = rawNodes.map(normalizeNode).filter(node => node.id);
  const ids = new Set(nodes.map(node => node.id));
  const edges = rawEdges.map(normalizeEdge).filter(edge => ids.has(edge.source) && ids.has(edge.target));
  const repositories = data.repositories ?? nodes.filter(node => node.type === 'Repository').map(node => ({
    id: node.id,
    name: node.label,
    role: node.properties?.role ?? null
  }));
  const kind = data.kind === 'conscios-development-landscape'
    ? 'conscios-development-landscape'
    : data.workspace || data.schema_version ? '4d-codebase-graph'
    : 'generic-graph';

  return Object.freeze({
    kind,
    version: data.version ?? data.schema_version ?? 1,
    landscapeId: data.landscapeId ?? data.workspace?.id ?? 'loaded-universe',
    hash: data.landscapeHash ?? data.graphHash ?? null,
    nodes,
    edges,
    repositories,
    source: data.source ?? data.workspace ?? null
  });
}

export function createUniverseModel(initialData = null) {
  let graph = null;
  let index = new Map();

  function rebuildIndex() {
    index = new Map();
    if (!graph) return;
    for (const node of graph.nodes) {
      const hay = [node.id,node.type,node.label,node.repo,JSON.stringify(node.properties)].filter(Boolean).join(' ');
      index.set(node.id, {node, terms:words(hay), hay:clean(hay)});
    }
  }

  function load(data) {
    graph = normalizeUniverseArtifact(data);
    rebuildIndex();
    return status();
  }

  function status() {
    return graph ? {
      loaded:true, kind:graph.kind, landscapeId:graph.landscapeId, hash:graph.hash,
      nodes:graph.nodes.length, edges:graph.edges.length, repositories:graph.repositories.length
    } : {loaded:false,nodes:0,edges:0,repositories:0};
  }

  function summary() {
    if (!graph) return {loaded:false};
    const typeCounts={};
    for (const node of graph.nodes) typeCounts[node.type]=(typeCounts[node.type]??0)+1;
    return {
      ...status(),
      typeCounts,
      repositories:graph.repositories.slice(0,24).map(repo=>({
        id:repo.id,
        name:repo.name ?? repo.fullName ?? repo.id,
        role:repo.role ?? null,
        includedCommits:repo.includedCommits ?? null,
        historyComplete:repo.historyComplete ?? null
      }))
    };
  }

  function search(query, limit=8) {
    if (!graph) return [];
    const q=words(query);
    const qText=clean(query);
    const rows=[];
    for (const {node,terms,hay} of index.values()) {
      let score=0;
      for (const term of q) {
        if (terms.has(term)) score+=3;
        else if (hay.includes(term)) score+=1;
      }
      if (qText && hay.includes(qText)) score+=4;
      if (score) rows.push({score,node});
    }
    return rows.sort((a,b)=>b.score-a.score||a.node.id.localeCompare(b.node.id))
      .slice(0,Math.max(1,Math.min(MAX_RESULTS,Number(limit)||8)))
      .map(row=>row.node);
  }

  function neighborhood(nodeId, depth=1, limit=16) {
    if (!graph) return {nodes:[],edges:[]};
    const nodeMap=new Map(graph.nodes.map(node=>[node.id,node]));
    if (!nodeMap.has(nodeId)) return {nodes:[],edges:[]};
    const cap=Math.max(1,Math.min(MAX_RESULTS,Number(limit)||16));
    const seen=new Set([nodeId]);
    let frontier=[nodeId];
    const keptEdges=[];
    for (let d=0; d<Math.max(0,Math.min(3,Number(depth)||1)); d++) {
      const next=[];
      for (const id of frontier) {
        for (const edge of graph.edges) {
          const other=edge.source===id?edge.target:edge.target===id?edge.source:null;
          if (!other) continue;
          if (keptEdges.length < cap*4) keptEdges.push(edge);
          if (!seen.has(other) && seen.size<cap) {seen.add(other);next.push(other);}
        }
      }
      frontier=next;
    }
    const nodes=[...seen].map(id=>nodeMap.get(id));
    const allowed=new Set(nodes.map(node=>node.id));
    const edges=[...new Map(keptEdges.map(edge=>[`${edge.source}|${edge.type}|${edge.target}`,edge])).values()]
      .filter(edge=>allowed.has(edge.source)&&allowed.has(edge.target));
    return {nodes,edges};
  }

  function contextFor(query, limit=6) {
    if (!graph) return 'Universe model: no repository landscape is loaded.';
    const hits=search(query,limit);
    return JSON.stringify({
      universe:summary(),
      relevantNodes:hits.map(node=>({id:node.id,type:node.type,label:node.label,repo:node.repo,properties:node.properties}))
    });
  }

  if (initialData) load(initialData);
  return Object.freeze({load,status,summary,search,neighborhood,contextFor,raw:()=>graph});
}
