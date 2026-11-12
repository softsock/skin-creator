import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

// starts the vite dev server and points an electron window at it for desktop development
const server = await createServer();
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite did not report a local URL');

const child = spawn(String(electron), ['.'], {
  stdio: 'inherit',
  env: { ...process.env, SKIN_STUDIO_DEV_URL: url },
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
