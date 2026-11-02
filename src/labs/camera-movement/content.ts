import type { MoveKind } from "./engine/types";

/** What each move does, how it feels, and how to ask for it. One source for the concept card. */
export const MOVE_COPY: Record<MoveKind, { what: string; feel: string; prompt: string }> = {
  static: {
    what: "The camera does not move. All the energy comes from the performance and the cut.",
    feel: "Observational, composed, confident. Comedy timing loves a locked-off frame.",
    prompt: "Say \"locked-off static shot\". AI models drift; naming stillness keeps them honest.",
  },
  dollyIn: {
    what: "The whole camera travels toward the subject. The lens stays the same, so perspective changes as it goes.",
    feel: "Realization, intimacy, rising tension: the audience leans in with the camera.",
    prompt: "Say \"slow dolly in\", not \"zoom\". A dolly changes perspective; a zoom only crops.",
  },
  dollyOut: {
    what: "The camera travels away, revealing more of the world around the subject.",
    feel: "Isolation, an ending, or a reveal of where the character really is.",
    prompt: "\"Slow dolly out to reveal…\" tells the model what the new space should contain.",
  },
  zoomIn: {
    what: "The camera stays put and the focal length grows. It magnifies the centre of the picture; nothing moves relative to anything else.",
    feel: "Flat and noticeable: a documentary snap or a 70s crash zoom, never an invisible move.",
    prompt: "Use \"zoom\" only when you want the zoom look. Compare it with the dolly to see why.",
  },
  pan: {
    what: "The camera turns left or right on its tripod head. Its position doesn't change, so there is no parallax.",
    feel: "Following attention: from one thing to the next, or a reveal of what a character sees.",
    prompt: "Name the direction and what it lands on: \"slow pan right, landing on Bram\".",
  },
  tilt: {
    what: "The camera pivots up or down without moving. A tilt up a character makes them grow in stature.",
    feel: "Up: awe, scale, a reveal of height. Down: discovery, or diminishing the subject.",
    prompt: "\"Tilt up from his boots to his face\" gives the model a start and an end.",
  },
  truck: {
    what: "The camera slides sideways, keeping its orientation. Near things sweep past quickly, far things barely move: parallax.",
    feel: "Depth and dimensionality. The set becomes a place you're moving through.",
    prompt: "Say \"lateral tracking shot\" or \"truck left\", and name the foreground elements for parallax.",
  },
  crane: {
    what: "The camera rises (or sinks) while staying aimed at the subject, so the angle changes from low to high.",
    feel: "Rising: release, an ending, the world opening up. Sinking: arrival, grounding.",
    prompt: "\"Crane up and away from Bram to a high angle\" describes both the move and the result.",
  },
  orbit: {
    what: "The camera arcs around the subject at a constant distance, keeping it centred while the background spins behind.",
    feel: "Heroic, dizzying, a moment that matters. Animation uses it for reveals and transformations.",
    prompt: "\"Slow 90° orbit around Bram\". Give an angle; models over-rotate otherwise.",
  },
  tracking: {
    what: "The camera moves with a moving subject, holding them in frame while the world streams past.",
    feel: "Energy and momentum: we run with the character instead of watching them go by.",
    prompt: "\"Tracking shot, camera leading Pip as he runs toward us\". Say leading or following.",
  },
  dollyZoom: {
    what: "Dolly and zoom together in opposite directions. The subject keeps its size while the background swells or shrinks behind them.",
    feel: "Vertigo, dread, a world-shifting realization. It feels wrong on purpose.",
    prompt: "Ask for a \"dolly zoom (vertigo effect)\" and name which way the background should go.",
  },
};

export const DOLLY_VS_ZOOM = {
  title: "Dolly vs zoom",
  body: "Both monitors start and end with Bram the same size. The dolly moves the camera, so the doorway behind him grows only a little. The zoom only crops, so the doorway grows exactly as much as he does.",
  prompt: "Prompt \"dolly in\" when you want depth to change; \"zoom in\" when you want the flat, magnified look.",
};
