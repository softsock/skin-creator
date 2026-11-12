import { useEffect, useRef } from 'react';
import { editor, toolController } from '../app/app';
import { getFaceMap, getSkinFaces, SKIN_SIZE } from '../core/skin-layout';
import type { PixelTarget } from '../editor/tool';
import { useUi } from './store';

// short island captions drawn into the unused corner of each unwrapped box
const PART_CAPTIONS = {
  head: 'Head',
  body: 'Body',
  rightArm: 'R arm',
  leftArm: 'L arm',
  rightLeg: 'R leg',
  leftLeg: 'L leg',
};

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

// flat texture editor showing the same document as the 3d view, with zoom, pan and island guides
export function TextureView() {
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
    const checker = pixelCanvas((x, y) => ((x + y) % 2 === 0 ? '#1c1d21' : '#222429'));
    let mask = pixelCanvas(() => null);
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
      const top = 44;
      zoom = Math.max(2, Math.floor(Math.min(w - 32, h - top - 16) / SKIN_SIZE));
      panX = Math.round((w - SKIN_SIZE * zoom) / 2);
      panY = top + Math.round((h - top - SKIN_SIZE * zoom) / 2);
    };

    const draw = () => {
      frame = 0;
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      const dpr = window.devicePixelRatio;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        if (!userMoved) fit();
      }
      const faces = getSkinFaces(editor.skin.model);
      if (modelDirty) {
        const faceMap = getFaceMap(editor.skin.model);
        mask = pixelCanvas((x, y) => (faceMap[y * SKIN_SIZE + x]! < 0 ? 'rgba(14,15,17,0.78)' : null));
        modelDirty = false;
      }
      if (pixelsDirty) {
        skinCtx.putImageData(skinImage, 0, 0);
        pixelsDirty = false;
      }
      const size = SKIN_SIZE * zoom;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(checker, panX, panY, size, size);
      ctx.drawImage(skinCanvas, panX, panY, size, size);
      ctx.drawImage(mask, panX, panY, size, size);

      if (zoom >= 12) {
        ctx.strokeStyle = 'rgba(255,255,255,0.045)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < SKIN_SIZE; i++) {
          ctx.moveTo(panX + i * zoom + 0.5, panY);
          ctx.lineTo(panX + i * zoom + 0.5, panY + size);
          ctx.moveTo(panX, panY + i * zoom + 0.5);
          ctx.lineTo(panX + size, panY + i * zoom + 0.5);
        }
        ctx.stroke();
      }

      ctx.lineWidth = 1;
      for (const face of faces) {
        const { x, y, w: fw, h: fh } = face.rect;
        ctx.strokeStyle = face.layer === 'base' ? 'rgba(255,255,255,0.2)' : 'rgba(62,207,142,0.38)';
        ctx.strokeRect(panX + x * zoom + 0.5, panY + y * zoom + 0.5, fw * zoom - 1, fh * zoom - 1);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(panX - 0.5, panY - 0.5, size + 1, size + 1);

      if (zoom >= 7) {
        ctx.font = '500 9px "Inter Variable", sans-serif';
        ctx.textBaseline = 'top';
        for (const face of faces) {
          if (face.face !== 'right') continue;
          ctx.fillStyle = face.layer === 'base' ? 'rgba(231,232,235,0.6)' : 'rgba(62,207,142,0.8)';
          ctx.fillText(
            PART_CAPTIONS[face.part],
            panX + face.rect.x * zoom + 3,
            panY + (face.rect.y - face.rect.w) * zoom + 4,
          );
        }
      }

      const hover = useUi.getState().hover;
      if (hover) {
        const hx = panX + hover.x * zoom;
        const hy = panY + hover.y * zoom;
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
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left - panX) / zoom);
      const y = Math.floor((event.clientY - rect.top - panY) / zoom);
      if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return null;
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
      const rect = canvas.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
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
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-panel">
      <canvas
        ref={canvasRef}
        data-testid="texture-view"
        className="block h-full w-full cursor-crosshair touch-none"
      />
    </div>
  );
}
