import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { candidateIdentity, contentDigest, inventory } from '../../../../scripts/pages-artifact.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const source = 'a'.repeat(40), main = 'b'.repeat(40), tree = 'c'.repeat(40);
const repo = 'chau-hm/view-camera-simulator';
const blobs = { '.github/workflows/pages.yml': '37490702733b5130bd9ec125e0d41102751ed004', '.github/workflows/historical-qualification.yml': '3a449d8f6f896c2cc38252209362daa0778dc6d6', '.github/workflows/pages-artifact-pilot.yml': '94b7feb1e0370ac020b24103f581dbc03a2f6643' };
const ciSteps = ['Checkout', 'Require successful historical qualification and fail-open routing', 'Lint', 'Type-check', 'Unit and integration tests', 'Run ordinary Chromium application smoke', 'Verify production preview WebGL isolation', 'Validate M7R broad E2E recovery evidence integrity', 'Validate M7V E2E qualification lane and skip governance policy'];
const producerSteps = ['Test artifact and workflow contracts', 'Build and identify candidate', 'Pin original identity outside the candidate', 'Test prebuilt candidate', 'Verify unchanged payload', 'Retain candidate and identity', 'Retrieve retained candidate into a fresh directory', 'Verify retained candidate'];
const step = (name) => ({ name, status: 'completed', conclusion: 'success' });
const job = (name, steps, run_id, run_attempt) => ({ id: name === 'prepare' ? 999 : 888, name, status: 'completed', conclusion: 'success', run_id, run_attempt, head_sha: source, steps: steps.map(step) });
const run = (id, attempt, path, workflow_id, event) => ({ id, run_attempt: attempt, path, workflow_id, event, status: 'completed', conclusion: 'success', head_sha: source, head_branch: 'main', repository: { full_name: repo }, head_repository: { full_name: repo } });

export function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vcs-preflight-test-'));
  const candidate = join(root, 'candidate'), payload = join(candidate, 'payload');
  mkdirSync(payload, { recursive: true });
  writeFileSync(join(payload, 'index.html'), 'hello');
  writeFileSync(join(payload, '404.html'), 'hello');
  writeFileSync(join(payload, '.nojekyll'), '');
  mkdirSync(join(payload, '.well-known'));
  writeFileSync(join(payload, '.well-known', 'test'), 'public');
  const lock = Buffer.from('fixture lock');
  const files = inventory(payload);
  const manifest = { schemaVersion: 1, repository: repo, sourceCommit: source, sourceTree: tree, buildConfiguration: 'vite-pages-v1', basePath: '/view-camera-simulator/', mode: 'production', nodeVersion: 'v24.3.0', packageLockSha256: hash(lock), buildCommand: 'npm run build -- --base=<basePath>', workflow: 'Pages artifact pilot (non-publishing)', runId: '456', runAttempt: '1', files, contentDigest: contentDigest(files) };
  const saveManifest = () => writeFileSync(join(candidate, 'manifest.json'), JSON.stringify(manifest));
  saveManifest();
  const pin = candidateIdentity(candidate, { sourceCommit: source, sourceTree: tree });
  writeFileSync(join(candidate, 'validation.json'), JSON.stringify({ status: 'ARTIFACT_VALIDATED', qualification: 'RELEASE_QUALIFICATION_PENDING', deployment: 'NOT_DEPLOYED', ...pin }));
  const ciRun = run(123, 2, '.github/workflows/pages.yml', 304398257, 'push');
  const producerRun = run(456, 1, '.github/workflows/pages-artifact-pilot.yml', 432187587, 'workflow_dispatch');
  const ciJobs = [job('feature-push-routing', ['Allow full CI for non-feature-push events'], 123, 2), job('feature-push-validation-gate', ['Allow full CI unless exact PR validation covers this push'], 123, 2), job('ci', ciSteps, 123, 2), job('historical-qualification / Historical evidence decision', ['Classify changes and run required historical qualification', 'Preserve machine-readable qualification result'], 123, 2)];
  const producerJobs = [job('prepare', producerSteps, 456, 1)];
  const artifact = { id: 789, name: 'pages-candidate-456-1', expired: false, size_in_bytes: 1, digest: '', created_at: '2026-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z', workflow_run: { id: 456, head_sha: source, head_branch: 'main', repository_id: 1283640696, head_repository_id: 1283640696 } };
  const state = { root, candidate, payload, source, main, tree, lock, manifest, saveManifest, pin, hash, ciRun, producerRun, ciJobs, producerJobs, artifact, blobs: { ...blobs }, remote: 'https://github.com/chau-hm/view-camera-simulator.git', localMain: main, finalMain: main, sourceExists: true, ancestry: true, selectedTree: tree, calls: [], incompleteJobs: false, archive: Buffer.alloc(0), log: '', missingArtifact: false };
  state.log = `prepare\tPin original identity outside the candidate\t2026 ${JSON.stringify(pin)}\nprepare\tRetain candidate and identity\t2026 Artifact ID 789\nprepare\tRetrieve retained candidate into a fresh directory\t2026 (ID: 789, Size: 1)\nprepare\tVerify retained candidate\t2026 ${JSON.stringify(pin)}\n`;
  state.pack = () => {
    const zip = join(root, 'archive.zip');
    execFileSync('python3', ['-c', "import os,sys,zipfile\nr,z=sys.argv[1:]\nwith zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as out:\n for d,_,fs in os.walk(r):\n  for f in fs:\n   p=os.path.join(d,f);out.write(p,os.path.relpath(p,r))", candidate, zip]);
    state.archive = readFileSync(zip); artifact.size_in_bytes = state.archive.length; artifact.digest = `sha256:${hash(state.archive)}`;
  };
  state.pack();
  state.packUnsafe = () => {
    const zip = join(root, 'unsafe.zip');
    execFileSync('python3', ['-c', "import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w') as z: z.writestr('../escape','x')", zip]);
    state.archive = readFileSync(zip); artifact.size_in_bytes = state.archive.length; artifact.digest = `sha256:${hash(state.archive)}`;
  };
  let refs = 0;
  state.command = (bin, args, options) => {
    state.calls.push([bin, ...args]);
    if (bin === 'python3') return execFileSync(bin, args, options);
    if (bin === 'git') {
      if (args[0] === 'remote') return state.remote;
      if (args[0] === 'ls-remote') return `${refs++ ? state.finalMain : state.main}\trefs/heads/main`;
      if (args[0] === 'merge-base') { if (!state.ancestry) throw new Error('not ancestor'); return Buffer.alloc(0); }
      if (args[0] === 'show') return state.lock;
      if (args.includes('refs/remotes/origin/main')) return state.localMain;
      if (args.includes(`${source}^{commit}`)) { if (!state.sourceExists) throw new Error('missing'); return source; }
      if (args.includes(`${source}^{tree}`)) return state.selectedTree;
      if (args[0] === 'rev-parse') return state.blobs[args[1].slice(source.length + 1)] ?? 'missing';
    }
    if (bin === 'gh') {
      if (args[0] === 'run') return Buffer.from(state.log);
      const path = args[1];
      if (path.endsWith('/123/attempts/2')) return Buffer.from(JSON.stringify(state.ciRun));
      if (path.endsWith('/123/attempts/2/jobs?per_page=100')) return Buffer.from(JSON.stringify({ total_count: state.ciJobs.length + (state.incompleteJobs ? 1 : 0), jobs: state.ciJobs }));
      if (path.endsWith('/456/attempts/1')) return Buffer.from(JSON.stringify(state.producerRun));
      if (path.endsWith('/456/attempts/1/jobs?per_page=100')) return Buffer.from(JSON.stringify({ total_count: state.producerJobs.length, jobs: state.producerJobs }));
      if (path.endsWith('/artifacts/789/zip')) return state.archive;
      if (path.endsWith('/artifacts/789')) { if (state.missingArtifact) throw new Error('not found'); return Buffer.from(JSON.stringify(state.artifact)); }
    }
    throw new Error(`Unexpected command: ${[bin, ...args].join(' ')}`);
  };
  state.args = [source, '123', '2', '456', '1', '789'];
  state.staging = () => readdirSync(root).filter((name) => name.startsWith('vcs-release-preflight-'));
  state.cleanup = () => rmSync(root, { recursive: true, force: true });
  return state;
}
