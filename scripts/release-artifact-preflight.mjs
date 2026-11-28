import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPinned } from './pages-artifact.mjs';

import { REPO, MAX_ARCHIVE, WORKFLOWS, INTEGRATED_PAGES_BLOB, INTEGRATED_SOURCE_BLOBS, CI_STEPS, PRODUCER_STEPS, verifyRun, requireJob, verifyArtifactMetadata, assessCandidateMetadata, validateJobInventory } from './release-candidate-eligibility.mjs';
export { WORKFLOWS, INTEGRATED_PAGES_BLOB, INTEGRATED_SOURCE_BLOBS, CI_STEPS, PRODUCER_STEPS, verifyRun, requireJob, verifyArtifactMetadata };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(message); };

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

export function checkArchive(artifact, archive) {
  if (archive.length !== artifact.size_in_bytes || sha256(archive) !== artifact.digest.slice(7)) fail('Artifact transport size or digest mismatch');
}

export function runPreflight(args, { runCommand = execFileSync, tempRoot = tmpdir() } = {}) {
  if (resolve(process.cwd()) !== resolve(dirname(fileURLToPath(import.meta.url)), '..')) fail('qualification-must-run-from-repository-root');
  const git = (...args) => runCommand('git', args, { encoding: 'utf8', maxBuffer: MAX_ARCHIVE }).trim();
  const gh = (...args) => runCommand('gh', args, { maxBuffer: MAX_ARCHIVE, stdio: ['ignore', 'pipe', 'pipe'] });
  const api = (path) => JSON.parse(gh('api', `repos/${REPO}/${path}`).toString('utf8'));
  const jobs = (run, attempt, source) => {
    const response = api(`actions/runs/${run}/attempts/${attempt}/jobs?per_page=100`);
    return validateJobInventory(response, run, attempt, source);
  };
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
  try { runCommand('git', ['merge-base', '--is-ancestor', source, main], { stdio: 'ignore' }); } catch { fail('Source is not an ancestor of authoritative main'); }
  const tree = git('rev-parse', `${source}^{tree}`);
  const blobs = {};
  for (const path of [...Object.keys(WORKFLOWS), ...Object.keys(INTEGRATED_SOURCE_BLOBS)]) {
    if (path in INTEGRATED_SOURCE_BLOBS && git('rev-parse', `${source}:.github/workflows/pages.yml`) !== INTEGRATED_PAGES_BLOB) continue;
    blobs[path] = git('rev-parse', `${source}:${path}`);
  }
  const ciRun = api(`actions/runs/${ciId}/attempts/${ciAttempt}`);
  const ciJobs = jobs(ciId, ciAttempt, source);
  const same = ciId === producerId && ciAttempt === producerAttempt;
  const producerRun = same ? ciRun : api(`actions/runs/${producerId}/attempts/${producerAttempt}`);
  const producerJobs = same ? ciJobs : jobs(producerId, producerAttempt, source);
  const artifact = api(`actions/artifacts/${artifactId}`);
  const metadata = assessCandidateMetadata({ source, ciId, ciAttempt, producerId, producerAttempt, artifactId, blobs, ciRun, ciJobs, producerRun, producerJobs, artifact });
  if (metadata.state !== 'ELIGIBLE_FOR_PREFLIGHT') fail(`Metadata ${metadata.state}: ${metadata.reason}`);
  const { policy, producerJob } = metadata;
  const log = gh('run', 'view', producerId, '--repo', REPO, '--job', String(producerJob.id), '--log').toString('utf8');
  const pin = producerPin(log, artifactId);
  if (pin.sourceCommit !== source || pin.sourceTree !== tree) fail('Producer pin source or tree mismatch');
  const archive = gh('api', `repos/${REPO}/actions/artifacts/${artifactId}/zip`);
  checkArchive(artifact, archive);
  const staging = mkdtempSync(join(tempRoot, 'vcs-release-preflight-'));
  try {
    const zipPath = join(staging, 'candidate.zip');
    const payload = join(staging, 'candidate');
    writeFileSync(zipPath, archive, { mode: 0o600 });
    runCommand('python3', [resolve('scripts/extract-pages-artifact.py'), zipPath, payload], { stdio: ['ignore', 'ignore', 'pipe'] });
    const actual = verifyPinned(payload, pin, { sourceCommit: source, sourceTree: tree }, true);
    const manifest = JSON.parse(readFileSync(join(payload, 'manifest.json'), 'utf8'));
    const lock = runCommand('git', ['show', `${source}:package-lock.json`], { maxBuffer: MAX_ARCHIVE });
    if (manifest.workflow !== (policy === 'main-ci-integrated-v1' ? 'CI and Deploy to GitHub Pages' : 'Pages artifact pilot (non-publishing)') || manifest.buildConfiguration !== (policy === 'main-ci-integrated-v1' ? 'vite-pages-after-typecheck-v1' : 'vite-pages-v1') || manifest.runId !== producerId || manifest.runAttempt !== producerAttempt || manifest.packageLockSha256 !== sha256(lock)) fail('Manifest producer provenance mismatch');
    const finalRefs = git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/);
    if (finalRefs[0] !== main || finalRefs[1] !== 'refs/heads/main') fail('Authoritative main changed during preflight; retry after fetch');
    const result = { status: 'RELEASE_PREFLIGHT_VERIFIED', qualification: 'RELEASE_QUALIFICATION_PENDING', deployment: 'NOT_DEPLOYED', repository: REPO, policy, source, tree, main, ci: { runId: ciId, attempt: Number(ciAttempt) }, producer: { runId: producerId, attempt: Number(producerAttempt), jobId: producerJob.id }, artifact: { id: artifactId, transportDigest: artifact.digest, transportSize: artifact.size_in_bytes, createdAt: artifact.created_at, expiresAt: artifact.expires_at }, identity: actual };
    return result;
  } finally { rmSync(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (resolve(process.cwd()) !== resolve(dirname(fileURLToPath(import.meta.url)), '..')) fail('qualification-must-run-from-repository-root');
    const result = runPreflight(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    console.error(`Verified artifact ${result.artifact.id} for ${result.source}; release qualification pending; not deployed.`);
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    console.error(`RELEASE_PREFLIGHT_FAILED: ${detail}`);
    console.log(JSON.stringify({ status: 'RELEASE_PREFLIGHT_FAILED', qualification: 'RELEASE_QUALIFICATION_PENDING', deployment: 'NOT_DEPLOYED', reason: detail }));
    process.exitCode = 1;
  }
}
