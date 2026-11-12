# Renderer notes

Local rules for `src/renderer`. The general guide is in the root `AGENTS.md`.

- **Units.** One world unit is one skin pixel. The character stands on `y = 0`, is 32 units tall, faces
  `+z`, and its right arm is on `-x`. Shadow frustum, AO radius and camera distances assume this scale.
- **One pipeline for both modes.** Edit and Studio render through the same `EffectComposer`
  (`RenderPass → GTAOPass → OutputPass`). A mode is only a `LightingPreset` plus field of view; switching
  interpolates the numbers. Do not add a second renderer or a second set of materials.
- **Light intensities are physical.** Since three r155 a directional or ambient intensity of `π` returns
  the full albedo. The editor preset is tuned so front faces are about 0.9× the texture colour with no
  tone mapping. Studio presets use linear tone mapping so lit colours stay equal to the texture; filmic
  curves (`neutral`, `aces`, `agx`) are available to presets but shift dark colours noticeably.
- **Textures must stay crisp.** Nearest filtering, no mipmaps, sRGB. The shader patch in
  `skin-object.ts` clamps sampling to the face's own texels (the `uvRect` attribute) because MSAA can
  extrapolate UVs across an island border. Keep the clamp if you touch the material.
- **Render on demand.** The frame loop only draws when the camera moves, a transition runs or `dirty` is
  set. Any new state change must set `dirty`.
- **Picking does not use meshes.** `pick()` converts the pointer to a ray and calls
  `core/picking.ts`. If parts ever get transforms (posing), transform the ray into part space there.
- **Export** resizes the drawing buffer, renders once and calls `toBlob` in the same task, then restores
  the size. Nothing may `await` between the render and `toBlob`.
- **Shadow type.** `PCFSoftShadowMap` was removed in three r187; softness comes from `PCFShadowMap` with
  `shadow.radius`.
