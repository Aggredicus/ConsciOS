import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const builder = path.join(root, 'scripts', 'build-development-save-state.mjs');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: options.encoding || 'utf8',
    env: options.env || process.env,
  });
}

function mustRun(command, args, options = {}) {
  const result = run(command, args, options);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr}`);
  return result;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseStoredZip(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.ok(offset + 30 <= buffer.length, 'truncated local ZIP header');
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    assert.equal(method, 0, 'continuation ZIP must use deterministic STORE method');
    assert.equal(compressedSize, uncompressedSize, 'STORE sizes must match');
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + uncompressedSize;
    assert.ok(dataEnd <= buffer.length, 'truncated ZIP entry');
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString('utf8');
    entries.set(name, buffer.subarray(dataStart, dataEnd));
    offset = dataEnd;
  }
  return entries;
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'conscios-save-fixture-'));
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conscios-save-output-'));

try {
  mustRun('git', ['init', '-q', '-b', 'main'], { cwd: fixture });
  mustRun('git', ['config', 'user.name', 'ConsciOS Observer'], { cwd: fixture });
  mustRun('git', ['config', 'user.email', 'observer@example.invalid'], { cwd: fixture });

  fs.writeFileSync(path.join(fixture, 'tracked.txt'), 'stable baseline\n');
  fs.writeFileSync(path.join(fixture, 'deleted.txt'), 'delete me after commit\n');
  fs.mkdirSync(path.join(fixture, 'notes'));
  mustRun('git', ['add', 'tracked.txt', 'deleted.txt'], { cwd: fixture });
  mustRun('git', ['commit', '-q', '-m', 'fixture baseline'], { cwd: fixture });

  fs.appendFileSync(path.join(fixture, 'tracked.txt'), 'dirty edit\n');
  fs.rmSync(path.join(fixture, 'deleted.txt'));
  fs.writeFileSync(path.join(fixture, 'notes', 'new.txt'), 'untracked but explicit working-tree state\n');

  const first = path.join(outputDir, 'first.zip');
  const second = path.join(outputDir, 'second.zip');
  mustRun(process.execPath, [builder, '--quiet', '--output', first], { cwd: fixture });
  mustRun(process.execPath, [builder, '--quiet', '--output', second], { cwd: fixture });

  const firstBytes = fs.readFileSync(first);
  const secondBytes = fs.readFileSync(second);
  assert.deepEqual(firstBytes, secondBytes, 'identical working state must produce byte-identical ZIPs');
  assert.equal(sha256(firstBytes), sha256(secondBytes), 'archive SHA-256 must be stable');

  const entries = parseStoredZip(firstBytes);
  for (const required of [
    'STATE.json',
    'MANIFEST.json',
    'PROMPT.md',
    'git/status.txt',
    'git/staged.diff',
    'git/unstaged.diff',
    'repo/tracked.txt',
    'repo/notes/new.txt',
  ]) {
    assert.ok(entries.has(required), `missing ${required}`);
  }
  assert.ok(!entries.has('repo/deleted.txt'), 'deleted tracked files must be absent from snapshot');
  assert.match(entries.get('git/unstaged.diff').toString('utf8'), /deleted\.txt/, 'deletion must remain visible in Git diff');

  const state = JSON.parse(entries.get('STATE.json').toString('utf8'));
  const sourceCommit = mustRun('git', ['rev-parse', 'HEAD'], { cwd: fixture }).stdout.trim();
  assert.equal(state.format, 'conscios-development-save-state/v1');
  assert.equal(state.sourceCommit, sourceCommit);
  assert.equal(state.branch, 'main');
  assert.equal(state.dirty, true);
  assert.equal(state.causalAuthority, 'none');

  const prompt = entries.get('PROMPT.md').toString('utf8');
  assert.match(prompt, /External AI output is a proposal/);
  assert.match(prompt, /Do not infer hidden conversation state/);

  const manifest = JSON.parse(entries.get('MANIFEST.json').toString('utf8'));
  assert.equal(manifest.hashAlgorithm, 'sha256');
  assert.equal(manifest.zipMethod, 'store');
  for (const item of manifest.entries) {
    assert.ok(entries.has(item.path), `manifest path missing from archive: ${item.path}`);
    const data = entries.get(item.path);
    assert.equal(data.length, item.bytes, `byte count mismatch for ${item.path}`);
    assert.equal(sha256(data), item.sha256, `hash mismatch for ${item.path}`);
  }

  fs.writeFileSync(path.join(fixture, 'provider.key'), 'DO_NOT_PACKAGE\n');
  const secret = run(process.execPath, [builder, '--quiet', '--output', path.join(outputDir, 'secret.zip')], { cwd: fixture });
  assert.notEqual(secret.status, 0, 'likely secret material must fail closed');
  assert.match(secret.stderr, /likely secret material/i);
  fs.rmSync(path.join(fixture, 'provider.key'));

  const oversized = run(process.execPath, [builder, '--quiet', '--output', path.join(outputDir, 'oversized.zip')], {
    cwd: fixture,
    env: { ...process.env, CONSCIOS_SAVE_STATE_MAX_BYTES: '32' },
  });
  assert.notEqual(oversized.status, 0, 'oversized continuation state must fail closed');
  assert.match(oversized.stderr, /exceeds limit/i);

  const unsafe = run(process.execPath, [builder, '--quiet', '--output', 'unsafe.zip'], { cwd: fixture });
  assert.notEqual(unsafe.status, 0, 'non-ignored in-repository output must fail closed');
  assert.match(unsafe.stderr, /non-ignored repository path/i);

  console.log(`Development save-state verification passed: ${entries.size} archive entries; sha256=${sha256(firstBytes)}.`);
  console.log('Negative controls passed: secret path, package-size bound, and unsafe output location.');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
}
