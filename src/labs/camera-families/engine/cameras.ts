import type { FormatId } from "./formats";
import type { LookId } from "./looks";

export type CameraGroup = "cinema" | "film" | "specialized";
export type Verification = "manufacturer" | "secondary" | "unverified";

export interface CameraSpec {
  id: string;
  name: string;
  maker: string;
  group: CameraGroup;
  /** The gate the shot is rendered through when this camera is selected. */
  format: FormatId;
  film?: boolean;
  /** Sensor (or film gate) active area, as published. */
  sensor: string;
  resolution: string;
  /** Manufacturer-claimed dynamic range, verbatim; null when not stated. */
  dr: string | null;
  maxFps: string;
  /** Highest full-sensor (or headline) frame rate, for the frame-rate warning. */
  maxFpsValue: number | null;
  shutter: string;
  use: string;
  /** The look preset suggested when the camera is picked (an artistic approximation). */
  look: LookId;
  verification: Verification;
  note?: string;
  sources: readonly { label: string; url: string }[];
  /** A lens the camera implies (the probe lens): applied when the card is picked. */
  lens?: { focalMm: number; tStop: number };
}

export const CAMERAS = [
  {
    id: "alexa35",
    name: "ALEXA 35 Xtreme",
    maker: "ARRI",
    group: "cinema",
    format: "alexa35",
    sensor: "27.99 × 19.22 mm · Super 35, 4.6K 3:2 Open Gate",
    resolution: "4608 × 3164",
    dr: "17 stops",
    maxFps: "120 fps at 4.6K Open Gate (ProRes/ARRICORE); 660 fps only in 2K/HD S16 Sensor Overdrive, where DR drops to 11 stops",
    maxFpsValue: 120,
    shutter: "Electronic 5°–356° (type not stated)",
    use: "Prestige drama, features, premium commercials",
    look: "naturalistic",
    verification: "manufacturer",
    note: "ARRI now lists the original ALEXA 35 as replaced by the Xtreme; same ALEV 4 sensor.",
    sources: [
      { label: "ARRI ALEXA 35 Xtreme", url: "https://www.arri.com/en/camera-systems/cameras/alexa-35-xtreme" },
      { label: "ARRI ALEXA 35", url: "https://www.arri.com/en/camera-systems/cameras/alexa-35" },
    ],
  },
  {
    id: "alexa265",
    name: "ALEXA 265",
    maker: "ARRI",
    group: "cinema",
    format: "alexa265",
    sensor: "54.12 × 25.58 mm · 65 mm, 6.5K 2.12:1 Open Gate",
    resolution: "6560 × 3100",
    dr: "15 stops",
    maxFps: "60 fps in every mode (ARRIRAW only)",
    maxFpsValue: 60,
    shutter: "Electronic 5°–358° (type not stated)",
    use: "Premium large-format theatrical features",
    look: "large-format",
    verification: "manufacturer",
    sources: [{ label: "ARRI Rental ALEXA 265", url: "https://www.arrirental.com/en/cameras/digital-65-mm-cameras/alexa-265" }],
  },
  {
    id: "venice2",
    name: "VENICE 2 (8.6K)",
    maker: "Sony",
    group: "cinema",
    format: "venice",
    sensor: "35.9 × 24.0 mm · full frame 8.6K 3:2 (a 6K sensor block is also offered)",
    resolution: "8640 × 5760 (6K block: 6048 × 4032)",
    dr: "16 stops (6K block: 15+ stops)",
    maxFps: "30 fps at 8.6K 3:2, 60 fps at 8.2K 17:9, 120 fps at 5.5K S35 2.39:1",
    maxFpsValue: 60,
    shutter: "Not stated",
    use: "Features, high-end TV, low light, virtual production; dual base ISO 800 / 3200 (6K: 500 / 2500)",
    look: "naturalistic",
    verification: "manufacturer",
    note: "Sony's site blocked automated reading; figures are from Sony's VENICE 2 recording-formats sheet (April 2023). Later firmware may add modes.",
    sources: [
      { label: "Sony VENICE 2 Recording Formats (PDF)", url: "https://77snszqv.media.zestyio.com/Sony_VENICE2_RecordingFormats.pdf" },
      { label: "Sony Cinematography: VENICE 2 dual base ISO", url: "https://sony-cinematography.com/articles/venice-2-dive-into-features-dual-base-iso/" },
    ],
  },
  {
    id: "vraptorx",
    name: "V-RAPTOR [X] 8K VV",
    maker: "RED",
    group: "cinema",
    format: "vv",
    sensor: "40.96 × 21.60 mm · 35.4 MP VV global-shutter CMOS",
    resolution: "8192 × 4320",
    dr: "17+ stops",
    maxFps: "120 fps at 8K 17:9, 240 fps at 4K, 600 fps at 2K 2.4:1",
    maxFpsValue: 120,
    shutter: "Global",
    use: "Action, VFX plates, commercials, compact rigs",
    look: "clean-hires",
    verification: "manufacturer",
    note: "Super 35 is a crop mode on this sensor; RED's separate S35 V-RAPTOR is rolling shutter.",
    sources: [
      { label: "RED V-RAPTOR [X] 8K VV tech specs", url: "https://docs.red.com/955-0225/955-0225_V1.7+Rev-B+RED+PS,+V-RAPTOR+%5BX%5D+8K+VV+Operation+Guide+HTML/Content/B_TechSpecs/Specs_V-RAPTOR%20[X].htm" },
      { label: "RED camera comparison (CSV)", url: "https://www.reddigitalcinema.com/data-exports/camera-compare-specs-2025Q1.csv" },
    ],
  },
  {
    id: "ursacine12k",
    name: "URSA Cine 12K LF",
    maker: "Blackmagic Design",
    group: "cinema",
    format: "ursa-lf",
    sensor: "35.64 × 23.32 mm · \"Large Format\" RGBW",
    resolution: "12,288 × 8040 (12K 3:2 open gate)",
    dr: "16 stops",
    maxFps: "80 fps at 12K open gate, 100 fps at 12K 17:9, 224 fps at 8K/4K 2.4:1",
    maxFpsValue: 80,
    shutter: "Not stated",
    use: "Indie features, VFX pipelines, Blackmagic RAW / Resolve workflows",
    look: "clean-hires",
    verification: "manufacturer",
    sources: [{ label: "Blackmagic URSA Cine tech specs", url: "https://www.blackmagicdesign.com/products/blackmagicursacine/techspecs/W-CIN-01" }],
  },
  {
    id: "c400",
    name: "EOS C400",
    maker: "Canon",
    group: "cinema",
    format: "ff",
    sensor: "Full-frame CMOS · active area in mm not published (drawn as nominal 36 × 24)",
    resolution: "6000 × 4000 (RAW 6K 3:2)",
    dr: "16 stops (Canon Log 2, ISO 800)",
    maxFps: "60 fps at 6K full frame, 120 fps at 4K crop",
    maxFpsValue: 60,
    shutter: "Not stated",
    use: "Documentary, indie, small crews, commercials; Dual Pixel AF, triple base ISO 800 / 3200 / 12800",
    look: "doc",
    verification: "manufacturer",
    note: "Canon UK gives 33.8 × 19.0 mm only for the UHD crop; the full sensor size could not be verified.",
    sources: [{ label: "Canon Japan EOS C400 specifications", url: "https://canon.jp/biz/product/camera/pro-imaging/cinema-eos/lineup/ces-camera/c400/spec" }],
  },
  {
    id: "film35",
    name: "35 mm film (Super 35)",
    maker: "ARRIFLEX / Panavision",
    group: "film",
    format: "s35-3perf",
    film: true,
    sensor: "24.89 × 13.87 mm 3-perf · 24.89 × 18.66 mm 4-perf full aperture",
    resolution: "Photochemical; typically scanned at 4K",
    dr: null,
    maxFps: "Camera-dependent (typically up to 150 fps on high-speed bodies)",
    maxFpsValue: null,
    shutter: "Rotary mirror shutter (adjustable on most cine bodies)",
    use: "Organic grain and texture; period and auteur features",
    look: "film35",
    verification: "secondary",
    note: "Gate figures are the conventional ASC values; Kodak rounds them to 24.90 × 13.90 / 18.70 mm. No DR figure: negative latitude depends on the stock.",
    sources: [
      { label: "Kodak film format choices (PDF)", url: "https://www.kodak.com/content/products-brochures/Film/Film-Format-Choices-Infographic.pdf" },
    ],
  },
  {
    id: "film65",
    name: "65 mm / IMAX film",
    maker: "Panavision / IMAX",
    group: "film",
    format: "65-5perf",
    film: true,
    sensor: "52.48 × 23.01 mm 5-perf 65 · IMAX 15/70: 70.41 × 51.61 mm",
    resolution: "Photochemical; scanned at 6K–12K+",
    dr: null,
    maxFps: "Camera-dependent",
    maxFpsValue: null,
    shutter: "Rotary shutter",
    use: "Epic scale and detail for giant screens",
    look: "film65",
    verification: "secondary",
    note: "65 mm width varies by reference (52.15 mm Kodak, 52.48 mm conventional). IMAX height: SMPTE ST 417 gives 51.61 mm; other sources say 52.63 mm. Pick the IMAX gate in the diagram to compare.",
    sources: [
      { label: "Kodak film format choices (PDF)", url: "https://www.kodak.com/content/products-brochures/Film/Film-Format-Choices-Infographic.pdf" },
      { label: "SMPTE ST 417 (IMAX 15/70 aperture)", url: "https://pub.smpte.org/latest/st417/st0417-2005_stable2015.pdf" },
    ],
  },
  {
    id: "phantom",
    name: "Phantom Flex4K",
    maker: "Vision Research",
    group: "specialized",
    format: "phantom",
    sensor: "27.6 × 15.5 mm · Super 35-sized",
    resolution: "4096 × 2304",
    dr: null,
    maxFps: "938 fps at full 4K, about 1,970 fps at 2K",
    maxFpsValue: 938,
    shutter: "Rolling (Flex4K); the Flex4K-GS and VEO4K add a global mode",
    use: "Extreme slow motion: impacts, liquids, explosions",
    look: "action",
    verification: "manufacturer",
    note: "Phantom's site blocked direct reading; specs come from Phantom product pages and datasheets via search. The VEO4K-PL datasheet claims 9 stops (global) / 12 stops (rolling).",
    sources: [
      { label: "Phantom Flex4K", url: "https://www.phantomhighspeed.com/products/cameras/4kmedia/flex4k" },
      { label: "Flex4K datasheet (PDF)", url: "https://www.phantomhighspeed.com/-/media/project/ameteksxa/visionresearch/documents/datasheets/web/wdsflex4k.pdf" },
    ],
  },
  {
    id: "gopro",
    name: "GoPro HERO13 Black",
    maker: "GoPro",
    group: "specialized",
    format: "action",
    sensor: "1/1.9-inch type (retailer figure; nominal ~6.7 × 5.0 mm)",
    resolution: "5568 × 4872 (27 MP 8:7)",
    dr: null,
    maxFps: "5.3K60, 4K120, 1080p240",
    maxFpsValue: 120,
    shutter: "Not stated",
    use: "POV, crashes, extreme sports, tight spaces",
    look: "action",
    verification: "secondary",
    note: "GoPro claims no DR for HERO13 (just 10-bit HLG). The newer MISSION 1 Pro (2026) has a 1-inch sensor, 8K60 and claims up to 14 stops in GP-Log2.",
    sources: [
      { label: "B&H: GoPro HERO13 Black", url: "https://www.bhphotovideo.com/c/product/1846709-REG/gopro_chdhx_131_th_hero13_black.html" },
      { label: "GoPro MISSION 1 Pro", url: "https://gopro.com/en/us/shop/learn-cameras/mission-1-pro-ils" },
    ],
  },
  {
    id: "inspire3",
    name: "DJI Inspire 3 · X9-8K Air",
    maker: "DJI",
    group: "specialized",
    format: "ff",
    sensor: "\"35mm full-frame CMOS\" · mm not published (drawn as nominal 36 × 24)",
    resolution: "8192 × 4320 video",
    dr: "14+ stops",
    maxFps: "8K 25 fps CinemaDNG, 8K 75 fps ProRes RAW (2.4:1), 4K 120 fps",
    maxFpsValue: 75,
    shutter: "Electronic (type not stated)",
    use: "Aerial establishing shots and drone cinematography",
    look: "clean-hires",
    verification: "manufacturer",
    sources: [
      { label: "DJI Inspire 3 specs", url: "https://www.dji.com/inspire-3/specs" },
      { label: "DJI Inspire 3 FAQ", url: "https://www.dji.com/inspire-3/faq" },
    ],
  },
  {
    id: "fx6",
    name: "Sony FX6",
    maker: "Sony",
    group: "specialized",
    format: "ff",
    sensor: "Full frame, 10.2 MP effective (mm not verified; drawn as nominal 36 × 24)",
    resolution: "3840 × 2160 UHD / 4096 × 2160 DCI",
    dr: "15+ stops (S-Log3)",
    maxFps: "UHD 120 fps (~5 % crop), DCI 4K 60 fps, FHD 240 fps",
    maxFpsValue: 120,
    shutter: "Not stated",
    use: "Documentary, ENG, interviews, run-and-gun; dual base ISO 800 / 12800",
    look: "doc",
    verification: "secondary",
    note: "Sony's site blocked automated reading; figures are Sony launch material as reported by Film and Digital Times.",
    sources: [{ label: "FDTimes: Sony FX6 launch", url: "https://www.fdtimes.com/2020/11/17/sony-fx6-full-frame-4k-cine-camera/" }],
  },
  {
    id: "insta360pro2",
    name: "Insta360 Pro 2",
    maker: "Insta360",
    group: "specialized",
    format: "small-360",
    sensor: "Six sensors behind 200° F2.4 fisheyes; 1/2.3-inch type per retailer",
    resolution: "7680 × 7680 (8K 3D) / 7680 × 3840 (8K 2D)",
    dr: null,
    maxFps: "8K 3D 30 fps, 8K 2D 60 fps, 4K 120 fps",
    maxFpsValue: 60,
    shutter: "Not stated",
    use: "360° / VR capture, immersive environments",
    look: "doc",
    verification: "manufacturer",
    note: "The lab renders a flat view through one lens's sensor size; the real output is a stitched sphere.",
    sources: [{ label: "Insta360 Pro 2 online manual: specification", url: "https://onlinemanual.insta360.com/pro2/en-us/compare/specification" }],
  },
  {
    id: "probe",
    name: "Probe lens (Laowa 24mm f/14 2× Macro Probe)",
    maker: "Venus Optics (Laowa)",
    group: "specialized",
    format: "ff",
    sensor: "A lens, not a camera: covers full frame and Super 35 on a host body",
    resolution: "Host camera's",
    dr: null,
    maxFps: "Host camera's",
    maxFpsValue: null,
    shutter: "Host camera's",
    use: "Bug's-eye macro, inside miniatures, unusual perspectives; 24 mm, f/14, 2× magnification, 408 mm long tube",
    look: "naturalistic",
    lens: { focalMm: 24, tStop: 14 },
    verification: "manufacturer",
    note: "Pick it and the lab sets 24 mm at T14 on a full-frame host. Real probe lenses lose about a stop to transmission.",
    sources: [{ label: "Laowa 24mm f/14 2× Macro Probe", url: "https://www.venuslens.net/product/laowa-24mm-f-14-2x-macro-probe/" }],
  },
] as const satisfies readonly CameraSpec[];

export type CameraId = (typeof CAMERAS)[number]["id"];
export const DEFAULT_CAMERA: CameraId = "alexa35";
export const isCameraId = (v: unknown): v is CameraId => typeof v === "string" && CAMERAS.some((c) => c.id === v);
export const getCamera = (id: CameraId): CameraSpec => CAMERAS.find((c) => c.id === id) ?? CAMERAS[0];
export const camerasIn = (g: CameraGroup): CameraSpec[] => CAMERAS.filter((c) => c.group === g);
