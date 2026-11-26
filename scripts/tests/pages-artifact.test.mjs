import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentDigest, inventory, verify } from '../pages-artifact.mjs';

test('content and source verification rejects corruption, extra entries and unsafe types', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-artifact-'));
  try {
    writeFileSync(join(dir, 'index.html'), 'hello');
    writeFileSync(join(dir, '404.html'), 'hello');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'bundle');
    const files = inventory(dir);
    const manifest = { schemaVersion: 1, repository: 'chau-hm/view-camera-simulator', sourceCommit: 'a'.repeat(40), sourceTree: 'b'.repeat(40), buildConfiguration: 'vite-pages-v1', basePath: '/view-camera-simulator/', mode: 'production', nodeVersion: 'v24.3.0', packageLockSha256: 'c'.repeat(64), buildCommand: 'npm run build -- --base=<basePath>', files, contentDigest: contentDigest(files) };
    assert.equal(verify(dir, manifest, { sourceCommit: 'a'.repeat(40) }).fileCount, 3);
    assert.throws(() => verify(dir, manifest, { sourceCommit: 'd'.repeat(40) }), /identity mismatch/);
    assert.throws(() => verify(dir, { ...manifest, schemaVersion: 2 }), /Invalid/);
    assert.throws(() => verify(dir, { ...manifest, contentDigest: '0'.repeat(64) }), /mismatch/);
    assert.throws(() => verify(dir, { ...manifest, files: files.map((f, i) => i ? f : { ...f, size: f.size + 1 }) }), /mismatch/);
    assert.throws(() => verify(dir, { ...manifest, files: files.map((f, i) => i ? f : { ...f, sha256: '0'.repeat(64) }) }), /mismatch/);
    writeFileSync(join(dir, 'assets', 'app.js'), 'changed');
    assert.throws(() => verify(dir, manifest), /mismatch/);
    writeFileSync(join(dir, 'assets', 'app.js'), 'bundle');
    unlinkSync(join(dir, '404.html'));
    assert.throws(() => verify(dir, manifest), /mismatch/);
    writeFileSync(join(dir, '404.html'), 'hello');
    writeFileSync(join(dir, 'unexpected'), 'x');
    assert.throws(() => verify(dir, manifest), /mismatch/);
    unlinkSync(join(dir, 'unexpected'));
    symlinkSync('index.html', join(dir, 'link'));
    assert.throws(() => verify(dir, manifest), /Unsupported/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pilot is manual and has no publication authority', async () => {
  const { readFileSync } = await import('node:fs');
  const yaml = readFileSync('.github/workflows/pages-artifact-pilot.yml', 'utf8');
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /contents: read/);
  assert.doesNotMatch(yaml, /pages:\s*write|id-token:\s*write|deploy-pages|github-pages|git push/);
  assert.ok(yaml.indexOf('pages-artifact.mjs prepare') < yaml.indexOf('playwright.pages-artifact.config.ts'));
  assert.ok(yaml.indexOf('playwright.pages-artifact.config.ts') < yaml.indexOf('pages-artifact.mjs verify'));
  assert.ok(yaml.indexOf('pages-artifact.mjs verify') < yaml.indexOf('actions\/upload-artifact'));
});
