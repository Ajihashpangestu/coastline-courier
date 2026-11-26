// Local preview server for Coastline Courier: serves game/ as static files
// so the entry can be played in a desktop browser before hand-in.
// Run: node serve.ts  (then open the printed address)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = fileURLToPath(new URL('./game/', import.meta.url));
const port = 8080;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const safePath = normalize(join(gameDir, requested));
  if (!safePath.startsWith(gameDir)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(safePath);
    response.writeHead(200, { 'content-type': types[extname(safePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

server.listen(port, () => {
  console.log(`Coastline Courier at http://localhost:${port}/`);
});
