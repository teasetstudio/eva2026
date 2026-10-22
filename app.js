(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const audio = $('#music');
  const panel = $('#music-panel');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let tracks = [{ src: 'audio/Fergie-Glamorous-Instrumental.mp3', title: 'Glamorous (Instrumental)', artist: 'Fergie' }];
  let trackIndex = 0;
  let youtubePlayer;
  let youtubeReady = false;
  let playRequest = 0;
  let toastTimer;
  let raveTimer;
  let raveActive = false;
  let petCount = 0;
  let pigeonTaps = [];
  let pageScroll = 0;

  const createDiamond = (className = 'pink-diamond') => {
    const diamond = document.createElement('img');
    diamond.className = className;
    diamond.src = 'images/diamong.png';
    diamond.alt = '';
    return diamond;
  };
  const renderWithDiamond = (element, message) => {
    element.replaceChildren(message, ' ', createDiamond());
  };
  const say = (message, withDiamond = false) => {
    const toast = $('#toast');
    if (withDiamond) renderWithDiamond(toast, message);
    else toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
  };
  const playerMessage = (message, withDiamond = false) => {
    const element = $('#player-message');
    if (withDiamond) renderWithDiamond(element, message);
    else element.textContent = message;
  };
  const time = (seconds) => Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—:—';

  // One shared audio element lives outside the panel, so closing it never stops a song.
  const syncPlayback = () => {
    const playing = !audio.paused;
    document.body.classList.toggle('is-playing', playing);
    $$('[data-play]').forEach((button) => {
      button.setAttribute('aria-label', playing ? 'Поставить музыку на паузу' : 'Включить музыку');
      button.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    });
    $('#dock-status').textContent = playing ? '· В ЭФИРЕ' : '· НАЖМИ PLAY';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    const current = $('#playlist [aria-current="true"] > span:last-child');
    if (current) current.replaceChildren(playing ? '♫' : createDiamond());
  };

  const pauseMusic = () => {
    playRequest++;
    audio.pause();
    syncPlayback();
  };

  const playMusic = async () => {
    const request = ++playRequest;
    if (youtubeReady) youtubePlayer.pauseVideo();
    $('#panic-video')?.pause();
    playerMessage('Загружаем твою песню…');
    try {
      await audio.play();
      if (request !== playRequest) return;
      playerMessage('Ты — главная героиня. Это твой саундтрек', true);
    } catch (error) {
      if (request !== playRequest || error.name === 'AbortError') return;
      const message = error.name === 'NotAllowedError'
        ? 'Нажми Play ещё раз, чтобы включить музыку'
        : 'Песня не загрузилась. Попробуй Play ещё раз.';
      const withDiamond = error.name === 'NotAllowedError';
      playerMessage(message, withDiamond);
      say(message, withDiamond);
    }
    syncPlayback();
  };

  const syncTrack = () => {
    const track = tracks[trackIndex];
    $('#dock-title').textContent = track.title;
    $('#panel-track-title').textContent = track.title;
    $('#panel-artist').textContent = track.artist;
    $('#track-count').textContent = `${String(tracks.length).padStart(2, '0')} ${tracks.length === 1 ? 'ТРЕК' : 'В ПЛЕЙЛИСТЕ'}`;
    const list = $('#playlist');
    list.replaceChildren();
    tracks.forEach((item, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-current', String(index === trackIndex));
      button.setAttribute('aria-label', `Включить: ${item.artist} — ${item.title}`);
      const number = document.createElement('span');
      number.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('span');
      info.textContent = item.title;
      const artist = document.createElement('small');
      artist.textContent = item.artist;
      info.append(artist);
      const icon = document.createElement('span');
      if (index === trackIndex && !audio.paused) icon.textContent = '♫';
      else icon.append(createDiamond());
      icon.setAttribute('aria-hidden', 'true');
      button.append(number, info, icon);
      button.addEventListener('click', () => selectTrack(index, true));
      li.append(button);
      list.append(li);
    });
    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: 'EVA.FM',
        artwork: [{ src: 'images/diamong.png', sizes: '445x410', type: 'image/png' }]
      });
    }
  };

  const selectTrack = (index, autoplay = !audio.paused) => {
    pauseMusic();
    trackIndex = (index + tracks.length) % tracks.length;
    audio.src = tracks[trackIndex].src;
    $('#seek').value = 0;
    $('#seek').disabled = true;
    $('#elapsed').textContent = '0:00';
    $('#duration').textContent = '—:—';
    syncTrack();
    if (autoplay) void playMusic();
  };
  const previous = () => {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else selectTrack(trackIndex - 1);
  };
  $$('[data-play]').forEach((button) => button.addEventListener('click', () => audio.paused ? void playMusic() : pauseMusic()));
  $$('[data-previous]').forEach((button) => button.addEventListener('click', previous));
  $$('[data-next]').forEach((button) => button.addEventListener('click', () => selectTrack(trackIndex + 1)));
  audio.volume = 0.7;
  audio.addEventListener('play', syncPlayback);
  audio.addEventListener('pause', syncPlayback);
  audio.addEventListener('ended', () => selectTrack(trackIndex + 1, true));
  audio.addEventListener('error', () => {
    playerMessage('Не удалось открыть песню. Проверь соединение и нажми Play.');
    syncPlayback();
  });
  audio.addEventListener('loadedmetadata', () => {
    $('#duration').textContent = time(audio.duration);
    $('#seek').disabled = !Number.isFinite(audio.duration);
  });
  let seeking = false;
  audio.addEventListener('timeupdate', () => {
    if (seeking) return;
    $('#elapsed').textContent = time(audio.currentTime);
    $('#seek').value = audio.duration ? String(audio.currentTime / audio.duration * 1000) : '0';
  });
  $('#seek').addEventListener('input', (event) => {
    seeking = true;
    $('#elapsed').textContent = time(Number(event.target.value) / 1000 * audio.duration);
  });
  $('#seek').addEventListener('change', (event) => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value) / 1000 * audio.duration;
    seeking = false;
  });
  $('#volume').addEventListener('input', (event) => {
    const value = Number(event.target.value);
    audio.volume = value / 100;
    $('#volume-value').textContent = `${value}%`;
  });
  // iOS Safari delegates media volume to the device's hardware controls.
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    $('#volume-hint').hidden = false;
    $('#volume').disabled = true;
    $('#volume-value').textContent = 'iPhone';
  }
  if ('mediaSession' in navigator) {
    const actions = { play: () => void playMusic(), pause: pauseMusic, previoustrack: previous, nexttrack: () => selectTrack(trackIndex + 1) };
    for (const [action, handler] of Object.entries(actions)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Unsupported on some mobile browsers. */ }
    }
  }
  syncTrack();
  fetch('tracks.json').then((response) => response.ok ? response.json() : Promise.reject())
    .then((manifest) => {
      const valid = manifest.filter((track) => typeof track.title === 'string' && typeof track.artist === 'string' && /^audio\/(?!.*\.\.)[^?#]+\.(mp3|m4a|ogg|wav|aac|flac)$/i.test(track.src));
      if (!valid.length) return;
      const currentSrc = tracks[trackIndex].src;
      tracks = valid;
      trackIndex = Math.max(0, tracks.findIndex((track) => track.src === currentSrc));
      syncTrack();
    }).catch(() => { /* The bundled song still works if the manifest is unavailable. */ });

  $$('[data-open-player]').forEach((button) => button.addEventListener('click', () => {
    if (panel.open) return;
    pageScroll = window.scrollY;
    panel.showModal();
    document.body.style.position = 'fixed';
    document.body.style.top = `-${pageScroll}px`;
    document.body.style.width = '100%';
    $$('.playlist-toggle').forEach((toggle) => toggle.setAttribute('aria-expanded', 'true'));
  }));
  $('#close-player').addEventListener('click', () => panel.close());
  panel.addEventListener('click', (event) => {
    if (event.target !== panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientY < rect.top || event.clientX < rect.left || event.clientX > rect.right) panel.close();
  });
  panel.addEventListener('close', () => {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo({ top: pageScroll, behavior: 'instant' });
    $$('.playlist-toggle').forEach((toggle) => toggle.setAttribute('aria-expanded', 'false'));
  });

  // The real privacy-enhanced player is never covered or replaced by a fake play button.
  const iframe = $('#pigeon-video');
  const embedURL = new URL(iframe.src);
  if (location.protocol !== 'file:') {
    embedURL.searchParams.set('origin', location.origin);
    iframe.src = embedURL.href;
  }
  const pauseForVideo = () => {
    const wasPlaying = !audio.paused;
    $('#panic-video')?.pause();
    pauseMusic();
    playerMessage('Музыка на паузе: сейчас голубиное ТВ. Вернуть её можно кнопкой Play.');
    renderWithDiamond($('#video-note'), 'Музыка на паузе. Вернуть её можно кнопкой Play');
    if (wasPlaying) say('Музыка подождёт. В эфире голуби', true);
  };
  $('#panic-video')?.addEventListener('play', () => {
    pauseMusic();
    if (youtubeReady) youtubePlayer.pauseVideo();
    playerMessage('Музыка на паузе: смотрим видеоулику из леса. Вернуть её можно кнопкой Play.');
  });
  const videoUnavailable = () => {
    $('#video-note').textContent = 'Эфир здесь недоступен. Открой этот же выпуск на YouTube ↓';
    $('.video-screen').classList.add('video-error');
  };
  let apiTimer;
  window.onYouTubeIframeAPIReady = () => {
    clearTimeout(apiTimer);
    youtubePlayer = new YT.Player('pigeon-video', {
      events: {
        onReady: () => { youtubeReady = true; },
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.BUFFERING) pauseForVideo();
          // ENDED deliberately does not restart the postcard's music.
        },
        onError: videoUnavailable,
      },
    });
  };
  let apiRequested = false;
  const requestYoutubeAPI = () => {
    if (apiRequested) return;
    apiRequested = true;
    if (window.YT?.Player) { window.onYouTubeIframeAPIReady(); return; }
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = videoUnavailable;
    document.head.append(script);
    apiTimer = setTimeout(() => {
      if (!youtubeReady) $('#video-note').textContent = 'Если эфир не загрузится, открой его на YouTube ↓';
    }, 15000);
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { requestYoutubeAPI(); observer.disconnect(); }
    }, { rootMargin: '600px' });
    observer.observe(iframe);
  } else requestYoutubeAPI();
  // Also pause on entry into the iframe if a content blocker prevents the API loading.
  window.addEventListener('blur', () => {
    setTimeout(() => { if (document.activeElement === iframe) pauseForVideo(); }, 0);
  });
  $('#youtube-fallback').addEventListener('click', pauseForVideo);
  $('#tv-heart').addEventListener('click', (event) => { sparkleAt(event.currentTarget); say('Твой лайк передан в голубятню', true); });

  // A single demand-driven canvas limits particles and avoids hundreds of DOM animations.
  const canvas = $('#glitter-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let frame = 0;
  let lastFrame = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  const budget = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 ? 75 : 125;
  const colors = ['#f33895', '#ff98d0', '#fff1a3', '#ad76e8', '#ffffff', '#efb962'];
  const resizeCanvas = () => {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  const draw = (now) => {
    const step = lastFrame ? Math.min((now - lastFrame) / 16.67, 2) : 1;
    lastFrame = now;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    particles = particles.filter((particle) => particle.life > 0);
    for (const particle of particles) {
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.vy += 0.065 * step;
      particle.life -= step;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation += 0.025 * step);
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / 18));
      ctx.fillStyle = particle.color;
      const size = particle.size;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.25, -size * 0.25);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.25, size * 0.25);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.25, size * 0.25);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.25, -size * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (particles.length) frame = requestAnimationFrame(draw);
    else { frame = 0; lastFrame = 0; ctx.clearRect(0, 0, canvasWidth, canvasHeight); }
  };
  const burst = (x, y, count = 15, force = 3) => {
    if (!ctx || document.hidden) return;
    if (motionPreference.matches) { count = Math.min(count, 5); force = 0.5; }
    const available = Math.max(0, budget - particles.length);
    for (let i = 0; i < Math.min(count, available); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.75 + 0.25) * force;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
        life: motionPreference.matches ? 15 : 35 + Math.random() * 25, size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)], rotation: Math.random() * Math.PI });
    }
    if (!frame && particles.length) frame = requestAnimationFrame(draw);
  };
  function sparkleAt(element) {
    const rect = element.getBoundingClientRect();
    burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 22);
  }
  let fireworksRunning = false;
  $('#fireworks-button').addEventListener('click', () => {
    if (fireworksRunning) return;
    fireworksRunning = true;
    say('ЕВА, +999 ОЧКОВ ГЛАМУРА! ✦');
    const bounds = $('.postcard').getBoundingClientRect();
    const bursts = motionPreference.matches ? 1 : 6;
    for (let i = 0; i < bursts; i++) setTimeout(() => {
      burst(bounds.left + bounds.width * (0.15 + Math.random() * 0.7), canvasHeight * (0.14 + Math.random() * 0.55), 40, 6);
    }, i * 250);
    setTimeout(() => { fireworksRunning = false; }, 2000);
  });
  $$('.glitter-zone').forEach((zone) => zone.addEventListener('click', (event) => {
    if (event.target.closest('button,a,input,iframe')) return;
    burst(event.clientX, event.clientY, 10, 2);
  }));

  const bounce = (element) => {
    element.classList.remove('bouncing');
    void element.offsetWidth;
    element.classList.add('bouncing');
    sparkleAt(element);
    setTimeout(() => element.classList.remove('bouncing'), 700);
  };
  const catMessages = ['Кошачий совет вынес положительный вердикт.', 'Кот в очках подтвердил VIP-статус.', 'Котодоверие: +100 очков.', 'Эксперт удовлетворён. Это редкость.'];
  const petCat = (element) => {
    bounce(element);
    petCount++;
    $('#pet-count').textContent = `∞ + ${petCount} мур`;
    say(catMessages[(petCount - 1) % catMessages.length]);
  };
  $$('.cat-interaction').forEach((cat) => cat.addEventListener('click', () => petCat(cat)));
  const stopRave = () => {
    clearTimeout(raveTimer);
    raveActive = false;
    document.body.classList.remove('rave-mode');
    $('#rave-banner').hidden = true;
    $('#rave-stop').hidden = true;
  };
  const startRave = () => {
    if (raveActive) return;
    raveActive = true;
    document.body.classList.add('rave-mode');
    $('#rave-banner').hidden = false;
    $('#rave-stop').hidden = false;
    say('СЕКРЕТ ОТКРЫТ: ГОЛУБИНЫЙ РЕЙВ 🪩');
    burst(innerWidth / 2, innerHeight * 0.35, 45, 5);
    // This changes the visuals only; a secret never starts unsolicited audio.
    raveTimer = setTimeout(stopRave, 20000);
  };
  const flyPigeon = (element) => {
    if (element.classList.contains('flying')) return;
    element.classList.add('flying');
    sparkleAt(element);
    setTimeout(() => element.classList.remove('flying'), 1500);
    const now = Date.now();
    pigeonTaps = pigeonTaps.filter((tap) => now - tap < 12000);
    pigeonTaps.push(now);
    if (pigeonTaps.length >= 5) { pigeonTaps = []; startRave(); }
    else say(['Курлык! Протокол одобрения доставлен.', 'Птица счастья временно покинула чат.', 'Голубь ушёл за блёстками.'][pigeonTaps.length % 3]);
  };
  $$('.pigeon-interaction').forEach((pigeon) => pigeon.addEventListener('click', () => flyPigeon(pigeon)));
  $('#rave-stop').addEventListener('click', stopRave);
  $('#rave-close').addEventListener('click', stopRave);

  const compliments = ['Международный голубиный комитет выражает Еве уважение.', 'Коты вынесли положительный вердикт. Обжалованию не подлежит.', 'Ева, тебе присвоено звание «ЛЕГЕНДА 2007 ГОДА».', 'Поздравляем! Голуби решили не воровать твои крошки.', 'Кот в очках лично подтвердил твой VIP-статус.'];
  let complimentIndex = 0;
  $('#compliment-button').addEventListener('click', (event) => {
    $('#compliment').textContent = compliments[complimentIndex++ % compliments.length];
    renderWithDiamond(event.currentTarget, 'Ещё одно сообщение');
    sparkleAt(event.currentTarget);
  });

  // Pointer capture supports real fingers; constrain each sticker inside its own collage.
  $$('.draggable').forEach((sticker) => {
    let drag;
    let x = 0;
    let y = 0;
    let suppressClick = false;
    sticker.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const rect = sticker.getBoundingClientRect();
      const bounds = sticker.parentElement.getBoundingClientRect();
      drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x, y,
        minX: x + bounds.left - rect.left + 5, maxX: x + bounds.right - rect.right - 5,
        minY: y + bounds.top - rect.top + 5, maxY: y + bounds.bottom - rect.bottom - 5, moved: false };
      sticker.setPointerCapture(event.pointerId);
      sticker.classList.add('dragging');
    });
    sticker.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (!drag.moved) return;
      x = Math.max(drag.minX, Math.min(drag.maxX, drag.x + dx));
      y = Math.max(drag.minY, Math.min(drag.maxY, drag.y + dy));
      sticker.style.translate = `${x}px ${y}px`;
    });
    const finishDrag = (event) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      suppressClick = drag.moved;
      if (drag.moved) sparkleAt(sticker);
      drag = null;
      sticker.classList.remove('dragging');
      setTimeout(() => { suppressClick = false; }, 50);
    };
    sticker.addEventListener('pointerup', finishDrag);
    sticker.addEventListener('pointercancel', finishDrag);
    sticker.addEventListener('lostpointercapture', finishDrag);
    sticker.addEventListener('click', () => { if (!suppressClick) { sparkleAt(sticker); say('Эту наклейку можно двигать пальцем', true); } });
  });

  // Native scrolling keeps photo swipes, vertical page scrolling and pinch zoom
  // available without gesture handlers or an autoplay timer.
  const friendsTrack = $('#friends-track');
  if (friendsTrack) {
    const slides = [...friendsTrack.querySelectorAll('.friends-slide')];
    const dots = $$('[data-friends-slide]');
    let active = 0;
    let scrollTimer;
    let trackWidth = friendsTrack.clientWidth;
    const updatePhoto = (index) => {
      active = index;
      $('#friends-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      dots.forEach((dot, dotIndex) => dot.setAttribute('aria-current', String(dotIndex === index)));
    };
    const showPhoto = (index, instant = false) => {
      clearTimeout(scrollTimer);
      const destination = (index + slides.length) % slides.length;
      const jump = instant || Math.abs(destination - active) > 1;
      updatePhoto(destination);
      friendsTrack.scrollTo({
        left: slides[active].offsetLeft,
        behavior: jump || motionPreference.matches ? 'instant' : 'smooth',
      });
    };
    const readPhoto = () => {
      clearTimeout(scrollTimer);
      const index = slides.reduce((nearest, slide, candidate) =>
        Math.abs(slide.offsetLeft - friendsTrack.scrollLeft) < Math.abs(slides[nearest].offsetLeft - friendsTrack.scrollLeft) ? candidate : nearest, 0);
      if (index !== active) updatePhoto(index);
    };
    $('#friends-previous').addEventListener('click', () => showPhoto(active - 1));
    $('#friends-next').addEventListener('click', () => showPhoto(active + 1));
    dots.forEach((dot) => dot.addEventListener('click', () => showPhoto(Number(dot.dataset.friendsSlide))));
    friendsTrack.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(readPhoto, 140);
    }, { passive: true });
    friendsTrack.addEventListener('scrollend', readPhoto);
    friendsTrack.addEventListener('keydown', (event) => {
      if (event.target !== friendsTrack) return;
      const destinations = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 };
      if (!(event.key in destinations)) return;
      event.preventDefault();
      showPhoto(destinations[event.key], event.key === 'Home' || event.key === 'End');
    });
    const resizePhotos = () => {
      if (friendsTrack.clientWidth === trackWidth) return;
      trackWidth = friendsTrack.clientWidth;
      showPhoto(active, true);
    };
    if ('ResizeObserver' in window) new ResizeObserver(resizePhotos).observe(friendsTrack);
    else window.addEventListener('resize', resizePhotos, { passive: true });
    motionPreference.addEventListener('change', () => showPhoto(active, true));
    updatePhoto(0);
    $('#friends-navigation').hidden = false;
  }

  let visitorTimer;
  let visitorHideTimer;
  let visits = 0;
  const visitor = $('#edge-visitor');
  const scheduleVisitor = () => {
    clearTimeout(visitorTimer);
    if (document.hidden || motionPreference.matches) return;
    visitorTimer = setTimeout(() => {
      if (panel.open || raveActive || $('#cat-panic')?.dataset.paused === 'false') { scheduleVisitor(); return; }
      visits++;
      const pigeon = visits % 2 === 0;
      $('#visitor-image').src = pigeon ? 'images/mobile/peagun2.webp' : 'images/mobile/cat2.webp';
      $('#visitor-image').alt = pigeon ? 'Голубь заглянул с края экрана' : 'Кот заглянул с края экрана';
      $('#visitor-button').setAttribute('aria-label', pigeon ? 'Отправить неожиданного голубя в полёт' : 'Погладить неожиданного кота');
      $('#visitor-speech').textContent = pigeon ? 'курлык. это я. снова.' : 'проверка: ты улыбаешься?';
      visitor.hidden = false;
      visitorHideTimer = setTimeout(() => { visitor.hidden = true; scheduleVisitor(); }, 5500);
    }, 26000);
  };
  $('#visitor-button').addEventListener('click', (event) => {
    if (visits % 2 === 0) flyPigeon(event.currentTarget);
    else petCat(event.currentTarget);
    clearTimeout(visitorHideTimer);
    visitorHideTimer = setTimeout(() => { visitor.hidden = true; scheduleVisitor(); }, 1600);
  });
  scheduleVisitor();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(visitorTimer);
      clearTimeout(visitorHideTimer);
      visitor.hidden = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      particles = [];
      if (ctx) ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    } else scheduleVisitor();
  });
  motionPreference.addEventListener('change', () => {
    visitor.hidden = true;
    clearTimeout(visitorHideTimer);
    scheduleVisitor();
  });
})();
