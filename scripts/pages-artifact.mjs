import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'chau-hm/view-camera-simulator';
const packageName = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8')).name;
if (packageName !== repository.split('/')[1]) throw new Error('Repository and package name disagree');
const base = `/${packageName}/`;
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

// Hash regular files only, in bytewise path order. Metadata is outside payload.
export function inventory(root) {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) throw new Error('Missing artifact directory');
  const result = [];
  function visit(directory, prefix = '') {
    for (const name of readdirSync(directory).sort()) {
      if (!name || name === '.' || name === '..' || /[\\/\x00-\x1f\x7f]/.test(name)) throw new Error('Unsafe artifact path');
      const path = prefix ? `${prefix}/${name}` : name;
      if ((name.startsWith('.') && name !== '.nojekyll' && name !== '.well-known') || /^(?:credentials|secrets?)(?:\..*)?$/i.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name)) throw new Error(`Disallowed private artifact entry: ${path}`);
      const absolute = join(directory, name);
      const stat = lstatSync(absolute);
      if ((name === '.well-known' && !stat.isDirectory()) || (name === '.nojekyll' && !stat.isFile())) throw new Error(`Unsupported artifact entry: ${path}`);
      if (stat.isDirectory()) visit(absolute, path);
      else if (stat.isFile() && stat.nlink === 1) {
        const bytes = readFileSync(absolute);
        result.push({ path, size: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`Unsupported artifact entry: ${path}`);
    }
  }
  visit(root);
  return result.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function contentDigest(files) {
  return sha256(JSON.stringify(files));
}

export function verify(root, manifest, expected = {}) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.repository !== repository ||
      !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || !/^[a-f0-9]{40}$/.test(manifest.sourceTree) ||
      manifest.basePath !== base || manifest.mode !== 'production' || !((manifest.buildConfiguration === 'vite-pages-v1' && manifest.buildCommand === 'npm run build -- --base=<basePath>') ||
        (manifest.buildConfiguration === 'vite-pages-after-typecheck-v1' && manifest.buildCommand === 'npm run build:production-preview:after-typecheck -- --base=<basePath>')) || !/^v\d+\.\d+\.\d+$/.test(manifest.nodeVersion) ||
      !/^[a-f0-9]{64}$/.test(manifest.packageLockSha256) ||
      !Array.isArray(manifest.files) || !/^[a-f0-9]{64}$/.test(manifest.contentDigest)) throw new Error('Invalid artifact manifest');
  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) throw new Error(`Artifact identity mismatch: ${key}`);
  }
  const files = inventory(root);
  if (JSON.stringify(files) !== JSON.stringify(manifest.files) || contentDigest(files) !== manifest.contentDigest) throw new Error('Artifact content mismatch');
  if (!files.some((file) => file.path === 'index.html') || !files.some((file) => file.path === '404.html') ||
      !readFileSync(join(root, 'index.html')).equals(readFileSync(join(root, '404.html')))) throw new Error('Invalid Pages fallback');
  return { fileCount: files.length, size: files.reduce((sum, file) => sum + file.size, 0), contentDigest: manifest.contentDigest };
}

// The pin is stored outside the candidate before Preview, and is not uploaded.
export function candidateIdentity(candidate, expected = {}) {
  const manifestBytes = readFileSync(join(candidate, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const summary = verify(join(candidate, 'payload'), manifest, expected);
  return { identityVersion: 1, sourceCommit: manifest.sourceCommit, sourceTree: manifest.sourceTree,
    schemaVersion: manifest.schemaVersion, basePath: manifest.basePath,
    manifestSha256: sha256(manifestBytes), ...summary };
}

export function verifyPinned(candidate, pinned, expected, retained = false) {
  const keys = ['identityVersion', 'sourceCommit', 'sourceTree', 'schemaVersion', 'basePath', 'manifestSha256', 'fileCount', 'size', 'contentDigest'];
  if (!pinned || Object.keys(pinned).sort().join(',') !== keys.sort().join(',') ||
      pinned.identityVersion !== 1 || pinned.schemaVersion !== 1 || pinned.basePath !== base ||
      !/^[a-f0-9]{40}$/.test(pinned.sourceCommit) || !/^[a-f0-9]{40}$/.test(pinned.sourceTree) ||
      !/^[a-f0-9]{64}$/.test(pinned.manifestSha256) || !/^[a-f0-9]{64}$/.test(pinned.contentDigest) ||
      !Number.isSafeInteger(pinned.fileCount) || pinned.fileCount < 1 || !Number.isSafeInteger(pinned.size) || pinned.size < 0) throw new Error('Invalid pinned identity');
  if (!lstatSync(candidate).isDirectory()) throw new Error('Unsupported candidate directory');
  const allowed = retained ? ['manifest.json', 'payload', 'validation.json'] : ['manifest.json', 'payload'];
  if (JSON.stringify(readdirSync(candidate).sort()) !== JSON.stringify(allowed)) throw new Error('Unexpected candidate entries');
  if (!lstatSync(join(candidate, 'manifest.json')).isFile() || lstatSync(join(candidate, 'manifest.json')).nlink !== 1) throw new Error('Unsupported manifest entry');
  const actual = candidateIdentity(candidate, expected);
  for (const key of keys) if (actual[key] !== pinned[key]) throw new Error(`Pinned identity mismatch: ${key}`);
  if (retained) {
    const validationPath = join(candidate, 'validation.json');
    if (!lstatSync(validationPath).isFile() || lstatSync(validationPath).nlink !== 1) throw new Error('Unsupported validation entry');
    const validation = JSON.parse(readFileSync(validationPath, 'utf8'));
    if (validation.status !== 'ARTIFACT_VALIDATED' || validation.qualification !== 'RELEASE_QUALIFICATION_PENDING' ||
        validation.deployment !== 'NOT_DEPLOYED' || validation.contentDigest !== pinned.contentDigest ||
        keys.some((key) => validation[key] !== pinned[key])) throw new Error('Invalid validation metadata');
  }
  return actual;
}

function prepare(out, afterTypecheck = false) {
  if (git('status', '--porcelain', '--untracked-files=all')) throw new Error('Artifact source must be a clean committed tree');
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== repository) throw new Error('Unexpected repository');
  if (Object.keys(process.env).some((key) => key.startsWith('VITE_')) || (process.env.NODE_ENV && process.env.NODE_ENV !== 'production')) throw new Error('Conflicting build environment');
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    if (existsSync(name)) throw new Error(`Environment file is not permitted: ${name}`);
  }
  if (git('ls-files', '--others', '--ignored', '--exclude-standard', '--', 'public', 'src')) throw new Error('Ignored source files may affect the build');
  const sourceCommit = git('rev-parse', 'HEAD');
  const sourceTree = git('rev-parse', 'HEAD^{tree}');
  const target = resolve(out);
  const payload = join(target, 'payload');
  if (existsSync(target)) throw new Error('Output already exists');
  mkdirSync(target, { recursive: true });
  // Standalone execution always includes the required typecheck.
  execFileSync('npm', ['run', afterTypecheck ? 'build:production-preview:after-typecheck' : 'build', '--', `--base=${base}`], { stdio: 'inherit', env: { ...process.env, VITE_BASE_PATH: base } });
  copyFileSync('dist/index.html', 'dist/404.html');
  mkdirSync(payload);
  // Copy only files that passed the inventory entry-type checks.
  for (const file of inventory('dist')) {
    mkdirSync(dirname(join(payload, file.path)), { recursive: true });
    copyFileSync(join('dist', file.path), join(payload, file.path));
  }
  const files = inventory(payload);
  const manifest = {
    schemaVersion: 1, repository, sourceCommit, sourceTree,
    buildConfiguration: afterTypecheck ? 'vite-pages-after-typecheck-v1' : 'vite-pages-v1', basePath: base, mode: 'production',
    nodeVersion: process.version, packageLockSha256: sha256(readFileSync('package-lock.json')),
    buildCommand: afterTypecheck ? 'npm run build:production-preview:after-typecheck -- --base=<basePath>' : 'npm run build -- --base=<basePath>',
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    files, contentDigest: contentDigest(files),
  };
  verify(payload, manifest);
  writeFileSync(join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'ARTIFACT_BUILT', qualification: 'RELEASE_QUALIFICATION_PENDING', deployment: 'NOT_DEPLOYED', ...verify(payload, manifest) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, path, arg1, arg2, arg3, arg4] = process.argv.slice(2);
    if ((command === 'prepare' || command === 'prepare-after-typecheck') && path && !arg1) prepare(path, command === 'prepare-after-typecheck');
    else if (command === 'verify' && path && (!arg2 || arg1)) {
      const manifest = JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8'));
      console.log(JSON.stringify(verify(join(path, 'payload'), manifest, { ...(arg1 ? { sourceCommit: arg1 } : {}), ...(arg2 ? { sourceTree: arg2 } : {}) })));
    } else if (command === 'pin' && path && arg1 && arg2 && arg3 && !arg4) {
      const pinRelative = relative(resolve(path), resolve(arg1));
      if (!pinRelative || (!pinRelative.startsWith(`..${sep}`) && pinRelative !== '..')) throw new Error('Pin must be outside candidate');
      const identity = candidateIdentity(path, { sourceCommit: arg2, sourceTree: arg3 });
      verifyPinned(path, identity, { sourceCommit: arg2, sourceTree: arg3 });
      writeFileSync(arg1, `${JSON.stringify(identity, null, 2)}\n`, { flag: 'wx' });
      console.log(JSON.stringify(identity));
    } else if (command === 'verify-pinned' && path && arg1 && arg2 && arg3 && (!arg4 || arg4 === '--retained')) {
      const identity = JSON.parse(readFileSync(arg1, 'utf8'));
      console.log(JSON.stringify(verifyPinned(path, identity, { sourceCommit: arg2, sourceTree: arg3 }, arg4 === '--retained')));
    } else throw new Error('Usage: node scripts/pages-artifact.mjs prepare <new-output-dir> | verify <output-dir> [expected-commit [expected-tree]]');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
