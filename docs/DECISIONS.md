# Decisions

Short records of choices that are not obvious from the code. Add an entry when you make another one.

### 1. Own geometry and picking instead of skinview3d

skinview3d (MIT) has correct geometry and animations but owns its renderer, composer and lights, pins an
older three.js, and offers no editing. We need full control of the pipeline for Studio mode and exact texel
picking. The box table is about 100 lines, so we wrote it and cross-checked the UV origins and inflation
values against skinview3d's `model.ts`.

### 2. Analytic picking in `core`, not `THREE.Raycaster` on meshes

72 quads are intersected directly. Hits are clamped to their face, so a stroke can never land in a
neighbouring UV island, and the logic is unit tested in Node without WebGL.

### 3. The document buffer is the PNG

A flat 64×64 RGBA buffer is the single source of truth and is exported byte for byte. Future editing layers
must composite into this buffer rather than replace it, which keeps the export format independent of
internal features.

### 4. Commands with merge keys instead of snapshots or transactions

Blockbench, MC Skin Editor and Skin Anvil store before/after bitmaps. Sparse pixel diffs are smaller and
give plugins and future AI tools one uniform, auditable entry point. Live strokes execute a command per
pointer event and the history merges those sharing a stroke key, so there is no separate transaction API.

### 5. `fast-png` instead of canvas for PNG I/O

Canvas 2D premultiplies alpha, which changes RGB values of semi-transparent pixels on the way in and out.
A pure codec gives exact round-trips, works in Node tests and behaves the same in Electron. Its palette
_encoder_ misplaces alpha when opaque entries precede transparent ones; we only use its decoder for
palettes and always write RGBA8.

### 6. Rays pass through transparent outer pixels by default

Other editors either make the outer shell always paintable or require hiding it. `auto` paints what is
visible; `base` and `outer` are explicit overrides in tool settings. The layer is locked per stroke.

### 7. One render pipeline, modes as data

Edit and Studio differ only in a `LightingPreset` and field of view. This makes the F9 transition a tween,
guarantees identical model and texture, and lets plugins add presets without renderer code.

### 8. Linear tone mapping for studio presets

Khronos Neutral, ACES and AgX all change dark skin colours visibly (Neutral crushed the starter skin's
navy trousers and the graphite backdrop). The product rule is that lighting improves but pixels are not
repainted, so presets use linear tone mapping with lights balanced to about 1.0× albedo on lit faces.

### 9. Built-in `GTAOPass` for ambient occlusion

It ships with three.js, so it always matches the installed version. `n8ao` handles cut-outs better but has
an unresolved licence statement (ISC on npm, CC0 in the repository) and unverified r187 support. The known
cost is documented in `PROJECT.md`; empty outer shells are hidden to limit it.

### 10. Empty base pixels render as a dark checker

Minecraft ignores base-layer alpha. Drawing holes would make a blank skin invisible and unpaintable;
drawing black would hide what is empty. A subtle checker keeps the model solid and the state readable.

### 11. Declarative plugin surfaces

Tools name an icon, panels list fields, presets are objects. Nothing in the contract requires passing React
components or three.js objects, so the same API can later be served over `postMessage` to a sandboxed
iframe or worker.

### 12. Plain Electron scripts instead of electron-vite or a Vite plugin

The renderer is the unmodified web build. The main and preload files are two small `.cts` files compiled by
`tsc`; `scripts/desktop-dev.mjs` starts Vite and Electron together. No extra build tool to maintain.

### 13. Web saves by download

The File System Access API cannot be automated in tests and is Chromium only. A file input and a download
work everywhere, including the cloud preview. The desktop adapter provides real save-in-place.

### 14. TypeScript 6.0, not 7

`typescript-eslint` 8.72 supports TypeScript below 6.1. Move to 7 when the linter does.

### 15. Self-hosted Inter font

Bundled through `@fontsource-variable/inter` so the UI looks the same on every OS and offline, with no
third-party font request.

### 16. Blockbench-style workspace, written from scratch

The layout, panel names (UV, Textures, Outliner, Color), flat blue-grey theme and floor grid follow
Blockbench because skin artists already know where things are there. Only the arrangement and palette are
modelled on it; no Blockbench code, icons or fonts are used, since it is GPL and this project is MIT. Icons
stay lucide and the font stays Inter. The floor grid is an editing aid: it belongs to the editor look
only, fades out in Studio mode and is never part of an exported render.
