import test from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/kernel.mjs';
import { createResearchLab } from '../src/lab.mjs';
import { executeCommand } from '../src/commands.mjs';

test('help exposes experiment documentation',async()=>{
  const kernel=createKernel(),lab=createResearchLab({kernel});
  const r=await executeCommand('help experiment',{kernel,lab});
  assert.match(r.text,/NAME/);assert.match(r.text,/SYNOPSIS/);assert.match(r.text,/DESCRIPTION/);
});

test('unknown commands have recovery path',async()=>{
  const kernel=createKernel(),lab=createResearchLab({kernel});
  const r=await executeCommand('wat',{kernel,lab});
  assert.match(r.text,/command not found/);assert.match(r.text,/help/);
});
