import { resolveMechanicalBuffers, type Part } from "./mechanicalGeometry";
import {
  frameMaterialProps,
  resolvePresentationColor,
  type PresentationProps,
} from "./mechanicalMaterials";

type HardwareProps = PresentationProps & {
  name: string;
  parts: readonly Part[];
  color: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  roughness?: number;
  metalness?: number;
  ghostColor?: string;
  emissive?: string;
  emissiveIntensity?: number;
};

export const Hardware = ({
  name,
  parts,
  color,
  position,
  scale,
  roughness = 0.58,
  metalness = 0.32,
  ghostColor = "#aab5c3",
  emissive,
  emissiveIntensity,
  ghost,
  state = "normal",
}: HardwareProps) => {
  const buffers = resolveMechanicalBuffers(parts);
  return (
    <mesh name={name} position={position} scale={scale} renderOrder={ghost ? 10 : 0}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.position, 3]} />
        <bufferAttribute attach="attributes-normal" args={[buffers.normal, 3]} />
      </bufferGeometry>
      <meshStandardMaterial
        color={resolvePresentationColor(color, ghostColor, state, ghost)}
        emissive={
          ghost || state === "dimmed"
            ? "#000000"
            : (emissive ?? (state === "highlighted" ? "#78470c" : color))
        }
        emissiveIntensity={ghost || state === "dimmed" ? 0 : (emissiveIntensity ?? 0.3)}
        roughness={roughness}
        metalness={metalness}
        {...frameMaterialProps({ ghost, state })}
      />
    </mesh>
  );
};
