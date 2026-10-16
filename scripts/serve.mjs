import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.FLOWCANVAS_STATIC_DIR ?? 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};
const policy =
  "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const server = createServer((request, response) => {
  void (async () => {
    response.setHeader('Content-Security-Policy', policy);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const content = await readFile(path);
      response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
      response.writeHead(200);
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  })().catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end('Server error');
  });
});
server.listen(Number(process.env.FLOWCANVAS_PORT ?? 4173), '127.0.0.1');
server.on('error', (error) => {
  console.error('Static server failed:', error.code);
  process.exitCode = 1;
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close();
  });
