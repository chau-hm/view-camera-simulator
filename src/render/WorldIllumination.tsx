import { resolveSceneWorldIllumination } from "../scenes/illumination/sceneWorldIllumination";
import * as THREE from "three";
import React from "react";
import type {
  WorldIlluminationDirectionalSource,
  WorldIlluminationSource,
} from "./worldIlluminationContract";
import {
  worldIlluminationDirectionalToWorld,
  worldIlluminationPointToWorld,
} from "./worldIlluminationContract";

const assertNever = (source: never): never => {
  throw new Error(`Unsupported world illumination source: ${String(source)}`);
};

export type DirectionalWorldIlluminationProps = Readonly<{
  source: WorldIlluminationDirectionalSource;
}>;

export class DirectionalWorldIllumination extends React.Component<DirectionalWorldIlluminationProps> {
  private readonly target: THREE.Object3D;

  constructor(props: DirectionalWorldIlluminationProps) {
    super(props);
    this.target = new THREE.Object3D();
    this.target.name = `${props.source.id}-target`;
  }

  render() {
    const { source } = this.props;
    const light = worldIlluminationDirectionalToWorld(source);
    return (
      <>
        <primitive object={this.target} position={light.target} />
        <directionalLight
          name={source.id}
          color={light.color}
          intensity={light.intensity}
          castShadow={light.castShadow}
          position={light.position}
          target={this.target}
        />
      </>
    );
  }
}

const worldIlluminationElement = (source: WorldIlluminationSource) => {
  switch (source.kind) {
    case "point": {
      const light = worldIlluminationPointToWorld(source);
      return (
        <pointLight
          key={source.id}
          name={source.id}
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          decay={light.decay}
          castShadow={light.castShadow}
          position={light.position}
        />
      );
    }
    case "directional":
      return <DirectionalWorldIllumination key={source.id} source={source} />;
    default:
      return assertNever(source);
  }
};

export const WorldIllumination = ({ sceneId }: { sceneId: string }) => {
  const illumination = resolveSceneWorldIllumination(sceneId);

  return (
    <>
      {illumination.sources.map(worldIlluminationElement)}
    </>
  );
};
