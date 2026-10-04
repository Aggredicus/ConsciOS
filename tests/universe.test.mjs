import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniverseModel } from '../src/universe.mjs';

test('loads a 4d-style repository graph and bounds search',()=>{
  const u=createUniverseModel({
    schema_version:'1',
    workspace:{id:'test-space'},
    nodes:[
      {id:'repo:self',type:'Repository',repo:'Aggredicus/ConsciOS',label:'ConsciOS',properties:{}},
      {id:'module:memory',type:'Module',repo:'Aggredicus/ConsciOS',label:'Autobiographical Memory',properties:{path:'src/memory.mjs'}},
      {id:'module:world',type:'Module',repo:'Aggredicus/ConsciOS',label:'World Model',properties:{}}
    ],
    edges:[{source:'repo:self',target:'module:memory',type:'CONTAINS'}]
  });
  assert.equal(u.status().loaded,true);
  assert.equal(u.search('memory')[0].id,'module:memory');
  assert.equal(u.neighborhood('repo:self',1).nodes.length,2);
});
