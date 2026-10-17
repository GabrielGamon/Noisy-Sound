// Motor de reprodução: arquivos do aparelho tocam no <audio>; músicas do SoundCloud
// tocam pelo player oficial do SoundCloud (Widget API), escondido na página.
const SC_API = 'https://w.soundcloud.com/player/api.js';
const SC_PARAMS = '&auto_play=false&visual=false&show_comments=false&hide_related=true&show_teaser=false&show_user=false&sharing=false&buying=false&download=false';

let scApi;
function loadScApi() {
  scApi ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SC_API; s.onload = resolve;
    s.onerror = () => { scApi = null; reject(new Error('SoundCloud indisponível')); };
    document.head.appendChild(s);
  });
  return scApi;
}

function scFrame(url, host) {
  const f = document.createElement('iframe');
  f.allow = 'autoplay; encrypted-media';
  f.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) + SC_PARAMS;
  host.appendChild(f);
  return f;
}
const wait = (fn, ms, msg) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(msg || 'timeout')), ms);
  fn((v) => { clearTimeout(t); resolve(v); });
});

// Lê as informações de um link do SoundCloud (música ou playlist) sem tocar nada.
async function scResolve(url) {
  await loadScApi();
  const f = scFrame(url, document.getElementById('sc-meta'));
  try {
    const w = SC.Widget(f);
    await wait((done) => w.bind(SC.Widget.Events.READY, done), 20000, 'Link não encontrado');
    let sounds = await wait((done) => w.getSounds(done), 10000);
    if (!sounds || !sounds.length) sounds = [await wait((done) => w.getCurrentSound(done), 10000)];
    const out = [];
    for (const s of sounds) {
      let full = s;
      if (s && !s.title && s.id) {
        // Playlists longas só trazem os detalhes das primeiras faixas; carregamos o resto uma a uma.
        await wait((done) => w.load('https://api.soundcloud.com/tracks/' + s.id, { auto_play: false, callback: done }), 15000).catch(() => {});
        full = await wait((done) => w.getCurrentSound(done), 10000).catch(() => null);
      }
      if (full && full.title) out.push(full);
    }
    return out;
  } finally { f.remove(); }
}

const player = (() => {
  const audio = document.getElementById('audio');
  const on = { play() {}, pause() {}, time() {}, ended() {}, needTap() {} };
  let kind = 'file', fileUrl = null;
  let sc = null, scReady = null, scTime = 0, scDur = 0, scPaused = true, scToken = 0;

  audio.addEventListener('ended', () => kind === 'file' && on.ended());
  audio.addEventListener('play', () => kind === 'file' && on.play());
  audio.addEventListener('pause', () => kind === 'file' && on.pause());
  audio.addEventListener('timeupdate', () => kind === 'file' && on.time());
  audio.addEventListener('loadedmetadata', () => kind === 'file' && on.time());

  function scWidget(firstUrl) {
    scReady ||= loadScApi().then(() => new Promise((resolve) => {
      const f = scFrame(firstUrl, document.getElementById('sc-host'));
      const w = SC.Widget(f); const E = SC.Widget.Events;
      w.bind(E.READY, () => resolve(w));
      w.bind(E.PLAY, () => { if (kind !== 'sc') return w.pause(); scPaused = false; document.body.classList.remove('sc-tap'); on.play(); });
      w.bind(E.PAUSE, () => { scPaused = true; if (kind === 'sc') on.pause(); });
      w.bind(E.FINISH, () => { scPaused = true; if (kind === 'sc') on.ended(); });
      w.bind(E.PLAY_PROGRESS, (e) => { scTime = e.currentPosition / 1000; if (kind === 'sc') on.time(); });
      sc = w;
    })).catch((e) => { scReady = null; throw e; });
    return scReady;
  }

  return {
    on,
    get kind() { return kind; },
    get paused() { return kind === 'sc' ? scPaused : audio.paused; },
    get currentTime() { return kind === 'sc' ? scTime : audio.currentTime; },
    set currentTime(s) { if (kind === 'sc') { sc?.seekTo(s * 1000); scTime = s; } else audio.currentTime = s; },
    get duration() { return kind === 'sc' ? scDur : audio.duration; },
    play() {
      if (kind === 'sc') sc?.play(); else audio.play().catch(() => {});
    },
    pause() { if (kind === 'sc') sc?.pause(); else audio.pause(); },
    stop() {
      audio.pause(); audio.removeAttribute('src'); sc?.pause();
      document.body.classList.remove('sc-tap');
    },
    async load(t, blob, autoplay = true) {
      const token = ++scToken;
      document.body.classList.remove('sc-tap');
      if (t.source === 'sc') {
        audio.pause(); kind = 'sc'; scTime = 0; scDur = (t.duration || 0); scPaused = true; on.time();
        const w = await scWidget(t.url);
        if (token !== scToken) return;
        await new Promise((done) => w.load(t.url, { auto_play: autoplay, visual: false, show_comments: false, hide_related: true, show_teaser: false, show_user: false, sharing: false, buying: false, download: false, callback: done }));
        if (token !== scToken) return;
        w.getDuration((ms) => { if (ms) { scDur = ms / 1000; on.time(); } });
        if (autoplay) {
          w.play();
          // O iPhone às vezes exige um toque direto no player do SoundCloud para começar.
          setTimeout(() => { if (token === scToken && scPaused) { document.body.classList.add('sc-tap'); on.needTap(); } }, 2500);
        }
      } else {
        sc?.pause(); kind = 'file';
        if (fileUrl) URL.revokeObjectURL(fileUrl);
        fileUrl = URL.createObjectURL(blob);
        audio.src = fileUrl;
        if (autoplay) audio.play().catch(() => {});
      }
    },
  };
})();
