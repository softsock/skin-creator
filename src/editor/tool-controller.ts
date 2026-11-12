import type { Rgba } from '../core/color';
import type { Editor } from '../core/editor';
import type { PixelTarget, StrokeContext, Tool } from './tool';

// ambient ui state the controller reads at stroke time, injected to keep it ui agnostic
export interface ToolEnvironment {
  activeTool(): Tool | undefined;
  color(): Rgba;
  brushSize(): number;
  setColor(color: Rgba): void;
  colorUsed(color: Rgba): void;
}

// counter that gives each stroke a unique merge key so strokes stay separate undo steps
let strokeCounter = 0;

// turns pointer gestures from any view into tool calls and undoable commands
export class ToolController {
  private stroke: { tool: Tool; ctx: StrokeContext; last: PixelTarget } | null = null;

  constructor(
    private readonly editor: Editor,
    private readonly env: ToolEnvironment,
  ) {}

  // whether a stroke is in progress, used by views to suspend camera controls
  get active(): boolean {
    return this.stroke !== null;
  }

  // starts a stroke with the active tool on the given pixel
  begin(target: PixelTarget): boolean {
    const tool = this.env.activeTool();
    if (!tool) return false;
    const mergeKey = `stroke:${++strokeCounter}`;
    const { editor, env } = this;
    const ctx: StrokeContext = {
      skin: editor.skin,
      color: env.color(),
      brushSize: tool.usesBrushSize ? env.brushSize() : 1,
      paint: (changes) => {
        editor.execute(editor.createPixelPatch(tool.label, changes, mergeKey));
      },
      pickColor: (color) => env.setColor(color),
    };
    this.stroke = { tool, ctx, last: target };
    if (tool.usesColor) env.colorUsed(ctx.color);
    tool.onStrokeStart(target, ctx);
    return true;
  }

  // continues the stroke when the pointer reaches a different pixel
  move(target: PixelTarget): void {
    const stroke = this.stroke;
    if (!stroke || (target.x === stroke.last.x && target.y === stroke.last.y)) return;
    stroke.tool.onStrokeMove?.(target, stroke.last, stroke.ctx);
    stroke.last = target;
  }

  // finishes the stroke so the next one becomes a new undo step
  end(): void {
    this.stroke = null;
  }
}
