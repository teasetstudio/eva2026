(() => {
  'use strict';

  const section = document.querySelector('#cat-panic');
  if (!section) return;
  const find = (selector) => section.querySelector(selector);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const button = find('#panic-button');
  const meter = find('#panic-meter');
  const guest = find('#panic-edge-guest');
  const video = find('#panic-video');
  const reveal = find('#panic-reveal');
  const videoToggle = find('#panic-video-toggle');
  const videoStatus = find('#panic-video-status');
  const announcement = find('#panic-announcement');
  const timers = new Set();
  const scenes = [
    { id: 'intruder', value: 10, fill: 10, level: 'Лёгкое беспокойство', label: 'ВЕРСИЯ 01 / ГОСТЬ БЕЗ ЗАПИСИ', title: 'ГОЛУБЬ ЗАШЁЛ БЕЗ СТУКА?', detail: 'Нет. Этот вообще ключи себе сделал. Кот уже привык.', caption: 'Не то. Копаем дальше.' },
    { id: 'news', value: 47, fill: 47, level: 'Он что-то подозревает', label: 'ВЕРСИЯ 02 / ОШИБКА СИСТЕМЫ', title: 'ПАПКА «ЕДА» ОКАЗАЛАСЬ ПУСТОЙ?', detail: 'Страшно. Но кот говорит: дело не в его еде.', caption: 'Чужая еда. Уже интереснее.' },
    { id: 'visitor', value: 99, fill: 99, level: 'ПОЛНАЯ ПАНИКА', label: 'ВЕРСИЯ 03 / ДОПРОС ГОЛУБЯ', title: 'ГОЛУБЬ СЪЕЛ ВСЁ ПЕРВЫМ?', detail: '«Это не я». Он даже вопроса не дослушал.', caption: 'Алиби: клевал в другом месте.' },
    { id: 'suspect', value: 999, fill: 100, level: 'КОТ ЧТО-ТО ВСПОМНИЛ', label: 'ВЕРСИЯ 04 / СЛЕД ВЕДЁТ В ЛЕС', title: 'ОДНИ СОБИРАЛИ. КТО-ТО ЕЛ.', detail: 'У кота есть запись. И на ней всё гораздо хуже.', caption: 'Вспомнил. Лучше бы не вспоминал.' },
    { id: 'reveal', value: 9999, fill: 100, level: 'ЯГОДНЫЙ СКАНДАЛ', label: 'ВИДЕОУЛИКА / ЗАПИСЬ ИЗ ЛЕСА', title: 'ТАК ВОТ ЧТО ОН УВИДЕЛ!', detail: 'Включай со звуком. У сборщиков ягод есть вопросы.', caption: '' },
  ];
  let step = 0;
  let playbackRequest = 0;
  let videoFailed = false;

  const later = (callback, delay) => {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
  };
  const clearEffects = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    guest.hidden = true;
  };
  const announce = (text) => { announcement.textContent = text; };
  const settle = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    guest.hidden = true;
    section.dataset.phase = 'settled';
  };

  const pauseVideo = () => {
    playbackRequest++;
    video.pause();
  };
  const showVideoError = () => {
    if (reveal.hidden) return;
    videoFailed = true;
    pauseVideo();
    syncVideo();
    find('#panic-video-error').hidden = false;
    videoStatus.textContent = 'НЕ ЗАГРУЗИЛОСЬ. ПОВТОРИМ?';
  };
  const playVideo = () => {
    const request = ++playbackRequest;
    find('#panic-video-error').hidden = true;
    if (videoFailed || video.error || video.networkState === video.NETWORK_NO_SOURCE) video.load();
    videoFailed = false;
    if (video.ended) video.currentTime = 0;
    videoStatus.textContent = 'ЗАГРУЖАЕМ ВИДЕОУЛИКУ…';
    // Called directly from a tap, so mobile browsers can play with sound.
    video.play().catch((error) => {
      if (request !== playbackRequest || reveal.hidden || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') videoStatus.textContent = 'НАЖМИ НА КРУЖОК ▶';
      else showVideoError();
    });
  };

  const mediaTime = (seconds) => Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
  const syncVideoTime = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 19;
    find('#panic-video-time').textContent = `${mediaTime(video.currentTime)} / ${mediaTime(duration)}`;
    find('.panic-round').style.setProperty('--video-progress', String(Math.min(100, video.currentTime / duration * 100)));
  };
  const syncVideo = () => {
    const playing = !video.paused;
    reveal.dataset.playing = String(playing);
    videoToggle.setAttribute('aria-label', playing ? 'Приостановить видеоулику' : videoFailed ? 'Повторить загрузку видеоулики' : video.ended ? 'Смотреть видеоулику ещё раз' : 'Смотреть видеоулику со звуком');
    find('#panic-video-icon').textContent = playing ? 'Ⅱ' : video.ended || videoFailed ? '↻' : '▶';
    if (!video.error && !videoFailed) videoStatus.textContent = playing ? 'УЛИКА ВОСПРОИЗВОДИТСЯ' : video.ended ? 'ДЕЛО РАСКРЫТО ✓' : 'НАЖМИ НА КРУЖОК ▶';
  };
  videoToggle.addEventListener('click', () => video.paused ? playVideo() : pauseVideo());
  find('#panic-video-sound').addEventListener('click', () => { video.muted = !video.muted; });
  video.addEventListener('volumechange', () => {
    find('#panic-video-sound').textContent = video.muted ? '🔇' : '🔊';
    find('#panic-video-sound').setAttribute('aria-label', video.muted ? 'Включить звук видео' : 'Выключить звук видео');
    find('#panic-video-sound').setAttribute('aria-pressed', String(video.muted));
  });
  video.addEventListener('play', syncVideo);
  video.addEventListener('pause', syncVideo);
  video.addEventListener('loadedmetadata', syncVideoTime);
  video.addEventListener('timeupdate', syncVideoTime);
  video.addEventListener('error', showVideoError);
  video.querySelector('source').addEventListener('error', showVideoError);
  video.addEventListener('ended', () => {
    if (reveal.hidden || !video.ended) return;
    syncVideo();
    find('#panic-verdict').hidden = false;
    find('#panic-event-detail').textContent = 'Катя и Богдан собирали. Ева: «А я всё съем». Кот всё понял.';
    find('#panic-hint').textContent = 'Сборщики ягод требуют объяснений.';
    announce('Дело раскрыто. Катя и Богдан собирали ягоды, а Ева их ела. «А я всё съем». Богдан: «Кто не работает, тот ест». Ева, в следующий раз — с корзинкой!');
  });

  const keepConsoleVisible = () => {
    const consoleRect = find('#panic-console').getBoundingClientRect();
    const consoleHeight = find('.panic-controls').getBoundingClientRect().bottom - consoleRect.top;
    const dockTop = document.querySelector('.music-dock')?.getBoundingClientRect().top ?? innerHeight;
    const gutter = Math.max(2, Math.min(12, Math.floor((dockTop - consoleHeight) / 2)));
    // Only move when the whole console fits above the music dock. No body lock:
    // the music dialog retains sole ownership of its existing scroll restoration.
    if (consoleHeight <= dockTop - gutter * 2 && (consoleRect.top < gutter || consoleRect.top + consoleHeight > dockTop - gutter)) {
      window.scrollTo({ top: window.scrollY + consoleRect.top - gutter, behavior: motion.matches ? 'instant' : 'smooth' });
    }
  };

  const reset = () => {
    clearEffects();
    pauseVideo();
    video.currentTime = 0;
    syncVideoTime();
    reveal.hidden = true;
    find('#panic-case-file').hidden = true;
    find('#panic-verdict').hidden = true;
    find('#panic-video-error').hidden = true;
    find('.panic-transcript').open = false;
    step = 0;
    section.dataset.scene = 'idle';
    section.dataset.phase = 'settled';
    find('#panic-report-label').textContent = 'РАССЛЕДОВАНИЕ НАЧИНАЕТСЯ ЗАНОВО';
    find('#panic-event-title').textContent = 'Кот требует пересмотра дела.';
    find('#panic-event-detail').textContent = 'Ягоды не вернуть. Но запись осталась.';
    find('#panic-cat-caption').textContent = 'Он снова даже не моргает.';
    find('#panic-value').textContent = '0%';
    find('#panic-meter-fill').style.width = '0%';
    meter.setAttribute('aria-valuenow', '0');
    meter.setAttribute('aria-valuetext', '0% — Причина шока не установлена');
    find('#panic-level').textContent = 'Причина шока не установлена';
    find('#panic-step').textContent = '0 / 5';
    find('#panic-button-label').textContent = '👀 ЧТО ОН УВИДЕЛ?!';
    find('#panic-hint').textContent = 'Можно снова. Кот будет против.';
    announce('Кот вернулся. Паника сброшена до 0%. Можно пройти все пять сцен заново.');
  };

  button.addEventListener('click', () => {
    if (step === scenes.length) { reset(); return; }
    clearEffects();
    const visitor = document.querySelector('#edge-visitor');
    if (visitor) visitor.hidden = true;
    const scene = scenes[step++];
    section.dataset.scene = scene.id;
    section.dataset.phase = 'playing';
    find('#panic-report-label').textContent = scene.label;
    find('#panic-event-title').textContent = scene.title;
    find('#panic-event-detail').textContent = scene.detail;
    find('#panic-cat-caption').textContent = scene.caption;
    find('#panic-value').textContent = `${scene.value}%`;
    find('#panic-meter-fill').style.width = `${scene.fill}%`;
    // The physical bar saturates at 100%; the readout keeps counting past it.
    meter.setAttribute('aria-valuenow', String(scene.value));
    meter.setAttribute('aria-valuetext', `${scene.value}% — ${scene.level}`);
    find('#panic-level').textContent = scene.level;
    find('#panic-step').textContent = `${step} / ${scenes.length}`;
    find('#panic-button-label').textContent = step === scenes.length ? '↻ ЕЩЁ РАЗ С НАЧАЛА' : step === scenes.length - 1 ? '🎬 ЧТО ЖЕ ОН УВИДЕЛ?!' : '👀 НЕТ… А ЧТО ТОГДА?!';
    find('#panic-hint').textContent = step === scenes.length ? 'Нажми на кружок: пауза / продолжить.' : ['Версия не подтвердилась.', 'Кажется, дело всё-таки в еде.', 'Голубь отпущен. Но под подписку.', 'Дальше — запись. Без реконструкций.'][step - 1];
    announce(`${scene.value}%. ${scene.level}. ${scene.title} ${scene.detail}`);

    if (scene.id === 'visitor' && !motion.matches) {
      later(() => { guest.hidden = false; }, 250);
      later(() => { guest.hidden = true; }, 3100);
    }
    if (scene.id === 'reveal') {
      reveal.hidden = false;
      find('#panic-case-file').hidden = false;
      settle();
      playVideo();
    }
    // Every tap advances immediately; old timers can never overwrite a later scene.
    else if (motion.matches) settle();
    else later(settle, scene.id === 'visitor' ? 3200 : 1400);
    keepConsoleVisible();
  });

  document.addEventListener('visibilitychange', () => {
    section.dataset.paused = String(document.hidden);
    if (document.hidden) { settle(); pauseVideo(); }
  });
  motion.addEventListener('change', () => { if (motion.matches) settle(); });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      section.dataset.paused = String(!entry.isIntersecting || document.hidden);
      if (!entry.isIntersecting) { settle(); pauseVideo(); }
    });
    observer.observe(section);
  }
})();
