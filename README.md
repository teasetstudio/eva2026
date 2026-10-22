# Eva's little pink internet

A portrait-phone postcard in Russian, built with HTML, CSS and JavaScript. No runtime dependencies or framework. Optimized for 320–430px phones; wider screens keep the same single-column postcard.

Run `npm start` and open `http://localhost:4173`. Run `npm run build` to create `dist/` for any static host. Serve over HTTP(S), rather than opening the HTML as a file. `npm test` checks the audio manifest, static package, and preview server's media requests.

## Music

The supplied `audio` folder currently contains **one actual song**: КИНО — Звезда по имени Солнце. Previous/next wrap through the available files. Add more files to `audio/`; the development server and build discover them automatically. Use `Artist - Song title.mp3` for readable labels. MP3, M4A, OGG, WAV, AAC and FLAC are included; browser codec support varies, so MP3/M4A are best for phones. Playback begins only after a visitor taps Play.

The sticky dock and expanded panel share one audio element. Closing the panel or scrolling preserves playback. On iPhone, volume uses the phone's hardware buttons, with an explanation in the panel. Android and other browsers also have a volume slider.

## Pigeon TV

The real YouTube iframe embeds **LZRpBgiMeNs** on `youtube-nocookie.com`, without autoplay. The IFrame API pauses music on PLAYING or BUFFERING; focusing the iframe also pauses music if the API is blocked. Video ending never resumes music. Explicitly playing music pauses the YouTube player when its API is available. The exact-video fallback link remains available if embedding, a network, or a content blocker prevents playback.

## Tiny secrets

The final «Хорошая компания» photo album uses the seven supplied `images/friends*.jpg` photos. Swipe, arrows, dots or keyboard arrows move between frames; the arrows wrap at both ends. There is no automatic advance. Mobile WebP copies in `images/mobile/` preserve the full frames and correct EXIF orientation; ↗ opens each untouched original separately. Reduced motion switches slide navigation to instant scrolling.

«КОТ В ШОКЕ» follows the cat gallery. Four false guesses lead to the actual answer: `video/eva2.mp4`, a 19-second forest recording displayed in a Telegram-style circle. The final tap starts it inline with sound and pauses music/YouTube. Tap the circle to pause or replay; sound has a separate control. After the clip, a forest report reveals who collected the berries and who ate them. A text summary is also available. Video stays unloaded until the reveal; scrolling away, hiding the tab, resetting, or starting music pauses it. Rapid taps cancel earlier effects; reduced motion disables decorative animations. Original `images/cat4.png` is preserved and decorative edge visitors wait while this section is visible.

`npm run test:panic` runs real mobile touch checks in headless Chrome at 320, 360, 390 and 430px, including the circular video's playback/sound/ending, music coordination, replay, rapid taps, reduced motion and existing interactions. Chrome is required (`CHROME_BIN` overrides its path). Screenshots are written to a temporary directory printed by the command.

Tap cats, tap pigeons, tap decorative backgrounds, drag the two stickers, read Nokia messages, or use the large fireworks button. Five pigeon taps within twelve seconds open a twenty-second «ГОЛУБИНЫЙ РЕЙВ»; the close button ends it immediately. Pigeons return after flying away. Edge visitors appear occasionally while the page is visible. A secret never turns on audio automatically.

Particles share one canvas, capped at 75–125 concurrent particles, with animation frames running only while needed. Offscreen tabs stop decorative effects. Reduced-motion preferences limit glitter and disable recurring edge visitors. Original images are retained; the site uses small WebP versions in `images/mobile/` (about 125 KB total).
