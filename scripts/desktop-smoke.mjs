import { spawn } from 'node:child_process';
import electron from 'electron';

// boots the built desktop app without a display and exits 0 once the ui and preload bridge are ready
const child = spawn(
  String(electron),
  ['.', '--ozone-platform=headless', '--disable-gpu', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, SKIN_STUDIO_SMOKE: '1' },
  },
);
child.on('exit', (code) => process.exit(code ?? 1));
