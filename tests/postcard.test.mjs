import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioManifest } from '../scripts/audio-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let server;
let base;
before(async () => {
  server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview did not start')), 5000);
    server.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    server.stderr.on('data', (chunk) => { clearTimeout(timer); reject(new Error(chunk.toString())); });
    server.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
});
after(() => server?.kill());

test('playlist discovers real audio, safely encodes names, and excludes folders and non-audio files', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'eva-manifest-'));
  try {
    await mkdir(path.join(fixture, 'audio'));
    for (const name of ['kino-sun.mp3', 'Ева - Любимая песня.mp3', 'Read me.txt', 'A #1 - Love & glitter.m4a']) {
      await writeFile(path.join(fixture, 'audio', name), 'fixture');
    }
    await mkdir(path.join(fixture, 'audio', 'folder.mp3'));
    const manifest = await audioManifest(fixture);
    assert.equal(manifest.length, 3);
    assert.deepEqual(manifest.find((track) => track.artist === 'КИНО'), { src: 'audio/kino-sun.mp3', title: 'Звезда по имени Солнце', artist: 'КИНО' });
    const unicode = manifest.find((track) => track.artist === 'Ева');
    assert.equal(unicode.title, 'Любимая песня');
    assert.equal(decodeURIComponent(unicode.src), 'audio/Ева - Любимая песня.mp3');
    assert.match(manifest.find((track) => track.artist === 'A #1').src, /%23/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test('preview serves the postcard and live playlist', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /youtube-nocookie\.com\/embed\/LZRpBgiMeNs\?/);
  assert.match(html, /youtube\.com\/watch\?v=LZRpBgiMeNs/);
  assert.match(html, /autoplay=0/);
  assert.deepEqual(await (await fetch(`${base}/tracks.json`)).json(), await audioManifest(root));
});

test('audio supports mobile seek range requests and HEAD', async () => {
  const bytes = await readFile(path.join(root, 'audio/kino-sun.mp3'));
  const partial = await fetch(`${base}/audio/kino-sun.mp3`, { headers: { Range: 'bytes=100-1123' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), `bytes 100-1123/${bytes.length}`);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(100, 1124));
  const suffix = await fetch(`${base}/audio/kino-sun.mp3`, { headers: { Range: 'bytes=-100' } });
  assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), bytes.subarray(-100));
  const invalid = await fetch(`${base}/audio/kino-sun.mp3`, { headers: { Range: `bytes=${bytes.length + 5}-` } });
  assert.equal(invalid.status, 416);
  const head = await fetch(`${base}/audio/kino-sun.mp3`, { method: 'HEAD' });
  assert.equal(Number(head.headers.get('content-length')), bytes.length);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test('preview keeps configuration and repository files private', async () => {
  for (const pathname of ['/.git/config', '/package.json', '/scripts/serve.mjs', '/%2e%2e/package.json', '/audio/missing.mp3']) {
    assert.equal((await fetch(base + pathname)).status, 404, pathname);
  }
});

test('production package contains every local page asset and every playlist song', async () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const output = path.join(root, 'dist');
  const html = await readFile(path.join(output, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const asset = match[1];
    if (/^(https?:|data:)/.test(asset)) continue;
    await access(path.join(output, asset));
  }
  const manifest = JSON.parse(await readFile(path.join(output, 'tracks.json'), 'utf8'));
  assert.ok(manifest.length > 0);
  for (const track of manifest) await access(path.join(output, decodeURIComponent(track.src)));
  assert.deepEqual(manifest, await audioManifest(root));
});
