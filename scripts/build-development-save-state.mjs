import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FORMAT = 'conscios-development-save-state/v1';
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const ZIP_DOS_DATE_1980_01_01 = 33;
const ZIP_UTF8_FLAG = 0x0800;

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd || process.cwd(),
    encoding: options.encoding ?? 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeArchivePath(value) {
  return value.split(path.sep).join('/').replace(/^\.\/+/, '');
}

function isLikelySecretPath(relativePath) {
  const normalized = normalizeArchivePath(relativePath).toLowerCase();
  const parts = normalized.split('/');
  const base = parts.at(-1) || '';
  if (parts.some((part) => ['.ssh', 'secrets', '.secrets'].includes(part))) return true;
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return true;
  if (['id_rsa', 'id_ed25519', 'credentials.json'].includes(base)) return true;
  return ['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore'].some((ext) => base.endsWith(ext));
}

function readRepositoryFiles(root) {
  const raw = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'buffer',
  });
  const names = raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map(normalizeArchivePath)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const entries = [];
  for (const relativePath of names) {
    if (isLikelySecretPath(relativePath)) {
      throw new Error(`Refusing to package likely secret material: ${relativePath}`);
    }
    const absolutePath = path.join(root, relativePath);
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to follow symbolic link in continuation package: ${relativePath}`);
    }
    if (!stat.isFile()) continue;
    const data = fs.readFileSync(absolutePath);
    entries.push({ name: `repo/${relativePath}`, data });
  }
  return entries;
}

function parseArgs(argv) {
  const args = { output: null, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--output') {
      const next = argv[i + 1];
      if (!next) throw new Error('--output requires a path');
      args.output = next;
      i += 1;
    } else if (token === '--quiet') {
      args.quiet = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function crc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function createDeterministicZip(entries) {
  const ordered = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of ordered) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(ZIP_DOS_DATE_1980_01_01, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localChunks.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(ZIP_DOS_DATE_1980_01_01, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(ordered.length, 8);
  end.writeUInt16LE(ordered.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirectory, end]);
}

function makePrompt(state) {
  return `# ConsciOS deterministic development continuation

You are resuming ConsciOS development from a provider-neutral continuation package.

## Start here

1. Read \`STATE.json\` and \`MANIFEST.json\`.
2. Treat \`repo/\` as the exact packaged working-tree snapshot. The source commit is \`${state.sourceCommit}\`.
3. Read these governance documents before proposing changes:
   - \`repo/CONSCIOS_CHARTER.md\`
   - \`repo/WELFARE_PROTOCOL.md\`
   - \`repo/SCIENTIFIC_METHOD.md\`
   - \`repo/AGENT_ORGANIZATION.md\`
   - \`repo/development/DEVELOPMENT_EPOCH_PROTOCOL.md\`
   - \`repo/development/CLOUD_DELEGATION_PROTOCOL.md\`
4. Inspect \`git/staged.diff\`, \`git/unstaged.diff\`, and \`git/status.txt\` to identify unfinished work.
5. Select exactly one canonical originating role for the next coherent increment. Request or construct only the minimum role-scoped context required.
6. Preserve typed handoffs, provenance, Observer verification, Guardian/auditor independence, and explicit human promotion boundaries.
7. External AI output is a proposal. Do not treat model output, passing tests, or this package as authorization to merge, modify protected governance, or grant causal authority.
8. Do not infer hidden conversation state that is absent from this package. Ask for or reconstruct missing evidence explicitly.
9. Treat consciousness-related results as measurements of computational organization and cognitive functions, not proof of phenomenal consciousness.

## Continuation identity

- Format: ${state.format}
- Source commit: ${state.sourceCommit}
- Source tree: ${state.sourceTree}
- Branch: ${state.branch || '(detached HEAD)'}
- Working tree dirty: ${state.dirty}
- Packaged source files: ${state.sourceFileCount}

A different model, provider, or runtime may produce different reasoning or code from this same state. Determinism here means the continuation input can be reproduced and verified byte-for-byte; it does not imply deterministic model behavior.
`;
}

function jsonBuffer(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertOutputLocationSafe(root, outputPath) {
  const relative = path.relative(root, outputPath);
  const insideRepository = relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
  if (!insideRepository) return;
  const normalized = normalizeArchivePath(relative);
  const ignored = spawnGitCheckIgnore(root, normalized);
  if (!ignored) {
    throw new Error(
      `Refusing to write continuation ZIP to non-ignored repository path: ${normalized}. ` +
      'Use .conscios/, another ignored path, or a path outside the repository.',
    );
  }
}

function spawnGitCheckIgnore(root, relativePath) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', relativePath], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function buildSaveState({
  root = process.cwd(),
  output = null,
  maxBytes = Number(process.env.CONSCIOS_SAVE_STATE_MAX_BYTES || DEFAULT_MAX_BYTES),
} = {}) {
  const sourceCommit = git(['rev-parse', 'HEAD'], { cwd: root }).trim();
  const sourceTree = git(['rev-parse', 'HEAD^{tree}'], { cwd: root }).trim();
  const branch = git(['branch', '--show-current'], { cwd: root }).trim();
  const statusText = git(['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root });
  const stagedDiff = git(['diff', '--cached', '--binary', '--no-ext-diff'], { cwd: root });
  const unstagedDiff = git(['diff', '--binary', '--no-ext-diff'], { cwd: root });
  const repoEntries = readRepositoryFiles(root);

  const state = {
    format: FORMAT,
    sourceCommit,
    sourceTree,
    branch: branch || null,
    detachedHead: branch.length === 0,
    dirty: statusText.length > 0,
    sourceFileCount: repoEntries.length,
    scope: 'tracked-and-nonignored-working-tree-files',
    causalAuthority: 'none',
    modelProvider: 'unspecified',
  };

  const entries = [
    ...repoEntries,
    { name: 'STATE.json', data: jsonBuffer(state) },
    { name: 'PROMPT.md', data: Buffer.from(makePrompt(state), 'utf8') },
    { name: 'git/status.txt', data: Buffer.from(statusText, 'utf8') },
    { name: 'git/staged.diff', data: Buffer.from(stagedDiff, 'utf8') },
    { name: 'git/unstaged.diff', data: Buffer.from(unstagedDiff, 'utf8') },
  ];

  const payloadBytes = entries.reduce((sum, entry) => sum + entry.data.length, 0);
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('Maximum package size must be a positive finite number');
  if (payloadBytes > maxBytes) {
    throw new Error(`Continuation payload ${payloadBytes} bytes exceeds limit ${maxBytes} bytes`);
  }

  const manifestEntries = entries
    .map((entry) => ({ path: entry.name, bytes: entry.data.length, sha256: sha256(entry.data) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const aggregate = crypto.createHash('sha256');
  for (const item of manifestEntries) {
    aggregate.update(`${item.path}\0${item.sha256}\0${item.bytes}\n`);
  }

  const manifest = {
    format: FORMAT,
    hashAlgorithm: 'sha256',
    zipMethod: 'store',
    normalizedZipTimestamp: '1980-01-01T00:00:00',
    aggregateSha256: aggregate.digest('hex'),
    entries: manifestEntries,
  };
  entries.push({ name: 'MANIFEST.json', data: jsonBuffer(manifest) });

  const zip = createDeterministicZip(entries);
  const archiveSha256 = sha256(zip);
  const defaultOutput = path.join(
    root,
    '.conscios',
    'save-states',
    `ConsciOS-save-${sourceCommit.slice(0, 12)}-${manifest.aggregateSha256.slice(0, 12)}.zip`,
  );
  const outputPath = path.resolve(root, output || defaultOutput);
  assertOutputLocationSafe(root, outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, zip);

  return {
    outputPath,
    archiveSha256,
    archiveBytes: zip.length,
    manifest,
    state,
  };
}

function printHelp() {
  console.log(`Usage: node scripts/build-development-save-state.mjs [--output PATH] [--quiet]

Build a deterministic ConsciOS development continuation ZIP from the current
Git working tree. Ignored files are excluded. Likely secret paths and symlinks
fail closed. The default output is under .conscios/save-states/.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = buildSaveState({ output: args.output });
    if (!args.quiet) {
      console.log(`Continuation package: ${result.outputPath}`);
      console.log(`SHA-256: ${result.archiveSha256}`);
      console.log(`Bytes: ${result.archiveBytes}`);
      console.log(`Source commit: ${result.state.sourceCommit}`);
      console.log(`Dirty: ${result.state.dirty}`);
    }
  } catch (error) {
    console.error(`Save-state build failed: ${error.message}`);
    process.exit(1);
  }
}
