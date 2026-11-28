/* Capture real pointer-drag input, a viewport video with a diagnostic overlay,
 * and request/frame telemetry. Video sampling is not a complete trace of the
 * operating-system compositor; rAF reports are not presentation callbacks. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { summarizeFrameOrder } = require('./focus-scrub-analysis.cjs');

const out = path.resolve(process.argv[2] || '/private/tmp/room-focus-interactive');
const url = process.env.ROOM_OPTICS_URL || 'http://127.0.0.1:5214/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1';
const timeout = 240000;
const variant = process.env.SCRUB_VARIANT || 'neutral';
const gpuMode = process.env.SCRUB_GPU || 'swiftshader';
const quality = process.env.SCRUB_QUALITY || 'low';
const from = Number(process.env.SCRUB_FROM || 1200);
const to = Number(process.env.SCRUB_TO || 3000);
const count = Number(process.env.SCRUB_EVENT_COUNT || 8);
const slowMs = Number(process.env.SCRUB_SLOW_MS || 180);
if (!['neutral', 'shift-swing'].includes(variant)) throw Error('SCRUB_VARIANT must be neutral or shift-swing');
if (!['swiftshader', 'metal', 'default'].includes(gpuMode)) throw Error('SCRUB_GPU must be swiftshader, metal, or default');
if (!['low', 'standard', 'high'].includes(quality)) throw Error('SCRUB_QUALITY must be low, standard, or high');
if (![from, to].every(v => Number.isInteger(v) && v >= 100 && v <= 8000 && v % 10 === 0) || from >= to) throw Error('SCRUB_FROM and SCRUB_TO must be ordered reachable 10 mm steps from 100 to 8000');
if (!Number.isInteger(count) || count < 2 || count > 40 || !Number.isFinite(slowMs) || slowMs < 0 || slowMs > 1000) throw Error('Invalid SCRUB_EVENT_COUNT or SCRUB_SLOW_MS');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const snapshotSource = () => ({
    commit: git(['rev-parse', 'HEAD']),
    dirtySource: !!git(['status', '--porcelain']),
    trackedDiffSha256: hash(execFileSync('git', ['diff', '--binary', 'HEAD'])),
    captureHelperSha256: hash(fs.readFileSync(__filename)),
    orderHelperSha256: hash(fs.readFileSync(path.join(__dirname, 'focus-scrub-analysis.cjs'))),
  });
  const source = snapshotSource();
  const args = gpuMode === 'swiftshader'
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : gpuMode === 'metal' ? ['--use-gl=angle', '--use-angle=metal'] : [];
  const browser = await chromium.launch({ headless: process.env.SCRUB_HEADED !== '1', args });
  const context = await browser.newContext({ viewport: { width: 1200, height: 950 }, recordVideo: { dir: out, size: { width: 1200, height: 950 } } });
  const page = await context.newPage();
  const video = page.video();
  page.setDefaultTimeout(timeout);
  await page.addInitScript({ path: path.join(__dirname, 'capture-sync.cjs') });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  const canvas = page.locator('[data-rtt-resource-channel="default"] canvas');
  let manifest = { source, url, browser: browser.version(), gpuMode, variant, quality, requested: { from, to, count, slowMs }, status: 'incomplete' };
  let failure = null;
  async function wait(expected) {
    try {
      await page.waitForFunction(expected => {
        const r = window.__roomInspectCapture(window.__roomOptics, expected);
        return r.status === 'ready' || r.status === 'failed';
      }, expected, { timeout });
    } catch (error) {
      const details = await page.evaluate(expected => ({
        inspection: window.__roomInspectCapture?.(window.__roomOptics, expected),
        request: window.__roomOptics?.request, frame: window.__roomOptics?.frame,
      }), expected).catch(() => null);
      throw Error(`Timed out waiting for a request-matched completed frame: ${JSON.stringify(details)}; ${error.message}`);
    }
    const snapshot = await page.evaluate(expected => ({
      identity: window.__roomInspectCapture(window.__roomOptics, expected),
      state: window.__roomOptics, gi: window.__giReport, observedAtMs: performance.now(),
    }), expected);
    if (snapshot.identity.status !== 'ready') throw Error(`RTT failure: ${JSON.stringify(snapshot.identity)}`);
    return snapshot;
  }
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__roomOptics?.ready || window.__roomOptics?.error, null, { timeout });
    if (await page.evaluate(() => window.__roomOptics?.error)) throw Error('Room resource initialization failed');
    await page.getByLabel('Composition').selectOption('depth');
    await page.getByLabel('Color path').selectOption('hdr');
    await page.getByLabel('Reflections').check();
    await page.getByLabel('Display exposure').fill('18.1');
    await page.getByLabel('Aperture').selectOption('5.6');
    await page.getByLabel('Render quality').selectOption(quality);
    if (variant === 'shift-swing') {
      await page.getByLabel('Shift (mm)').fill('32');
      await page.getByLabel('Swing (degrees)').fill('-2.1');
    }
    await page.getByRole('button', { name: 'Unmount Observer' }).click();
    const focus = page.getByLabel('Focus (mm)');
    await focus.fill(String(from));
    const expected = { presetKey: 'depth', subjectMode: 'room', hdr: true, reflectionsEnabled: true,
      rawDebug: false, previewMode: 'upright', renderQuality: quality, displayExposure: 18.1,
      'camera.aperture': 5.6, 'camera.focusDistanceMm': from,
      'camera.frontShiftMm': variant === 'shift-swing' ? 32 : 0,
      'camera.frontSwingDeg': variant === 'shift-swing' ? -2.1 : 0 };
    const baseline = await wait(expected);
    if (baseline.gi?.expected !== 302 || baseline.gi?.matched !== 302 || baseline.gi?.missing?.length || baseline.gi?.mismatch?.length || baseline.gi?.stale?.length) throw Error(`GI mismatch: ${JSON.stringify(baseline.gi)}`);
    const gpu = await canvas.evaluate(el => {
      const gl = el.getContext('webgl2') || el.getContext('webgl');
      if (!gl) return null;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { version: gl.getParameter(gl.VERSION), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), width: el.width, height: el.height, cssWidth: el.clientWidth, cssHeight: el.clientHeight };
    });
    if (!gpu?.renderer) throw Error('Actual WebGL renderer could not be inspected');
    const software = /swiftshader|software/i.test(gpu.renderer);
    manifest = { ...manifest, gpu, software, baseline, status: 'running' };
    if (gpuMode === 'metal' && (software || !/metal/i.test(gpu.renderer))) throw Error(`Metal was requested but renderer is not verified as Metal hardware: ${gpu.renderer}`);
    await canvas.screenshot({ path: path.join(out, 'settled-start.png'), timeout });
    const afterStart = await wait(expected);
    if (afterStart.identity.requestId !== baseline.identity.requestId || afterStart.identity.generationId !== baseline.identity.generationId) throw Error('Settled start changed request or generation during screenshot');

    // Fixed overlay is non-interactive and does not resize either canvas. The
    // visible monotonic clock is recorded in each captured screencast image.
    await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Focus (mm)"]');
      if (!(input instanceof HTMLInputElement)) throw Error('Focus slider is missing');
      const overlay = document.createElement('pre');
      overlay.id = 'focus-scrub-video-telemetry';
      Object.assign(overlay.style, { position: 'fixed', top: '4px', right: '4px', zIndex: '2147483647', pointerEvents: 'none', margin: '0', padding: '5px 8px', background: 'rgba(0,0,0,.88)', color: '#fff', font: '12px/1.25 monospace', whiteSpace: 'pre', border: '1px solid #aaa' });
      document.body.append(overlay);
      const trace = window.__focusInteractiveTrace = { phase: 'settled', running: true, startTimeOriginMs: performance.timeOrigin, events: [], samples: [], phaseMarkers: [] };
      input.addEventListener('input', event => trace.events.push({ phase: trace.phase, atMs: performance.now(), value: Number(event.target.value), trusted: event.isTrusted }));
      let lastKey = '';
      const tick = () => {
        if (!trace.running) return;
        const s = window.__roomOptics, f = s?.frame;
        const now = performance.now();
        const key = `${trace.phase}/${s?.camera?.focusDistanceMm}/${s?.request?.requestId}/${f?.frameId}`;
        const frame = f && { status: f.status, frameId: f.frameId, request: f.request, generation: f.generation };
        overlay.textContent = `Focus scrub: ${trace.phase}\nt=${now.toFixed(1)} ms\ncommitted ${s?.camera?.focusDistanceMm ?? '?'} mm  ${s?.request?.requestId ?? '?'}\nframe ${f?.frameId ?? '?'}  ${f?.request?.requestId ?? '?'}\nframe status ${f?.status ?? '?'}`;
        if (s && key !== lastKey) {
          lastKey = key;
          trace.samples.push({ phase: trace.phase, time: now, committedFocusMm: s.camera?.focusDistanceMm,
            request: s.request, generation: s.generation, frame,
            inspection: window.__roomInspectCapture(s, {}) });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    async function phase(label, start, end, pacingMs) {
      // Waiting here establishes a settled starting frame. The optional delay
      // below paces pointer input only; it is never used as readiness evidence.
      await page.evaluate(() => { window.__focusInteractiveTrace.phase = 'settling'; });
      await focus.fill(String(start));
      await wait({ ...expected, 'camera.focusDistanceMm': start });
      const box = await focus.boundingBox();
      if (!box || box.width <= 16) throw Error('Focus slider has no usable visible bounds');
      await page.evaluate(label => {
        const trace = window.__focusInteractiveTrace;
        trace.phase = label;
        trace.phaseMarkers.push({ phase: label, atMs: performance.now(), type: 'start' });
      }, label);
      const x = value => box.x + 8 + (box.width - 16) * (value - 100) / (8000 - 100);
      const y = box.y + box.height / 2;
      await page.mouse.move(x(start), y);
      await page.mouse.down();
      for (let i = 1; i <= count; i++) {
        await page.mouse.move(x(start + (end - start) * i / count), y, { steps: 1 });
        if (pacingMs) await new Promise(resolve => setTimeout(resolve, pacingMs));
      }
      await page.mouse.up();
      const actual = Number(await focus.inputValue());
      const final = await wait({ ...expected, 'camera.focusDistanceMm': actual });
      await page.evaluate(({ label, actual }) => {
        const trace = window.__focusInteractiveTrace;
        trace.phaseMarkers.push({ phase: label, atMs: performance.now(), type: 'settled', actualFocusMm: actual });
      }, { label, actual });
      return { label, intendedStartMm: start, intendedEndMm: end, actualEndMm: actual,
        pacingMs, settled: final.identity, camera: final.state.camera, timestampMs: final.observedAtMs };
    }
    const phases = [];
    phases.push(await phase('rapid-forward', from, to, 0));
    phases.push(await phase('rapid-reverse', to, from, 0));
    phases.push(await phase('slow-forward', from, to, slowMs));
    phases.push(await phase('slow-reverse', to, from, slowMs));
    const trace = await page.evaluate(() => { window.__focusInteractiveTrace.running = false; return window.__focusInteractiveTrace; });
    const dragEvents = trace.events.filter(event => phases.some(phase => phase.label === event.phase));
    if (dragEvents.some(event => !event.trusted) || phases.some(phase => dragEvents.filter(event => event.phase === phase.label && event.trusted).length < 2))
      throw Error('Each rapid and slow phase requires at least two trusted pointer-generated focus input events');
    const order = summarizeFrameOrder(trace.samples);
    const finalSource = snapshotSource();
    if (finalSource.commit !== source.commit || finalSource.trackedDiffSha256 !== source.trackedDiffSha256 ||
        finalSource.captureHelperSha256 !== source.captureHelperSha256 || finalSource.orderHelperSha256 !== source.orderHelperSha256)
      throw Error('Source or capture helper changed during the run; reject this video and telemetry');
    manifest = { ...manifest, status: 'completed', phases, trace, order, errors,
      finalSource,
      criteria: { completionOrder: 'No decreasing completed request sequence within the same renderer generation; unknown IDs are unclassified.',
        warning: 'Completion telemetry is sampled by requestAnimationFrame and is not compositor-presented-frame evidence. Video is a sampled screencast, not a complete display trace. Input pacing is not readiness evidence.' },
      screenshots: ['settled-start.png'], video: 'focus-scrub.webm' };
    if (errors.length) throw Error(`Browser errors: ${JSON.stringify(errors)}`);
  } catch (error) {
    failure = error;
    const partialTrace = await page.evaluate(() => {
      if (!window.__focusInteractiveTrace) return null;
      window.__focusInteractiveTrace.running = false;
      return window.__focusInteractiveTrace;
    }).catch(() => null);
    manifest = { ...manifest, status: 'failed', error: String(error?.stack || error), errors,
      ...(partialTrace ? { trace: partialTrace, order: summarizeFrameOrder(partialTrace.samples) } : {}) };
  } finally {
    await context.close();
    if (video) {
      const original = await video.path().catch(() => null);
      if (original && fs.existsSync(original)) fs.renameSync(original, path.join(out, 'focus-scrub.webm'));
    }
    await browser.close();
    fs.writeFileSync(path.join(out, 'interactive-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ status: manifest.status, gpu: manifest.gpu, phases: manifest.phases?.map(p => ({label:p.label, actualEndMm:p.actualEndMm, frameId:p.settled.frameId})), inputEvents: manifest.trace?.events.length, sampledFrames: manifest.order?.completions.length, orderRegressions: manifest.order?.regressions.length, video: manifest.video }));
})().catch(error => { console.error(error); process.exitCode = 1; });
