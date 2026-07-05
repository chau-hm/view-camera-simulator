import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const SCENES = [architectureRiseScene, tableTiltScene, shelfSwingScene, focusFundamentalsTwoTargets];
const VIEWS: Array<'side' | 'top'> = ['side', 'top'];

describe('GeometryViewport matrix', () => {
  afterEach(() => { cleanup(); });

  for (const scene of SCENES) {
    for (const view of VIEWS) {
      it(`${scene.id} renders (${view}) primitives, depth strip, and minimal annotations`, () => {
        const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
        const { container } = render(<GeometryViewport opticsState={optics} geometryView={view} scene={scene} />);

        const svg = container.querySelector(`[data-testid="geometry-svg-${view}"]`) as SVGElement | null;
        expect(svg).toBeTruthy();

        // Optical depth strip present
        const depthStrip = container.querySelector('[aria-label="Optical depth order"]');
        expect(depthStrip).toBeTruthy();

        // Exactly one Optical axis label
        const axisCount = Array.from(container.querySelectorAll('text')).filter((t) => t.textContent?.trim() === 'Optical axis').length;
        expect(axisCount).toBe(1);

        // DiagramLegend absent (should not include 'Film datum')
        const legend = Array.from(container.querySelectorAll('div')).find((d) => d.textContent?.includes('Film datum'));
        expect(legend).toBeUndefined();

        // No white annotation-card rects inside SVG (legacy cards used fill="#ffffff")
        expect(svg!.querySelector('rect[fill="#ffffff"]')).toBeNull();

        // No leader-line polylines inside SVG
        expect(svg!.querySelectorAll('polyline').length).toBe(0);

        // All line coordinates finite
        const lines = Array.from(svg!.querySelectorAll('line')) as SVGLineElement[];
        for (const ln of lines) {
          const x1 = parseFloat(ln.getAttribute('x1') || 'NaN');
          const y1 = parseFloat(ln.getAttribute('y1') || 'NaN');
          const x2 = parseFloat(ln.getAttribute('x2') || 'NaN');
          const y2 = parseFloat(ln.getAttribute('y2') || 'NaN');
          expect(Number.isFinite(x1)).toBe(true);
          expect(Number.isFinite(y1)).toBe(true);
          expect(Number.isFinite(x2)).toBe(true);
          expect(Number.isFinite(y2)).toBe(true);
        }

        // FOV rays present (amber lines)
        const fovLines = Array.from(svg!.querySelectorAll('line')).filter((l) => l.getAttribute('stroke') === '#f59e0b');
        expect(fovLines.length).toBeGreaterThanOrEqual(1);

        // Camera glyphs (rear and front standards) present as dark rects
        const rearRect = Array.from(svg!.querySelectorAll('rect')).find((r) => r.getAttribute('fill') === '#1f2937');
        const frontRect = Array.from(svg!.querySelectorAll('rect')).find((r) => r.getAttribute('fill') === '#475569');
        expect(rearRect).toBeTruthy();
        expect(frontRect).toBeTruthy();

        // Target glyphs render if scene has targets
        if (scene.focusTargets && scene.focusTargets.length > 0) {
          const targetRects = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === '#0f766e');
          expect(targetRects.length).toBeGreaterThanOrEqual(1);
        }
      });

      it(`${scene.id} stability: target Xs stable under focus change (${view})`, () => {
        const state1 = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, focusDistanceMm: 1000 }, scene);
        const { container, rerender } = render(<GeometryViewport opticsState={state1} geometryView={view} scene={scene} />);
        const svg = container.querySelector(`[data-testid="geometry-svg-${view}"]`) as SVGElement | null;
        expect(svg).toBeTruthy();
        const targetRects1 = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === '#0f766e');
        if (targetRects1.length === 0) return; // nothing to compare
        const centres1 = targetRects1.map((r) => parseFloat(r.getAttribute('x') || '0'));

        const state2 = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, focusDistanceMm: 3000 }, scene);
        rerender(<GeometryViewport opticsState={state2} geometryView={view} scene={scene} />);
        const targetRects2 = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === '#0f766e');
        const centres2 = targetRects2.map((r) => parseFloat(r.getAttribute('x') || '0'));

        expect(centres1.length).toBe(centres2.length);
        for (let i = 0; i < centres1.length; i++) {
          expect(Math.abs(centres1[i] - centres2[i])).toBeLessThan(1);
        }
      });
    }
  }

  it('Focus Fundamentals: depth strip infinity chips appear once when diagnostics.isInfinityFocus', () => {
    const scene = focusFundamentalsTwoTargets;
    const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
    const origDiag = (optics as unknown as { diagnostics?: Record<string, unknown> }).diagnostics ?? {};
    const opticsInf = { ...(optics as unknown as Record<string, unknown>), diagnostics: { ...(origDiag as Record<string, unknown>), isInfinityFocus: true } } as unknown as typeof optics;
    const { container } = render(<GeometryViewport opticsState={opticsInf} geometryView="side" scene={scene} />);
    const depthStrip = container.querySelector('[aria-label="Optical depth order"]');
    expect(depthStrip).toBeTruthy();
    const txt = depthStrip?.textContent || '';
    // Focus ∞ once
    const focusMatches = (txt.match(/Focus\s*∞/g) || []);
    expect(focusMatches.length).toBe(1);
    // Far DOF ∞ once (if present)
    const farMatches = (txt.match(/Far DOF\s*∞/g) || []);
    expect(farMatches.length).toBe(1);

    // Focus Fundamentals should not show hinge marker
    const hinge = container.querySelector('circle[fill="#7c3aed"]');
    expect(hinge).toBeNull();
  });
});
