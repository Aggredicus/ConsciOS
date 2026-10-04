import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../governance/protected-manifest.json', import.meta.url), 'utf8'));

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

let failed = false;
for (const entry of manifest.files) {
  const bytes = await readFile(new URL(`../${entry.path}`, import.meta.url));
  const actual = gitBlobSha1(bytes);
  const ok = actual === entry.gitBlobSha1;
  console.log(`${ok ? 'ok' : 'FAIL'}  ${entry.path}  ${actual}`);
  if (!ok) failed = true;
}
if (failed) {
  console.error('Protected-document continuity check failed.');
  process.exit(1);
}
console.log('Protected constitutional corpus is byte-identical to the recorded source.');
