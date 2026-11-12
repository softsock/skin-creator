# Minecraft Skin Studio – Project

## Vision

A modern studio for creating, editing and presenting Minecraft Java skins: a precise 2D/3D pixel editor
plus a **Studio Render** mode that lights the unchanged blocky model like a product shot. Priorities, in
order: frontend quality, a dependable editor, the studio renderer, extensibility, maintainability.

## Scope of the MVP (implemented)

- 64×64 Java skins, classic and slim arms, base and outer layers, transparency.
- Import and export of PNG with exact pixel round-trip (all PNG colour types are read, RGBA8 is written).
- Pencil, eraser, colour picker and fill; brush size; HSV picker, palette, recent colours.
- Painting directly on the 3D model and in a 2D texture view, both driven by one Skin Document.
- Undo/redo for every change, one step per stroke.
- Body part and layer visibility, 3D / split / 2D views, orbit, pan and zoom.
- Blockbench-style workspace: menu bar, mode selector, docked UV, Textures, Color and Outliner panels,
  toolbar with tool options above the viewport, floor grid in the editor.
- Studio mode (F9): three lighting presets, soft shadows, ambient occlusion, backdrops, adjustable field of
  view, PNG export at 1×/2×/4× with optional transparent background.
- Extension registries for tools, panels, actions, shortcuts and lighting presets, a versioned plugin API
  with permissions, and one bundled example extension (Shading tools).
- Electron shell with a sandboxed renderer and native open/save dialogs.

## User workflows

1. **Edit** – open or drop a PNG (or start from the starter character), pick a tool and colour, paint on the
   model or the texture, toggle layers, undo freely.
2. **Present** – press F9, pick a lighting preset and backdrop, frame the camera, export a render.
3. **Ship** – Save (Ctrl+S) or Export skin PNG (Ctrl+Shift+S) and upload the file to minecraft.net.

## Known limitations

- Legacy 64×32 skins are rejected with a clear message; conversion is on the roadmap.
- Semi-transparent outer pixels are preserved in the file and blended in the viewport, but several
  overlapping translucent shells may sort incorrectly. Base-layer alpha is ignored when rendering, as in
  the game; empty base pixels are drawn as a dark checker so they stay visible.
- Ambient occlusion is computed from solid geometry, so it treats partly transparent outer shells as
  solid. Fully empty shells are skipped. With a transparent background only the shadow, not the occlusion,
  is kept on the invisible floor.
- Switching between classic and slim does not move arm pixels.
- The web build saves by downloading; overwriting the opened file works only in the desktop shell.
- No session autosave yet.
- The Browser tab is a placeholder in every build.
- Plugins are trusted, bundled code. There is no sandbox for third-party code yet.

### What was and was not verified

Verified in a headless cloud browser with software WebGL (SwiftShader): the whole editor, Studio mode and
both exports, through Playwright and manual screenshots. Verified headlessly: the Electron shell boots in
development and production mode and exposes the preload bridge (`pnpm desktop:smoke`).

Not verified: rendering on real GPUs and at high pixel ratios, frame rate, native open/save dialogs, and
anything on Windows or macOS. To check locally on Windows:

```powershell
pnpm install
pnpm check
pnpm test:e2e      # run `pnpm exec playwright install chromium` once beforehand
pnpm desktop       # then try File → Open PNG, Save, Export
```

## Non-goals

- Scraping NameMC or any other service.
- Bedrock skins, HD skins, capes and custom models.
- Repainting or upscaling the skin in Studio mode: lighting changes, pixels do not.
- Blender or other offline renderers and LLM APIs in the MVP.

Architecture, decisions and future plans live in [docs/](docs).
