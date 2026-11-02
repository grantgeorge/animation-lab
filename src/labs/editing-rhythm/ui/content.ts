import type { ExperimentId } from "../engine/types";

/** One technique per experiment: what it is, what to try, and the lesson. */
export const EXP_INFO: Record<ExperimentId, { tab: string; title: string; technique: string; try: string; lesson: string }> = {
  timeline: {
    tab: "Timeline",
    title: "One scene, four edits",
    technique: "Order, holds and reactions",
    try: "Try holding the reaction shot longer, or moving the glowing box before the reaction. Watch the explanation change.",
    lesson: "Editing isn't assembling shots. It decides what the audience sees, when they see it, and how long they have to react.",
  },
  pacing: {
    tab: "Pacing",
    title: "Pacing & rhythm",
    technique: "Shot duration",
    try: "Drag the tempo: the same shots, in the same order, only longer or shorter.",
    lesson: "When to hold and when to cut. Long shots invite the audience to feel; short shots push them forward.",
  },
  kuleshov: {
    tab: "Kuleshov",
    title: "The Kuleshov effect",
    technique: "Context changes meaning",
    try: "Watch Bram's neutral face beside each insert. What do you read on his face?",
    lesson: "The face never changes: the same frames sit either side of every insert. Change the shot beside a neutral expression and viewers perceive a different emotion, without reanimating anything.",
  },
  reaction: {
    tab: "Reactions",
    title: "Reaction shots",
    technique: "Reaction before or after the event",
    try: "Put Bram's reaction before the box opens, then after it.",
    lesson: "A reaction before the event makes us anxious about what he sees; after the event it tells us how to feel about what we just saw.",
  },
  continuity: {
    tab: "Continuity",
    title: "Continuity: eyelines and the line",
    technique: "Screen direction",
    try: "Flip camera 3 across the line, then watch Pip and Bram's looks across the cut.",
    lesson: "Keep every camera on one side of the line between two characters and their eyelines meet across the cut. Cross it and they both look the same way: the audience loses the geography.",
  },
  jl: {
    tab: "J / L cuts",
    title: "J-cuts and L-cuts",
    technique: "Sound leads or follows picture",
    try: "Slide the sound edit before the picture cut (J) or after it (L).",
    lesson: "A J-cut lets the next sound arrive first, so the audience leans into the cut; an L-cut lets a moment linger over the new image. The picture cut never moves.",
  },
  montage: {
    tab: "Montage",
    title: "Montage & compression",
    technique: "Narrative time",
    try: "Compare the lamplighter's 60 s in real time with a 10 s montage of jump cuts, then dissolves.",
    lesson: "Montage keeps only the beats that tell the story. Jump cuts feel brisk and modern; dissolves say gently that time is passing.",
  },
  comedy: {
    tab: "Comedy timing",
    title: "Comedy timing",
    technique: "Setup, anticipation, slip, reaction",
    try: "Change the gaps between the beats, or pick one of the four classic variants.",
    lesson: "Comedy is controlled by anticipation, withheld information and precise reaction timing, not by making everything faster.",
  },
};
