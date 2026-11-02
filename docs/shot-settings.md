# Shot settings export — `animation-lab.shot/1`

`Copy JSON` (⇧C) and `Export` (X) produce one JSON document describing the film camera. It exports the **settled** camera (the canonical state), not the eased in-between pose.

## Coordinate conventions

- World: three.js, right-handed, **+Y up**, **meters**. Cameras look down their local **−Z** with +Y up.
- Blender: location `(x, −z, y)` meters (Z up). Rotation: `M_blender = Rx(+90°) · M_three`, decomposed as three's `'ZYX'` Euler, which is Blender's `rotation_mode = 'XYZ'`. Lens in mm, `sensor_fit = 'HORIZONTAL'`, sensor 36 × 20.25 mm.
- Unreal: location `100 · (−z, x, y)` centimeters (Z up, left-handed, X forward). Rotator from the forward vector: `yaw = atan2(F.y, F.x)`, `pitch = atan2(F.z, |F.xy|)`, roll 0 (the lab camera never rolls). Filmback 36 × 20.25 mm; set `LensSettings` min/max before `CurrentFocalLength`.

## Fields

| Field | Meaning |
|---|---|
| `schemaVersion` | `"animation-lab.shot/1"` |
| `coordinateSystem` | the conventions above, including `blenderMap` and `unrealMap` |
| `frame` | aspect 16:9, nominal 1920 × 1080 |
| `sensor` | `fit: horizontal`, active gate 36 × 20.25 mm |
| `lens` | focal length, horizontal/vertical FOV, lens class |
| `camera` | mode (`fixed`/`match`), position, target, up, forward, quaternion `[x, y, z, w]`, yaw/pitch (degrees; yaw > 0 turns toward +X) |
| `clip` | near / far in meters |
| `framing.rig` | the lab's canonical rig: rail position `railS`, yaw, pitch |
| `subject` | target id (`primary`/`secondary`/`both`), name, anchor, distance from the lens |
| `derived` | distance to Bram along the rail, frame size at the subject, framing-box fraction, full-body fraction, perspective ratio k |
| `classification` | shot size, lens class, angle, perspective, movement (`static` in the MVP) |
| `prompt` | the shot-language line and its parts |
| `engines.blender` / `engines.unreal` | the converted camera, ready to paste |
| `animation` | time in the loop (s), loop duration, clip id, frame at 24 fps |

## Worked examples (from the unit tests)

| Camera | Blender | Unreal |
|---|---|---|
| Default: (−0.35, 1.47, 0), looking −Z, 50 mm | loc (−0.35, 0, 1.47), rot (90, 0, 0) | loc (0, −35, 147) cm, P 0 Y 0 R 0 |
| Yaw only, looking −X | rot (90, 0, 90) | yaw −90 |
| Pitch only, −10.39° | rot (79.61, 0, 0) | pitch −10.39 |
| Match 85 mm on Bram from the 92 % framing: (−0.35, 1.47, 0.56) | loc (−0.35, −0.56, 1.47) | loc (−56, −35, 147) cm |

## Shot language

Order: shot size → lens → angle → distance → perspective → movement. Seedance-style guidance: name the shot first and use one camera move per shot. The MVP always says "locked-off static shot". Future camera-path exports should say "zoom" only when the focal length changes over the shot, and "dolly/push" only when the position changes.

Example: `Medium close-up of Bram, 85 mm portrait telephoto, eye level, camera 3.6 m from Bram, natural perspective, locked-off static shot.`

Perspective words follow camera **position**: k = depth to the subject ÷ depth to the back wall (z −9). Deep < 0.18, compressed > 0.45. A lens change alone never changes the perspective word.
