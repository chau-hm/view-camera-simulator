export const REPO = 'chau-hm/view-camera-simulator';
export const REPO_ID = 1283640696;
export const MAX_ARCHIVE = 128 * 1024 * 1024;
// Updating trusted workflow definitions requires independent review of this policy.
export const WORKFLOWS = {
  '.github/workflows/pages.yml': '37490702733b5130bd9ec125e0d41102751ed004',
  '.github/workflows/historical-qualification.yml': '3a449d8f6f896c2cc38252209362daa0778dc6d6',
  '.github/workflows/pages-artifact-pilot.yml': '94b7feb1e0370ac020b24103f581dbc03a2f6643',
};
export const INTEGRATED_PAGES_BLOB = '1f2f97b115ec4baf1b18ab8f3777eabe6efaa81e';
// The integrated workflow calls source-side build and Preview code. Pin the
// reviewed profile independently of producer-declared manifest metadata.
export const INTEGRATED_SOURCE_BLOBS = Object.freeze({
  'scripts/pages-artifact.mjs': '2e5268c81b9ee0cc6ed9fe2b677b82aa1770667d',
  'scripts/pages-artifact-server.mjs': '6f65062056965afa7618696f1116b7fbe65b3956',
  'playwright.pages-artifact.config.ts': '53ded0849a0959728febc143baac6fb0651047cc',
  'package.json': '67632e46d4929703cfea38ebb7635f2f3bed58e0',
  'vite.config.ts': '2d5bd5682141657159e6b99c31f210729e2b62c2',
  'src/tests/e2e/architecture-rise-webgpu-production.spec.ts': '19ba2813a4e259a427dd606ae7a40e402ee17d42',
  'src/tests/scene-variation-e2e/pages-artifact.spec.ts': 'f14aa0bcab77431e020ae2f72b6a667ee2487d3e',
  'src/tests/scene-variation-e2e/architecture-rise-seeded-materials-subpath-production.spec.ts': '667d13eb3714272f98ff9e547491e8b90f7b8e3a',
});
export const CI_STEPS = ['Checkout', 'Require successful historical qualification and fail-open routing', 'Lint', 'Type-check', 'Unit and integration tests', 'Run ordinary Chromium application smoke', 'Verify production preview WebGL isolation', 'Validate M7R broad E2E recovery evidence integrity', 'Validate M7V E2E qualification lane and skip governance policy'];
export const PRODUCER_STEPS = ['Test artifact and workflow contracts', 'Build and identify candidate', 'Pin original identity outside the candidate', 'Test prebuilt candidate', 'Verify unchanged payload', 'Retain candidate and identity', 'Retrieve retained candidate into a fresh directory', 'Verify retained candidate'];
const fail = (message) => { throw new Error(message); };

export function validateJobInventory(response, run, attempt, source) {
  if (!Array.isArray(response?.jobs) || response.total_count !== response.jobs.length || response.jobs.some((job) => String(job.run_id) !== String(run) || job.run_attempt !== Number(attempt) || job.head_sha !== source)) throw new Error('UNVERIFIED:Incomplete or mismatched attempt job list');
  return response.jobs;
}

export function verifyRun(run, { id, attempt, source, path, event, workflowId }) {
  if (String(run.id) !== id || run.run_attempt !== Number(attempt) || run.path !== path || run.workflow_id !== workflowId ||
      run.event !== event || run.status !== 'completed' || run.conclusion !== 'success' || run.head_sha !== source ||
      run.head_branch !== 'main' || run.repository?.full_name !== REPO || run.head_repository?.full_name !== REPO) fail(`Untrusted run: ${id} attempt ${attempt}`);
}

export function requireJob(jobs, name, steps) {
  const selected = jobs.filter((job) => job.name === name);
  if (selected.length !== 1) fail(`UNVERIFIED:Required job missing or ambiguous: ${name}`);
  if (selected[0].status !== 'completed' || !selected[0].conclusion || !Array.isArray(selected[0].steps)) fail(`UNVERIFIED:Required job incomplete: ${name}`);
  if (selected[0].conclusion !== 'success') fail(`Required job failed: ${name}`);
  for (const name of steps) {
    const matches = selected[0].steps.filter((step) => step.name === name);
    if (matches.length !== 1 || matches[0].status !== 'completed' || !matches[0].conclusion) fail(`UNVERIFIED:Required step missing, ambiguous or incomplete: ${name}`);
    if (matches[0].conclusion !== 'success') fail(`Required step failed: ${name}`);
  }
  return selected[0];
}

export function verifyArtifactMetadata(artifact, { artifactId, producerId, attempt, source, now = Date.now() }) {
  if (String(artifact.id) !== artifactId || artifact.name !== `pages-candidate-${producerId}-${attempt}` || artifact.expired !== false ||
      !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 || artifact.size_in_bytes > MAX_ARCHIVE ||
      !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') || !Number.isFinite(Date.parse(artifact.created_at)) || !Number.isFinite(Date.parse(artifact.expires_at)) || Date.parse(artifact.expires_at) <= now ||
      String(artifact.workflow_run?.id) !== producerId || artifact.workflow_run?.head_sha !== source || artifact.workflow_run?.head_branch !== 'main' ||
      artifact.workflow_run?.repository_id !== REPO_ID || artifact.workflow_run?.head_repository_id !== REPO_ID) fail('Untrusted, missing, expired or mismatched artifact');
}

// Metadata-only decision; transport, logs and contents are verified later.
export function assessCandidateMetadata({ source, ciId, ciAttempt, producerId, producerAttempt, artifactId, blobs, ciRun, ciJobs, producerRun, producerJobs, artifact, now = Date.now() }) {
  try {
    if (![source, ciId, ciAttempt, producerId, producerAttempt, artifactId].every((v) => typeof v === 'string' && v.length) || !blobs || !ciRun || !Array.isArray(ciJobs) || !artifact) throw new Error('UNVERIFIED:missing metadata');
    if (!/^[a-f0-9]{40}$/.test(source) || ![ciId, ciAttempt, producerId, producerAttempt, artifactId].every((id) => /^[1-9][0-9]{0,15}$/.test(id))) throw new Error('UNVERIFIED:invalid metadata identifiers');
    for (const path of Object.keys(WORKFLOWS)) if (typeof blobs[path] !== 'string') throw new Error('UNVERIFIED:source workflow unavailable');
    const pagesBlob = blobs['.github/workflows/pages.yml'];
    if (pagesBlob !== WORKFLOWS['.github/workflows/pages.yml'] && pagesBlob !== INTEGRATED_PAGES_BLOB) throw new Error('unreviewed pages workflow');
    const integratedCI = pagesBlob === INTEGRATED_PAGES_BLOB;
    if (integratedCI) for (const [path, expected] of Object.entries(INTEGRATED_SOURCE_BLOBS)) {
      if (typeof blobs[path] !== 'string') throw new Error('UNVERIFIED:source build profile unavailable');
      if (blobs[path] !== expected) throw new Error(`unreviewed integrated build profile: ${path}`);
    }
    for (const [path, expected] of Object.entries(WORKFLOWS)) if (path !== '.github/workflows/pages.yml' && blobs[path] !== expected) throw new Error(`unreviewed workflow: ${path}`);
    const policy = integratedCI && ciId === producerId && ciAttempt === producerAttempt ? 'main-ci-integrated-v1' : 'historical-two-run-v1';
    if (ciRun.id == null || ciRun.run_attempt == null || !ciRun.path || ciRun.workflow_id == null || !ciRun.event || !ciRun.head_sha || !ciRun.head_branch || ciRun.status !== 'completed' || !ciRun.conclusion || !ciRun.repository?.full_name || !ciRun.head_repository?.full_name) throw new Error('UNVERIFIED:incomplete CI metadata');
    verifyRun(ciRun, { id: ciId, attempt: ciAttempt, source, path: '.github/workflows/pages.yml', event: 'push', workflowId: 304398257 });
    requireJob(ciJobs, 'feature-push-routing', ['Allow full CI for non-feature-push events']);
    requireJob(ciJobs, 'feature-push-validation-gate', ['Allow full CI unless exact PR validation covers this push']);
    const ciJob = requireJob(ciJobs, 'ci', integratedCI ? [...CI_STEPS, ...PRODUCER_STEPS.filter((s) => s !== 'Test artifact and workflow contracts')] : CI_STEPS);
    requireJob(ciJobs, 'historical-qualification / Historical evidence decision', ['Classify changes and run required historical qualification', 'Preserve machine-readable qualification result']);
    let producerJob = ciJob;
    if (policy !== 'main-ci-integrated-v1') {
      if (!producerRun || !Array.isArray(producerJobs) || producerRun.id == null || producerRun.run_attempt == null || !producerRun.path || producerRun.workflow_id == null || !producerRun.event || !producerRun.head_sha || !producerRun.head_branch || !producerRun.repository?.full_name || !producerRun.head_repository?.full_name || producerRun.status !== 'completed' || !producerRun.conclusion) throw new Error('UNVERIFIED:incomplete producer metadata');
      verifyRun(producerRun, { id: producerId, attempt: producerAttempt, source, path: '.github/workflows/pages-artifact-pilot.yml', event: 'workflow_dispatch', workflowId: 432187587 });
      producerJob = requireJob(producerJobs, 'prepare', PRODUCER_STEPS);
    }
    if (!artifact.workflow_run || artifact.workflow_run.id == null || !artifact.workflow_run.head_sha || !artifact.workflow_run.head_branch || artifact.workflow_run.repository_id == null || artifact.workflow_run.head_repository_id == null || artifact.id == null || !artifact.name || artifact.expired == null || !artifact.digest || artifact.size_in_bytes == null || !artifact.created_at || !artifact.expires_at) throw new Error('UNVERIFIED:incomplete artifact metadata');
    verifyArtifactMetadata(artifact, { artifactId, producerId, attempt: producerAttempt, source, now });
    return { state: 'ELIGIBLE_FOR_PREFLIGHT', policy, producerJob };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    // Missing/duplicate jobs and missing steps are ambiguous, not evidence of failure.
    const incomplete = reason.startsWith('UNVERIFIED:');
    return { state: incomplete ? 'UNVERIFIED' : 'INELIGIBLE', reason };
  }
}
