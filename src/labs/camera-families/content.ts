import type { Step } from "./store";

export const THESIS = "The camera body decides how the image is captured. The lens, the light and the cinematography shape the look far more.";

export const STEP_COPY: Record<Step, { n: string; tab: string; title: string; lesson: string; tip: string }> = {
  sensor: {
    n: "1",
    tab: "Sensor",
    title: "Sensor format",
    lesson: "The sensor is the canvas the lens draws on. Through the same lens a bigger sensor sees more. To get the same picture it needs a longer lens, and that longer lens is where its shallower depth of field comes from.",
    tip: "Switch to Same framing, then pick ALEXA 35 and ALEXA 265. Bram stays the same size, but the focal length doubles.",
  },
  focal: {
    n: "2",
    tab: "Focal length",
    title: "Focal length",
    lesson: "From a fixed camera position, focal length only crops the picture: perspective comes from where the camera stands. The true field of view depends on focal length and sensor width together.",
    tip: "The same 35 mm lens is a normal lens on Super 35, a mild wide on full frame and a true wide on 65 mm.",
  },
  aperture: {
    n: "3",
    tab: "Aperture",
    title: "Aperture & depth of field",
    lesson: "The T-stop sets the aperture diameter (focal ÷ N). A wider aperture, closer focus, longer lens, or bigger sensor at the same framing all make the depth of field shallower.",
    tip: "Same framing and the same depth of field: Super 35 at T2 ≈ full frame at T2.8 ≈ 65 mm at about T4.",
  },
  shutter: {
    n: "4",
    tab: "Shutter",
    title: "Movement & shutter",
    lesson: "Shutter angle is the share of each frame the shutter stays open. 180° at 24 fps means 1/48 s, the motion blur audiences read as cinema. A narrow shutter strobes and a wide one smears.",
    tip: "Pick Fast pan and the rolling-shutter test, then compare ALEXA 35 (rolling) with V-RAPTOR [X] (global): watch the door frame lean.",
  },
  response: {
    n: "5",
    tab: "Response",
    title: "Image rendering",
    lesson: "Camera response is how scene brightness becomes picture values. The curve's shoulder decides whether the lamps and the window roll off gently or clip, and the colour decides how skin and night read.",
    tip: "Press Highlight test, then switch between Naturalistic and Doc. The lantern holds detail in one and clips to a flat blob in the other.",
  },
  blind: {
    n: "★",
    tab: "Blind test",
    title: "Blind test",
    lesson: "Three family presets on the same frame, with the labels hidden. Match each picture to its preset. The differences are subtle, much smaller than a change of lens or light.",
    tip: "Odd-numbered rounds (1, 3, 5…) use three digital-cinema looks. That's the realistic case, and it's hard.",
  },
};

export const APPROX_NOTE = "These looks are artistic approximations written for this lab. They are not any manufacturer's color science.";

export const KEYS: [string, string][] = [
  ["W / I / E", "Watch, Inspect, Experiment"],
  ["1 – 5", "Sensor, Focal, Aperture, Shutter, Response"],
  ["B", "Blind test"],
  ["F", "Same lens ↔ same framing"],
  ["Space", "Play / pause"],
  [", .", "Step one frame"],
  ["?", "This guide"],
];
