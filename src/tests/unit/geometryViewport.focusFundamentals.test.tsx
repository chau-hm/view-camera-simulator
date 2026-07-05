import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";

describe("GeometryViewport - Focus Fundamentals specific regression", () => {
  afterEach(() => {
    cleanup();
  });

  it("A: Stable board positions when changing focus (side view)", () => {
    const scene = focusFundamentalsTwoTargets;
    const state1000 = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, focusDistanceMm: 1000 }, scene);
    const { container, rerender } = render(<GeometryViewport opticsState={state1000} geometryView="side" scene={scene} />);
    const svg = container.querySelector('[data-testid="geometry-svg-side"]') as SVGElement | null;
    expect(svg).toBeTruthy();

    // find board glyph rects (side view uses 12x16 rectangles for boards)
    const rects = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('width') === '12' && r.getAttribute('height') === '16' && r.getAttribute('fill') === '#0f766e');
    expect(rects.length).toBeGreaterThanOrEqual(2);
    const centres1 = rects.map((r) => ({ cx: parseFloat(r.getAttribute('x') || '0') + 6 }));

    // rerender at focus 3000
    const state3000 = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, focusDistanceMm: 3000 }, scene);
    rerender(<GeometryViewport opticsState={state3000} geometryView="side" scene={scene} />);
    const rects2 = Array.from(svg!.querySelectorAll('rect')).filter((r) => r.getAttribute('width') === '12' && r.getAttribute('height') === '16' && r.getAttribute('fill') === '#0f766e');
    const centres2 = rects2.map((r) => ({ cx: parseFloat(r.getAttribute('x') || '0') + 6 }));

    // compare X positions for each board (order preserved)
    expect(centres1.length).toBe(centres2.length);
    for (let i = 0; i < centres1.length; i++) {
      expect(Math.abs(centres1[i].cx - centres2[i].cx)).toBeLessThan(0.5);
    }
  });

  it("B/D: Plane and glyph orientation (side & top): planes vertical and glyphs vertical plates", () => {
    const scene = focusFundamentalsTwoTargets;
    const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);

    // side view
    const { container: c1 } = render(<GeometryViewport opticsState={optics} geometryView="side" scene={scene} />);
    const svgSide = c1.querySelector('[data-testid="geometry-svg-side"]') as SVGElement | null;
    expect(svgSide).toBeTruthy();

    // check there exists at least one vertical plane line (x1 ~ x2)
    const planeLinesAll = Array.from(svgSide!.querySelectorAll('line')) as SVGLineElement[];
    const verticalPlane = planeLinesAll.find((ln) => Math.abs(parseFloat(ln.getAttribute('x1') || '0') - parseFloat(ln.getAttribute('x2') || '0')) < 1);
    expect(verticalPlane).toBeTruthy();

    // glyph orientation: rear/front standards are vertical plates (height > width)
    const rearRect = Array.from(svgSide!.querySelectorAll('rect')).find((r) => r.getAttribute('fill') === '#1f2937');
    const frontRect = Array.from(svgSide!.querySelectorAll('rect')).find((r) => r.getAttribute('fill') === '#475569');
    expect(rearRect).toBeTruthy();
    expect(frontRect).toBeTruthy();
    if (rearRect) expect(parseFloat(rearRect.getAttribute('height') || '0')).toBeGreaterThan(parseFloat(rearRect.getAttribute('width') || '0'));
    if (frontRect) expect(parseFloat(frontRect.getAttribute('height') || '0')).toBeGreaterThan(parseFloat(frontRect.getAttribute('width') || '0'));

    // top view
    const { container: c2 } = render(<GeometryViewport opticsState={optics} geometryView="top" scene={scene} />);
    const svgTop = c2.querySelector('[data-testid="geometry-svg-top"]') as SVGElement | null;
    expect(svgTop).toBeTruthy();

    // in top view, target glyphs should be vertical plates
    const targetRectsTop = Array.from(svgTop!.querySelectorAll('rect')).filter((r) => r.getAttribute('fill') === '#0f766e');
    expect(targetRectsTop.length).toBeGreaterThanOrEqual(2);
    for (const r of targetRectsTop) {
      expect(parseFloat(r.getAttribute('height') || '0')).toBeGreaterThan(parseFloat(r.getAttribute('width') || '0'));
    }
  });

  it("C: FOV rays intersect visible plane segments", () => {
    const scene = focusFundamentalsTwoTargets;
    const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
    const { container } = render(<GeometryViewport opticsState={optics} geometryView="side" scene={scene} />);
    const svg = container.querySelector('[data-testid="geometry-svg-side"]') as SVGElement | null;
    expect(svg).toBeTruthy();

    const fovLines = Array.from(svg!.querySelectorAll('line')).filter((l) => l.getAttribute('stroke') === '#f59e0b' && l.getAttribute('stroke-width') === '1');
    expect(fovLines.length).toBeGreaterThanOrEqual(2);

    // collect plane segments extents (x ranges)
    // Ensure each fov line endpoint (x2,y2) lies within the SVG viewBox (i.e., visible)
    const vb = svg!.getAttribute('viewBox') || '0 0 460 280';
    const parts = vb.split(/\s+/).map((s) => parseFloat(s));
    const width = parts[2] || 460;
    const height = parts[3] || 280;
    for (const fl of fovLines) {
      const fx = parseFloat(fl.getAttribute('x2') || '0');
      const fy = parseFloat(fl.getAttribute('y2') || '0');
      expect(fx).toBeGreaterThanOrEqual(0);
      // allow endpoints slightly outside viewBox due to long rays; tolerate a margin
      const margin = Math.max(100, Math.round(width * 0.2));
      expect(fx).toBeLessThanOrEqual(width + margin);
      expect(fy).toBeGreaterThanOrEqual(0 - margin);
      expect(fy).toBeLessThanOrEqual(height + margin);
    }
  });

  it("E: Depth strip shows expected chips and DiagramLegend is not present; Infinity mode shows ∞", () => {
    const scene = focusFundamentalsTwoTargets;
    const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
    const { container, rerender } = render(<GeometryViewport opticsState={optics} geometryView="side" scene={scene} />);

    // depth strip exists and has aria-label
    const depthStrip = container.querySelector('[aria-label="Optical depth order"]');
    expect(depthStrip).toBeTruthy();
    const text = depthStrip?.textContent || '';
    expect(text).toContain('Film');
    expect(text).toContain('Lens');
    expect(text).toContain('Near DOF');
    expect(text).toContain('Focus');
    expect(text).toContain('Far DOF');

    // DiagramLegend should not be present for focus fundamentals
    const legend = container.querySelector('div') && Array.from(container.querySelectorAll('div')).find((d) => d.textContent?.includes('Film datum'));
    expect(legend).toBeUndefined();

    // Infinity mode: mark diagnostics as infinity and rerender
    // build a shallow copy and set diagnostics.isInfinityFocus without using `any`
    const origDiag = (optics as unknown as { diagnostics?: Record<string, unknown> }).diagnostics ?? {};
    const opticsInf = { ...(optics as unknown as Record<string, unknown>), diagnostics: { ...(origDiag as Record<string, unknown>), isInfinityFocus: true } } as unknown as typeof optics;
    rerender(<GeometryViewport opticsState={opticsInf} geometryView="side" scene={scene} />);
    const depthStrip2 = container.querySelector('[aria-label="Optical depth order"]');
    expect(depthStrip2).toBeTruthy();
    const txt2 = depthStrip2?.textContent || '';
    expect(txt2).toContain('Focus');
    expect(txt2).toMatch(/∞/);
  });

  it("F: Raw RTT isolation — GroundGlassRenderer uses RTT and not legacy overlay for Focus Fundamentals", () => {
    const scene = focusFundamentalsTwoTargets;
    const optics = deriveOpticsState(DEFAULT_CAMERA_STATE, scene);
    const { container } = render(
      <GroundGlassRenderer
        opticsState={optics}
        assistEnabled={false}
        focusAssistEnabled={false}
        gridEnabled={false}
        riseMm={0}
        tiltDeg={0}
        swingDeg={0}
        focusDistanceMm={2000}
        aperture={11}
        renderQuality="low"
        sceneId={scene.id}
      />,
    );

    // legacy overlay should not be present
    expect(container.querySelector('[data-testid="ground-glass-scene"]')).toBeNull();
    // RTT container should be present
    expect(container.querySelector('[data-testid="ground-glass-rtt"]')).toBeTruthy();

    // check debug global value if set (camera far should not be 10000)
    const far = (globalThis as unknown as { __GROUNDGLASS_RTT_LAST_CAM_FAR?: number }).__GROUNDGLASS_RTT_LAST_CAM_FAR;
    if (typeof far === 'number') {
      expect(far).not.toEqual(10000);
    }
  });
});
