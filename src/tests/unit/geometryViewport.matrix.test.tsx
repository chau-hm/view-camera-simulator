import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";

const SCENES = [architectureRiseScene, tableTiltScene, shelfSwingScene, focusFundamentalsTwoTargets];
const VIEWS: Array<'side' | 'top'> = ['side', 'top'];

describe('GeometryViewport matrix', () => {
  afterEach(() => { cleanup(); });

  for (const scene of SCENES) {
    for (const view of VIEWS) {
      // movement semantics: table-tilt should affect Side more than Top
      if (scene.id === 'table-tilt' && view === 'side') {
        it(`${scene.id} movement: tilt affects Side geometry`, () => {
          const base = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
          const tilted = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, frontTiltDeg: 5 }, scene);
          const { container: c1 } = render(<GeometryViewport opticsState={base} geometryView={view} scene={scene} riseMm={0} />);
          const { container: c2 } = render(<GeometryViewport opticsState={tilted} geometryView={view} scene={scene} riseMm={0} />);
          const l1 = c1.querySelector('line[data-testid="plane-line-focus"]');
          const l2 = c2.querySelector('line[data-testid="plane-line-focus"]');
          if (!l1 || !l2) return; // no focus segment to compare
          const x11 = parseFloat(l1.getAttribute('x1') || '0');
          const y11 = parseFloat(l1.getAttribute('y1') || '0');
          const x12 = parseFloat(l1.getAttribute('x2') || '0');
          const y12 = parseFloat(l1.getAttribute('y2') || '0');
          const x21 = parseFloat(l2.getAttribute('x1') || '0');
          const y21 = parseFloat(l2.getAttribute('y1') || '0');
          const x22 = parseFloat(l2.getAttribute('x2') || '0');
          const y22 = parseFloat(l2.getAttribute('y2') || '0');
          const slope1 = (y12 - y11) / (x12 - x11 || 1);
          const slope2 = (y22 - y21) / (x22 - x21 || 1);
          expect(Math.abs(slope1 - slope2)).toBeGreaterThan(0.001);
        });
      }

      if (scene.id === 'shelf-swing' && view === 'top') {
        it(`${scene.id} movement: swing affects Top geometry`, () => {
          const base = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
          const swung = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, frontSwingDeg: 5 }, scene);
          const { container: c1 } = render(<GeometryViewport opticsState={base} geometryView={view} scene={scene} riseMm={0} />);
          const { container: c2 } = render(<GeometryViewport opticsState={swung} geometryView={view} scene={scene} riseMm={0} />);
          const l1 = c1.querySelector('line[data-testid="plane-line-focus"]');
          const l2 = c2.querySelector('line[data-testid="plane-line-focus"]');
          if (!l1 || !l2) return;
          const x11 = parseFloat(l1.getAttribute('x1') || '0');
          const y11 = parseFloat(l1.getAttribute('y1') || '0');
          const x12 = parseFloat(l1.getAttribute('x2') || '0');
          const y12 = parseFloat(l1.getAttribute('y2') || '0');
          const x21 = parseFloat(l2.getAttribute('x1') || '0');
          const y21 = parseFloat(l2.getAttribute('y1') || '0');
          const x22 = parseFloat(l2.getAttribute('x2') || '0');
          const y22 = parseFloat(l2.getAttribute('y2') || '0');
          const slope1 = (y12 - y11) / (x12 - x11 || 1);
          const slope2 = (y22 - y21) / (x22 - x21 || 1);
          expect(Math.abs(slope1 - slope2)).toBeGreaterThan(0.001);
        });
      }
      it(`${scene.id} renders (${view}) primitives, depth strip, and minimal annotations`, () => {
        const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
        const { container } = render(<GeometryViewport opticsState={optics} geometryView={view} scene={scene} riseMm={0} />);

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

        // camera glyphs: ensure vertical plates (height > width)
        const rearRect = Array.from(svg!.querySelectorAll('rect')).find((r) => r.getAttribute('fill') === '#1f2937');
        const frontRect = Array.from(svg!.querySelectorAll('rect')).find((r) => r.getAttribute('fill') === '#475569');
        expect(rearRect).toBeTruthy();
        expect(frontRect).toBeTruthy();
        if (rearRect) {
          const w = parseFloat(rearRect.getAttribute('width') || '0');
          const h = parseFloat(rearRect.getAttribute('height') || '0');
          expect(h).toBeGreaterThan(w);
        }
        if (frontRect) {
          const w = parseFloat(frontRect.getAttribute('width') || '0');
          const h = parseFloat(frontRect.getAttribute('height') || '0');
          expect(h).toBeGreaterThan(w);
        }

        // Target glyphs render if scene has targets and are vertical plates
        if (scene.focusTargets && scene.focusTargets.length > 0) {
          const targetRects = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === '#0f766e');
          expect(targetRects.length).toBeGreaterThanOrEqual(1);
          for (const tr of targetRects) {
            const w = parseFloat(tr.getAttribute('width') || '0');
            const h = parseFloat(tr.getAttribute('height') || '0');
            expect(h).toBeGreaterThanOrEqual(w);
          }
        }
      });

      it(`${scene.id} stability: target Xs stable under focus change (${view})`, () => {
        const state1 = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, focusDistanceMm: 1000 }, scene);
        const { container, rerender } = render(<GeometryViewport opticsState={state1} geometryView={view} scene={scene} riseMm={0} />);
        const svg = container.querySelector(`[data-testid="geometry-svg-${view}"]`) as SVGElement | null;
        expect(svg).toBeTruthy();
        const targetRects1 = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === '#0f766e');
        if (targetRects1.length === 0) return; // nothing to compare
        const centres1 = targetRects1.map((r) => parseFloat(r.getAttribute('x') || '0'));

        const state2 = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, focusDistanceMm: 3000 }, scene);
        rerender(<GeometryViewport opticsState={state2} geometryView={view} scene={scene} riseMm={0} />);
        const targetRects2 = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === '#0f766e');
        const centres2 = targetRects2.map((r) => parseFloat(r.getAttribute('x') || '0'));

        expect(centres1.length).toBe(centres2.length);
        for (let i = 0; i < centres1.length; i++) {
          expect(Math.abs(centres1[i] - centres2[i])).toBeLessThan(1);
        }
      });
    }
  }

  it("Table Tilt calibrated side view uses canonical probes and a horizontal focus plane", () => {
    const optics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        activeSceneId: tableTiltScene.id,
        frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
        focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
      },
      tableTiltScene,
    );
    const { container } = render(
      <GeometryViewport
        opticsState={optics}
        geometryView="side"
        scene={tableTiltScene}
        riseMm={0}
      />,
    );
    const focusLine = container.querySelector(
      'line[data-testid="plane-line-focus"]',
    ) as SVGLineElement | null;
    expect(focusLine).not.toBeNull();
    expect(Number(focusLine?.getAttribute("y1"))).toBeCloseTo(
      Number(focusLine?.getAttribute("y2")),
      5,
    );
    const labels = Array.from(container.querySelectorAll("text")).map((node) => node.textContent);
    ["Near stripe", "Middle lines", "Far chart", "Tabletop", "Focus plane"].forEach((label) =>
      expect(labels).toContain(label),
    );

    const targetXs = ["near-cup", "mid-notebook", "far-book"].map((id) => {
      const target = container.querySelector(`[data-testid="geometry-target-${id}"] rect`);
      expect(target).not.toBeNull();
      return Number(target?.getAttribute("x"));
    });
    expect(targetXs[1] - targetXs[0]).toBeGreaterThan(15);
    expect(targetXs[2] - targetXs[1]).toBeGreaterThan(15);
    expect(container.querySelector('[data-testid="tabletop-guide"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dof-region"]')).toHaveAttribute("opacity", "0.08");
  });

  it('Focus Fundamentals: depth strip shows Focus ∞ and Far DOF ∞ for real infinity focus mode', () => {
    const scene = focusFundamentalsTwoTargets;
    const infinityState = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, focusMode: 'infinity' }, scene);
    // physical state assertions
    expect(infinityState.focusPlane).toBeNull();
    expect(infinityState.depthOfFieldFarPlane).toBeNull();

    const { container } = render(<GeometryViewport opticsState={infinityState} geometryView="side" scene={scene} riseMm={0} />);
    const depthStrip = container.querySelector('[aria-label="Optical depth order"]');
    expect(depthStrip).toBeTruthy();
    const txt = depthStrip?.textContent || '';

    // Focus ∞ once
    const focusMatches = (txt.match(/Focus\s*∞/g) || []);
    expect(focusMatches.length).toBe(1);
    // Far DOF ∞ once
    const farMatches = (txt.match(/Far DOF\s*∞/g) || []);
    expect(farMatches.length).toBe(1);

    // No finite Focus or Far DOF chip should exist
    const finiteFocus = (txt.match(/Focus\s*\d+/g) || []);
    expect(finiteFocus.length).toBe(0);
    const finiteFar = (txt.match(/Far DOF\s*\d+/g) || []);
    expect(finiteFar.length).toBe(0);

    // Focus Fundamentals should not show hinge marker
    const hinge = container.querySelector('circle[fill="#7c3aed"]');
    expect(hinge).toBeNull();

    // Ensure no green finite focus-point marker exists in the SVG (finite focus would render a numeric chip only)
    // We assert that the depth strip does not include any numeric focus label as above; additionally ensure no focus circle with green fill exists
    const greenFocus = container.querySelector('circle[fill="#16a34a"]');
    expect(greenFocus).toBeNull();
  });
});
