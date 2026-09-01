/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from "react";
import * as THREE from "three";
import {
  lessonZeroGroundGlassSubjectGeometry,
  type LessonZeroGroundGlassSubjectBox,
} from "../scenes/lessonZeroGroundGlassSubject";
import { toWorld } from "./rttUtils";

const UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);

const materialByRole = new Map<string, THREE.MeshStandardMaterial>();

const roleForBox = (box: LessonZeroGroundGlassSubjectBox): string => {
  if (box.id === "target-board" || box.id === "target-stand" || box.id === "target-base") {
    return "structure";
  }
  if (box.id.startsWith("target-frame") || box.id.startsWith("nested-target")) {
    return "frame";
  }
  if (box.id.startsWith("target-cross")) return "cross";
  if (box.id === "target-centre-square") return "centre";
  return "depth";
};

const materialForRole = (role: string): THREE.MeshStandardMaterial => {
  const existing = materialByRole.get(role);
  if (existing) return existing;

  const material = new THREE.MeshStandardMaterial({
    color:
      role === "structure"
        ? "#26364a"
        : role === "frame"
          ? "#f8fafc"
          : role === "cross"
            ? "#e11d48"
            : role === "centre"
              ? "#f59e0b"
              : "#38bdf8",
    roughness: 0.82,
    metalness: 0.04,
  });
  materialByRole.set(role, material);
  return material;
};

export function createLessonZeroGroundGlassGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = "view-camera-anatomy-subject";
  group.userData = {
    subjectId: "view-camera-anatomy",
    focusDepthMm: lessonZeroGroundGlassSubjectGeometry.focusDepthMm,
  };

  lessonZeroGroundGlassSubjectGeometry.boxes.forEach((box) => {
    const mesh = new THREE.Mesh(UNIT_BOX_GEOMETRY, materialForRole(roleForBox(box)));
    mesh.name = `view-camera-anatomy-${box.id}`;
    mesh.position.set(
      toWorld(box.center.x),
      toWorld(box.center.y),
      toWorld(box.center.z),
    );
    mesh.scale.set(toWorld(box.size.x), toWorld(box.size.y), toWorld(box.size.z));
    mesh.userData = {
      subjectPartId: box.id,
      focusDepthMm: lessonZeroGroundGlassSubjectGeometry.focusDepthMm,
    };
    group.add(mesh);
  });

  return group;
}

/** The same subject factory is used by the interactive scene and Ground Glass RTT. */
export const LessonZeroGroundGlassSubject: React.FC = () => {
  const group = useMemo(() => createLessonZeroGroundGlassGroup(), []);
  return <primitive object={group} dispose={null} />;
};
