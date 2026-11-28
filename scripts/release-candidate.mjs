import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualifyCandidate, verifyReleaseBContract } from './release-artifact-qualify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'chau-hm/view-camera-simulator';
const SHA = /^[a-f0-9]{40}$/;

// Discovery only: these records are not authorization. Run preflight after
// choosing, and never silently try another artifact after verification fails.
export function selectCandidate({ main, history, runs, artifacts, source, blobsBySource, assess, now = Date.now() }) {
  if (!SHA.test(main) || !Array.isArray(history) || history[0] !== main || !Array.isArray(runs) || !Array.isArray(artifacts) || typeof assess !== 'function') throw new Error('candidate-discovery-incomplete');
  if (source && (!SHA.test(source) || !history.includes(source))) throw new Error('candidate-source-not-on-main-history');
  const skipped = [];
  for (const sha of source ? [source] : history) {
    const candidates = [];
    const relevant = runs.filter((r) => r.head_sha === sha);
    const ciRuns = relevant.filter((r) => r.path === '.github/workflows/pages.yml' && r.event === 'push');
    const producers = relevant.filter((r) => (r.path === '.github/workflows/pages.yml' && r.event === 'push') || (r.path === '.github/workflows/pages-artifact-pilot.yml' && r.event === 'workflow_dispatch'));
    for (const producer of producers) for (const artifact of artifacts) {
      if (String(artifact.workflow_run?.id) !== String(producer.id)) continue;
      if (!Number.isSafeInteger(producer.run_attempt) || !artifact.name) throw new Error('candidate-evidence-unverified:missing-attempt-or-name');
      if (artifact.name !== `pages-candidate-${producer.id}-${producer.run_attempt}`) continue;
      const integrated = producer.path === '.github/workflows/pages.yml';
      if (ciRuns.length === 0 && !(producer.status === 'completed' && producer.conclusion && producer.conclusion !== 'success')) throw new Error(`candidate-evidence-unverified:${sha}:missing-ci-run`);
      for (const ci of ciRuns) {
        if (integrated && (ci.id !== producer.id || ci.run_attempt !== producer.run_attempt)) continue;
        const args = { source: sha, ciId: String(ci.id), ciAttempt: String(ci.run_attempt), producerId: String(producer.id), producerAttempt: String(producer.run_attempt), artifactId: String(artifact.id), blobs: blobsBySource?.[sha], ciRun: ci, ciJobs: ci.jobs, producerRun: producer, producerJobs: producer.jobs, artifact, now };
        const metadata = assess(args);
        if (metadata.state === 'UNVERIFIED') throw new Error(`candidate-evidence-unverified:${sha}:${metadata.reason}`);
        if (metadata.state !== 'ELIGIBLE_FOR_PREFLIGHT') continue;
        candidates.push({ repository: REPO, artifactName: artifact.name, source: sha, ciId: args.ciId, ciAttempt: args.ciAttempt, producerId: args.producerId, producerAttempt: args.producerAttempt, artifactId: args.artifactId, expiresAt: artifact.expires_at, integrated, policy: metadata.policy, transportDigest: artifact.digest, transportSize: artifact.size_in_bytes, createdAt: artifact.created_at });
      }
    }
    const associations = new Map();
    for (const candidate of candidates) {
      const key = `${candidate.producerId}:${candidate.producerAttempt}`;
      const prior = associations.get(key);
      if (prior && prior !== candidate.artifactId) throw new Error('ambiguous-retained-artifacts');
      associations.set(key, candidate.artifactId);
    }
    candidates.sort((a,b) => Number(b.integrated) - Number(a.integrated) || Number(b.ciId) - Number(a.ciId) || Number(b.ciAttempt) - Number(a.ciAttempt) || Number(b.producerId) - Number(a.producerId) || Number(b.producerAttempt) - Number(a.producerAttempt) || Number(b.artifactId) - Number(a.artifactId));
    if (candidates.length) return { state: 'ELIGIBLE_FOR_PREFLIGHT', main, selectedSource: sha, isMainTip: sha === main, newerIneligible: skipped, candidate: candidates[0] };
    skipped.push({ source: sha, state: 'INELIGIBLE', reason: 'no-eligible-run-and-artifact' });
  }
  throw new Error('no-retained-candidate-found');
}

function gh(...args) { return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
function git(...args) { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim(); }
export function flattenPages(all, key) {
  if (!Array.isArray(all) || all.length === 0 || all.some((page) => !Array.isArray(page[key]))) throw new Error('candidate-api-pagination-incomplete');
  const entries = all.flatMap((page) => page[key]);
  if (all.some((page) => page.total_count !== entries.length)) throw new Error('candidate-api-pagination-incomplete');
  return entries;
}
function pages(path, key) {
  return flattenPages(JSON.parse(gh('api', '--paginate', '--slurp', `repos/${REPO}/${path}`)), key);
}
export async function main(args, overrides = {}) {
  if (resolve(process.cwd()) !== root) throw new Error('qualification-must-run-from-repository-root');
  const [action, option, value] = args;
  const gitCall = overrides.git ?? git;
  const ghCall = overrides.gh ?? gh;
  const getPages = overrides.pages ?? pages;
  const gate = overrides.gate ?? verifyReleaseBContract;
  const qualify = overrides.qualify ?? qualifyCandidate;
  if (!['list', 'qualify'].includes(action) || (action === 'list' && args.length !== 1) || (action === 'qualify' && !((option === '--latest' && args.length === 2) || (option === '--source' && args.length === 3 && SHA.test(value ?? ''))))) throw new Error('Usage: node scripts/release-candidate.mjs list | qualify --latest | qualify --source <full-sha>');
  const refs = gitCall('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/);
  const mainSha = refs[0];
  if (!SHA.test(mainSha ?? '') || refs[1] !== 'refs/heads/main' || gitCall('rev-parse', 'refs/remotes/origin/main') !== mainSha) throw new Error('fetch-origin-main-before-selection');
  const history = gitCall('rev-list', '--first-parent', mainSha).split('\n');
  const listedRuns = getPages('actions/runs?branch=main&per_page=100', 'workflow_runs');
  const artifacts = getPages('actions/artifacts?per_page=100', 'artifacts');
  if (action === 'list') return { status: 'CANDIDATE_DISCOVERY', main: mainSha, artifacts: artifacts.filter((a) => /^pages-candidate-\d+-\d+$/.test(a.name)).map((a) => ({ id: a.id, name: a.name, expired: a.expired, expiresAt: a.expires_at, source: a.workflow_run?.head_sha })) , deployment: 'NOT_DEPLOYED' };
  // Do not load release preflight or artifact helpers until their committed
  // canonical identities have been verified by the Release C gate.
  await gate();
  const { runPreflight } = overrides.preflightModule ?? await import('./release-artifact-preflight.mjs');
  const { assessCandidateMetadata, validateJobInventory, WORKFLOWS, INTEGRATED_SOURCE_BLOBS, INTEGRATED_PAGES_BLOB } = await import('./release-candidate-eligibility.mjs');
  const candidateSources = new Set();
  for (const artifact of artifacts.filter((a) => /^pages-candidate-\d+-\d+$/.test(a.name) && a.expired !== true && !(Number.isFinite(Date.parse(a.expires_at)) && Date.parse(a.expires_at) <= Date.now()))) {
    if (!artifact.workflow_run?.head_sha || artifact.workflow_run.id == null || !artifact.workflow_run.head_branch) throw new Error('candidate-evidence-unverified:artifact-association-missing');
    const matching = listedRuns.filter((run) => String(run.id) === String(artifact.workflow_run.id));
    if (matching.length > 1) throw new Error('candidate-evidence-unverified:ambiguous-producer');
    if (matching.length === 0) {
      if (artifact.workflow_run.head_branch === 'main') throw new Error('candidate-evidence-unverified:producer-unavailable');
      continue;
    }
    if (!matching[0].head_sha || !matching[0].path || !matching[0].event || !matching[0].head_branch) throw new Error('candidate-evidence-unverified:producer-identity-missing');
    candidateSources.add(matching[0].head_sha);
  }
  const blobsBySource = {};
  const runs = [];
  for (const run of listedRuns.filter((r) => candidateSources.has(r.head_sha) && ['.github/workflows/pages.yml', '.github/workflows/pages-artifact-pilot.yml'].includes(r.path))) {
    if (!blobsBySource[run.head_sha]) {
      const blobs = {};
      for (const path of Object.keys(WORKFLOWS)) blobs[path] = gitCall('rev-parse', `${run.head_sha}:${path}`);
      if (blobs['.github/workflows/pages.yml'] === INTEGRATED_PAGES_BLOB) for (const path of Object.keys(INTEGRATED_SOURCE_BLOBS)) blobs[path] = gitCall('rev-parse', `${run.head_sha}:${path}`);
      blobsBySource[run.head_sha] = blobs;
    }
    if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 || run.run_attempt > 100) throw new Error('candidate-attempt-inventory-incomplete');
    for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
      const entry = JSON.parse(ghCall('api', `repos/${REPO}/actions/runs/${run.id}/attempts/${attempt}`));
      if (entry.id !== run.id || entry.run_attempt !== attempt || entry.head_sha !== run.head_sha || !entry.path || !entry.event || !entry.head_branch || entry.workflow_id == null || !entry.repository?.full_name || !entry.head_repository?.full_name) throw new Error('candidate-attempt-identity-mismatch');
      const jobs = JSON.parse(ghCall('api', `repos/${REPO}/actions/runs/${run.id}/attempts/${attempt}/jobs?per_page=100`));
      entry.jobs = validateJobInventory(jobs, run.id, attempt, run.head_sha);
      runs.push(entry);
    }
  }
  const selection = selectCandidate({ main: mainSha, history, runs, artifacts, source: option === '--source' ? value : undefined, blobsBySource, assess: assessCandidateMetadata });
  const c = selection.candidate;
  c.sourceTree = gitCall('rev-parse', `${c.source}^{tree}`);
  if (!SHA.test(c.sourceTree)) throw new Error('candidate-source-tree-unverified');
  const pinnedPreflight = (identifiers) => {
    const verified = runPreflight(identifiers);
    if (verified.main !== mainSha || verified.source !== c.source || verified.tree !== c.sourceTree || verified.policy !== c.policy || verified.repository !== c.repository || verified.artifact.id !== c.artifactId || verified.artifact.transportDigest !== c.transportDigest || verified.artifact.transportSize !== c.transportSize || verified.artifact.createdAt !== c.createdAt || verified.artifact.expiresAt !== c.expiresAt) throw new Error('candidate-selected-identity-changed');
    return verified;
  };
  const result = await qualify([c.source, c.ciId, c.ciAttempt, c.producerId, c.producerAttempt, c.artifactId], { preflight: pinnedPreflight });
  if (result.candidate.main !== mainSha) throw new Error('main-moved-during-selection');
  return { selection, result };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`RELEASE_CANDIDATE_FAILED: ${error.message}`); console.log(JSON.stringify({ status: 'RELEASE_CANDIDATE_FAILED', reason: error.message, deployment: 'NOT_DEPLOYED' })); process.exitCode = 1; }
}
