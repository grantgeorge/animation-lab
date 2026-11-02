"use client";

import dynamic from "next/dynamic";
import type { LabModuleId } from "@/labs/types";

function Loading() {
  return (
    <main className="fixed inset-0 grid place-items-center bg-void">
      <p className="mono text-[12px] text-ink-2">Building the set…</p>
    </main>
  );
}

// One literal dynamic() per lab so each lab is its own chunk.
const LABS: Record<LabModuleId, React.ComponentType> = {
  "lens-and-framing": dynamic(() => import("@/labs/lens-and-framing/LensFramingLab"), { ssr: false, loading: Loading }),
  "camera-movement": dynamic(() => import("@/labs/camera-movement/CameraMovementLab"), { ssr: false, loading: Loading }),
  "lighting-studio": dynamic(() => import("@/labs/lighting-studio/LightingStudioLab"), { ssr: false, loading: Loading }),
  "timing-and-spacing": dynamic(() => import("@/labs/timing-and-spacing/TimingSpacingLab"), { ssr: false, loading: Loading }),
  "character-acting": dynamic(() => import("@/labs/character-acting/CharacterActingLab"), { ssr: false, loading: Loading }),
  "animation-style": dynamic(() => import("@/labs/animation-style/AnimationStyleLab"), { ssr: false, loading: Loading }),
  "staging-and-blocking": dynamic(() => import("@/labs/storytelling/BlockingLab"), { ssr: false, loading: Loading }),
  "storyboards-animatics": dynamic(() => import("@/labs/storytelling/AnimaticsLab"), { ssr: false, loading: Loading }),
  "color-scripting": dynamic(() => import("@/labs/storytelling/ColorLab"), { ssr: false, loading: Loading }),
  "facial-animation": dynamic(() => import("@/labs/facial-animation/FacialAnimationLab"), { ssr: false, loading: Loading }),
  "shot-coverage": dynamic(() => import("@/labs/shot-coverage/ShotCoverageLab"), { ssr: false, loading: Loading }),
  "camera-families": dynamic(() => import("@/labs/camera-families/CameraFamiliesLab"), { ssr: false, loading: Loading }),
  "animation-camera": dynamic(() => import("@/labs/animation-camera/AnimationCameraLab"), { ssr: false, loading: Loading }),
  "grading-finishing": dynamic(() => import("@/labs/grading-finishing/GradingFinishingLab"), { ssr: false, loading: Loading }),
  "painterly-textures": dynamic(() => import("@/labs/painterly-textures/PainterlyLab"), { ssr: false, loading: Loading }),
  "environment-depth": dynamic(() => import("@/labs/environment-depth/EnvironmentDepthLab"), { ssr: false, loading: Loading }),
  "editing-rhythm": dynamic(() => import("@/labs/editing-rhythm/EditingRhythmLab"), { ssr: false, loading: Loading }),
  "vfx-simulation": dynamic(() => import("@/labs/vfx-simulation/VfxSimulationLab"), { ssr: false, loading: Loading }),
  "character-rigging": dynamic(() => import("@/labs/character-rigging/CharacterRiggingLab"), { ssr: false, loading: Loading }),
  "character-design": dynamic(() => import("@/labs/character-design/CharacterDesignLab"), { ssr: false, loading: Loading }),
  "2d-vs-3d": dynamic(() => import("@/labs/2d-vs-3d/TwoDThreeDLab"), { ssr: false, loading: Loading }),
  "stylized-rendering": dynamic(() => import("@/labs/stylized-rendering/StylizedRenderingLab"), { ssr: false, loading: Loading }),
  "secondary-motion": dynamic(() => import("@/labs/secondary-motion/SecondaryMotionLab"), { ssr: false, loading: Loading }),
  "compositing-passes": dynamic(() => import("@/labs/compositing-passes/CompositingPassesLab"), { ssr: false, loading: Loading }),
  "ai-shot-continuity": dynamic(() => import("@/labs/ai-shot-continuity/AiShotContinuityLab"), { ssr: false, loading: Loading }),
  "voice-direction": dynamic(() => import("@/labs/voice-direction/VoiceDirectionLab"), { ssr: false, loading: Loading }),
  "procedural-vs-keyframe": dynamic(() => import("@/labs/procedural-vs-keyframe/ProceduralKeyframeLab"), { ssr: false, loading: Loading }),
};

/** Client boundary: labs are WebGL apps and render only in the browser. */
export function LabShell({ entry }: { entry: LabModuleId }) {
  const Lab = LABS[entry];
  return <Lab />;
}
