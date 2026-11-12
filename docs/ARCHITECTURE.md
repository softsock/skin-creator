# Architecture

How the application is put together. For the reasons behind these choices see `DECISIONS.md`.

## Data flow

```
pointer in 3D view ──ray──▶ core/picking ─┐
pointer in 2D view ──pixel─▶ face map ────┤
                                          ▼
                              editor/ToolController ──▶ Tool.onStroke*(target, StrokeContext)
                                                              │ ctx.paint(changes)
                                                              ▼
                                         Editor.execute(PixelPatchCommand)   ◀── plugins, import, AI (future)
                                                              │
                                                    SkinDocument (64×64 RGBA)
                                                   ╱          │            ╲
                                    DataTexture (3D)   2D canvas view   PNG export
```

There is one `SkinDocument`. Its `pixels` buffer _is_ the Minecraft PNG: the three.js texture reads the
same memory, the 2D view wraps it in an `ImageData`, and export encodes it unchanged, including texels no
body part uses.

## Core (`src/core`)

- **`skin-layout.ts`** – the Minecraft box-UV table. For a model (`classic` or `slim`) it yields 72
  `SkinFace` records: texture rect, a model-space origin, unit `u`/`v` axes, lengths and a normal. The outer
  layer is the same box inflated by 0.5 (head) or 0.25 (other parts) per side. `getFaceMap` maps each
  texel to its face or `-1`.
- **`picking.ts`** – analytic ray/quad intersection over those faces. Returns hits nearest first with the
  exact texel, clamped to the face. Base faces are single sided, outer faces double sided.
- **`skin-document.ts`** – pixel buffer, model, name and change notifications.
- **`commands.ts`** – `Command { apply, revert, merge? }`. `PixelPatchCommand` is a sparse diff;
  `SetModelCommand`, `ReplaceSkinCommand` (import, new) and `RenameCommand` cover the rest.
- **`editor.ts`** – owns the document and the undo/redo stacks. `execute` merges consecutive commands with
  the same `mergeKey`, which is how a drag becomes one undo step while still updating live.
- **`png.ts`** – decoding and encoding through `fast-png`, model inference, validation errors.
- **`default-skin.ts`** – the procedurally painted starter character.

## Editor (`src/editor`)

A `Tool` is plain data plus `onStrokeStart` / `onStrokeMove`. It receives a `PixelTarget` (texel and face)
and a `StrokeContext` (`skin` read-only, `color`, `brushSize`, `paint`, `pickColor`). `ToolController`
creates one context and one merge key per stroke. `paint-target.ts` decides which layer a 3D ray edits:
`auto` skips transparent outer texels, `base` and `outer` force a layer. The 3D view locks the layer for
the rest of a stroke so an eraser cannot fall through the hole it just made.

## Extensions (`src/extensions`)

`Registry<T>` is an observable id-keyed list. The app has four: tools, panels, actions (with shortcuts) and
lighting presets. Built-in features register through them exactly like plugins.

`ExtensionHost` installs `Plugin { manifest, activate(api) }`. The manifest declares `apiVersion` and
`permissions`; the host builds a `PluginApi` whose every call checks a permission and records a disposer,
so disabling a plugin removes everything it added. Plugin edits go through `api.edit.setPixels`, which
creates a normal undoable command. Panels are declarative (`slider`, `button`) and rendered by the host.

`builtin/shading.ts` is the reference plugin: two tools, a panel and an action.

Planned contracts that are **not** implemented yet: import/export formats and a sandboxed runtime for
untrusted plugins. See `ROADMAP.md`.

## Renderer (`src/renderer`)

- **`skin-object.ts`** – builds one mesh per part and layer from the face table and binds a nearest-filtered
  `DataTexture` to the document buffer. Hides outer shells that contain no pixels.
- **`lighting.ts`** – `LightingPreset` data: three directional lights, ambient, hemisphere, environment,
  exposure, tone mapping, shadow, AO, backdrop. `EDITOR_LIGHTING` is the flat edit look.
- **`viewport.ts`** – `SkinViewport`: renderer, composer, orbit controls, look transitions, hover outline,
  picking and PNG export. Details and pitfalls are in `src/renderer/AGENTS.md`.

Studio mode is not a separate scene. `ui/Viewport3D.tsx` computes a `ViewportLook` from UI state and the
viewport tweens to it, which gives the F9 transition and guarantees the same model and texture.

## UI (`src/ui`) and app wiring (`src/app`)

`app/app.ts` creates the singletons (editor, registries, extension host, platform, tool controller).
`app/actions.ts` registers application actions; `app/files.ts` implements new, open, save and export.

`ui/store.ts` (zustand) holds interface state only. Components read the document through
`useEditorRevision()` and registries through `useRegistry()`, both built on `useSyncExternalStore`. The two
canvases (`Viewport3D`, `TextureView`) are imperative: they subscribe to the store and the document
directly and do not re-render React on pointer movement.

The workspace is a dock (`ui/Dock.tsx`, built on dockview). `ui/layout.ts` lists the panels, builds the
default arrangement, saves the layout to `localStorage` and reopens closed panels. Two of the panels are
view areas (`ui/ViewSlot.tsx`); the store keeps a `ViewKind` per area (`3d`, `2d`, `parts`, `render`,
`browser`, `namemc`) and which area is active, and the view switcher in the top bar changes the active one.
Each 3D area owns its own `SkinViewport`, registered in `app.viewports`; `viewportFor(kinds)` finds the
one an action should use. A render area is the same viewport with the studio look, so switching a 3D area
to 3D Render animates instead of remounting. `TextureView` draws either the atlas or the parts sheet from
`core/skin-layout.ts` (`getPartSheet`), mapping every tile back to real texture pixels.

## Platform (`src/platform`, `electron/`)

`PlatformAdapter` has `openPng`, `savePng` and `onBrowserDownload`. The web adapter uses a file input and
a download. The desktop adapter calls `window.skinStudioDesktop`, exposed by `electron/preload.cts`.

`electron/main.cts` creates a window with `contextIsolation`, `sandbox` and no Node integration, denies
permissions, navigation and new windows, validates IPC senders, only writes PNG data, and only to paths the
user picked in a native dialog (the renderer holds an opaque token, never a path).

The Browser and NameMC views are a `<webview>` (`ui/BrowserView.tsx`) in the `skin-browser` session
partition. The main process strips any preload, forces sandboxing, refuses other partitions and non-https
sources, denies permissions, keeps popups in the same view, and intercepts downloads: only a PNG under
4 MB is read, sent to the renderer and deleted from the temp folder, and it becomes a skin only when the
user presses Import.

## Testing

- Vitest (`src/**/*.test.ts`, Node environment): layout table, picking, commands and history, PNG codec,
  tools, paint targeting, registries and the extension host.
- Playwright (`e2e/`, production build, software WebGL): painting on the model, drag strokes versus
  orbiting, tools, import/export round-trips, 2D atlas and parts editing, the render view and both render
  exports, extension disable, the web browser fallback, and the dock (float, close, reopen, drag, swap,
  persistence, reset). Tests assert on downloaded PNG pixels.
