# Research

Study of existing skin editors and libraries, done on 2026-11-12 before implementation. The reference
projects were read as source code on their default branches; none of them was run, so statements about
their behaviour come from the code, not from observation. Dependency versions are the declared ranges.

## Reference projects

| Project        | Licence          | Version | Last commit seen | three.js     | Plugin runtime               |
| -------------- | ---------------- | ------- | ---------------- | ------------ | ---------------------------- |
| Blockbench     | GPL-3.0-or-later | 5.2.2   | 2026-10-18       | `^0.129`     | yes, same realm, unsandboxed |
| MC Skin Editor | Apache-2.0       | 1.4.0   | 2026-11-10       | `^0.186`     | none                         |
| Skin Anvil     | MIT              | –       | 2026-07-22       | `0.156.1`    | none                         |
| skinview3d     | MIT              | 3.4.2   | 2026-05-02       | `^0.156`     | none                         |
| Skinforge      | AGPL-3.0-only    | 1.3.0   | 2026-09-10       | r128 via CDN | yes, same realm, unsandboxed |

All five are under active or recent development. Two are copyleft, so their code may be studied but not
copied into this MIT project.

### Blockbench – GPL-3.0-or-later, active

- three.js `^0.129`, Vue 2, Electron ([package.json](https://github.com/JannisX11/blockbench/blob/master/package.json)).
- **Painting:** [`Preview.raycast`](https://github.com/JannisX11/blockbench/blob/master/js/preview/preview.ts#L560-L700)
  raycasts visible meshes; [`Painter.getCanvasToolPixelCoords`](https://github.com/JannisX11/blockbench/blob/master/js/texturing/painter.js#L1684-L1693)
  converts UV to pixels. Transparent pixels are skipped only for the eyedropper or with specific options.
- **Skin geometry:** [`skin_presets`](https://github.com/JannisX11/blockbench/blob/master/js/formats/minecraft/skin.ts#L862-L1060):
  4/3-pixel arms, overlay inflation 0.5 for the head and 0.25 elsewhere.
- **Textures:** nearest filtering, custom shader discarding alpha below 0.01
  ([textures.js](https://github.com/JannisX11/blockbench/blob/master/js/texturing/textures.js#L71-L95)).
- **Undo:** [`UndoSystem`](https://github.com/JannisX11/blockbench/blob/master/js/undo.js#L17-L70) stores
  before/after snapshots of the affected aspects, including bitmap copies.
- **Plugins:** [`plugin_loader.ts`](https://github.com/JannisX11/blockbench/blob/master/js/plugin_loader.ts#L776-L825)
  runs plugin scripts with `new Function` in the renderer realm with access to application globals. Native
  modules are permission gated ([native_apis.ts](https://github.com/JannisX11/blockbench/blob/master/js/native_apis.ts#L98-L215)),
  but the [desktop window](https://github.com/JannisX11/blockbench/blob/master/electron/main.js#L74-L84)
  enables Node integration without context isolation. It is an extension system, not a sandbox.
- **Takeaway:** the best reference for workflow and tool design. Too broad and tightly coupled to reuse, and
  GPL code cannot be copied into an MIT project.

### MC Skin Editor – Apache-2.0, active

- Svelte 5, three.js `^0.186`, Vite 8.
- **Painting:** [`raycastPixel.ts`](https://github.com/eheikes/mc-skin-editor/blob/main/src/lib/three/raycastPixel.ts)
  takes the first intersected mesh and floors the UV. No alpha check, so empty outer pixels block the ray.
- **Geometry:** explicit face rectangles in [`uv.ts`](https://github.com/eheikes/mc-skin-editor/blob/main/src/lib/skin/uv.ts);
  [`layout.ts`](https://github.com/eheikes/mc-skin-editor/blob/main/src/lib/skin/layout.ts) inflates every
  overlay by 0.5, which differs from the game for body and limbs.
- **Rendering:** unlit `MeshBasicMaterial`, nearest, sRGB, `alphaTest` 0.05
  ([buildSkinModel.ts](https://github.com/eheikes/mc-skin-editor/blob/main/src/lib/three/buildSkinModel.ts#L184-L206)).
- **Undo:** up to 50 full snapshots ([history.ts](https://github.com/eheikes/mc-skin-editor/blob/main/src/lib/stores/history.ts));
  tools are a fixed switch that mutates the store. PNG I/O goes through canvas.
- **Takeaway:** a clean separation of atlas data from rendering that we followed. We replaced store
  mutation with commands and canvas I/O with a lossless codec.

### Skin Anvil – MIT

- React 18, three.js 0.156, built on skinview3d.
- **Painting:** [`PaintViewport3D`](https://github.com/spencerfrost/skin-anvil/blob/master/client/src/components/SkinEditor/PaintViewport3D.jsx#L38-L74)
  raycasts the skinview3d meshes, filters by an active layer and rejects back-facing overlay hits. Alpha is
  ignored on purpose so empty overlay pixels can be painted.
- **Undo:** 64 full-frame snapshots; fixed tools; data-URL export
  ([useSkinEditor.js](https://github.com/spencerfrost/skin-anvil/blob/master/client/src/hooks/useSkinEditor.js)).
- **Takeaway:** shows that painting on top of a viewer works, and that double-sided shells need care with
  back faces. The viewer coupling is what we wanted to avoid.

### skinview3d – MIT, maintained

- three.js `^0.156`. A viewer: no painting, history or plugins.
- **Geometry:** [`model.ts`](https://github.com/bs-community/skinview3d/blob/master/src/model.ts#L123-L260).
  UV origins (base / outer): head 0,0 / 32,0; body 16,16 / 16,32; right arm 40,16 / 40,32; left arm
  32,48 / 48,48; right leg 0,16 / 0,32; left leg 16,48 / 0,48. Outer boxes are 9×9×9 for the head and
  +0.5 in each dimension for the rest. [`setUVs`](https://github.com/bs-community/skinview3d/blob/master/src/model.ts#L15-L63)
  defines the per-face rectangles, including the flipped bottom face. Our table matches these values.
- **Materials:** `MeshStandardMaterial`; base front-sided and opaque; outer double-sided, transparent,
  `alphaTest` 1e-5.
- **Viewer:** owns renderer, FXAA composer, controls and lights and disables colour management globally
  ([viewer.ts](https://github.com/bs-community/skinview3d/blob/master/src/viewer.ts#L337-L400)).
- **Takeaway:** the authoritative open reference for geometry. As a dependency it would constrain the
  studio pipeline and the three.js version.

### Skinforge – AGPL-3.0-only

- Electron 33, three.js r128 from a CDN, a single large [`index.html`](https://github.com/Nuccleusbee/skinforge/blob/main/app/index.html).
- **Painting:** software-projected per-texel quads with point-in-quad picking, plus a three.js picker.
- **History:** labelled snapshots that share unchanged layer buffers; localStorage autosave.
- **Plugins:** [API 1.0](https://github.com/Nuccleusbee/skinforge/blob/main/app/index.html#L1959-L2011)
  registers tools, panels and actions; code runs through `new Function` without isolation, and disabling a
  plugin reloads the editor.
- **Takeaway:** good ideas (layered history, extension UX) in a monolith we should not copy, both for
  maintainability and for licence reasons.

## Comparison

| Topic               | Common practice                        | What we do                                                 |
| ------------------- | -------------------------------------- | ---------------------------------------------------------- |
| UV to pixel         | floor(uv × 64) from a mesh raycast     | analytic ray/quad hit, clamped to the face                 |
| Transparent overlay | always blocks, or layer must be hidden | rays pass through in `auto`; explicit `base`/`outer` modes |
| Undo                | bitmap snapshots (50–64 steps)         | sparse diff commands, strokes merged, 300 steps            |
| Tools               | fixed switch or global `new Tool`      | registry of data-described tools with a narrow context     |
| PNG I/O             | canvas                                 | pure codec, exact round-trip                               |
| Lighting            | unlit or one ambient + one point light | preset-driven three-point rig, shadows, AO, environment    |
| Plugins             | same-realm scripts with full access    | versioned API, permissions, disposable registrations       |

## Rendering with three.js r187

- Colour management: `outputColorSpace` sRGB and sRGB textures; the old `encoding` API is gone
  ([migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)).
- Light units changed in r155: values that looked right before need to be multiplied by π
  ([announcement](https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733)).
- `PCFSoftShadowMap` is removed in r187 and falls back to `PCFShadowMap`, which now filters with a Vogel
  disk scaled by `shadow.radius` ([WebGLShadowMap.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl/WebGLShadowMap.js)).
  The shadow pass copies `map` and `alphaTest`, so cut-out overlays cast correct shadows.
- Ambient occlusion: `GTAOPass`, `SAOPass` and `SSAOPass` render normals with an override material and
  therefore ignore cut-outs ([GTAOPass](https://threejs.org/docs/pages/GTAOPass.html)). `postprocessing`
  (Zlib) and `n8ao` are alternatives; `n8ao` states ISC on npm and CC0 in its repository. The research
  advice was to ship without AO until it had been checked against transparent overlays. We checked it on
  the starter skin, whose head, body and arms have partly transparent outer layers, saw no visible
  artefacts in the three presets, and kept it behind a switch with the limitation documented.
- `EffectComposer` needs a render target with `samples` for MSAA, and `OutputPass` applies tone mapping
  and the output colour space ([OutputPass](https://threejs.org/docs/pages/OutputPass.html)).
- `RoomEnvironment` with `PMREMGenerator` gives image-based light without shipping HDR files.
- Tone mapping: Khronos Neutral was designed to preserve base colour
  ([PR 27668](https://github.com/mrdoob/three.js/pull/27668)), but in our scene it darkened low values too
  much. This was observed, see decision 8.
- PNG export without `preserveDrawingBuffer`: render and call `toBlob` in the same task
  ([tips](https://threejs.org/manual/pages/tips.html)).
- Headless Chromium has no GPU; software WebGL needs `--use-angle=swiftshader --enable-unsafe-swiftshader`
  ([SwiftShader notes](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md)).
  Observed: WebGL2 works this way in the cloud preview and in our Playwright runs.

## Electron

- Electron 45 is current. `BrowserView` is deprecated; `WebContentsView` is the supported way to embed
  third-party pages, and `<webview>` is discouraged
  ([web embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds)).
- For untrusted content: context isolation, sandbox, no Node integration, a separate session partition,
  permission handlers that deny by default, `setWindowOpenHandler`, navigation checks, IPC sender validation
  and explicit `will-download` handling ([security checklist](https://www.electronjs.org/docs/latest/tutorial/security)).
- `electron-vite` and `vite-plugin-electron` are both maintained; we need neither (decision 12).

## Plugin isolation options

- Figma runs plugin logic in a restricted sandbox and plugin UI in an iframe, connected by messages
  ([how plugins run](https://developers.figma.com/docs/plugins/how-plugins-run/)).
- A sandboxed iframe without `allow-same-origin` is the practical browser boundary. Workers give
  termination but share the origin's network and storage. QuickJS in WebAssembly restricts capabilities but
  needs resource limits. ShadowRealm is not a security boundary.
- Consequence for us: keep the API data-only and message-friendly now, ship trusted bundled plugins only,
  and add the iframe runtime later.

## Minecraft skin format

- 64×64 PNG; classic arms 4 px wide, slim 3 px; each part has a base and an outer layer; the game ignores
  alpha on the base layer ([Minecraft Wiki](https://minecraft.wiki/w/Skin)).
- Classic uses 3264 of 4096 texels, slim 3136. Unused texels must survive a round-trip.
- Legacy 64×32 skins contain only right limbs and a head overlay; conversion mirrors them to the left side
  and repairs head overlays that were saved fully opaque
  ([skinview-utils](https://github.com/bs-community/skinview-utils/blob/master/src/process.ts)). MC Skin
  Editor instead mirrors at render time without converting the atlas.

## Limits other editors place on third-party plugins

- Blockbench and Skinforge both run plugin code with `new Function` inside the application's own realm.
  A plugin can reach every global, so their permission prompts are advisory, not enforced.
- Blockbench gates native modules and file access per plugin, but its window still runs with Node
  integration and without context isolation.
- Skinforge cannot unload a plugin; disabling one reloads the editor.
- MC Skin Editor, Skin Anvil and skinview3d have no plugin runtime at all.

What we took from this: registrations must be disposable so a plugin can be switched off live, permissions
must be checked by the host on every call, and untrusted code must wait for a real isolation boundary.

## Reuse versus build

Reused: three.js with its OrbitControls, post-processing passes and RoomEnvironment; fast-png; Radix
primitives; lucide icons; zustand. Written here: document, commands, layout table, picking, tools,
registries, plugin host, lighting presets and the UI.

## Our dependencies

Versions and licences as published on npm on 2026-11-12.

| Package                            | Version    | Licence    | Note                                                          |
| ---------------------------------- | ---------- | ---------- | ------------------------------------------------------------- |
| three                              | 0.187.0    | MIT        | current release, includes the post-processing passes          |
| react, react-dom                   | 19.3       | MIT        |                                                               |
| zustand                            | 5.1        | MIT        |                                                               |
| radix-ui                           | 1.8        | MIT        | unstyled primitives, styled with Tailwind                     |
| lucide-react                       | 1.72       | ISC        |                                                               |
| fast-png                           | 8.0.0      | MIT        | last published 2025-12; palette encoder quirk, see decision 5 |
| clsx                               | 2.1        | MIT        |                                                               |
| @fontsource-variable/inter         | 5.3        | OFL-1.1    | font files only                                               |
| electron (dev)                     | 45.3       | MIT        | downloads its binary on first use, no install script          |
| vite, vitest, tailwindcss (dev)    | 8 / 5 / 4  | MIT        |                                                               |
| typescript, @playwright/test (dev) | 6.0 / 1.65 | Apache-2.0 | TypeScript held at 6.0 for `typescript-eslint`                |

Considered and not adopted: `skinview3d` (decision 1), `n8ao` (decision 9), `postprocessing` (Zlib; its
peer range stops below three 0.188, and the built-in passes were enough), `electron-vite` and
`vite-plugin-electron` (decision 12).
