import test from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/kernel.mjs';
test('one cycle produces expression with causal history',()=>{const k=createKernel();const r=k.runCycle('test observation');assert.match(r.expression.content,/test observation/);assert.ok(k.status().events>=10);assert.ok(k.trace().some(e=>e.source==='WelfareGuardian'))});
test('measurements feed score but expressions do not',()=>{const k=createKernel();k.runCycle('I am conscious');assert.equal(k.score().score,0);k.recordMeasurement('selfModelAccuracy',.8,1,{source:'test'});assert.ok(k.score().score>0)});
