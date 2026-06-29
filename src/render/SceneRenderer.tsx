import { Canvas } from "@react-three/fiber";
import { useEffect } from "react";
import type { SceneDefinition } from "../types/scene";

type SceneRendererProps = {
  scene: SceneDefinition;
  attempt: number;
  simulateAssetFailure: boolean;
  onAssetError: (message: string) => void;
};

const DemoScene = () => (
  <>
    <ambientLight intensity={0.8} />
    <pointLight position={[4, 5, 4]} />
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" />
    </mesh>
  </>
);

export const SceneRenderer = ({
  scene,
  attempt,
  simulateAssetFailure,
  onAssetError,
}: SceneRendererProps) => {
  useEffect(() => {
    if (simulateAssetFailure && attempt === 0) {
      onAssetError(`Failed to load scene assets for ${scene.id}.`);
    }
  }, [attempt, onAssetError, scene.id, simulateAssetFailure]);

  if (simulateAssetFailure && attempt === 0) {
    return null;
  }

  return (
    <div style={{ height: 260, border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
      <Canvas camera={{ position: [0, 1.5, 4], fov: 50 }}>
        <DemoScene />
      </Canvas>
    </div>
  );
};
