import { useEffect, useRef } from 'react';
import { editor, presets, toolController, viewports } from '../app/app';
import { resolvePaintTarget, type PaintTargetMode } from '../editor/paint-target';
import type { PixelTarget } from '../editor/tool';
import { getSkinFaces, type LayerId } from '../core/skin-layout';
import { EDITOR_LIGHTING } from '../renderer/lighting';
import { SkinViewport, type ViewportLook } from '../renderer/viewport';
import { useUi, type ViewKind } from './store';

// field of view used while editing, wider than studio for comfortable close-up painting
const EDIT_FOV = 35;

// derives the look of one view tab from ui state, the only difference between 3d and render views
function lookOf(id: string): ViewportLook {
  const { views, studio } = useUi.getState();
  if (views[id] !== 'render') return { lighting: EDITOR_LIGHTING, fov: EDIT_FOV, transparent: false };
  const preset = presets.get(studio.presetId) ?? presets.list()[0] ?? EDITOR_LIGHTING;
  return {
    lighting: {
      ...preset,
      background: studio.background ?? preset.background,
      ao: studio.ambientOcclusion ? preset.ao : 0,
      shadow: studio.shadows ? preset.shadow : 0,
    },
    fov: studio.fov,
    transparent: studio.transparent,
  };
}

// hosts one three.js viewport for a view tab and translates pointer input into tool strokes
export function Viewport3D({ id }: { id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const render = useUi((state) => state.views[id] === 'render');
  const transparent = useUi((state) => state.views[id] === 'render' && state.studio.transparent);
  const webglError = useUi((state) => state.webglError);

  useEffect(() => {
    const container = containerRef.current!;
    const painting = () => useUi.getState().views[id] === '3d';
    let viewport: SkinViewport;
    try {
      viewport = new SkinViewport(container, editor, lookOf(id));
    } catch (error) {
      console.error(error);
      const { views, set } = useUi.getState();
      const flat = (kind: ViewKind): ViewKind => (kind === '3d' || kind === 'render' ? '2d' : kind);
      set({
        webglError: error instanceof Error ? error.message : String(error),
        views: Object.fromEntries(Object.entries(views).map(([key, kind]) => [key, flat(kind)])),
      });
      return;
    }
    viewports.set(id, viewport);
    viewport.setVisibility(useUi.getState().visibility);
    const canvas = viewport.canvas;
    let strokeLayer: LayerId | null = null;

    const targetAt = (event: PointerEvent, mode: PaintTargetMode) =>
      resolvePaintTarget(viewport.pick(event.clientX, event.clientY), editor.skin, mode);
    const setHover = (target: PixelTarget | null) => {
      const hover = useUi.getState().hover;
      if (!target) {
        if (hover) useUi.getState().set({ hover: null });
      } else if (!hover || hover.x !== target.x || hover.y !== target.y) {
        useUi.getState().set({ hover: { x: target.x, y: target.y, faceIndex: target.face.index } });
      }
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !painting()) return;
      const target = targetAt(event, useUi.getState().paintTarget);
      if (!target || !toolController.begin(target)) return;
      strokeLayer = target.face.layer;
      viewport.controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!painting()) return;
      if (strokeLayer) {
        const target = targetAt(event, strokeLayer);
        if (target) toolController.move(target);
        setHover(target);
      } else if (event.buttons === 0) {
        setHover(targetAt(event, useUi.getState().paintTarget));
      }
    };
    const onUp = () => {
      if (!strokeLayer) return;
      strokeLayer = null;
      toolController.end();
      viewport.controls.enabled = true;
    };
    const onLeave = () => setHover(null);
    const onContextMenu = (event: Event) => event.preventDefault();
    canvas.addEventListener('pointerdown', onDown, { capture: true });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', onContextMenu);

    const sizeObserver = new ResizeObserver(() =>
      useUi.getState().set({ viewportSize: `${id}:${container.clientWidth}x${container.clientHeight}` }),
    );
    sizeObserver.observe(container);

    const unsubscribe = useUi.subscribe((state, previous) => {
      const kindChanged = state.views[id] !== previous.views[id];
      if (kindChanged || (state.studio !== previous.studio && state.views[id] === 'render')) {
        viewport.setLook(lookOf(id), true);
      }
      if (state.visibility !== previous.visibility) viewport.setVisibility(state.visibility);
      if (state.hover !== previous.hover || kindChanged) {
        const hover = state.views[id] === '3d' ? state.hover : null;
        const face = hover && getSkinFaces(editor.skin.model)[hover.faceIndex];
        viewport.setHover(hover && face ? { face, x: hover.x, y: hover.y } : null);
      }
    });

    return () => {
      unsubscribe();
      sizeObserver.disconnect();
      viewports.delete(id);
      viewport.dispose();
    };
  }, [id]);

  if (webglError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-medium text-fg">3D viewport unavailable</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">
          This browser could not create a WebGL2 context, so the 3D and 3D Render views are disabled. The 2D
          views keep working.
        </p>
        <p className="max-w-sm text-[11px] text-faint">{webglError}</p>
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      data-testid="viewport-3d"
      className={`h-full w-full ${transparent ? 'checker' : ''} ${render ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
    />
  );
}
