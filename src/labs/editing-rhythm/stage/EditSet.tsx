"use client";

import { useRef } from "react";
import { DoubleSide, type Group } from "three";
import { BackWall, Backdrop, ClockTower, DoorwayFlat, Lantern, StagePlate } from "@/scene/set/Set";
import { ORDER, useFrameUpdater } from "@/renderer/runtime/frameBus";
import { reelAt } from "../engine/source";

/**
 * The doorway set (Lamplighter's Square), composed from the shared set pieces with the door shut:
 * this lab's source time runs far past the doorway scene's 6 s door animation. The standing lantern
 * is struck for the Kuleshov plates (where it lies fallen) and the lamplighter montage.
 */
export function EditSet() {
  const lantern = useRef<Group>(null);
  useFrameUpdater(({ t }) => {
    const r = reelAt(t)?.reel;
    if (lantern.current) lantern.current.visible = r !== "kule" && r !== "mont";
  }, ORDER.POSE);
  return (
    <group>
      <StagePlate />
      <Backdrop />
      <ClockTower />
      <BackWall />
      <DoorwayFlat />
      <group ref={lantern}>
        <Lantern />
      </group>
      <mesh position={[0, 0.001, -6.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 5]} />
        <meshStandardMaterial color="#2a2622" roughness={0.95} side={DoubleSide} />
      </mesh>
    </group>
  );
}
