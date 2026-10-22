import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function audioManifest(root) {
  const entries = await readdir(path.join(root, 'audio'), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && /\.(mp3|m4a|ogg|wav|aac|flac)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name }) => {
      if (name === 'kino-sun.mp3') return { src: 'audio/kino-sun.mp3', title: 'Звезда по имени Солнце', artist: 'КИНО' };
      const label = path.parse(name).name.replace(/_/g, ' ');
      const split = label.indexOf(' - ');
      return { src: `audio/${encodeURIComponent(name)}`, title: split === -1 ? label : label.slice(split + 3), artist: split === -1 ? 'EVA.FM' : label.slice(0, split) };
    });
}
