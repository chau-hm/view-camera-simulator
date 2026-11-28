import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualifyCandidate, verifyReleaseBContract } from './release-artifact-qualify.mjs';

const REPO = 'chau-hm/view-camera-simulator';
const SHA = /^[a-f0-9]{40}$/;

// Discovery only: these records are not authorization. Run preflight after
// choosing, and never silently try another artifact after verification fails.
export function selectCandidate({ main, history, runs, artifacts, source, now = Date.now() }) {
  if (!SHA.test(main) || !Array.isArray(history) || history[0] !== main || !Array.isArray(runs) || !Array.isArray(artifacts)) throw new Error('candidate-discovery-incomplete');
  if (source && (!SHA.test(source) || !history.includes(source))) throw new Error('candidate-source-not-on-main-history');
  const revisions = source ? [source] : history;
  const skipped = [];
  for (const sha of revisions) {
    const candidates = [];
    const ciRuns = runs.filter((r) => r.head_sha === sha && r.path === '.github/workflows/pages.yml' && r.event === 'push' && r.head_branch === 'main' && r.status === 'completed' && r.conclusion === 'success' && r.discoveryEligible !== false);
    const producers = runs.filter((r) => r.head_sha === sha && r.head_branch === 'main' && r.status === 'completed' && r.conclusion === 'success' && r.discoveryEligible !== false && ((r.path === '.github/workflows/pages.yml' && r.event === 'push') || (r.path === '.github/workflows/pages-artifact-pilot.yml' && r.event === 'workflow_dispatch')));
    for (const producer of producers) for (const artifact of artifacts) {
      const attempt = producer.run_attempt;
      if (!Number.isSafeInteger(attempt) || attempt < 1 || String(artifact.workflow_run?.id) !== String(producer.id) || artifact.name !== `pages-candidate-${producer.id}-${attempt}` || artifact.expired !== false || !(Date.parse(artifact.expires_at) > now)) continue;
      const integrated = producer.path === '.github/workflows/pages.yml';
      for (const ci of ciRuns) {
        if (integrated && (ci.id !== producer.id || ci.run_attempt !== attempt)) continue;
        candidates.push({ source: sha, ciId: String(ci.id), ciAttempt: String(ci.run_attempt), producerId: String(producer.id), producerAttempt: String(attempt), artifactId: String(artifact.id), expiresAt: artifact.expires_at, integrated });
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
    if (candidates.length) return { main, selectedSource: sha, isMainTip: sha === main, newerIneligible: skipped, candidate: candidates[0] };
    skipped.push({ source: sha, reason: 'no-completed-run-with-retained-candidate' });
  }
  throw new Error('no-retained-candidate-found');
}

function gh(...args) { return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
function git(...args) { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim(); }
export function flattenPages(all, key) {
  if (!Array.isArray(all) || all.some((page) => !Array.isArray(page[key]))) throw new Error('candidate-api-pagination-incomplete');
  const entries = all.flatMap((page) => page[key]);
  if (all.some((page) => page.total_count !== entries.length)) throw new Error('candidate-api-pagination-incomplete');
  return entries;
}
function pages(path, key) {
  return flattenPages(JSON.parse(gh('api', '--paginate', '--slurp', `repos/${REPO}/${path}`)), key);
}
export async function main(args) {
  const [action, option, value] = args;
  if (!['list', 'qualify'].includes(action) || (action === 'list' && args.length !== 1) || (action === 'qualify' && !((option === '--latest' && args.length === 2) || (option === '--source' && args.length === 3 && SHA.test(value ?? ''))))) throw new Error('Usage: node scripts/release-candidate.mjs list | qualify --latest | qualify --source <full-sha>');
  const refs = git('ls-remote', '--heads', 'origin', 'refs/heads/main').split(/\s+/);
  const mainSha = refs[0];
  if (!SHA.test(mainSha ?? '') || refs[1] !== 'refs/heads/main' || git('rev-parse', 'refs/remotes/origin/main') !== mainSha) throw new Error('fetch-origin-main-before-selection');
  const history = git('rev-list', '--first-parent', mainSha).split('\n');
  const listedRuns = pages('actions/runs?branch=main&per_page=100', 'workflow_runs').filter((r) => r.repository?.full_name === REPO && r.head_repository?.full_name === REPO);
  const artifacts = pages('actions/artifacts?per_page=100', 'artifacts');
  if (action === 'list') return { status: 'CANDIDATE_DISCOVERY', main: mainSha, artifacts: artifacts.filter((a) => /^pages-candidate-\d+-\d+$/.test(a.name)).map((a) => ({ id: a.id, name: a.name, expired: a.expired, expiresAt: a.expires_at, source: a.workflow_run?.head_sha })) , deployment: 'NOT_DEPLOYED' };
  // Do not load release preflight or artifact helpers until their committed
  // canonical identities have been verified by the Release C gate.
  await verifyReleaseBContract();
  const { runPreflight, verifyRun, requireJob, WORKFLOWS, INTEGRATED_PAGES_BLOB, INTEGRATED_SOURCE_BLOBS, CI_STEPS, PRODUCER_STEPS } = await import('./release-artifact-preflight.mjs');
  const candidateSources = new Set(artifacts.filter((a) => a.expired === false && Date.parse(a.expires_at) > Date.now() && /^pages-candidate-\d+-\d+$/.test(a.name)).map((a) => a.workflow_run?.head_sha));
  const runs = [];
  for (const run of listedRuns.filter((r) => candidateSources.has(r.head_sha) && ['.github/workflows/pages.yml', '.github/workflows/pages-artifact-pilot.yml'].includes(r.path))) {
    if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 || run.run_attempt > 100) throw new Error('candidate-attempt-inventory-incomplete');
    for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
      const entry = JSON.parse(gh('api', `repos/${REPO}/actions/runs/${run.id}/attempts/${attempt}`));
      if (entry.id !== run.id || entry.run_attempt !== attempt || entry.head_sha !== run.head_sha) throw new Error('candidate-attempt-identity-mismatch');
      if (entry.status === 'completed' && entry.conclusion === 'success') {
        const jobs = JSON.parse(gh('api', `repos/${REPO}/actions/runs/${run.id}/attempts/${attempt}/jobs?per_page=100`));
        if (!Array.isArray(jobs.jobs) || jobs.total_count !== jobs.jobs.length || jobs.jobs.some((job) => String(job.run_id) !== String(run.id) || job.run_attempt !== attempt || job.head_sha !== run.head_sha)) throw new Error('candidate-job-inventory-incomplete');
        try {
          const isCi = entry.path === '.github/workflows/pages.yml';
          verifyRun(entry, { id: String(run.id), attempt: String(attempt), source: entry.head_sha, path: entry.path, event: isCi ? 'push' : 'workflow_dispatch', workflowId: isCi ? 304398257 : 432187587 });
          const blob = git('rev-parse', `${entry.head_sha}:.github/workflows/pages.yml`);
          const integrated = blob === INTEGRATED_PAGES_BLOB;
          if (!integrated && blob !== WORKFLOWS['.github/workflows/pages.yml']) throw new Error('unknown-policy');
          if (integrated && Object.entries(INTEGRATED_SOURCE_BLOBS).some(([path, expected]) => git('rev-parse', `${entry.head_sha}:${path}`) !== expected)) throw new Error('unknown-build-profile');
          if (isCi) {
            requireJob(jobs.jobs, 'feature-push-routing', ['Allow full CI for non-feature-push events']);
            requireJob(jobs.jobs, 'feature-push-validation-gate', ['Allow full CI unless exact PR validation covers this push']);
            requireJob(jobs.jobs, 'historical-qualification / Historical evidence decision', ['Classify changes and run required historical qualification', 'Preserve machine-readable qualification result']);
            requireJob(jobs.jobs, 'ci', integrated ? [...CI_STEPS, ...PRODUCER_STEPS.filter((name) => name !== 'Test artifact and workflow contracts')] : CI_STEPS);
          } else {
            requireJob(jobs.jobs, 'prepare', PRODUCER_STEPS);
          }
          entry.discoveryEligible = true;
        } catch { entry.discoveryEligible = false; }
      }
      runs.push(entry);
    }
  }
  const selection = selectCandidate({ main: mainSha, history, runs, artifacts, source: option === '--source' ? value : undefined });
  const c = selection.candidate;
  const result = await qualifyCandidate([c.source, c.ciId, c.ciAttempt, c.producerId, c.producerAttempt, c.artifactId], { preflight: runPreflight });
  if (result.candidate.main !== mainSha) throw new Error('main-moved-during-selection');
  return { selection, result };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`RELEASE_CANDIDATE_FAILED: ${error.message}`); console.log(JSON.stringify({ status: 'RELEASE_CANDIDATE_FAILED', reason: error.message, deployment: 'NOT_DEPLOYED' })); process.exitCode = 1; }
}
