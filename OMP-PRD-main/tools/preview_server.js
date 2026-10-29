/* ============================================================
   OMP preview server — serves the site exactly the way Firebase
   Hosting will, by routing every request through the same rules
   (tools/hosting_router.js reads firebase.json).

   Usage:  node tools/preview_server.js [port]     (default 8080, binds 0.0.0.0)

   Demonstrates locally: pretty direct navigation, browser refresh on
   /articles/<slug>, deep links, legacy .html 301s, trailing-slash
   301s, invalid slugs -> 404 page with 404 status.
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const createRouter = require('./hosting_router.js');
const { resolve } = createRouter(ROOT, path.join(ROOT, 'firebase.json'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain',
  '.ico': 'image/x-icon'
};

const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(req.url.split('?')[0]); } catch (e) { pathname = req.url.split('?')[0]; }
  const r = resolve(pathname, 0);
  const log = (code) => console.log(`${req.method} ${pathname} -> ${code}${r.location ? ' ' + r.location : ''}`);

  if (r.type === 'redirect') {
    log(r.status);
    res.writeHead(r.status, { Location: r.location, 'Content-Type': 'text/plain' });
    res.end(`${r.status} Moved: ${r.location}`);
    return;
  }
  const file = path.join(ROOT, r.file || '/404.html');
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  const isHtml = /\.html$/.test(r.file);
  const status = r.type === 'notfound' ? 404 : 200;
  log(status + (r.type === 'notfound' ? ' (404 page)' : ' file ' + r.file));
  res.writeHead(status, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OMP preview (Firebase-equivalent routing) on http://0.0.0.0:${PORT}/`);
});
