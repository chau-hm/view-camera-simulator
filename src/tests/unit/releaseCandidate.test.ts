import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
// @ts-expect-error JavaScript helper
import { INTEGRATED_PAGES_BLOB, INTEGRATED_SOURCE_BLOBS, PRODUCER_STEPS } from '../../../scripts/release-artifact-preflight.mjs';
// @ts-expect-error JavaScript helper
import { flattenPages, selectCandidate } from '../../../scripts/release-candidate.mjs';

const tip = 'a'.repeat(40), old = 'b'.repeat(40);
const run = (id: number, source: string, integrated = true, attempt = 1) => ({ id, head_sha: source, head_branch: 'main', path: integrated ? '.github/workflows/pages.yml' : '.github/workflows/pages-artifact-pilot.yml', event: integrated ? 'push' : 'workflow_dispatch', run_attempt: attempt, status: 'completed', conclusion: 'success' });
const artifact = (id: number, producer: number, attempt = 1) => ({ id, name: `pages-candidate-${producer}-${attempt}`, expired: false, expires_at: '2099-01-01T00:00:00Z', workflow_run: { id: producer } });
const fixture = () => ({ main: tip, history: [tip, old], runs: [run(10, old), run(11, tip)], artifacts: [artifact(100, 10), artifact(101, 11)] });
const select = (input: object) => selectCandidate({ ...input, blobsBySource: {}, assess: ({ ciRun, producerRun, artifact }: { ciRun: { id: number; run_attempt: number; conclusion: string; discoveryEligible?: boolean }; producerRun: { id: number; path: string; run_attempt: number; conclusion: string }; artifact: { name: string; expired: boolean } }) => ciRun.discoveryEligible === false ? { state: 'UNVERIFIED', reason: 'incomplete' } : ciRun.conclusion !== 'success' || producerRun.conclusion !== 'success' || artifact.expired || artifact.name !== `pages-candidate-${producerRun.id}-${producerRun.run_attempt}` || (producerRun.path === '.github/workflows/pages.yml' && (ciRun.id !== producerRun.id || ciRun.run_attempt !== producerRun.run_attempt)) ? { state: 'INELIGIBLE' } : { state: 'ELIGIBLE_FOR_PREFLIGHT', policy: 'fixture' } });
describe('release candidate discovery', () => {
  it('rejects a different working directory before discovery or qualification', () => {
    for (const script of ['scripts/release-candidate.mjs', 'scripts/release-artifact-preflight.mjs', 'scripts/release-artifact-qualify.mjs']) {
      const result = spawnSync(process.execPath, [resolve(script), 'list'], { cwd: tmpdir(), encoding: 'utf8' });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('qualification-must-run-from-repository-root');
    }
  });
  it('checks canonical tooling before loading preflight', () => {
    const source = readFileSync('scripts/release-candidate.mjs', 'utf8');
    expect(source).not.toMatch(/^import .*from ['"]\.\/release-artifact-preflight/m);
    expect(source.indexOf('await gate()')).toBeLessThan(source.indexOf("await import('./release-artifact-preflight.mjs')"));
  });
  it('combines every API page and fails closed on missing pages', () => {
    const pages = [{ total_count: 2, artifacts: [{ id: 1 }] }, { total_count: 2, artifacts: [{ id: 2 }] }];
    expect(flattenPages(pages, 'artifacts')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(() => flattenPages(pages.slice(0, 1), 'artifacts')).toThrow('pagination-incomplete');
  });
  it('does not downgrade when mandatory job evidence is incomplete', () => {
    const f = fixture();
    const incomplete = { ...f.runs[1]!, discoveryEligible: false };
    expect(() => select({ ...f, runs: [f.runs[0], incomplete] })).toThrow('candidate-evidence-unverified');
  });
  it('uses main history rather than artifact or run completion order', () => {
    const f = fixture(); f.runs.push(run(99, old)); f.artifacts.push(artifact(999, 99));
    expect(select(f)).toMatchObject({ selectedSource: tip, isMainTip: true, candidate: { artifactId: '101' } });
  });
  it('reports a missing or expired tip and selects an older source', () => {
    const f = fixture(); f.artifacts[1]!.expired = true;
    expect(select(f)).toMatchObject({ selectedSource: old, isMainTip: false, newerIneligible: [{ source: tip }] });
  });
  it('does not substitute an explicitly selected source', () => {
    const f = fixture(); f.artifacts[1]!.expired = true;
    expect(() => select({ ...f, source: tip })).toThrow('no-retained-candidate');
    expect(select({ ...f, source: old }).selectedSource).toBe(old);
  });
  it('prefers a same-source integrated producer and newest attempt', () => {
    const f = fixture(); f.runs.push(run(90, tip, false), run(12, tip, true, 2)); f.artifacts.push(artifact(190, 90), artifact(102, 12, 2));
    expect(select(f).candidate).toMatchObject({ ciId: '12', producerId: '12', producerAttempt: '2', artifactId: '102' });
  });
  it('excludes failed CI and unassociated artifact names', () => {
    const f = fixture(); f.runs[1]!.conclusion = 'failure';
    expect(select(f).selectedSource).toBe(old);
  });
  it('rejects multiple artifacts for the same producing attempt', () => {
    const f = fixture(); f.artifacts.push(artifact(500, 11));
    expect(() => select(f)).toThrow('ambiguous-retained-artifacts');
  });
  it('requires the expected authoritative history', () => {
    expect(() => select({ ...fixture(), history: [old] })).toThrow();
  });
  it('pins the source build and Preview contract to the reviewed files', () => {
    for (const [path, expected] of Object.entries(INTEGRATED_SOURCE_BLOBS)) {
      const bytes = readFileSync(path);
      expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(expected);
    }
  });
  it('gates all producer steps on canonical actual main pushes', () => {
    const yaml = readFileSync('.github/workflows/pages.yml', 'utf8');
    const bytes = Buffer.from(yaml);
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    expect(blob).toBe(INTEGRATED_PAGES_BLOB);
    const producer = yaml.slice(yaml.indexOf('      - name: Build and identify candidate'), yaml.indexOf('\n  deploy:'));
    expect(producer.match(/github\.event_name == 'push'/g)).toHaveLength(7);
    expect(producer.match(/github\.ref == 'refs\/heads\/main'/g)).toHaveLength(7);
    expect(producer).toContain('prepare-after-typecheck');
    expect(producer).toContain('include-hidden-files: true');
    expect(producer).toContain('actions/download-artifact@v4');
    expect(producer).not.toMatch(/deploy-pages|pages:\s*write|id-token:\s*write|continue-on-error/);
    expect(yaml).toContain("if: github.event_name == 'push' && github.ref == 'refs/heads/production'");
  });
});

// The fixture uses real manifest, payload, archive and preflight validation.
// @ts-expect-error JavaScript fixture
import { fixture as preflightFixture } from './helpers/releasePreflightFixture.mjs';
// @ts-expect-error JavaScript helper
import { assessCandidateMetadata } from '../../../scripts/release-candidate-eligibility.mjs';
// @ts-expect-error JavaScript helper
import { runPreflight } from '../../../scripts/release-artifact-preflight.mjs';
// @ts-expect-error JavaScript helper
import { main as candidateMain } from '../../../scripts/release-candidate.mjs';

function metadataFixture() {
  const f = preflightFixture();
  const metadata = { source: f.source, ciId: '123', ciAttempt: '2', producerId: '456', producerAttempt: '1', artifactId: '789', blobs: f.blobs, ciRun: f.ciRun, ciJobs: f.ciJobs, producerRun: f.producerRun, producerJobs: f.producerJobs, artifact: f.artifact };
  return { f, metadata };
}

describe('shared eligibility and actual selector orchestration', () => {
  it('accepts real historical metadata and full preflight through the same verifier', () => {
    const { f, metadata } = metadataFixture();
    try {
      expect(assessCandidateMetadata(metadata)).toMatchObject({ state: 'ELIGIBLE_FOR_PREFLIGHT', policy: 'historical-two-run-v1' });
      expect(runPreflight(f.args, { runCommand: f.command, tempRoot: f.root })).toMatchObject({ status: 'RELEASE_PREFLIGHT_VERIFIED', policy: 'historical-two-run-v1' });
    } finally { f.cleanup(); }
  });
  it('does not downgrade when actual metadata lacks mandatory evidence', () => {
    const { f, metadata } = metadataFixture();
    try {
      const ci = { ...f.ciRun, jobs: f.ciJobs };
      const producer = { ...f.producerRun, jobs: f.producerJobs };
      f.producerJobs[0].steps.pop();
      expect(() => selectCandidate({ main: f.main, history: [f.main, f.source], source: f.source, runs: [ci, producer], artifacts: [f.artifact], blobsBySource: { [f.source]: metadata.blobs }, assess: assessCandidateMetadata })).toThrow('candidate-evidence-unverified');
    } finally { f.cleanup(); }
  });
  it('accepts same-run integrated metadata and rejects an altered source build profile', () => {
    const { f, metadata } = metadataFixture();
    try {
      f.blobs['.github/workflows/pages.yml'] = INTEGRATED_PAGES_BLOB;
      Object.assign(f.blobs, INTEGRATED_SOURCE_BLOBS);
      f.ciJobs[2].steps.push(...PRODUCER_STEPS.filter((name: string) => name !== 'Test artifact and workflow contracts').map((name: string) => ({ name, status: 'completed', conclusion: 'success' })));
      f.artifact.name = 'pages-candidate-123-2'; f.artifact.workflow_run.id = 123;
      metadata.producerId = '123'; metadata.producerAttempt = '2'; metadata.producerRun = f.ciRun; metadata.producerJobs = f.ciJobs;
      expect(assessCandidateMetadata(metadata)).toMatchObject({ state: 'ELIGIBLE_FOR_PREFLIGHT', policy: 'main-ci-integrated-v1' });
      f.blobs['vite.config.ts'] = 'f'.repeat(40);
      expect(assessCandidateMetadata(metadata).state).toBe('INELIGIBLE');
    } finally { f.cleanup(); }
  });
  it.each([
    ['qualification workflow', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.blobs['.github/workflows/historical-qualification.yml'] = 'f'.repeat(40); }, 'INELIGIBLE'],
    ['pilot workflow blob', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.blobs['.github/workflows/pages-artifact-pilot.yml'] = 'f'.repeat(40); }, 'INELIGIBLE'],
    ['invalid size', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.artifact.size_in_bytes = 0; }, 'INELIGIBLE'],
    ['pilot workflow', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.producerRun.workflow_id = 42; }, 'INELIGIBLE'],
    ['artifact source', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.artifact.workflow_run.head_sha = 'f'.repeat(40); }, 'INELIGIBLE'],
    ['artifact repository', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.artifact.workflow_run.repository_id = 1; }, 'INELIGIBLE'],
    ['invalid digest', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.artifact.digest = 'bad'; }, 'INELIGIBLE'],
    ['expired', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.artifact.expired = true; }, 'INELIGIBLE'],
    ['failed attempt', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.ciRun.conclusion = 'failure'; }, 'INELIGIBLE'],
    ['failed retention', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.producerJobs[0].steps.at(-1).conclusion = 'failure'; }, 'INELIGIBLE'],
    ['malformed job record', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.ciJobs.push(null); }, 'UNVERIFIED'],
    ['missing retention', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.producerJobs[0].steps.pop(); }, 'UNVERIFIED'],
    ['duplicate job', (m: ReturnType<typeof metadataFixture>["metadata"]) => { m.ciJobs.push(m.ciJobs[2]); }, 'UNVERIFIED'],
    ['missing artifact identity', (m: ReturnType<typeof metadataFixture>["metadata"]) => { delete m.artifact.workflow_run.repository_id; }, 'UNVERIFIED'],
  ])('classifies %s consistently with preflight', (_name, mutate, expectedState) => {
    const { f, metadata } = metadataFixture();
    try {
      (mutate as (value: typeof metadata) => void)(metadata);
      expect(assessCandidateMetadata(metadata).state).toBe(expectedState);
      expect(() => runPreflight(f.args, { runCommand: f.command, tempRoot: f.root })).toThrow(new RegExp(`${expectedState}`));
    } finally { f.cleanup(); }
  });
  function orchestrationFixture() {
    const { f } = metadataFixture();
    f.main = f.localMain = f.finalMain = f.source;
    let preflights = 0;
    const git = (...args: string[]) => args[0] === 'rev-list' ? f.source : String(f.command('git', args, {})).trim();
    const gh = (...args: string[]) => {
      if (args[1]?.includes('/123/attempts/1/jobs')) return JSON.stringify({ total_count: f.ciJobs.length, jobs: f.ciJobs.map((j: { run_attempt: number }) => ({ ...j, run_attempt: 1 })) });
      if (args[1]?.endsWith('/123/attempts/1')) return JSON.stringify({ ...f.ciRun, run_attempt: 1, conclusion: 'failure' });
      return f.command('gh', args, {}).toString();
    };
    const opts = {
      git, gh, gate: async () => {},
      pages: (path: string) => path.startsWith('actions/runs') ? [f.ciRun, f.producerRun] : [f.artifact],
      preflightModule: { runPreflight: (args: string[]) => { preflights++; return runPreflight(args, { runCommand: f.command, tempRoot: f.root }); } },
      qualify: async (args: string[], { preflight }: { preflight: (a: string[]) => unknown }) => ({ candidate: preflight(args), status: 'fixture-qualified' }),
    };
    return { f, opts, preflights: () => preflights };
  }
  it('resolves an exact candidate through real metadata and real preflight without a build or push', async () => {
    const { f, opts, preflights } = orchestrationFixture();
    try {
      const result = await candidateMain(['qualify', '--source', f.source], opts);
      expect(result.selection).toMatchObject({ state: 'ELIGIBLE_FOR_PREFLIGHT', selectedSource: f.source, candidate: { artifactId: '789' } });
      expect(result.result.candidate.status).toBe('RELEASE_PREFLIGHT_VERIFIED');
      expect(preflights()).toBe(1);
      expect(f.calls.some((call: string[]) => call.includes('push') || call.includes('build'))).toBe(false);
    } finally { f.cleanup(); }
  });
  it.each(['gate', 'preflight', 'qualification', 'api', 'git', 'main-moved'])('stops on %s without falling back', async (mode) => {
    const { f, opts, preflights } = orchestrationFixture();
    try {
      if (mode === 'gate') opts.gate = async () => { throw new Error('canonical tooling failure'); };
      if (mode === 'preflight') f.log = 'missing original pin';
      if (mode === 'qualification') opts.qualify = async (args: string[], { preflight }: { preflight: (a: string[]) => unknown }) => { preflight(args); throw new Error('qualification failed'); };
      if (mode === 'api') opts.gh = () => { throw new Error('API unavailable'); };
      if (mode === 'git') { const original = opts.git; opts.git = (...args: string[]) => { if (args.at(-1)?.includes('pages.yml')) throw new Error('git unavailable'); return original(...args); }; }
      if (mode === 'main-moved') f.finalMain = 'b'.repeat(40);
      await expect(candidateMain(['qualify', '--latest'], opts)).rejects.toThrow();
      expect(preflights()).toBe(mode === 'preflight' || mode === 'qualification' || mode === 'main-moved' ? 1 : 0);
    } finally { f.cleanup(); }
  });
});
