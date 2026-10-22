import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioManifest } from './audio-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const tracks = await audioManifest(root);
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'images'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'panic.css', 'panic.js']) await cp(path.join(root, file), path.join(output, file));
for (const image of ['diamong.png', 'butterfly.png', 'lapki.png', 'like.png', 'cat4.png', 'friends1.jpg', 'friends2.jpg', 'friends3.jpg', 'friends4.jpg', 'friends5.jpg', 'friends6.jpg', 'friends7.jpg']) {
  await cp(path.join(root, 'images', image), path.join(output, 'images', image));
}
await cp(path.join(root, 'images/mobile'), path.join(output, 'images/mobile'), { recursive: true });
await cp(path.join(root, 'audio'), path.join(output, 'audio'), { recursive: true });
await mkdir(path.join(output, 'video'), { recursive: true });
await cp(path.join(root, 'video/eva2.mp4'), path.join(output, 'video/eva2.mp4'));
await writeFile(path.join(output, 'tracks.json'), JSON.stringify(tracks, null, 2) + '\n');
console.log(`Built dist/ with ${tracks.length} audio track(s). Ready for static hosting.`);
