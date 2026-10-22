import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function audioManifest(root) {
  const knownTracks = new Map([
    ['Fergie-Glamorous-Instrumental.mp3', { order: 0, title: 'Glamorous (Instrumental)', artist: 'Fergie' }],
    ['nebesa-meladze.mp3', { order: 1, title: 'Небеса', artist: 'Меладзе' }],
    ['kino-sun.mp3', { order: 2, title: 'Звезда по имени Солнце', artist: 'КИНО' }],
  ]);
  const entries = await readdir(path.join(root, 'audio'), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && /\.(mp3|m4a|ogg|wav|aac|flac)$/i.test(entry.name))
    .sort((a, b) => (knownTracks.get(a.name)?.order ?? 1000) - (knownTracks.get(b.name)?.order ?? 1000) || a.name.localeCompare(b.name))
    .map(({ name }) => {
      const known = knownTracks.get(name);
      if (known) return { src: `audio/${encodeURIComponent(name)}`, title: known.title, artist: known.artist };
      const label = path.parse(name).name.replace(/_/g, ' ');
      const split = label.indexOf(' - ');
      return { src: `audio/${encodeURIComponent(name)}`, title: split === -1 ? label : label.slice(split + 3), artist: split === -1 ? 'EVA.FM' : label.slice(0, split) };
    });
}
