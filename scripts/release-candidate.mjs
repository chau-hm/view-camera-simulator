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
      const integrated = producer.path === '.github/workflows/pages.yml';
      if (ciRuns.length === 0 && !(producer.status === 'completed' && producer.conclusion && producer.conclusion !== 'success')) throw new Error(`candidate-evidence-unverified:${sha}:missing-ci-run`);
      for (const ci of ciRuns) {
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
    const descending = (a, b) => BigInt(a) === BigInt(b) ? 0 : BigInt(a) > BigInt(b) ? -1 : 1;
    candidates.sort((a,b) => Number(b.integrated) - Number(a.integrated) || descending(a.ciId, b.ciId) || descending(a.ciAttempt, b.ciAttempt) || descending(a.producerId, b.producerId) || descending(a.producerAttempt, b.producerAttempt) || descending(a.artifactId, b.artifactId));
    if (candidates.length) return { state: 'ELIGIBLE_FOR_PREFLIGHT', main, selectedSource: sha, isMainTip: sha === main, newerIneligible: skipped, candidate: candidates[0] };
    skipped.push({ source: sha, state: 'INELIGIBLE', reason: 'no-eligible-run-and-artifact' });
  }
  throw new Error('no-retained-candidate-found');
}

function gh(...args) { return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
function git(...args) { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim(); }
// GitHub numeric IDs must remain exact; unsafe JavaScript numbers cannot be
// distinguished after parsing. Decimal strings are normalized without Number.
function recordId(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('candidate-api-pagination-invalid-id');
    return String(value);
  }
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error('candidate-api-pagination-invalid-id');
  return BigInt(value).toString();
}

export function flattenPages(all, key) {
  if (!Array.isArray(all) || all.length === 0 || all.some((page) => !page || !Array.isArray(page[key]) || !Number.isSafeInteger(page.total_count) || page.total_count < 0)) throw new Error('candidate-api-pagination-incomplete');
  const entries = all.flatMap((page) => page[key]);
  if (all.some((page) => page.total_count !== entries.length)) throw new Error('candidate-api-pagination-incomplete');
  const seen = new Set();
  for (const entry of entries) {
    const id = recordId(entry?.id);
    if (seen.has(id)) throw new Error('candidate-api-pagination-duplicate-id');
    seen.add(id);
  }
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
  if (option === '--source' && !history.includes(value)) throw new Error('candidate-source-not-on-main-history');
  // Validate identities even for injected inventories; the real API path also
  // checks every page and total before producing these arrays.
  flattenPages([{ total_count: listedRuns.length, workflow_runs: listedRuns }], 'workflow_runs');
  flattenPages([{ total_count: artifacts.length, artifacts }], 'artifacts');
  const byRun = new Map(listedRuns.map((run) => [recordId(run.id), run]));
  const bySource = new Map();
  for (const artifact of artifacts) {
    if (typeof artifact.name !== 'string') throw new Error('candidate-evidence-unverified:artifact-name-missing');
    const name = /^pages-candidate-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(artifact.name);
    if (!name || artifact.expired === true || (Number.isFinite(Date.parse(artifact.expires_at)) && Date.parse(artifact.expires_at) <= Date.now())) continue;
    const declaredSource = artifact.workflow_run?.head_sha;
    const producer = byRun.get(name[1]);
    const producerSource = producer?.head_sha;
    // Missing association with no source cannot be attributed safely.
    const sourceSha = producerSource || declaredSource;
    if (!SHA.test(sourceSha ?? '')) throw new Error('candidate-evidence-unverified:artifact-source-missing');
    if (!producer && artifact.workflow_run?.head_branch && artifact.workflow_run.head_branch !== 'main') continue;
    const pairs = bySource.get(sourceSha) ?? [];
    pairs.push({ artifact, producer, attempt: Number(name[2]) });
    bySource.set(sourceSha, pairs);
  }
  let selection;
  const skipped = [];
  for (const sourceSha of option === '--source' ? [value] : history) {
    const pairs = bySource.get(sourceSha) ?? [];
    if (pairs.length === 0) {
      skipped.push({ source: sourceSha, state: 'INELIGIBLE', reason: 'no-retained-candidate' });
      continue;
    }
    if (pairs.some(({ artifact }) => artifact.workflow_run?.id == null || !artifact.workflow_run?.head_sha || !artifact.workflow_run?.head_branch)) throw new Error(`candidate-evidence-unverified:${sourceSha}:artifact-association-missing`);
    if (pairs.some(({ producer }) => !producer)) throw new Error(`candidate-evidence-unverified:${sourceSha}:producer-unavailable`);
    if (pairs.some(({ producer }) => !producer.path || !producer.event || !producer.head_branch || !producer.head_sha)) throw new Error(`candidate-evidence-unverified:${sourceSha}:producer-identity-missing`);
    const relevantPairs = pairs.filter(({ producer }) => (producer.path === '.github/workflows/pages.yml' && producer.event === 'push') || (producer.path === '.github/workflows/pages-artifact-pilot.yml' && producer.event === 'workflow_dispatch'));
    if (relevantPairs.length === 0) {
      skipped.push({ source: sourceSha, state: 'INELIGIBLE', reason: 'no-supported-producer' });
      continue;
    }
    const scopedGit = (...args) => { try { return gitCall(...args); } catch (error) { throw new Error(`candidate-evidence-unverified:${sourceSha}:git:${error.message}`); } };
    const scopedGh = (...args) => { try { return ghCall(...args); } catch (error) { throw new Error(`candidate-evidence-unverified:${sourceSha}:api:${error.message}`); } };
    const blobs = {};
    for (const path of Object.keys(WORKFLOWS)) blobs[path] = scopedGit('rev-parse', `${sourceSha}:${path}`);
    if (blobs['.github/workflows/pages.yml'] === INTEGRATED_PAGES_BLOB) for (const path of Object.keys(INTEGRATED_SOURCE_BLOBS)) blobs[path] = scopedGit('rev-parse', `${sourceSha}:${path}`);
    const hasPilot = relevantPairs.some(({ producer }) => producer.path === '.github/workflows/pages-artifact-pilot.yml');
    const producerIds = new Set(relevantPairs.map(({ producer }) => recordId(producer.id)));
    const relevantRuns = listedRuns.filter((run) => run.head_sha === sourceSha && ((run.path === '.github/workflows/pages.yml' && run.event === 'push' && (hasPilot || producerIds.has(recordId(run.id)))) || producerIds.has(recordId(run.id))));
    const runs = [];
    for (const run of relevantRuns) {
      if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 || run.run_attempt > 100) throw new Error('candidate-attempt-inventory-incomplete');
      const producerAttempts = relevantPairs.filter(({ producer }) => recordId(producer.id) === recordId(run.id)).map(({ attempt }) => attempt);
      if (producerAttempts.some((attempt) => !Number.isSafeInteger(attempt) || attempt < 1 || attempt > run.run_attempt)) throw new Error('candidate-attempt-inventory-incomplete');
      const attempts = run.path === '.github/workflows/pages.yml' && hasPilot ? Array.from({ length: run.run_attempt }, (_, i) => i + 1) : [...new Set(producerAttempts)];
      for (const attempt of attempts) {
        const entry = JSON.parse(scopedGh('api', `repos/${REPO}/actions/runs/${run.id}/attempts/${attempt}`));
        if (String(entry.id) !== String(run.id) || entry.run_attempt !== attempt || entry.head_sha !== sourceSha || !entry.path || !entry.event || !entry.head_branch || entry.workflow_id == null || !entry.repository?.full_name || !entry.head_repository?.full_name) throw new Error('candidate-attempt-identity-mismatch');
        // Failed or unfinished attempts are classified from their run record;
        // only successful attempts require detailed job evidence.
        entry.jobs = [];
        if (entry.status === 'completed' && entry.conclusion === 'success') {
          const jobs = JSON.parse(scopedGh('api', `repos/${REPO}/actions/runs/${run.id}/attempts/${attempt}/jobs?per_page=100`));
          entry.jobs = validateJobInventory(jobs, run.id, attempt, sourceSha);
        }
        runs.push(entry);
      }
    }
    try {
      const found = selectCandidate({ main: sourceSha, history: [sourceSha], runs, artifacts: relevantPairs.map(({ artifact }) => artifact), blobsBySource: { [sourceSha]: blobs }, assess: assessCandidateMetadata });
      selection = { ...found, main: mainSha, isMainTip: sourceSha === mainSha, newerIneligible: skipped };
      break;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'no-retained-candidate-found') throw error;
      skipped.push({ source: sourceSha, state: 'INELIGIBLE', reason: 'no-eligible-run-and-artifact' });
    }
  }
  if (!selection) throw new Error('no-retained-candidate-found');
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
