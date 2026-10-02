#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const ROOT=process.cwd(),argv=process.argv.slice(2);const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d};
const candidates=['index.html','runtime/modular-demo.html','live/index.html','local/index.html','local/encounter/index.html','local/workbench/index.html','local/exo-dashboard/index.html','local/swarm/index.html','tools/self-model-studio/index.html'];
const files=candidates.filter(p=>fs.existsSync(path.join(ROOT,p)));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const checksFor=(html)=>{
 const controls=[...html.matchAll(/<(button|input|select|textarea)\b([^>]*)>/gi)].map(m=>({tag:m[1].toLowerCase(),attrs:m[2]}));
 const labelled=controls.filter(c=>/aria-label\s*=|aria-labelledby\s*=|\bid\s*=/.test(c.attrs)).length;
 const clickDivs=(html.match(/<(div|span)[^>]+onclick\s*=/gi)||[]).length;
 const external=(html.match(/<(script|link|iframe)[^>]+(?:src|href)\s*=\s*["']https?:\/\//gi)||[]).length;
 const innerHTML=(html.match(/\.innerHTML\s*=/g)||[]).length;
 return {viewport:/<meta[^>]+name=["']viewport["']/i.test(html),language:/<html[^>]+lang=/i.test(html),title:/<title>[^<]+<\/title>/i.test(html),responsive:/@media\s*\(|max-width|min-width|clamp\(/i.test(html),statusVisibility:/aria-live|role=["']status["']|\bid=["']status["']/i.test(html),keyboardNative:clickDivs===0,touchAwareness:/touch-action|pointer(event|down|up)|coarse|44px|min-height\s*:\s*(?:4[4-9]|[5-9]\d)px/i.test(html),exportOrReset:/\b(export|download|reset|clear|save)\b/i.test(html),externalRuntimeResources:external,innerHTMLAssignments:innerHTML,controlCount:controls.length,labelledControlHeuristic:controls.length?Math.round(1000*labelled/controls.length)/1000:1};
};
const surfaces=files.map(p=>{const html=fs.readFileSync(path.join(ROOT,p),'utf8'),checks=checksFor(html);const missing=['viewport','language','title'].filter(k=>!checks[k]);const advisories=[];if(!checks.responsive)advisories.push('No obvious responsive/mobile CSS marker.');if(!checks.statusVisibility)advisories.push('No obvious live/status region.');if(!checks.touchAwareness)advisories.push('No obvious touch/coarse-pointer affordance.');if(checks.externalRuntimeResources)advisories.push(`${checks.externalRuntimeResources} external runtime resource(s).`);if(checks.innerHTMLAssignments)advisories.push(`${checks.innerHTMLAssignments} innerHTML assignment(s) require contextual review.`);return {path:p,checks,blocking:missing,advisories};});
const summary={surfaceCount:surfaces.length,blockingCount:surfaces.reduce((n,s)=>n+s.blocking.length,0),advisoryCount:surfaces.reduce((n,s)=>n+s.advisories.length,0),responsiveSurfaces:surfaces.filter(s=>s.checks.responsive).length,touchAwareSurfaces:surfaces.filter(s=>s.checks.touchAwareness).length,statusVisibleSurfaces:surfaces.filter(s=>s.checks.statusVisibility).length};
const report={version:'0.4.0',kind:'human-ux-static-audit',scope:'Static cross-surface heuristics only; not a substitute for device/user testing.',summary,surfaces,reportHash:null};report.reportHash=hash(JSON.stringify({...report,reportHash:null}));
const out=arg('--out');if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}else process.stdout.write(JSON.stringify(report,null,2)+'\n');
