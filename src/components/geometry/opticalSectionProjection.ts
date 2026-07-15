import type { GeometryView } from "../../types/camera";
import type { Bounds3, DerivedOpticsState, Plane, Vec3 } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import {
  deriveScheimpflugConstruction,
  type ScheimpflugConstruction,
} from "../../core/optics/scheimpflugConstruction";
import { CAMERA_CONSTANTS } from "../../utils/constants";

export type ScreenPoint = { x: number; y: number };

export type OpticalSection = {
  id: GeometryView;
  origin: Vec3;
  depthAxis: Vec3;
  lateralAxis: Vec3;
  normal: Vec3;
  lateralMinMm: number;
  lateralMaxMm: number;
};

export type PlaneSegment = {
  id: string;
  p1: ScreenPoint;
  p2: ScreenPoint;
  color: string;
};

export type OpticalSectionViewData = {
  section: OpticalSection;
  planeSegments: PlaneSegment[];
  physicalPlaneSegments: PlaneSegment[];
  fovSegments: Array<{ p1: ScreenPoint; p2: ScreenPoint }>;
  opticalAxisSegment: { p1: ScreenPoint; p2: ScreenPoint } | null;
  scheimpflugIntersection: ScreenPoint | null;
  projectWorldPoint: (point: Vec3) => ScreenPoint;
};

export type OpticalSectionData = {
  sectionOrigin: Vec3;
  sectionDepthDir: Vec3;
  sections: OpticalSection[];
  lensCenter: Vec3;
  views: Record<GeometryView, OpticalSectionViewData>;
  isInfinity: boolean;
  diagramMinDepthMm: number;
  diagramMaxDepthMm: number;
};

export type ScheimpflugConstructionWindow = {
  depth: { minMm: number; maxMm: number };
  lateral: { minMm: number; maxMm: number };
};

type SectionPoint = { depth: number; lateral: number };
type SectionWindow = {
  minDepth: number;
  maxDepth: number;
  minLateral: number;
  maxLateral: number;
};

// Pure geometry helpers (no React and no scene-specific coordinate shortcuts).
export const vecSub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export const vecAdd = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});
export const vecDot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vecScale = (a: Vec3, scalar: number): Vec3 => ({
  x: a.x * scalar,
  y: a.y * scalar,
  z: a.z * scalar,
});
export const vecCross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const vecLen = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const vecNorm = (a: Vec3): Vec3 => {
  const length = vecLen(a) || 1;
  return { x: a.x / length, y: a.y / length, z: a.z / length };
};

export const projectPointIntoSection = (point: Vec3, section: OpticalSection): SectionPoint => {
  const delta = vecSub(point, section.origin);
  return {
    depth: vecDot(delta, section.depthAxis),
    lateral: vecDot(delta, section.lateralAxis),
  };
};

/** Clip a projected infinite line or forward ray to a physical section window. */
export const clipSectionLineToWindow = ({
  origin,
  direction,
  window,
  ray = false,
}: {
  origin: SectionPoint;
  direction: SectionPoint;
  window: SectionWindow;
  ray?: boolean;
}): [SectionPoint, SectionPoint] | null => {
  const epsilon = 1e-10;
  let minimumT = ray ? 0 : Number.NEGATIVE_INFINITY;
  let maximumT = Number.POSITIVE_INFINITY;

  const clipAxis = (value: number, delta: number, minimum: number, maximum: number) => {
    if (Math.abs(delta) < epsilon) return value >= minimum && value <= maximum;
    let nearT = (minimum - value) / delta;
    let farT = (maximum - value) / delta;
    if (nearT > farT) [nearT, farT] = [farT, nearT];
    minimumT = Math.max(minimumT, nearT);
    maximumT = Math.min(maximumT, farT);
    return minimumT <= maximumT;
  };

  if (!clipAxis(origin.depth, direction.depth, window.minDepth, window.maxDepth)) return null;
  if (!clipAxis(origin.lateral, direction.lateral, window.minLateral, window.maxLateral)) {
    return null;
  }
  if (!Number.isFinite(minimumT) || !Number.isFinite(maximumT)) return null;

  return [minimumT, maximumT].map((t) => ({
    depth: origin.depth + direction.depth * t,
    lateral: origin.lateral + direction.lateral * t,
  })) as [SectionPoint, SectionPoint];
};

export const orderSegmentLeftToRight = <T extends { p1: ScreenPoint; p2: ScreenPoint }>(
  segment: T,
): { left: ScreenPoint; right: ScreenPoint } =>
  segment.p1.x <= segment.p2.x
    ? { left: segment.p1, right: segment.p2 }
    : { left: segment.p2, right: segment.p1 };

/** Maximum normalized 2D cross-product residual used for projected collinearity. */
export const PROJECTED_COLLINEARITY_TOLERANCE = 1e-9;

/**
 * Returns zero for parallel projected segments and Infinity for invalid or
 * degenerate input, so missing geometry cannot silently pass a test.
 */
export const normalizedSegmentCrossResidual = (
  first: Pick<PlaneSegment, "p1" | "p2">,
  second: Pick<PlaneSegment, "p1" | "p2">,
): number => {
  const firstVector = {
    x: first.p2.x - first.p1.x,
    y: first.p2.y - first.p1.y,
  };
  const secondVector = {
    x: second.p2.x - second.p1.x,
    y: second.p2.y - second.p1.y,
  };
  const denominator =
    Math.hypot(firstVector.x, firstVector.y) *
    Math.hypot(secondVector.x, secondVector.y);
  const coordinates = [
    first.p1.x,
    first.p1.y,
    first.p2.x,
    first.p2.y,
    second.p1.x,
    second.p1.y,
    second.p2.x,
    second.p2.y,
  ];
  if (!coordinates.every(Number.isFinite) || denominator <= 1e-12) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(
    firstVector.x * secondVector.y - firstVector.y * secondVector.x,
  ) / denominator;
};

/** Build a stable, perimeter-ordered DOF quadrilateral. */
export const buildDofPolygonPoints = (
  near: Pick<PlaneSegment, "p1" | "p2">,
  far: Pick<PlaneSegment, "p1" | "p2">,
): [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] => {
  const nearOrdered = orderSegmentLeftToRight(near);
  const farOrdered = orderSegmentLeftToRight(far);
  const nearDirection = {
    x: nearOrdered.right.x - nearOrdered.left.x,
    y: nearOrdered.right.y - nearOrdered.left.y,
  };
  const farDirection = {
    x: farOrdered.right.x - farOrdered.left.x,
    y: farOrdered.right.y - farOrdered.left.y,
  };
  const determinant = nearDirection.x * farDirection.y - nearDirection.y * farDirection.x;
  if (Math.abs(determinant) > 1e-10) {
    const betweenLefts = {
      x: farOrdered.left.x - nearOrdered.left.x,
      y: farOrdered.left.y - nearOrdered.left.y,
    };
    const nearT =
      (betweenLefts.x * farDirection.y - betweenLefts.y * farDirection.x) /
      determinant;
    const farT =
      (betweenLefts.x * nearDirection.y - betweenLefts.y * nearDirection.x) /
      determinant;
    if (nearT > 0 && nearT < 1 && farT > 0 && farT < 1) {
      // Scheimpflug DOF boundaries converge near the lens. If that convergence
      // falls inside a diagram that also shows the image side, start the filled
      // object-space wedge at the convergence instead of drawing a bow-tie.
      const intersection = {
        x: nearOrdered.left.x + nearDirection.x * nearT,
        y: nearOrdered.left.y + nearDirection.y * nearT,
      };
      return [intersection, nearOrdered.right, farOrdered.right, intersection];
    }
  }
  return [nearOrdered.left, nearOrdered.right, farOrdered.right, farOrdered.left];
};

const getBoundsCorners = (bounds: Bounds3): Vec3[] => {
  const result: Vec3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) result.push({ x, y, z });
    }
  }
  return result;
};

const orientLateralAxis = (axis: Vec3): Vec3 => {
  const preferredUp = Math.abs(axis.y) > 1e-6 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  return vecDot(axis, preferredUp) < 0 ? vecScale(axis, -1) : axis;
};

const createConstructionBasis = (
  opticsState: DerivedOpticsState,
  construction: ScheimpflugConstruction,
) => {
  const depthAxis = vecNorm(opticsState.filmNormalWorld);
  const lineDirection = construction.commonLine?.direction;
  if (!lineDirection || vecLen(lineDirection) < 1e-8) {
    return {
      normal: { x: 1, y: 0, z: 0 },
      depthAxis,
      lateralAxis: { x: 0, y: 1, z: 0 },
    };
  }
  const normal = vecNorm(lineDirection);
  const lateralAxis = orientLateralAxis(vecNorm(vecCross(normal, depthAxis)));
  return { normal, depthAxis, lateralAxis };
};

export const getScheimpflugConstructionWindow = (
  opticsState: DerivedOpticsState,
): ScheimpflugConstructionWindow | null => {
  const construction = deriveScheimpflugConstruction({
    filmPlane: opticsState.filmPlane,
    lensPlane: opticsState.lensPlane,
    focusPlane: opticsState.focusPlane,
  });
  if (!construction.isValid || !construction.commonLine) return null;
  const basis = createConstructionBasis(opticsState, construction);
  const section: OpticalSection = {
    id: "scheimpflug",
    origin: construction.commonLine.point,
    ...basis,
    lateralMinMm: 0,
    lateralMaxMm: 0,
  };
  const physicalPoints = [
    construction.commonLine.point,
    opticsState.lensCenterWorld,
    ...Object.values(opticsState.filmPlaneCornersWorld),
  ].map((point) => projectPointIntoSection(point, section));
  const constructionScaleMm = Math.max(
    300,
    ...physicalPoints.map((point) => Math.hypot(point.depth, point.lateral)),
  );
  const depthValues = physicalPoints.map((point) => point.depth);
  const lateralValues = physicalPoints.map((point) => point.lateral);
  const depthMargin = constructionScaleMm * 0.35;
  const lateralMargin = constructionScaleMm * 0.25;
  return {
    depth: {
      minMm: Math.min(...depthValues) - depthMargin,
      maxMm: Math.max(...depthValues) + depthMargin,
    },
    lateral: {
      minMm: Math.min(...lateralValues) - lateralMargin,
      maxMm: Math.max(...lateralValues) + lateralMargin,
    },
  };
};

const intersectCommonLineWithSection = (
  construction: ScheimpflugConstruction,
  section: OpticalSection,
): Vec3 | null => {
  const line = construction.commonLine;
  if (!line) return null;
  const denominator = vecDot(line.direction, section.normal);
  if (Math.abs(denominator) < 1e-8) return null;
  const t = vecDot(vecSub(section.origin, line.point), section.normal) / denominator;
  return vecAdd(line.point, vecScale(line.direction, t));
};

export function computeOpticalSectionData({
  opticsState,
  scene,
  svgWidth,
  svgHeight,
  depthWindow,
  lateralWindow,
  paddingPx,
}: {
  opticsState: DerivedOpticsState;
  scene: SceneDefinition;
  svgWidth: number;
  svgHeight: number;
  depthWindow: { minMm: number; maxMm: number };
  lateralWindow?: Partial<Record<GeometryView, { minMm: number; maxMm: number }>>;
  paddingPx?: number;
}): OpticalSectionData {
  const padding = paddingPx ?? 24;
  const diagramMinDepthMm = depthWindow.minMm;
  const diagramMaxDepthMm = depthWindow.maxMm;
  const sectionOrigin = opticsState.filmCenterWorld;
  const sectionDepthDir = vecNorm(opticsState.filmNormalWorld);
  const construction = deriveScheimpflugConstruction({
    filmPlane: opticsState.filmPlane,
    lensPlane: opticsState.lensPlane,
    focusPlane: opticsState.focusPlane,
  });
  const constructionBasis = createConstructionBasis(opticsState, construction);
  const baseSections: Array<Omit<OpticalSection, "lateralMinMm" | "lateralMaxMm">> = [
    {
      id: "side",
      origin: sectionOrigin,
      depthAxis: sectionDepthDir,
      lateralAxis: { x: 0, y: 1, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
    },
    {
      id: "top",
      origin: sectionOrigin,
      depthAxis: sectionDepthDir,
      lateralAxis: { x: 1, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
    },
    {
      id: "scheimpflug",
      origin: construction.commonLine?.point ?? sectionOrigin,
      ...constructionBasis,
    },
  ];

  const sceneCorners = [
    ...getBoundsCorners(scene.bounds),
    opticsState.filmCenterWorld,
    opticsState.lensCenterWorld,
    opticsState.focusPlane?.point,
  ].filter((point): point is Vec3 => Boolean(point));
  const sections = baseSections.map((section): OpticalSection => {
    const configured = lateralWindow?.[section.id];
    if (configured) {
      return {
        ...section,
        lateralMinMm: configured.minMm,
        lateralMaxMm: configured.maxMm,
      };
    }
    const laterals = sceneCorners.map((point) =>
      vecDot(vecSub(point, section.origin), section.lateralAxis),
    );
    const minimum = Math.min(...laterals);
    const maximum = Math.max(...laterals);
    const margin = Math.max(1, (maximum - minimum) * 0.04);
    return {
      ...section,
      lateralMinMm: minimum - margin,
      lateralMaxMm: maximum + margin,
    };
  });

  const filmCorners = Object.values(opticsState.filmPlaneCornersWorld);
  const planeDefinitions: Array<{ id: string; plane: Plane | null | undefined; color: string }> = [
    { id: "film", plane: opticsState.filmPlane, color: "#0284c7" },
    { id: "lens", plane: opticsState.lensPlane, color: "#475569" },
    { id: "focus", plane: opticsState.focusPlane, color: "#16a34a" },
    { id: "nearDof", plane: opticsState.depthOfFieldNearPlane, color: "#8b5cf6" },
    { id: "farDof", plane: opticsState.depthOfFieldFarPlane, color: "#8b5cf6" },
  ];

  const views = Object.fromEntries(
    sections.map((section): [GeometryView, OpticalSectionViewData] => {
      const mapToScreen = (point: SectionPoint): ScreenPoint => ({
        x:
          padding +
          ((point.depth - diagramMinDepthMm) /
            (diagramMaxDepthMm - diagramMinDepthMm || 1)) *
            (svgWidth - padding * 2),
        y:
          svgHeight -
          (padding +
            ((point.lateral - section.lateralMinMm) /
              (section.lateralMaxMm - section.lateralMinMm || 1)) *
              (svgHeight - padding * 2)),
      });
      const window: SectionWindow = {
        minDepth: diagramMinDepthMm,
        maxDepth: diagramMaxDepthMm,
        minLateral: section.lateralMinMm,
        maxLateral: section.lateralMaxMm,
      };

      const projectPlane = (plane: Plane): PlaneSegment | null => {
        const depthCoefficient = vecDot(plane.normal, section.depthAxis);
        const lateralCoefficient = vecDot(plane.normal, section.lateralAxis);
        const planeOffset = vecDot(plane.normal, vecSub(plane.point, section.origin));
        const direction = {
          depth: -lateralCoefficient,
          lateral: depthCoefficient,
        };
        if (Math.hypot(direction.depth, direction.lateral) < 1e-10) return null;
        const denominator = depthCoefficient ** 2 + lateralCoefficient ** 2;
        const origin = {
          depth: (planeOffset * depthCoefficient) / denominator,
          lateral: (planeOffset * lateralCoefficient) / denominator,
        };
        const clipped = clipSectionLineToWindow({ origin, direction, window });
        if (!clipped) return null;
        return { id: "plane", p1: mapToScreen(clipped[0]), p2: mapToScreen(clipped[1]), color: "" };
      };

      const planeTraceDirection = (plane: Plane): SectionPoint => ({
        depth: -vecDot(plane.normal, section.lateralAxis),
        lateral: vecDot(plane.normal, section.depthAxis),
      });

      const planeSegments = planeDefinitions.flatMap(({ id, plane, color }) => {
        if (!plane) return [];
        const segment = projectPlane(plane);
        return segment ? [{ ...segment, id, color }] : [];
      });

      const projectedLens = projectPointIntoSection(opticsState.lensCenterWorld, section);
      const axisDirection = {
        depth: vecDot(opticsState.opticalAxis.direction, section.depthAxis),
        lateral: vecDot(opticsState.opticalAxis.direction, section.lateralAxis),
      };
      const clippedAxis = clipSectionLineToWindow({
        origin: projectedLens,
        direction: axisDirection,
        window,
      });
      const opticalAxisSegment = clippedAxis
        ? { p1: mapToScreen(clippedAxis[0]), p2: mapToScreen(clippedAxis[1]) }
        : null;

      const filmHalfSpan = Math.max(
        ...filmCorners.map((point) =>
          Math.abs(vecDot(vecSub(point, opticsState.filmCenterWorld), section.lateralAxis)),
        ),
      );
      const filmSectionEndpoints = [-filmHalfSpan, filmHalfSpan].map((offset) =>
        vecAdd(opticsState.filmCenterWorld, vecScale(section.lateralAxis, offset)),
      );
      const lensTrace = planeTraceDirection(opticsState.lensPlane);
      const lensTraceLength = Math.hypot(lensTrace.depth, lensTrace.lateral) || 1;
      const lensPhysicalHalfLengthMm = CAMERA_CONSTANTS.frontStandardWidthMm / 2;
      const physicalPlaneSegments: PlaneSegment[] = [
        {
          id: "physical-film",
          color: "#0284c7",
          p1: mapToScreen(projectPointIntoSection(filmSectionEndpoints[0], section)),
          p2: mapToScreen(projectPointIntoSection(filmSectionEndpoints[1], section)),
        },
        {
          id: "physical-lens",
          color: "#475569",
          p1: mapToScreen({
            depth:
              projectedLens.depth -
              (lensTrace.depth / lensTraceLength) * lensPhysicalHalfLengthMm,
            lateral:
              projectedLens.lateral -
              (lensTrace.lateral / lensTraceLength) * lensPhysicalHalfLengthMm,
          }),
          p2: mapToScreen({
            depth:
              projectedLens.depth +
              (lensTrace.depth / lensTraceLength) * lensPhysicalHalfLengthMm,
            lateral:
              projectedLens.lateral +
              (lensTrace.lateral / lensTraceLength) * lensPhysicalHalfLengthMm,
          }),
        },
      ];
      const fovSegments = filmSectionEndpoints.flatMap((filmPoint) => {
        const directionWorld = vecNorm(vecSub(opticsState.lensCenterWorld, filmPoint));
        const direction = {
          depth: vecDot(directionWorld, section.depthAxis),
          lateral: vecDot(directionWorld, section.lateralAxis),
        };
        const clipped = clipSectionLineToWindow({
          origin: projectedLens,
          direction,
          window,
          ray: true,
        });
        return clipped ? [{ p1: mapToScreen(clipped[0]), p2: mapToScreen(clipped[1]) }] : [];
      });

      const commonPointWorld = intersectCommonLineWithSection(construction, section);
      const commonPointSection = commonPointWorld
        ? projectPointIntoSection(commonPointWorld, section)
        : null;
      const scheimpflugIntersection =
        commonPointSection &&
        commonPointSection.depth >= window.minDepth &&
        commonPointSection.depth <= window.maxDepth &&
        commonPointSection.lateral >= window.minLateral &&
        commonPointSection.lateral <= window.maxLateral
          ? mapToScreen(commonPointSection)
          : null;

      return [
        section.id,
        {
          section,
          planeSegments,
          physicalPlaneSegments,
          fovSegments,
          opticalAxisSegment,
          scheimpflugIntersection,
          projectWorldPoint: (point) => mapToScreen(projectPointIntoSection(point, section)),
        },
      ];
    }),
  ) as Record<GeometryView, OpticalSectionViewData>;

  return {
    sectionOrigin,
    sectionDepthDir,
    sections,
    lensCenter: opticsState.lensCenterWorld,
    views,
    isInfinity: Boolean(opticsState.diagnostics?.isInfinityFocus),
    diagramMinDepthMm,
    diagramMaxDepthMm,
  };
}
