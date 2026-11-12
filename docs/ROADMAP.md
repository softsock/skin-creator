# Roadmap

Ordered by priority within each group. Items here are not implemented.

## Next

1. **Verification on real hardware** – run the editor and Studio mode on Windows with a real GPU, check
   high-DPI rendering and frame rate, exercise the native dialogs, then add Windows packaging
   (electron-builder or Forge) and a CI workflow running `pnpm check`, `pnpm test:e2e` and
   `pnpm desktop:smoke`.
2. **Editing depth** – mirror painting across the body's symmetry plane, legacy 64×32 import (mirror the
   right limbs with the face table and clear head overlays that were saved fully opaque), session autosave, a line/rectangle tool, selection and move.
3. **Studio depth** – character posing (per-part pivots; picking must transform rays into part space),
   scene presets that bundle pose, camera and lighting, custom backdrop colour or image, fixed-size and
   higher-resolution export.

## Later

- **Editing layers** – internal paint layers and blend modes that composite into the document buffer.
- **Plugin runtime for untrusted code** – load plugins in a sandboxed iframe or worker and serve
  `PluginApi` over messages; add an install flow that shows requested permissions. Extend the API with
  import/export format contributions.
- **Integrated browser (desktop)** – a `WebContentsView` in its own session partition with navigation
  controls and tabs, no Node access, all permissions denied, window opening and navigation validated, and
  downloads handled through `will-download` so a PNG can be imported only after the user confirms. No
  scraping of NameMC; respect the service's terms.
- **AI assistance** – palette generation, automatic shading, reference image to skin, and an MCP server.
  All of it must act through editor commands, exactly like tools and plugins.
- **Rendering** – animation playback, cut-out aware ambient occlusion, optional offline rendering through
  Blender.
