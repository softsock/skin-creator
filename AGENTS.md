# Agent guide

Minecraft Skin Studio is a TypeScript + React + Three.js skin editor that runs in the browser and in
Electron. Read this file first; go to `docs/ARCHITECTURE.md` when you need to know how something works and
to `docs/DECISIONS.md` before changing how something is built.

## Commands

| Task                                         | Command                |
| -------------------------------------------- | ---------------------- |
| Web dev server (also the cloud preview)      | `pnpm dev` (port 5173) |
| Typecheck, lint, format check and unit tests | `pnpm check`           |
| Unit tests only                              | `pnpm test`            |
| End-to-end tests (builds first)              | `pnpm test:e2e`        |
| Format                                       | `pnpm format`          |
| Desktop app with hot reload                  | `pnpm desktop`         |
| Desktop app from the production build        | `pnpm desktop:preview` |
| Headless desktop boot check                  | `pnpm desktop:smoke`   |

Playwright uses its own Chromium by default. Where browsers cannot be downloaded, point it at an installed
Chrome: `PLAYWRIGHT_CHROME_PATH=/path/to/chrome pnpm test:e2e`. When Electron runs as root (containers),
append `--no-sandbox`, for example `node scripts/desktop-smoke.mjs --no-sandbox`.

## Architectural boundaries

```
src/core        document, commands, history, skin layout, picking math, PNG codec   (no DOM, no three, no react)
src/editor      tool contract, built-in tools, stroke controller, raster helpers    (depends on core only)
src/extensions  registries, plugin API v1, extension host, bundled plugins
src/renderer    three.js viewport, skin meshes, lighting presets                    (the only three.js code)
src/platform    web and desktop file access behind one adapter
src/app         singletons and wiring: editor, registries, actions, file operations
src/ui          React components and the zustand UI store
electron        main process and preload (the only Node/Electron code)
e2e             Playwright tests
```

Rules that keep the project healthy; ESLint enforces the import ones:

1. **One source of truth.** The skin lives in `SkinDocument`. Nothing else stores pixels.
2. **Every change is a command.** Mutate the document only through `editor.execute(command)`. Tools,
   plugins, file import and future AI features all use this path. Never write to `skin.pixels` directly.
3. **Tools see a `StrokeContext`, not the editor.** Plugins see `PluginApi`, not the registries.
4. **`core` and `editor` stay framework free** so they run in Node tests and, later, in a worker or a
   sandbox. `renderer` never imports React; `ui` never imports three.js.
5. **Geometry comes from `core/skin-layout.ts` only.** Meshes, picking, the 2D view and the default skin
   all read the same face table. Do not hard-code UV numbers elsewhere.
6. **Electron stays behind `platform/`.** No `electron` or `node:` imports under `src/`.
7. **UI state is not document state.** Tool, colour, visibility and studio settings live in `ui/store.ts`.

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess`. No `any`; named exports only inside `src`.
- Each definition has exactly one comment above it that says why it exists, in plain lowercase words.
  No comments inside function bodies, no TODO markers.
- Tailwind utility classes with the theme tokens from `src/index.css`. Reuse `ui/primitives.tsx` before
  adding a new control. Every button must do something; unfinished features are disabled or absent.
- Colours are straight-alpha `Rgba` tuples; packed pixels are little-endian `Uint32`.
- Prefer data over code for extension points (tools name their icon, panels declare fields, lighting
  presets are plain objects) so they can cross a sandbox boundary later.
- Add a dependency only when it replaces a meaningful amount of code. Check its licence and peer ranges.

## Testing requirements

- New logic in `core`, `editor` or `extensions` needs a Vitest test next to it (`*.test.ts`).
- Anything users can click needs coverage in `e2e/studio.spec.ts`. Assert on exported PNG pixels rather
  than on internal state; that is how painting, undo and round-trips are verified today.
- Run `pnpm check` and `pnpm test:e2e` before finishing. After visual changes, open the preview and look.
- Never mark rendering behaviour as verified unless it was observed. Cloud browsers use software WebGL;
  note in `PROJECT.md` what could not be checked.

## Where to look

- Product scope, limitations, what is verified: `PROJECT.md`
- Module design and data flow: `docs/ARCHITECTURE.md`
- Reasons behind technical choices: `docs/DECISIONS.md`
- Lessons from other editors: `docs/RESEARCH.md`
- Planned work: `docs/ROADMAP.md`
- Renderer specifics (units, shader patch, render loop): `src/renderer/AGENTS.md`
