import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Real mobile touch events through Chrome's built-in protocol; no test dependency.
const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'eva-panic-profile-'));
const screenshots = await mkdtemp(path.join(tmpdir(), 'eva-panic-screenshots-'));
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let chrome;
let socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ready = (child, stream, pattern) => new Promise((resolve, reject) => {
  let output = '';
  const timer = setTimeout(() => reject(new Error(`Process did not become ready: ${output}`)), 10000);
  child[stream].on('data', (chunk) => {
    output += chunk;
    const match = output.match(pattern);
    if (match) { clearTimeout(timer); resolve(match[1]); }
  });
  child.once('error', (error) => { clearTimeout(timer); reject(error); });
  child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Process exited (${code}): ${output}`)); });
});

try {
  const port = await ready(server, 'stdout', /localhost:(\d+)/);
  chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const browserURL = await ready(chrome, 'stderr', /DevTools listening on (ws:\/\/[^\s]+)/);
  const debugPort = new URL(browserURL).port;
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  const missingAssets = [];
  const videoRequests = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/video/eva2.mp4')) videoRequests.push(message.params.request.url);
    if (message.method === 'Network.responseReceived') {
      const { response } = message.params;
      if (response.url.startsWith(`http://127.0.0.1:${port}/`) && response.status >= 400) missingAssets.push(response.url);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression, timeout = 5000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await pause(40);
    }
    const media = await evaluate(`(() => { const v = document.querySelector('#panic-video'); return {scene:document.querySelector('#cat-panic').dataset.scene,paused:v.paused,source:v.currentSrc,networkState:v.networkState,readyState:v.readyState,error:v.error?.code}; })()`);
    throw new Error(`Timed out: ${expression}. Media: ${JSON.stringify(media)}`);
  };
  const tap = async (selector) => {
    const point = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      const rect = element.getBoundingClientRect();
      const dock = document.querySelector('.music-dock').getBoundingClientRect();
      if (rect.top >= dock.top && !element.closest('.music-dock,dialog')) window.scrollBy({top: rect.bottom - dock.top + 15, behavior: 'instant'});
      const r = element.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 2, radiusY: 2 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pause(80);
  };
  const shot = async (name) => {
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(screenshots, `${name}.png`), Buffer.from(result.data, 'base64'));
  };
  const state = () => evaluate(`({scene:document.querySelector('#cat-panic').dataset.scene,phase:document.querySelector('#cat-panic').dataset.phase,value:document.querySelector('#panic-meter').getAttribute('aria-valuenow'),guest:!document.querySelector('#panic-edge-guest').hidden,reveal:!document.querySelector('#panic-reveal').hidden,paused:document.querySelector('#panic-video').paused,bodyLock:document.body.style.position})`);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await until(`document.readyState === 'complete' && document.querySelector('#playlist button')`);
  await evaluate(`document.querySelector('#cat-panic').scrollIntoView({block:'start',behavior:'instant'})`);
  await evaluate(`document.querySelector('.panic-cat').decode()`);
  await shot('idle-390');
  assert.equal(videoRequests.length, 0, 'The forest clip must not download before its reveal');
  await tap('.dock-controls [data-play]');
  await until(`!document.querySelector('#music').paused`);
  const levels = ['10', '47', '99', '999', '9999'];
  const scenes = ['intruder', 'news', 'visitor', 'suspect', 'reveal'];
  for (let index = 0; index < scenes.length; index++) {
    await tap('#panic-button');
    const current = await state();
    assert.equal(current.scene, scenes[index]);
    assert.equal(current.value, levels[index]);
    assert.equal(current.bodyLock, '');
    if (index === 2) { await until(`!document.querySelector('#panic-edge-guest').hidden`); await pause(1000); }
    else if (index === 4) {
      await until(`document.querySelector('#panic-video').currentTime > .25`);
      assert.equal(current.reveal, true);
      assert.equal(await evaluate(`document.querySelector('#music').paused`), true);
      assert.equal(await evaluate(`document.querySelector('#panic-video').playsInline`), true);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('#panic-video')).clipPath`), 'circle(50%)');
    }
    else await pause(700);
    await shot(scenes[index]);
  }
  assert.ok(videoRequests.length > 0);
  await tap('#panic-video-toggle');
  assert.equal((await state()).paused, true);
  await tap('#panic-video-toggle');
  await until(`!document.querySelector('#panic-video').paused`);
  await tap('#panic-video-sound');
  assert.equal(await evaluate(`document.querySelector('#panic-video').muted`), true);
  await tap('#panic-video-sound');
  assert.equal(await evaluate(`document.querySelector('#panic-video').muted`), false);
  await evaluate(`document.querySelector('#panic-video').currentTime = document.querySelector('#panic-video').duration - .15`);
  await until(`document.querySelector('#panic-video').ended`);
  assert.equal(await evaluate(`document.querySelector('#panic-verdict').hidden`), false);
  assert.match(await evaluate(`document.querySelector('#panic-announcement').textContent`), /Кто не работает, тот ест/);
  assert.equal(await evaluate(`document.querySelector('#music').paused`), true);
  await evaluate(`document.querySelector('#panic-verdict').scrollIntoView({block:'center',behavior:'instant'})`);
  await shot('forest-verdict');
  await tap('#panic-button');
  assert.equal((await state()).scene, 'idle');
  assert.equal((await state()).reveal, false);
  assert.equal((await state()).paused, true);
  // Reset while animations are pending, then wait beyond every old callback.
  await evaluate(`for (let i=0;i<6;i++) document.querySelector('#panic-button').click()`);
  await pause(3300);
  assert.equal((await state()).scene, 'idle');
  assert.equal((await state()).value, '0');
  assert.equal((await state()).guest, false);
  assert.equal((await state()).reveal, false);
  assert.equal((await state()).paused, true);

  // The final album uses real scrolling: buttons, dots, keyboard and a finger.
  const photoIndex = () => evaluate(`Number(document.querySelector('[data-friends-slide][aria-current="true"]').dataset.friendsSlide)`);
  const photoSettled = (index) => until(`Math.abs(document.querySelector('#friends-track').scrollLeft - document.querySelectorAll('.friends-slide')[${index}].offsetLeft) < 2 && document.querySelector('[data-friends-slide="${index}"]').getAttribute('aria-current') === 'true'`);
  for (const [width, height] of [[320,568],[360,740],[390,844],[430,932]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await pause(100);
    await evaluate(`document.querySelector('#friends').scrollIntoView({block:'start',behavior:'instant'})`);
    await tap('[data-friends-slide="0"]');
    await photoSettled(0);
    for (let index = 1; index < 7; index++) {
      await tap('#friends-next');
      await photoSettled(index);
    }
    await tap('#friends-next');
    await photoSettled(0);
    await tap('#friends-previous');
    await photoSettled(6);
    await tap('[data-friends-slide="1"]');
    await photoSettled(1);
    const layout = await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('#friends button,#friends a')].map(e=>e.getBoundingClientRect()).filter(r=>r.width<44||r.height<44).length,contain:[...document.querySelectorAll('.friends-photo img')].every(e=>getComputedStyle(e).objectFit==='contain')})`);
    assert.equal(layout.scroll, width);
    assert.equal(layout.targets, 0);
    assert.equal(layout.contain, true);
    await evaluate(`document.querySelector('#friends-track').scrollIntoView({block:'center',behavior:'instant'}); document.querySelector('.friends-slide img').decode()`);
    await shot(`friends-${width}`);
  }
  // Keep the selected photograph when the viewport changes orientation/size.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await photoSettled(1);
  await evaluate(`document.querySelector('#friends-track').focus({preventScroll:true})`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End' });
  await photoSettled(6);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight' });
  await photoSettled(0);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  const swipeStart = await evaluate(`(() => { const e=document.querySelector('#friends-track'); e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.right-30,y:r.top+150,width:r.width}; })()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: swipeStart.x, y: swipeStart.y }] });
  for (let step=1; step<=8; step++) {
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: swipeStart.x - (swipeStart.width - 60)*step/8, y: swipeStart.y }] });
    await pause(25);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await photoSettled(1);
  await evaluate(`for(let i=0;i<8;i++) document.querySelector('#friends-next').click()`);
  await photoSettled(2);
  await pause(400);
  assert.equal(await photoIndex(), 2);
  await evaluate(`Promise.all([...document.querySelectorAll('.friends-photo img')].map(image=>image.decode()))`);
  assert.equal(await evaluate(`[...document.querySelectorAll('.friends-photo img')].every((image,index)=>index<2?image.naturalHeight>image.naturalWidth:image.naturalWidth>image.naturalHeight)`), true);
  await shot('friends-swipe');
  console.log('PASS: seven-photo album at 320–430px, full frames, orientation, arrows/dots/wrap, keyboard, native swipe, rapid taps, resize');

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const [width, height] of [[320,568],[360,740],[390,844],[430,932]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await pause(100);
    for (let index=0; index<6; index++) {
      if (index) await tap('#panic-button');
      const layout = await evaluate(`(() => {
        const button = document.querySelector('#panic-button');
        const rect = button.getBoundingClientRect();
        return {width:innerWidth,scroll:document.documentElement.scrollWidth,buttonWidth:rect.width,buttonHeight:rect.height,stageTop:document.querySelector('.panic-stage').getBoundingClientRect().top,buttonBottom:rect.bottom,dockTop:document.querySelector('.music-dock').getBoundingClientRect().top,overflow:[...document.querySelectorAll('#cat-panic h2,#panic-event-title,#panic-event-detail,#panic-level,#panic-button-label')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.id),motion:[...document.querySelectorAll('#cat-panic *')].flatMap(e=>e.getAnimations()).filter(a=>a.playState==='running').length};
      })()`);
      assert.equal(layout.scroll, width, `Horizontal overflow at ${width}px, scene ${index}`);
      assert.ok(layout.buttonWidth >= 44 && layout.buttonHeight >= 58);
      assert.deepEqual(layout.overflow, [], `Text overflow at ${width}px`);
      assert.equal(layout.motion, 0);
      if (index) {
        assert.equal((await state()).value, levels[index-1]);
        assert.equal((await state()).phase, 'settled');
        assert.ok(layout.stageTop >= 0 && layout.buttonBottom <= layout.dockTop, `Cat and action should both fit at ${width}×${height}, scene ${index}: ${JSON.stringify(layout)}`);
      }
    }
    await shot(`reduced-${width}`);
    await tap('#panic-button');
    assert.equal((await state()).scene, 'idle');
    console.log(`PASS: ${width}×${height}, four guesses + circular video, reduced motion, replay, no overflow`);
  }

  // Existing features still work after several complete panic cycles.
  await tap('.hero-cat');
  assert.match(await evaluate(`document.querySelector('#pet-count').textContent`), /1 мур/);
  await tap('#compliment-button');
  assert.match(await evaluate(`document.querySelector('#compliment').textContent`), /голубиный комитет/);
  await tap('.dock-controls [data-play]');
  await until(`!document.querySelector('#music').paused`);
  await tap('[data-open-player].playlist-toggle');
  assert.equal(await evaluate(`document.querySelector('#music-panel').open`), true);
  assert.equal(await evaluate(`document.body.style.position`), 'fixed');
  await tap('#close-player');
  assert.equal(await evaluate(`document.body.style.position`), '');
  assert.equal(await evaluate(`document.querySelector('#music').paused`), false);
  await tap('#panic-button');
  assert.equal(await evaluate(`document.querySelector('#music').paused`), false);
  await evaluate(`for(let i=0;i<4;i++) document.querySelector('#panic-button').click()`);
  await until(`!document.querySelector('#panic-video').paused`);
  assert.equal(await evaluate(`document.querySelector('#music').paused`), true);
  await tap('.dock-controls [data-play]');
  await until(`!document.querySelector('#music').paused`);
  assert.equal((await state()).paused, true);
  await tap('#panic-video-toggle');
  await until(`!document.querySelector('#panic-video').paused`);
  assert.equal(await evaluate(`document.querySelector('#music').paused`), true);
  await tap('.hero-cat');
  await until(`document.querySelector('#panic-video').paused`);
  // A failed MP4 request exposes a useful fallback and can be retried in place.
  await evaluate(`document.querySelector('#panic-video source').src = 'video/missing.mp4'; document.querySelector('#panic-video').load()`);
  await tap('#panic-video-toggle');
  await until(`!document.querySelector('#panic-video-error').hidden`);
  assert.match(await evaluate(`document.querySelector('#panic-video-toggle').getAttribute('aria-label')`), /Повторить загрузку/);
  assert.match(await evaluate(`document.querySelector('#panic-video-error a').href`), /video\/eva2\.mp4$/);
  await evaluate(`document.querySelector('#panic-video source').src = 'video/eva2.mp4'`);
  await tap('#panic-video-toggle');
  await until(`document.querySelector('#panic-video').currentTime > .1 && !document.querySelector('#panic-video').paused`);
  assert.equal(await evaluate(`document.querySelector('#pigeon-video').src.includes('/LZRpBgiMeNs?')`), true);
  assert.match(await evaluate(`document.querySelector('.verse-copy').textContent`), /познавай Его во всех своих путях/);
  assert.deepEqual(exceptions, []);
  assert.deepEqual(missingAssets.filter((url) => new URL(url).pathname !== '/video/missing.mp4'), []);
  console.log(`PASS: lazy video, circle mask, playback/pause/sound/ending, failed-load retry, media coordination, timer cleanup, existing features. Screenshots: ${screenshots}`);
} finally {
  socket?.close();
  server.kill();
  if (chrome) {
    const stopped = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await Promise.race([stopped, pause(2000)]);
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
