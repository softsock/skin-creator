import { useEffect, useRef } from 'react';
import { editor, presets, toolController, viewportRef } from '../app/app';
import { resolvePaintTarget, type PaintTargetMode } from '../editor/paint-target';
import type { PixelTarget } from '../editor/tool';
import { getSkinFaces, type LayerId } from '../core/skin-layout';
import { EDITOR_LIGHTING } from '../renderer/lighting';
import { SkinViewport, type ViewportLook } from '../renderer/viewport';
import { useUi } from './store';

// field of view used while editing, wider than studio for comfortable close-up painting
const EDIT_FOV = 35;

// derives the viewport look from ui state, the only difference between edit and studio mode
function currentLook(): ViewportLook {
  const { workspace, studio } = useUi.getState();
  if (workspace !== 'studio') return { lighting: EDITOR_LIGHTING, fov: EDIT_FOV, transparent: false };
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

// hosts the three.js viewport and translates pointer input into tool strokes
export function Viewport3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspace = useUi((state) => state.workspace);
  const transparent = useUi((state) => state.workspace === 'studio' && state.studio.transparent);
  const webglError = useUi((state) => state.webglError);

  useEffect(() => {
    const container = containerRef.current!;
    let viewport: SkinViewport;
    try {
      viewport = new SkinViewport(container, editor, currentLook());
    } catch (error) {
      console.error(error);
      useUi
        .getState()
        .set({ webglError: error instanceof Error ? error.message : String(error), viewMode: '2d' });
      return;
    }
    viewportRef.current = viewport;
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
      const ui = useUi.getState();
      if (event.button !== 0 || ui.workspace !== 'edit') return;
      const target = targetAt(event, ui.paintTarget);
      if (!target || !toolController.begin(target)) return;
      strokeLayer = target.face.layer;
      viewport.controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      const ui = useUi.getState();
      if (ui.workspace !== 'edit') return;
      if (strokeLayer) {
        const target = targetAt(event, strokeLayer);
        if (target) toolController.move(target);
        setHover(target);
      } else if (event.buttons === 0) {
        setHover(targetAt(event, ui.paintTarget));
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
      useUi.getState().set({ viewportSize: `${container.clientWidth}x${container.clientHeight}` }),
    );
    sizeObserver.observe(container);

    const unsubscribe = useUi.subscribe((state, previous) => {
      if (state.workspace !== previous.workspace || state.studio !== previous.studio) {
        if (state.workspace !== 'browser') viewport.setLook(currentLook(), true);
      }
      if (state.visibility !== previous.visibility) viewport.setVisibility(state.visibility);
      if (state.hover !== previous.hover) {
        const face = state.hover && getSkinFaces(editor.skin.model)[state.hover.faceIndex];
        viewport.setHover(state.hover && face ? { face, x: state.hover.x, y: state.hover.y } : null);
      }
    });

    return () => {
      unsubscribe();
      sizeObserver.disconnect();
      viewportRef.current = null;
      viewport.dispose();
    };
  }, []);

  if (webglError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-medium text-fg">3D viewport unavailable</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted">
          This browser could not create a WebGL2 context, so the 3D view and Studio mode are disabled. The 2D
          texture editor keeps working.
        </p>
        <p className="max-w-sm text-[11px] text-faint">{webglError}</p>
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      data-testid="viewport-3d"
      className={`h-full w-full ${transparent ? 'checker' : ''} ${workspace === 'edit' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
    />
  );
}
