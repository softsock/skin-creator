import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

// starts a vite dev server on its own port and points an electron window at it for desktop development
const server = await createServer({ server: { port: 5174, strictPort: false } });
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite did not report a local URL');

const child = spawn(String(electron), ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, SKIN_STUDIO_DEV_URL: url },
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
