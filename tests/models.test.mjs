import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRegistry, createScriptedModelAdapter } from '../src/models.mjs';

test('model registry tracks active adapters',()=>{
  const registry=createModelRegistry();
  registry.add(createScriptedModelAdapter({name:'a',responder:()=>'{"ok":true}'}));
  registry.add(createScriptedModelAdapter({name:'b',responder:()=>'{"ok":true}'}));
  assert.equal(registry.activeName(),'a');
  registry.use('b');
  assert.equal(registry.active().manifest.name,'b');
});
