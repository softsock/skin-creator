import {
  Box,
  Eraser,
  Moon,
  PaintBucket,
  Pencil,
  Pipette,
  Puzzle,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react';

// icons that tools and plugins may reference by name, so tool definitions stay plain data
const TOOL_ICONS: Record<string, LucideIcon> = {
  pencil: Pencil,
  eraser: Eraser,
  pipette: Pipette,
  'paint-bucket': PaintBucket,
  sun: Sun,
  moon: Moon,
  sparkles: Sparkles,
  box: Box,
};

// resolves a named icon, falling back to a generic plugin glyph for unknown names
export function toolIcon(name: string): LucideIcon {
  return TOOL_ICONS[name] ?? Puzzle;
}
