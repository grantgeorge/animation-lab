export const CHAPTER_IDS = ["drawings", "multiplane", "television", "digital-2d", "cg", "simulation", "stylization", "generative"] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export type View = "watch" | "process";
export type DirectorNoteId = "none" | "blue-scarf";

/** Durable, shareable view state. Playheads, slider positions and loading state stay local. */
export interface HistoryState {
  chapterId: ChapterId;
  view: View;
  compareChapterId: ChapterId | null;
  directorNote: DirectorNoteId;
}

export type ProcessDemo = "drawings" | "parallax" | "reuse" | "composite" | "rig" | "secondary-motion" | "cadence" | "conditioning";

export interface Milestone {
  title: string;
  year?: number;
  note?: string;
  sourceId?: string;
}

export interface Chapter {
  id: ChapterId;
  number: number;
  title: string;
  periodLabel: string;
  whatChanged: string;
  filmmakerControl: string;
  aiConnection: string;
  milestones: Milestone[];
  /** Media asset shown in Watch mode. */
  heroAssetId: string;
  processDemo: ProcessDemo;
  processCaption: string;
  controlHint: string;
  directorNoteExplanation: string;
  sourceIds: string[];
  relatedLabIds: string[];
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export type AssetOrigin = "ai-recreation" | "authored-demo" | "historical-source";

export interface MediaAsset {
  id: string;
  kind: "image" | "video";
  origin: AssetOrigin;
  url: string;
  posterUrl?: string;
  width: number;
  height: number;
  durationSeconds?: number;
  frameRate?: number;
  /** Human-reviewed beat marks, seconds from the start of THIS clip. */
  beatMarkers?: { id: BeatId; timeSeconds: number }[];
  alt: string;
  sceneVersion: string;
  approval: "draft" | "approved" | "retired";
  provenanceId?: string;
}

export type BeatId = "establish" | "notice" | "react" | "settle";

/** Sanitized provenance shown to visitors. Private job records stay in media-work/. */
export interface Provenance {
  id: string;
  steps: {
    label: string;
    endpointId: string;
    model: string;
    date: string;
    prompt: string;
    inputs: string[];
    parameters: Record<string, string | number | boolean>;
  }[];
  edits: string[];
  note?: string;
}

export type ReviewLabel = "Matches" | "Partly matches" | "Changed";

export interface ReviewObservation {
  criterion: "identity" | "scarf" | "beats" | "composition" | "unrequested" | "performance";
  label: ReviewLabel;
  at?: number;
  note: string;
}

export interface ExperimentTake {
  id: string;
  condition: "text" | "references";
  index: number;
  assetId: string;
  failed?: string;
  observations: ReviewObservation[];
}

export interface Experiment {
  id: string;
  look: string;
  brief: string;
  conditions: {
    id: "text" | "references";
    title: string;
    endpointId: string;
    inputs: string[];
    parameters: Record<string, string | number | boolean>;
    promptAddendum?: string;
  }[];
  references: { assetId: string; label: string }[];
  heroTakeId: string;
  takes: ExperimentTake[];
  revision: {
    sourceTakeId: string;
    assetId: string;
    keyframeAssetId?: string;
    endpointId: string;
    operation: string;
    instruction: string;
    observations: ReviewObservation[];
  } | null;
  about: string;
  reviewStatus: string;
}
