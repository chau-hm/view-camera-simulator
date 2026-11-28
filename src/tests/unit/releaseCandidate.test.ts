import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// @ts-expect-error JavaScript helper
import { INTEGRATED_PAGES_BLOB } from '../../../scripts/release-artifact-preflight.mjs';
// @ts-expect-error JavaScript helper
import { flattenPages, selectCandidate } from '../../../scripts/release-candidate.mjs';

const tip = 'a'.repeat(40), old = 'b'.repeat(40);
const run = (id: number, source: string, integrated = true, attempt = 1) => ({ id, head_sha: source, head_branch: 'main', path: integrated ? '.github/workflows/pages.yml' : '.github/workflows/pages-artifact-pilot.yml', event: integrated ? 'push' : 'workflow_dispatch', run_attempt: attempt, status: 'completed', conclusion: 'success' });
const artifact = (id: number, producer: number, attempt = 1) => ({ id, name: `pages-candidate-${producer}-${attempt}`, expired: false, expires_at: '2099-01-01T00:00:00Z', workflow_run: { id: producer } });
const fixture = () => ({ main: tip, history: [tip, old], runs: [run(10, old), run(11, tip)], artifacts: [artifact(100, 10), artifact(101, 11)] });
describe('release candidate discovery', () => {
  it('combines every API page and fails closed on missing pages', () => {
    const pages = [{ total_count: 2, artifacts: [{ id: 1 }] }, { total_count: 2, artifacts: [{ id: 2 }] }];
    expect(flattenPages(pages, 'artifacts')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(() => flattenPages(pages.slice(0, 1), 'artifacts')).toThrow('pagination-incomplete');
  });
  it('skips candidates whose mandatory job evidence is incomplete', () => {
    const f = fixture();
    const incomplete = { ...f.runs[1]!, discoveryEligible: false };
    expect(selectCandidate({ ...f, runs: [f.runs[0], incomplete] }).selectedSource).toBe(old);
  });
  it('uses main history rather than artifact or run completion order', () => {
    const f = fixture(); f.runs.push(run(99, old)); f.artifacts.push(artifact(999, 99));
    expect(selectCandidate(f)).toMatchObject({ selectedSource: tip, isMainTip: true, candidate: { artifactId: '101' } });
  });
  it('reports a missing or expired tip and selects an older source', () => {
    const f = fixture(); f.artifacts[1]!.expired = true;
    expect(selectCandidate(f)).toMatchObject({ selectedSource: old, isMainTip: false, newerIneligible: [{ source: tip }] });
  });
  it('does not substitute an explicitly selected source', () => {
    const f = fixture(); f.artifacts[1]!.expired = true;
    expect(() => selectCandidate({ ...f, source: tip })).toThrow('no-retained-candidate');
    expect(selectCandidate({ ...f, source: old }).selectedSource).toBe(old);
  });
  it('prefers a same-source integrated producer and newest attempt', () => {
    const f = fixture(); f.runs.push(run(90, tip, false), run(12, tip, true, 2)); f.artifacts.push(artifact(190, 90), artifact(102, 12, 2));
    expect(selectCandidate(f).candidate).toMatchObject({ ciId: '12', producerId: '12', producerAttempt: '2', artifactId: '102' });
  });
  it('excludes failed CI and unassociated artifact names', () => {
    const f = fixture(); f.runs[1]!.conclusion = 'failure';
    expect(selectCandidate(f).selectedSource).toBe(old);
  });
  it('rejects multiple artifacts for the same producing attempt', () => {
    const f = fixture(); f.artifacts.push(artifact(500, 11));
    expect(() => selectCandidate(f)).toThrow('ambiguous-retained-artifacts');
  });
  it('requires the expected authoritative history', () => {
    expect(() => selectCandidate({ ...fixture(), history: [old] })).toThrow();
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
