import { Tooltip } from 'radix-ui';
import { useEffect } from 'react';
import { actions, tools } from '../app/app';
import { importSkin } from '../app/files';
import { Dock } from './Dock';
import { isTyping, shortcutOf } from './shortcuts';
import { useUi } from './store';
import { TopBar } from './TopBar';

// shortcuts that must keep working while a text field is focused
const GLOBAL_SHORTCUTS = /^(F\d+|Mod\+S|Mod\+O|Mod\+E|Mod\+Shift\+S)$/;

// transient confirmation and error messages
function Toast() {
  const notice = useUi((state) => state.notice);
  const set = useUi((state) => state.set);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => set({ notice: null }), notice.kind === 'error' ? 6000 : 2600);
    return () => clearTimeout(timer);
  }, [notice, set]);
  if (!notice) return null;
  return (
    <div
      role="status"
      data-testid="toast"
      className={`pointer-events-none absolute bottom-6 left-1/2 z-[1000] max-w-md -translate-x-1/2 rounded-xl border px-3 py-2 text-xs shadow-xl shadow-black/40 ${notice.kind === 'error' ? 'border-danger/40 bg-[#2a1719] text-[#ffc9cd]' : 'border-line-strong bg-raised text-fg'}`}
    >
      {notice.text}
    </div>
  );
}

// application shell wiring the dock, global shortcuts and drag and drop import
export function App() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = shortcutOf(event);
      if (isTyping(event) && !GLOBAL_SHORTCUTS.test(shortcut)) return;
      const action = actions.list().find((item) => item.shortcut === shortcut);
      if (action) {
        event.preventDefault();
        action.run();
        return;
      }
      const tool = tools.list().find((item) => item.shortcut === shortcut);
      if (tool) useUi.getState().set({ activeToolId: tool.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
      <div
        data-app-ready
        className="relative flex h-full flex-col"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) importSkin(file.name, new Uint8Array(await file.arrayBuffer()));
        }}
      >
        <TopBar />
        <Dock />
        <Toast />
      </div>
    </Tooltip.Provider>
  );
}
