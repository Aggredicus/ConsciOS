import test from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/kernel.mjs';
import { executeCommand } from '../src/commands.mjs';
test('help exposes Linux-style documentation',async()=>{const r=await executeCommand('help score',{kernel:createKernel()});assert.match(r.text,/NAME/);assert.match(r.text,/SYNOPSIS/);assert.match(r.text,/DESCRIPTION/)});
test('unknown commands have recovery path',async()=>{const r=await executeCommand('wat',{kernel:createKernel()});assert.match(r.text,/command not found/);assert.match(r.text,/help/)});
