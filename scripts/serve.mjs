import http from 'node:http';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { audioManifest } from './audio-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.aac': 'audio/aac', '.flac': 'audio/flac' };

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/tracks.json') {
      response.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(await audioManifest(root)));
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only postcard assets, never the repository or local configuration.
    if (!/^(index\.html|styles\.css|app\.js|panic\.css|panic\.js|tracks\.json|images\/(diamong|butterfly|lapki|like|cat4)\.png|images\/friends[1-7]\.jpg|images\/mobile\/[^/]+\.webp|video\/eva2\.mp4|audio\/[^/]+\.(mp3|m4a|ogg|wav|aac|flac))$/i.test(relative)) {
      response.writeHead(404).end('Not found'); return;
    }
    const file = path.resolve(root, relative);
    if (!file.startsWith(root)) { response.writeHead(404).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
    let start = 0;
    let end = info.size - 1;
    let status = 200;
    if (request.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!range || (!range[1] && !range[2])) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      if (range[1]) { start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), end) : end; }
      else start = Math.max(0, info.size - Number(range[2]));
      if (start > end || start >= info.size) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    response.writeHead(status, headers);
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file, { start, end }).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
});
server.on('error', (error) => { console.error(`Could not start preview: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Eva's postcard: http://localhost:${server.address().port}`));
