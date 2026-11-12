import { useEffect, useRef } from 'react';
import { editor, toolController } from '../app/app';
import {
  getFaceMap,
  getPartSheet,
  getSkinFaces,
  PART_LABELS,
  SKIN_SIZE,
  type Rect,
  type SkinModel,
} from '../core/skin-layout';
import type { PixelTarget } from '../editor/tool';
import { useUi } from './store';

// whether the view shows the texture as minecraft stores it or one island per body part
export type TextureLayout = 'atlas' | 'parts';

// a piece of the texture and where the view draws it, in skin pixels
interface Tile {
  readonly rect: Rect;
  readonly x: number;
  readonly y: number;
  readonly caption?: string;
}

// tiles and overall size of what one layout draws
interface Sheet {
  readonly tiles: readonly Tile[];
  readonly width: number;
  readonly height: number;
}

// short island captions drawn into the unused corner of each unwrapped box in the atlas
const PART_CAPTIONS = {
  head: 'Head',
  body: 'Body',
  rightArm: 'R arm',
  leftArm: 'L arm',
  rightLeg: 'R leg',
  leftLeg: 'L leg',
};

// screen space kept free above the sheet so the first row of captions is never clipped
const TOP_MARGIN = 26;

// builds a 64x64 helper canvas whose pixels are produced by a callback, scaled up when drawn
function pixelCanvas(colorAt: (x: number, y: number) => string | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SKIN_SIZE;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < SKIN_SIZE; y++) {
    for (let x = 0; x < SKIN_SIZE; x++) {
      const color = colorAt(x, y);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

// describes what a layout draws, the atlas being a single tile covering the whole texture
function sheetFor(layout: TextureLayout, model: SkinModel): Sheet {
  if (layout === 'atlas') {
    return {
      tiles: [{ rect: { x: 0, y: 0, w: SKIN_SIZE, h: SKIN_SIZE }, x: 0, y: 0 }],
      width: SKIN_SIZE,
      height: SKIN_SIZE,
    };
  }
  const { islands, width, height } = getPartSheet(model);
  return {
    tiles: islands.map(({ part, layer, rect, x, y }) => ({
      rect,
      x,
      y,
      caption: layer === 'base' ? PART_LABELS[part] : `${PART_LABELS[part]} · outer`,
    })),
    width,
    height,
  };
}

// flat texture editor showing the same document as the 3d view, as an atlas or as separate parts
export function TextureView({ layout }: { layout: TextureLayout }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const skinCanvas = pixelCanvas(() => null);
    const skinCtx = skinCanvas.getContext('2d')!;
    const skinImage = new ImageData(
      new Uint8ClampedArray(editor.skin.pixels.buffer as ArrayBuffer),
      SKIN_SIZE,
      SKIN_SIZE,
    );
    const checker = pixelCanvas((x, y) => ((x + y) % 2 === 0 ? '#1a1e2c' : '#202536'));
    let mask = pixelCanvas(() => null);
    let sheet = sheetFor(layout, editor.skin.model);
    let zoom = 8;
    let panX = 0;
    let panY = 0;
    let userMoved = false;
    let pixelsDirty = true;
    let modelDirty = true;
    let frame = 0;
    let panning: { x: number; y: number } | null = null;
    let spaceHeld = false;

    const fit = () => {
      const { clientWidth: w, clientHeight: h } = container;
      zoom = Math.max(2, Math.floor(Math.min((w - 24) / sheet.width, (h - TOP_MARGIN - 12) / sheet.height)));
      panX = Math.round((w - sheet.width * zoom) / 2);
      panY = TOP_MARGIN + Math.round((h - TOP_MARGIN - sheet.height * zoom) / 2);
    };

    const syncSize = (): boolean => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return false;
      const dpr = window.devicePixelRatio;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        if (!userMoved) fit();
      }
      return true;
    };

    const tileOf = (x: number, y: number) =>
      sheet.tiles.find(
        ({ rect }) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h,
      );

    const draw = () => {
      frame = 0;
      if (!syncSize()) return;
      const { clientWidth: w, clientHeight: h } = container;
      const dpr = window.devicePixelRatio;
      const faces = getSkinFaces(editor.skin.model);
      if (modelDirty) {
        const faceMap = getFaceMap(editor.skin.model);
        mask = pixelCanvas((x, y) => (faceMap[y * SKIN_SIZE + x]! < 0 ? 'rgba(13,15,23,0.78)' : null));
        sheet = sheetFor(layout, editor.skin.model);
        if (!userMoved) fit();
        modelDirty = false;
      }
      if (pixelsDirty) {
        skinCtx.putImageData(skinImage, 0, 0);
        pixelsDirty = false;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.lineWidth = 1;

      for (const { rect, x, y } of sheet.tiles) {
        const left = panX + x * zoom;
        const top = panY + y * zoom;
        for (const image of [checker, skinCanvas, mask]) {
          ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, left, top, rect.w * zoom, rect.h * zoom);
        }
        if (zoom >= 12) {
          ctx.strokeStyle = 'rgba(255,255,255,0.045)';
          ctx.beginPath();
          for (let i = 1; i < rect.w; i++) {
            ctx.moveTo(left + i * zoom + 0.5, top);
            ctx.lineTo(left + i * zoom + 0.5, top + rect.h * zoom);
          }
          for (let i = 1; i < rect.h; i++) {
            ctx.moveTo(left, top + i * zoom + 0.5);
            ctx.lineTo(left + rect.w * zoom, top + i * zoom + 0.5);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(left - 0.5, top - 0.5, rect.w * zoom + 1, rect.h * zoom + 1);
      }

      ctx.font = '500 10px "Inter Variable", sans-serif';
      for (const face of faces) {
        const tile = tileOf(face.rect.x, face.rect.y);
        if (!tile) continue;
        const left = panX + (face.rect.x - tile.rect.x + tile.x) * zoom;
        const top = panY + (face.rect.y - tile.rect.y + tile.y) * zoom;
        ctx.strokeStyle = face.layer === 'base' ? 'rgba(255,255,255,0.2)' : 'rgba(174,184,246,0.42)';
        ctx.strokeRect(left + 0.5, top + 0.5, face.rect.w * zoom - 1, face.rect.h * zoom - 1);
        if (layout === 'atlas' && face.face === 'right' && zoom >= 7) {
          ctx.textBaseline = 'top';
          ctx.fillStyle = face.layer === 'base' ? 'rgba(230,232,242,0.6)' : 'rgba(174,184,246,0.85)';
          ctx.fillText(PART_CAPTIONS[face.part], left + 3, top - face.rect.w * zoom + 4);
        }
      }

      if (zoom >= 3) {
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(154,160,184,0.95)';
        for (const { caption, x, y } of sheet.tiles) {
          if (caption) ctx.fillText(caption, panX + x * zoom, panY + y * zoom - 4);
        }
      }

      const hover = useUi.getState().hover;
      const hoverTile = hover && tileOf(hover.x, hover.y);
      if (hover && hoverTile) {
        const hx = panX + (hover.x - hoverTile.rect.x + hoverTile.x) * zoom;
        const hy = panY + (hover.y - hoverTile.rect.y + hoverTile.y) * zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeRect(hx - 1.5, hy - 1.5, zoom + 3, zoom + 3);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(hx - 0.5, hy - 0.5, zoom + 1, zoom + 1);
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(draw);
    };

    const targetAt = (event: PointerEvent): PixelTarget | null => {
      syncSize();
      const bounds = canvas.getBoundingClientRect();
      const sx = (event.clientX - bounds.left - panX) / zoom;
      const sy = (event.clientY - bounds.top - panY) / zoom;
      const tile = sheet.tiles.find(
        ({ rect, x, y }) => sx >= x && sx < x + rect.w && sy >= y && sy < y + rect.h,
      );
      if (!tile) return null;
      const x = Math.floor(sx - tile.x) + tile.rect.x;
      const y = Math.floor(sy - tile.y) + tile.rect.y;
      const face = getSkinFaces(editor.skin.model)[getFaceMap(editor.skin.model)[y * SKIN_SIZE + x]!];
      return face ? { x, y, face } : null;
    };
    const setHover = (target: PixelTarget | null) => {
      const hover = useUi.getState().hover;
      if (!target) {
        if (hover) useUi.getState().set({ hover: null });
      } else if (!hover || hover.x !== target.x || hover.y !== target.y) {
        useUi.getState().set({ hover: { x: target.x, y: target.y, faceIndex: target.face.index } });
      }
    };
    const onDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      if (event.button === 1 || event.button === 2 || (event.button === 0 && spaceHeld)) {
        panning = { x: event.clientX - panX, y: event.clientY - panY };
        return;
      }
      const target = event.button === 0 ? targetAt(event) : null;
      if (target) toolController.begin(target);
    };
    const onMove = (event: PointerEvent) => {
      if (panning) {
        panX = event.clientX - panning.x;
        panY = event.clientY - panning.y;
        userMoved = true;
        schedule();
        return;
      }
      const target = targetAt(event);
      if (toolController.active && target) toolController.move(target);
      setHover(target);
    };
    const onUp = () => {
      panning = null;
      toolController.end();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const cx = event.clientX - bounds.left;
      const cy = event.clientY - bounds.top;
      const next = Math.min(64, Math.max(2, zoom * Math.pow(1.0018, -event.deltaY)));
      panX = cx - ((cx - panX) / zoom) * next;
      panY = cy - ((cy - panY) / zoom) * next;
      zoom = next;
      userMoved = true;
      schedule();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeld = event.type === 'keydown';
    };
    const onLeave = () => setHover(null);
    const onContextMenu = (event: Event) => event.preventDefault();

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const unsubscribeDocument = editor.subscribeDocument((change) => {
      if (change === 'pixels') pixelsDirty = true;
      if (change === 'model') modelDirty = true;
      schedule();
    });
    const unsubscribeUi = useUi.subscribe((state, previous) => {
      if (state.hover !== previous.hover) schedule();
    });
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(container);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      unsubscribeDocument();
      unsubscribeUi();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [layout]);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-app">
      <canvas
        ref={canvasRef}
        data-testid="texture-view"
        className="block h-full w-full cursor-crosshair touch-none"
      />
    </div>
  );
}
