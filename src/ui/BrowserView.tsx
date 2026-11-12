import { ArrowLeft, ArrowRight, Crown, Download, ExternalLink, Globe, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { platform } from '../app/app';
import { importSkin } from '../app/files';
import type { BrowserDownload } from '../platform/platform';
import { Button, IconButton } from './primitives';
import { useUi } from './store';

// session partition of the embedded browser, must match the one the desktop main process locks down
const BROWSER_PARTITION = 'skin-browser';

// page each browser kind opens first
const HOME_URLS = {
  browser: 'https://duckduckgo.com/',
  namemc: 'https://namemc.com/minecraft-skins',
};

// the parts of electron's webview element this view drives
interface WebviewElement extends HTMLElement {
  getURL(): string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  loadURL(url: string): Promise<void>;
}

// turns what the user typed into an https address, searching when it is not one
function toUrl(input: string): string {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[^\s/]+\.[^\s/]+(\/\S*)?$/.test(text)) return `https://${text}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
}

// explains on the web build why the browser is missing and offers the closest working alternative
function WebFallback({ kind }: { kind: 'browser' | 'namemc' }) {
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-app p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-panel text-muted">
          <Globe className="size-5" strokeWidth={1.5} />
        </div>
        <h2 className="text-sm font-semibold text-fg">Integrated browser is a desktop feature</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          The desktop app embeds an isolated browser here so you can look through NameMC and import a
          downloaded skin without leaving the studio. Websites such as NameMC refuse to be embedded in a web
          page, so this view cannot work in the browser build.
        </p>
        <a
          href={HOME_URLS[kind]}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-fg transition-colors hover:bg-hover"
        >
          <ExternalLink className="size-3.5" />
          {kind === 'namemc' ? 'Open NameMC in a new tab' : 'Open a new browser tab'}
        </a>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Download a skin PNG there, then drop it onto this window or use Import.
        </p>
      </div>
    </div>
  );
}

// embedded browser with basic navigation that offers png downloads as skin imports
function DesktopBrowser({ kind }: { kind: 'browser' | 'namemc' }) {
  const webviewRef = useRef<WebviewElement>(null);
  const [address, setAddress] = useState(HOME_URLS[kind]);
  const [history, setHistory] = useState({ back: false, forward: false });
  const [download, setDownload] = useState<BrowserDownload | null>(null);

  useEffect(() => {
    const webview = webviewRef.current!;
    const sync = () => {
      setAddress(webview.getURL());
      setHistory({ back: webview.canGoBack(), forward: webview.canGoForward() });
    };
    webview.addEventListener('did-navigate', sync);
    webview.addEventListener('did-navigate-in-page', sync);
    const unsubscribe = platform.onBrowserDownload((next) => {
      if (next.bytes) setDownload(next);
      else useUi.getState().notify('error', `${next.name} is not a skin PNG, so it was not downloaded.`);
    });
    return () => {
      webview.removeEventListener('did-navigate', sync);
      webview.removeEventListener('did-navigate-in-page', sync);
      unsubscribe();
    };
  }, []);

  const go = (url: string) => void webviewRef.current?.loadURL(url).catch(() => undefined);

  return (
    <div className="flex h-full flex-col bg-app">
      <form
        className="flex shrink-0 items-center gap-1 border-b border-line bg-panel px-2 py-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          go(toUrl(address));
        }}
      >
        <IconButton
          label="Back"
          icon={ArrowLeft}
          disabled={!history.back}
          onClick={() => webviewRef.current?.goBack()}
        />
        <IconButton
          label="Forward"
          icon={ArrowRight}
          disabled={!history.forward}
          onClick={() => webviewRef.current?.goForward()}
        />
        <IconButton label="Reload" icon={RotateCw} onClick={() => webviewRef.current?.reload()} />
        <input
          aria-label="Address"
          spellCheck={false}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          className="h-7 min-w-0 flex-1 rounded-lg border border-line bg-app px-2.5 text-xs text-fg outline-none focus:border-accent"
        />
        <IconButton label="NameMC skins" icon={Crown} onClick={() => go(HOME_URLS.namemc)} />
        {download?.bytes && (
          <Button
            variant="primary"
            onClick={() => {
              importSkin(download.name, download.bytes!);
              setDownload(null);
            }}
          >
            <Download className="size-3.5" /> Import {download.name}
          </Button>
        )}
      </form>
      <webview
        ref={webviewRef}
        src={HOME_URLS[kind]}
        partition={BROWSER_PARTITION}
        className="min-h-0 flex-1"
      />
    </div>
  );
}

// browser view area, a real embedded browser on desktop and an honest explanation on the web
export function BrowserView({ kind }: { kind: 'browser' | 'namemc' }) {
  return platform.kind === 'desktop' ? <DesktopBrowser kind={kind} /> : <WebFallback kind={kind} />;
}
