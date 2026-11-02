import { audibleEvents } from "../engine/audio";
import { stats } from "../engine/edit";
import { explain, type Point } from "../engine/explain";
import { COMEDY_PRESETS, KULE_LABEL, KULE_READING, comedyBeats, compression, continuityCams, eyelines, jlEdit, montageEdit, reactionEdit } from "../engine/experiments";
import { PRESET_INFO } from "../engine/presets";
import { SHOTS } from "../engine/shots";
import type { EditPresetId } from "../engine/types";
import { playgroundExplanation, type ERState } from "../store";

export interface ExpExplanation {
  headline: string;
  points: { id: string; text: string }[];
  reads?: EditPresetId;
}

const ARROW = { left: "←", right: "→" } as const;

/** The explanation for whatever is on the program monitor (rule-based, deterministic). */
export function explanationFor(s: ERState): ExpExplanation {
  switch (s.exp) {
    case "kuleshov": {
      const a = s.kuleAnswers[s.kuleInsert];
      return {
        headline: a ? `You read "${a.toLowerCase()}" beside ${KULE_LABEL[s.kuleInsert]}. Bram's face is the same frames in every version: the meaning came from the cut.` : `Bram's face, then ${KULE_LABEL[s.kuleInsert]}, then the same face again. What do you read on him?`,
        points: [
          { id: "kule.same", text: "The two close-ups are identical: same take, same frames (KULE 1.0–3.8 s). Nothing in the face was reanimated." },
          { id: "kule.reading", text: `Audiences usually read ${KULE_READING[s.kuleInsert]} with this pairing. The insert supplies the emotion; the face supplies the person feeling it.` },
          { id: "kule.ai", text: "For AI video: a neutral, well-lit close-up is reusable. Generate it once and let the shot beside it decide the emotion." },
        ],
      };
    }
    case "reaction": {
      const ex = explain(reactionEdit(s.reactionOrder));
      return {
        headline: s.reactionOrder === "before" ? "Reaction before the event: we see Bram's fear first, so the box opening is the answer to a question the audience has been holding." : "Reaction after the event: the box opens first, then Bram's face tells us how to feel about it. The reaction becomes the response, and here, the joke.",
        points: ex.points.filter((p) => p.id.startsWith("order") || p.id.startsWith("reaction")),
      };
    }
    case "continuity": {
      const r = eyelines(SHOTS.hesitate.cam, continuityCams(s.flipped).reaction ?? SHOTS.reaction.cam);
      return {
        headline: r.matched ? `Pip looks ${ARROW[r.pipLooks]}, Bram looks ${ARROW[r.bramLooks]}: their eyelines meet across the cut, so the audience feels them facing each other.` : `Pip looks ${ARROW[r.pipLooks]} and Bram looks ${ARROW[r.bramLooks]}: both face the same way across the cut. Camera 3 crossed the line, and the audience loses who is looking at whom.`,
        points: [
          { id: "cont.side", text: r.crossed ? "Camera 3 is on the far side of the line between Bram and Pip (red on the plan): screen direction flips on the cut." : "All cameras sit on one side of the line between Bram and Pip (the 180° rule)." },
          { id: "cont.fix", text: "Fixes: keep the camera on the same side, cut through a neutral shot on the line, or show the camera crossing in a moving shot." },
        ],
      };
    }
    case "jl": {
      const e = jlEdit(s.jlLead);
      const cut = e[0].duration;
      const over = audibleEvents(e).filter((x) => x.overPicture);
      const lead = s.jlLead;
      return {
        headline: lead > 0.05 ? `J-cut: the reveal's sound starts ${lead.toFixed(1)} s before its picture. We hear ${over.find((x) => x.index === 1)?.label ?? "the next shot"} over Bram's face, so his fear now reads as a reaction to it.` : lead < -0.05 ? `L-cut: Bram's sound carries ${(-lead).toFixed(1)} s over the reveal${over.length ? ` (${over[0].label})` : ""}. His moment lingers as the new image arrives.` : "Straight cut: picture and sound change together. Clean, but the cut is felt as a hard edge.",
        points: [
          { id: "jl.picture", text: `The picture cut stays at ${cut.toFixed(1)} s. Only the sound edit moves (the coloured bars in the Sound lane).` },
          ...over.map((x, i) => ({ id: `jl.over${i}`, text: `${x.label} plays at ${x.rec.toFixed(2)} s, over the ${x.rec < cut ? "reaction" : "reveal"} shot's picture.` })),
        ],
      };
    }
    case "montage": {
      const c = compression(montageEdit(s.montage));
      return {
        headline: s.montage === "realtime" ? "Real time: all 60 seconds. Every step is there, and the audience feels every step." : `${c.story.toFixed(0)} s of story in ${c.screen.toFixed(0)} s of screen time: ${c.ratio.toFixed(1)}× compression. ${s.montage === "jump" ? "Jump cuts make time leap; the locked camera makes the lamps pop on like a rhythm." : "Dissolves blend each moment into the next: time passes gently, almost dreamily."}`,
        points: [
          { id: "mont.keep", text: "Montage keeps the beats that change the story (each lamp catching) and drops the walking in between." },
          { id: "mont.cue", text: "The dusk sky darkening across the shots tells the audience how much time has passed." },
        ],
      };
    }
    case "comedy": {
      const b = comedyBeats(s.comedy);
      const p = s.comedyPreset ? COMEDY_PRESETS[s.comedyPreset] : null;
      return {
        headline: p ? `${p.label}: ${p.note}` : `Custom timing: the step lands at ${b.step.toFixed(1)} s, the fall at ${b.fall.toFixed(1)} s, the reaction at ${b.reaction.toFixed(1)} s.`,
        points: [
          { id: "com.setup", text: `Setup ${s.comedy.setup.toFixed(1)} s of confident strut: the pride before the fall.` },
          { id: "com.ant", text: s.comedy.anticipation > 0.05 ? `Anticipation ${s.comedy.anticipation.toFixed(1)} s: we see the peel before Bram does. We know; he doesn't.` : "No anticipation: the peel is a surprise to us and to him." },
          { id: "com.hold", text: s.comedy.hold > 0.05 ? `Hold ${s.comedy.hold.toFixed(1)} s: frozen mid-slip, he looks at us. The pause is the joke.` : "No hold: the slip turns straight into the fall." },
          { id: "com.after", text: `Aftermath ${s.comedy.aftermath.toFixed(1)} s of stillness before his tiny embarrassed reaction.` },
          { id: "com.cutaway", text: "The fall itself happens on a cut-away (the peel spins past as we hear the landing): the cut hides what the rig can't do, and the sound sells it." },
        ],
      };
    }
    default: {
      const ex = playgroundExplanation(s);
      return { headline: ex.headline, points: ex.points as Point[], reads: ex.reads };
    }
  }
}

export const readsLabel = (id: EditPresetId) => `${PRESET_INFO[id].label}: ${PRESET_INFO[id].feel}`;
export const statsLine = (s: ERState) => stats(s.edit);
