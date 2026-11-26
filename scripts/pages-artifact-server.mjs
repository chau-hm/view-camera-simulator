import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const root = resolve(process.argv[2] || '');
const base = '/view-camera-simulator/';
const port = Number(process.env.PORT || 4178);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
if (!process.argv[2] || !(await stat(resolve(root, 'index.html'))).isFile()) throw new Error('Prebuilt artifact is missing');
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // Existing root-based renderer tests can enter their route at the Pages base.
    if (url.pathname.startsWith('/simulator/')) {
      res.writeHead(302, { location: `${base}${url.pathname.slice(1)}${url.search}` }).end();
      return;
    }
    if (!url.pathname.startsWith(base)) { res.writeHead(404).end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) { res.writeHead(400).end(); return; }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(data);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
      if (relative.startsWith('assets/') || extname(relative)) { res.writeHead(404).end(); return; }
      const fallback = await readFile(resolve(root, '404.html'));
      res.writeHead(req.headers['x-pages-fallback-test'] === '1' ? 404 : 200, { 'content-type': 'text/html' }).end(fallback);
    }
  } catch { res.writeHead(500).end(); }
}).listen(port, '127.0.0.1');
