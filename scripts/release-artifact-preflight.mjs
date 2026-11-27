import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPinned } from './pages-artifact.mjs';

const REPO = 'chau-hm/view-camera-simulator';
const REPO_ID = 1283640696;
const MAX_ARCHIVE = 128 * 1024 * 1024;
// Updating trusted workflow definitions requires independent review of this policy.
const WORKFLOWS = {
  '.github/workflows/pages.yml': '37490702733b5130bd9ec125e0d41102751ed004',
  '.github/workflows/historical-qualification.yml': '3a449d8f6f896c2cc38252209362daa0778dc6d6',
  '.github/workflows/pages-artifact-pilot.yml': '94b7feb1e0370ac020b24103f581dbc03a2f6643',
};
const CI_STEPS = ['Checkout', 'Require successful historical qualification and fail-open routing', 'Lint', 'Type-check', 'Unit and integration tests', 'Run ordinary Chromium application smoke', 'Verify production preview WebGL isolation', 'Validate M7R broad E2E recovery evidence integrity', 'Validate M7V E2E qualification lane and skip governance policy'];
const PRODUCER_STEPS = ['Test artifact and workflow contracts', 'Build and identify candidate', 'Pin original identity outside the candidate', 'Test prebuilt candidate', 'Verify unchanged payload', 'Retain candidate and identity', 'Retrieve retained candidate into a fresh directory', 'Verify retained candidate'];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: MAX_ARCHIVE }).trim();
const gh = (...args) => execFileSync('gh', args, { maxBuffer: MAX_ARCHIVE, stdio: ['ignore', 'pipe', 'pipe'] });
const api = (path) => JSON.parse(gh('api', `repos/${REPO}/${path}`).toString('utf8'));
const fail = (message) => { throw new Error(message); };

export function verifyRun(run, { id, attempt, source, path, event, workflowId }) {
  if (String(run.id) !== id || run.run_attempt !== Number(attempt) || run.path !== path || run.workflow_id !== workflowId ||
      run.event !== event || run.status !== 'completed' || run.conclusion !== 'success' || run.head_sha !== source ||
      run.head_branch !== 'main' || run.repository?.full_name !== REPO || run.head_repository?.full_name !== REPO) fail(`Untrusted run: ${id} attempt ${attempt}`);
}

export function requireJob(jobs, name, steps) {
  const selected = jobs.filter((job) => job.name === name);
  if (selected.length !== 1 || selected[0].status !== 'completed' || selected[0].conclusion !== 'success') fail(`Required job failed or missing: ${name}`);
  for (const name of steps) {
    const matches = selected[0].steps.filter((step) => step.name === name);
    if (matches.length !== 1 || matches[0].status !== 'completed' || matches[0].conclusion !== 'success') fail(`Required step failed or missing: ${name}`);
  }
  return selected[0];
}

export function verifyArtifactMetadata(artifact, { artifactId, producerId, attempt, source, now = Date.now() }) {
  if (String(artifact.id) !== artifactId || artifact.name !== `pages-candidate-${producerId}-${attempt}` || artifact.expired !== false ||
      !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 || artifact.size_in_bytes > MAX_ARCHIVE ||
      !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') || !Number.isFinite(Date.parse(artifact.expires_at)) || Date.parse(artifact.expires_at) <= now ||
      String(artifact.workflow_run?.id) !== producerId || artifact.workflow_run?.head_sha !== source || artifact.workflow_run?.head_branch !== 'main' ||
      artifact.workflow_run?.repository_id !== REPO_ID || artifact.workflow_run?.head_repository_id !== REPO_ID) fail('Untrusted, missing, expired or mismatched artifact');
}

export function producerPin(log, artifactId) {
  const lines = log.split(/\r?\n/).map((line) => line.split('\t'));
  const parseStep = (step) => lines.filter((parts) => parts[1] === step).flatMap((parts) => {
    const match = parts.slice(2).join('\t').match(/\{\"identityVersion\":1,.*\}$/);
    if (!match) return [];
    try { return [JSON.parse(match[0])]; } catch { return []; }
  });
  const original = parseStep('Pin original identity outside the candidate');
  const retained = parseStep('Verify retained candidate');
  if (original.length !== 1 || retained.length !== 1 || JSON.stringify(original[0]) !== JSON.stringify(retained[0])) fail('Producer original and retained identity evidence missing or inconsistent');
  const uploadLines = lines.filter((p) => p[1] === 'Retain candidate and identity').map((p) => p.slice(2).join('\t'));
  const retrieved = lines.filter((p) => p[1] === 'Retrieve retained candidate into a fresh directory').map((p) => p.slice(2).join('\t'));
  if (!uploadLines.some((line) => new RegExp(`Artifact ID ${artifactId}(?:\\D|$)`).test(line)) || !retrieved.some((line) => line.includes(`(ID: ${artifactId},`))) fail('Producer log does not bind selected artifact ID');
  return original[0];
}

function jobs(run, attempt) {
  const response = api(`actions/runs/${run}/attempts/${attempt}/jobs?per_page=100`);
  if (!Array.isArray(response.jobs) || response.total_count !== response.jobs.length) fail('Incomplete job list');
  return response.jobs;
}

export function checkArchive(artifact, archive) {
  if (archive.length !== artifact.size_in_bytes || sha256(archive) !== artifact.digest.slice(7)) fail('Artifact transport size or digest mismatch');
}

function main(args) {
  if (args.length !== 6) fail('Usage: node scripts/release-artifact-preflight.mjs <source-sha> <ci-run-id> <ci-attempt> <producer-run-id> <producer-attempt> <artifact-id>');
  const [source, ciId, ciAttempt, producerId, producerAttempt, artifactId] = args;
  if (!/^[a-f0-9]{40}$/.test(source) || ![ciId, ciAttempt, producerId, producerAttempt, artifactId].every((v) => /^[1-9][0-9]{0,15}$/.test(v))) fail('Invalid candidate identifiers');
  const remote = git('remote', 'get-url', 'origin');
  if (!['https://github.com/chau-hm/view-camera-simulator.git', 'git@github.com:chau-hm/view-camera-simulator.git'].includes(remote)) fail('Unexpected repository remote');
  const refs = git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/);
  if (!/^[a-f0-9]{40}$/.test(refs[0] ?? '') || refs[1] !== 'refs/heads/main') fail('Cannot resolve authoritative main');
  const main = refs[0];
  // Refuse stale or missing local source history rather than infer ancestry.
  if (git('rev-parse', '--verify', 'refs/remotes/origin/main') !== main) fail('origin/main is stale; fetch origin before preflight');
  if (git('rev-parse', '--verify', `${source}^{commit}`) !== source) fail('Source commit unavailable');
  try { execFileSync('git', ['merge-base', '--is-ancestor', source, main], { stdio: 'ignore' }); } catch { fail('Source is not an ancestor of authoritative main'); }
  const tree = git('rev-parse', `${source}^{tree}`);
  for (const [path, blob] of Object.entries(WORKFLOWS)) if (git('rev-parse', `${source}:${path}`) !== blob) fail(`Unreviewed workflow definition: ${path}`);
  verifyRun(api(`actions/runs/${ciId}/attempts/${ciAttempt}`), { id: ciId, attempt: ciAttempt, source, path: '.github/workflows/pages.yml', event: 'push', workflowId: 304398257 });
  const ciJobs = jobs(ciId, ciAttempt);
  requireJob(ciJobs, 'feature-push-routing', ['Allow full CI for non-feature-push events']);
  requireJob(ciJobs, 'feature-push-validation-gate', ['Allow full CI unless exact PR validation covers this push']);
  requireJob(ciJobs, 'ci', CI_STEPS);
  requireJob(ciJobs, 'historical-qualification / Historical evidence decision', ['Classify changes and run required historical qualification', 'Preserve machine-readable qualification result']);
  verifyRun(api(`actions/runs/${producerId}/attempts/${producerAttempt}`), { id: producerId, attempt: producerAttempt, source, path: '.github/workflows/pages-artifact-pilot.yml', event: 'workflow_dispatch', workflowId: 432187587 });
  const producerJob = requireJob(jobs(producerId, producerAttempt), 'prepare', PRODUCER_STEPS);
  const artifact = api(`actions/artifacts/${artifactId}`);
  verifyArtifactMetadata(artifact, { artifactId, producerId, attempt: producerAttempt, source });
  const log = gh('run', 'view', producerId, '--repo', REPO, '--job', String(producerJob.id), '--log').toString('utf8');
  const pin = producerPin(log, artifactId);
  if (pin.sourceCommit !== source || pin.sourceTree !== tree) fail('Producer pin source or tree mismatch');
  const archive = gh('api', `repos/${REPO}/actions/artifacts/${artifactId}/zip`);
  checkArchive(artifact, archive);
  const staging = mkdtempSync(join(tmpdir(), 'vcs-release-preflight-'));
  try {
    const zipPath = join(staging, 'candidate.zip');
    const payload = join(staging, 'candidate');
    writeFileSync(zipPath, archive, { mode: 0o600 });
    execFileSync('python3', [resolve('scripts/extract-pages-artifact.py'), zipPath, payload], { stdio: ['ignore', 'ignore', 'pipe'] });
    const actual = verifyPinned(payload, pin, { sourceCommit: source, sourceTree: tree }, true);
    const manifest = JSON.parse(readFileSync(join(payload, 'manifest.json'), 'utf8'));
    const lock = execFileSync('git', ['show', `${source}:package-lock.json`], { maxBuffer: MAX_ARCHIVE });
    if (manifest.workflow !== 'Pages artifact pilot (non-publishing)' || manifest.runId !== producerId || manifest.runAttempt !== producerAttempt || manifest.packageLockSha256 !== sha256(lock)) fail('Manifest producer provenance mismatch');
    const finalRefs = git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/);
    if (finalRefs[0] !== main || finalRefs[1] !== 'refs/heads/main') fail('Authoritative main changed during preflight; retry after fetch');
    const result = { status: 'RELEASE_PREFLIGHT_VERIFIED', qualification: 'RELEASE_QUALIFICATION_PENDING', deployment: 'NOT_DEPLOYED', repository: REPO, source, tree, main, ci: { runId: ciId, attempt: Number(ciAttempt) }, producer: { runId: producerId, attempt: Number(producerAttempt), jobId: producerJob.id }, artifact: { id: artifactId, transportDigest: artifact.digest, transportSize: artifact.size_in_bytes, expiresAt: artifact.expires_at }, identity: actual };
    console.log(JSON.stringify(result, null, 2));
    console.error(`Verified artifact ${artifactId} for ${source}; release qualification pending; not deployed.`);
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    console.error(`RELEASE_PREFLIGHT_FAILED: ${detail}`);
    console.log(JSON.stringify({ status: 'RELEASE_PREFLIGHT_FAILED', qualification: 'RELEASE_QUALIFICATION_PENDING', deployment: 'NOT_DEPLOYED', reason: detail }));
    process.exitCode = 1;
  }
}
