// whether the user is on an apple platform, which decides how the mod key is labelled
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// normalizes a key event into the "Mod+Shift+Z" form used by action and tool definitions
export function shortcutOf(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Mod');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return parts.join('+');
}

// renders a shortcut definition for tooltips and menus using platform conventions
export function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => (part === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : part === 'Shift' && isMac ? '⇧' : part))
    .join(isMac ? '' : '+');
}

// whether a key event comes from a text field, where plain letter shortcuts must not fire
export function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return (
    !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}
