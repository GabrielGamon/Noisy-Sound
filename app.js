// Noisy Sound: app de música pessoal. Tudo roda no aparelho, sem servidor.
const $ = (s, el = document) => el.querySelector(s);
const audio = $('#audio');

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" class="fill"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2" class="fill"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" class="fill"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" class="fill"/><circle cx="12" cy="12" r="1.4" class="fill"/><circle cx="19" cy="12" r="1.4" class="fill"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M3 7h3c4 0 6 10 10 10h4M3 17h3c1.6 0 2.8-1.6 3.9-3.5M14 9.5C15 8 16 7 18 7h2M17 4l3 3-3 3M17 14l3 3-3 3"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M4 7h11M4 12h11M4 17h7M17 14l4 3-4 3z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10M18 15v6M15 18h6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
};

const state = {
  tracks: [], playlists: [], recents: [],
  queue: [], order: [], idx: -1, context: '',
  shuffle: false, repeat: 'off',
  tab: 'home', route: null, libFilter: 'songs', query: '',
};
const urls = new Map(); // id -> object URL da capa

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const fmt = (s) => { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const byId = (id) => state.tracks.find((t) => t.id === id);
const hashHue = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
const sortTitle = (a, b) => a.title.localeCompare(b.title, 'pt-BR');

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800);
}

function coverStyle(t) {
  const url = t && urls.get(t.id);
  if (url) return `background-image:url('${url}')`;
  const hue = t ? (t.hue ?? hashHue(t.title)) : 20;
  return `background-image:linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 60% 22%))`;
}
function coverHTML(t, size, label) {
  const letter = urls.get(t?.id) ? '' : esc((label ?? t?.title ?? '?').trim().charAt(0).toUpperCase());
  return `<div class="cover ${size}" style="${coverStyle(t)}">${letter}</div>`;
}
function playlistCover(p) {
  const first = p.trackIds.map(byId).find(Boolean);
  if (first) return `<div class="cover lg" style="${coverStyle(first)}">${urls.get(first.id) ? '' : esc(p.name.charAt(0).toUpperCase())}</div>`;
  return `<div class="cover lg">${esc(p.name.charAt(0).toUpperCase())}</div>`;
}

// ---------- carga inicial ----------
async function load() {
  state.tracks = (await DB.all('tracks')) || [];
  state.playlists = ((await DB.all('playlists')) || []).sort((a, b) => a.created - b.created);
  state.recents = (await DB.get('kv', 'recents')) || [];
  const s = (await DB.get('kv', 'settings')) || {};
  state.shuffle = !!s.shuffle; state.repeat = s.repeat || 'off';
  await Promise.all(state.tracks.filter((t) => t.hasCover).map(async (t) => {
    const b = await DB.get('blobs', 'cover:' + t.id);
    if (b) urls.set(t.id, URL.createObjectURL(b));
  }));
  navigator.storage?.persist?.();
  render(); syncControls();
}
const saveSettings = () => DB.put('kv', { shuffle: state.shuffle, repeat: state.repeat }, 'settings');

// ---------- importar músicas ----------
$('#import-btn').onclick = () => $('#file-input').click();
$('#file-input').onchange = async (e) => {
  const files = [...e.target.files]; e.target.value = '';
  if (files.length) importFiles(files);
};

function durationOf(file) {
  return new Promise((resolve) => {
    const a = new Audio(); const u = URL.createObjectURL(file);
    const done = (d) => { URL.revokeObjectURL(u); resolve(d); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    a.src = u;
  });
}

let actx;
async function peaksOf(file, n = 120) {
  if (file.size > 60e6) return null;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const buf = await new Promise((res, rej) => {
      file.arrayBuffer().then((ab) => {
        const p = actx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      }, rej);
    });
    const ch = buf.getChannelData(0); const step = Math.floor(ch.length / n); const out = [];
    for (let i = 0; i < n; i++) {
      let sum = 0; const start = i * step;
      for (let j = 0; j < step; j += 16) sum += ch[start + j] * ch[start + j];
      out.push(Math.sqrt(sum / (step / 16)));
    }
    const max = Math.max(...out, 0.0001);
    return out.map((v) => +(v / max).toFixed(3));
  } catch { return null; }
}

function hueFromImage(blob) {
  return new Promise((resolve) => {
    const img = new Image(); const u = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 24;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data;
      let best = null, bestScore = -1;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx - mn;
        const score = sat * (1 - Math.abs(mx - .65));
        if (score > bestScore) { bestScore = score; best = [r, gg, b, mx, mn]; }
      }
      URL.revokeObjectURL(u);
      if (!best || bestScore < .08) return resolve(null);
      const [r, gg, b, mx, mn] = best; const dd = mx - mn; let h;
      if (mx === r) h = ((gg - b) / dd) % 6; else if (mx === gg) h = (b - r) / dd + 2; else h = (r - gg) / dd + 4;
      resolve(Math.round((h * 60 + 360) % 360));
    };
    img.onerror = () => { URL.revokeObjectURL(u); resolve(null); };
    img.src = u;
  });
}

function parseName(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const m = base.match(/^(.+?)\s+[-–]\s+(.+)$/);
  return m ? { artist: m[1], title: m[2] } : { title: base };
}

async function importFiles(files) {
  const audioFiles = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(f.name));
  if (!audioFiles.length) return toast('Nenhum arquivo de áudio encontrado');
  let n = 0;
  showSheet(`<div class="sheet-title">Adicionando músicas</div><div class="a" style="padding:0 10px" id="imp-label">0 de ${audioFiles.length}</div><div class="progress-import" style="margin:10px"><span id="imp-bar"></span></div>`, { locked: true });
  for (const f of audioFiles) {
    try {
      const id = uid();
      const tags = await Tags.read(f).catch(() => ({}));
      const fromName = parseName(f.name);
      const [duration, peaks] = await Promise.all([durationOf(f), peaksOf(f)]);
      const t = {
        id, title: tags.title || fromName.title, artist: tags.artist || fromName.artist || 'Artista desconhecido',
        album: tags.album || '', duration, peaks, added: Date.now(), liked: false,
        type: f.type || 'audio/mpeg', hasCover: false, hue: null,
      };
      if (tags.cover && tags.cover.size > 100) {
        await DB.put('blobs', tags.cover, 'cover:' + id);
        t.hasCover = true; t.hue = await hueFromImage(tags.cover);
        urls.set(id, URL.createObjectURL(tags.cover));
      }
      if (t.hue == null) t.hue = hashHue(t.artist + t.title);
      await DB.put('blobs', f, 'audio:' + id);
      await DB.put('tracks', t);
      state.tracks.push(t);
    } catch (err) { console.error(err); }
    n++;
    const lbl = $('#imp-label'), bar = $('#imp-bar');
    if (lbl) lbl.textContent = `${n} de ${audioFiles.length}`;
    if (bar) bar.style.width = (n / audioFiles.length) * 100 + '%';
  }
  hideSheet(true);
  toast(n === 1 ? '1 música adicionada' : `${n} músicas adicionadas`);
  render();
}

// ---------- navegação ----------
document.querySelectorAll('.tabs button').forEach((b) => {
  b.onclick = () => {
    if (state.tab === b.dataset.tab && !state.route) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    state.tab = b.dataset.tab; state.route = null; render(); window.scrollTo(0, 0);
  };
});
function go(route) { state.route = route; render(); window.scrollTo(0, 0); }
function back() { state.route = null; render(); }

const TITLES = { home: 'Início', search: 'Buscar', library: 'Biblioteca' };

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  $('#screen-title').textContent = state.route ? '' : TITLES[state.tab];
  const v = $('#view');
  if (state.route) v.innerHTML = renderCollection(state.route);
  else if (!state.tracks.length && state.tab !== 'search') v.innerHTML = renderEmpty();
  else v.innerHTML = { home: renderHome, search: renderSearch, library: renderLibrary }[state.tab]();
  if (state.tab === 'search' && !state.route) {
    const inp = $('#q'); inp.oninput = () => { state.query = inp.value; $('#results').innerHTML = renderResults(); };
  }
}

function renderEmpty() {
  return `<div class="empty">
    <div class="big">${ICON.music}</div>
    <h3>Sua biblioteca está vazia</h3>
    <p>Adicione arquivos de música do iPhone ou do iCloud Drive. Eles ficam guardados aqui e tocam mesmo sem internet.</p>
    <button class="btn" data-act="import">${ICON.plus} Adicionar músicas</button>
  </div>`;
}

function trackRow(t, ctx, i) {
  const cur = currentTrack()?.id === t.id ? ' current' : '';
  return `<div class="row${cur}" data-play="${ctx}" data-i="${i}">
    ${coverHTML(t, 'md')}
    <div class="meta"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div>
    <button class="icon-btn more" data-menu="${t.id}" data-ctx="${ctx}" aria-label="Opções">${ICON.more}</button>
  </div>`;
}
function trackList(list, ctx) {
  return `<div class="list">${list.map((t, i) => trackRow(t, ctx, i)).join('')}</div>`;
}

// Cada "contexto" sabe gerar sua lista de faixas, para tocar em sequência.
function contextTracks(ctx) {
  const [kind, arg] = ctx.split(':');
  if (kind === 'all') return [...state.tracks].sort(sortTitle);
  if (kind === 'added') return [...state.tracks].sort((a, b) => b.added - a.added);
  if (kind === 'liked') return state.tracks.filter((t) => t.liked).sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));
  if (kind === 'artist') return state.tracks.filter((t) => t.artist === decodeURIComponent(arg)).sort(sortTitle);
  if (kind === 'pl') { const p = state.playlists.find((x) => x.id === arg); return p ? p.trackIds.map(byId).filter(Boolean) : []; }
  if (kind === 'search') return searchTracks(state.query);
  if (kind === 'recent') return state.recents.map(byId).filter(Boolean);
  return [];
}

function renderHome() {
  const recent = contextTracks('recent').slice(0, 12);
  const added = contextTracks('added').slice(0, 6);
  const quick = [
    { route: 'liked', label: 'Curtidas', cover: `<div class="cover md" style="background:linear-gradient(135deg,var(--accent),#7a2cff)">${ICON.heart}</div>` },
    { route: 'all', label: 'Todas as músicas', cover: `<div class="cover md">${ICON.music}</div>` },
    ...state.playlists.slice(0, 4).map((p) => {
      const t = p.trackIds.map(byId).find(Boolean);
      return { route: 'pl:' + p.id, label: p.name, cover: coverHTML(t, 'md', p.name) };
    }),
  ];
  return `
    <div class="quick">${quick.map((q) => `<button data-go="${q.route}">${q.cover}<span class="t">${esc(q.label)}</span></button>`).join('')}</div>
    ${recent.length ? `<h2>Tocadas recentemente</h2>
      <div class="shelf">${recent.map((t, i) => `<button class="tile" data-play="recent" data-i="${i}">${coverHTML(t, 'lg')}<div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></button>`).join('')}</div>` : ''}
    <h2>Adicionadas recentemente</h2>
    ${trackList(added, 'added')}`;
}

function searchTracks(q) {
  q = q.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (!q) return [];
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return state.tracks.filter((t) => norm(t.title).includes(q) || norm(t.artist).includes(q) || norm(t.album).includes(q)).sort(sortTitle);
}
function renderSearch() {
  return `<label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
    <input id="q" type="search" placeholder="Músicas, artistas ou álbuns" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search"></label>
    <div id="results">${renderResults()}</div>`;
}
function renderResults() {
  if (!state.query.trim()) {
    const artists = artistList().slice(0, 12);
    if (!artists.length) return `<div class="empty"><p>Adicione músicas para buscar entre elas.</p></div>`;
    return `<h2>Artistas</h2><div class="chips">${artists.map((a) => `<button class="chip" data-go="artist:${encodeURIComponent(a.name)}">${esc(a.name)}</button>`).join('')}</div>`;
  }
  const r = searchTracks(state.query);
  if (!r.length) return `<div class="empty"><p>Nada encontrado para “${esc(state.query)}”.</p></div>`;
  return `<h2>Músicas</h2>${trackList(r, 'search')}`;
}

function artistList() {
  const m = new Map();
  for (const t of state.tracks) { const a = m.get(t.artist) || { name: t.artist, tracks: [] }; a.tracks.push(t); m.set(t.artist, a); }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function renderLibrary() {
  const f = state.libFilter;
  const chips = [['songs', 'Músicas'], ['playlists', 'Playlists'], ['artists', 'Artistas']]
    .map(([k, l]) => `<button class="chip${f === k ? ' on' : ''}" data-filter="${k}">${l}</button>`).join('');
  let body = '';
  if (f === 'songs') {
    body = `<div style="display:flex;gap:10px;margin:14px 0 10px">
      <button class="btn" data-shuffle="all">${ICON.shuffle} Aleatório</button>
      <button class="btn ghost" data-act="import">${ICON.plus} Adicionar</button></div>
      ${trackList(contextTracks('all'), 'all')}`;
  } else if (f === 'playlists') {
    const liked = contextTracks('liked');
    body = `<div class="list" style="margin-top:10px">
      <button class="row" data-act="new-playlist"><div class="cover md">${ICON.plus}</div><div class="meta"><div class="t">Nova playlist</div></div></button>
      <button class="row" data-go="liked"><div class="cover md" style="background:linear-gradient(135deg,var(--accent),#7a2cff)">${ICON.heart}</div><div class="meta"><div class="t">Curtidas</div><div class="a">${liked.length} ${liked.length === 1 ? 'música' : 'músicas'}</div></div></button>
      ${state.playlists.map((p) => {
        const t = p.trackIds.map(byId).find(Boolean);
        return `<button class="row" data-go="pl:${p.id}">${coverHTML(t, 'md', p.name)}<div class="meta"><div class="t">${esc(p.name)}</div><div class="a">${p.trackIds.length} ${p.trackIds.length === 1 ? 'música' : 'músicas'}</div></div></button>`;
      }).join('')}</div>`;
  } else {
    body = `<div class="list" style="margin-top:10px">${artistList().map((a) =>
      `<button class="row" data-go="artist:${encodeURIComponent(a.name)}">${coverHTML(a.tracks[0], 'md', a.name)}<div class="meta"><div class="t">${esc(a.name)}</div><div class="a">${a.tracks.length} ${a.tracks.length === 1 ? 'música' : 'músicas'}</div></div></button>`).join('')}</div>`;
  }
  return `<div class="chips">${chips}</div>${body}`;
}

function renderCollection(route) {
  const [kind, arg] = route.split(':');
  const list = contextTracks(route);
  let title = '', sub = '', cover = '', extra = '';
  if (kind === 'liked') { title = 'Curtidas'; cover = `<div class="cover" style="background:linear-gradient(135deg,var(--accent),#7a2cff)"><svg viewBox="0 0 24 24" style="width:64px;height:64px"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" class="fill"/></svg></div>`; }
  else if (kind === 'all') { title = 'Todas as músicas'; cover = `<div class="cover">${ICON.music.replace('<svg', '<svg style="width:64px;height:64px"')}</div>`; }
  else if (kind === 'artist') { title = decodeURIComponent(arg); cover = `<div class="cover" style="border-radius:50%;${coverStyle(list[0])}">${urls.get(list[0]?.id) ? '' : esc(title.charAt(0).toUpperCase())}</div>`; }
  else if (kind === 'pl') {
    const p = state.playlists.find((x) => x.id === arg);
    if (!p) { state.route = null; return renderLibrary(); }
    title = p.name; cover = coverHTML(list[0], '', p.name);
    extra = `<button class="btn ghost" data-plmenu="${p.id}" aria-label="Opções da playlist">${ICON.more}</button>`;
  }
  const total = list.reduce((s, t) => s + (t.duration || 0), 0);
  sub = `${list.length} ${list.length === 1 ? 'música' : 'músicas'}${total >= 60 ? ' · ' + Math.round(total / 60) + ' min' : ''}`;
  return `<button class="back" data-act="back">${ICON.chevron} Voltar</button>
    <div class="hero">${cover}<h3>${esc(title)}</h3><div class="a">${sub}</div>
      <div class="actions">${list.length ? `<button class="btn" data-play="${route}" data-i="0">${ICON.play} Tocar</button>
      <button class="btn ghost" data-shuffle="${route}">${ICON.shuffle} Aleatório</button>` : ''}${extra}</div></div>
    ${list.length ? trackList(list, route) : `<div class="empty"><p>${kind === 'liked' ? 'Toque no coração de uma música para ela aparecer aqui.' : kind === 'pl' ? 'Adicione músicas pelo menu ••• de cada faixa.' : 'Nada por aqui ainda.'}</p></div>`}`;
}

// ---------- cliques (delegação) ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-menu],[data-play],[data-go],[data-act],[data-filter],[data-shuffle],[data-plmenu],[data-opt]');
  if (!el) return;
  const d = el.dataset;
  if (d.menu) { e.stopPropagation(); return trackMenu(d.menu, d.ctx); }
  if (d.opt) return;
  if (d.play) return playContext(d.play, +d.i || 0);
  if (d.shuffle) return playContext(d.shuffle, -1, true);
  if (d.go) return go(d.go);
  if (d.filter) { state.libFilter = d.filter; return render(); }
  if (d.plmenu) return playlistMenu(d.plmenu);
  if (d.act === 'import') return $('#file-input').click();
  if (d.act === 'back') return back();
  if (d.act === 'new-playlist') return newPlaylist();
});

// ---------- reprodução ----------
const currentTrack = () => byId(state.queue[state.order[state.idx]]);

function shuffled(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildOrder(startPos) {
  const idx = state.queue.map((_, i) => i);
  if (!state.shuffle) { state.order = idx; state.idx = Math.max(0, startPos); return; }
  const rest = shuffled(idx.filter((i) => i !== startPos));
  state.order = startPos >= 0 ? [startPos, ...rest] : rest;
  state.idx = 0;
}

function playContext(ctx, i, forceShuffle) {
  const list = contextTracks(ctx);
  if (!list.length) return;
  if (forceShuffle && !state.shuffle) { state.shuffle = true; saveSettings(); }
  state.queue = list.map((t) => t.id); state.context = ctx;
  buildOrder(forceShuffle ? -1 : i);
  if (forceShuffle && state.order.length === 0) buildOrder(0);
  start();
}

let currentUrl = null;
async function start(autoplay = true) {
  const t = currentTrack(); if (!t) return;
  const blob = await DB.get('blobs', 'audio:' + t.id);
  if (!blob) return toast('Arquivo não encontrado');
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(blob);
  audio.src = currentUrl;
  if (autoplay) audio.play().catch(() => {});
  state.recents = [t.id, ...state.recents.filter((x) => x !== t.id)].slice(0, 30);
  DB.put('kv', state.recents, 'recents');
  updateNowPlaying();
  if (!state.route && state.tab !== 'search') render();
  else document.querySelectorAll('.row.current').forEach((r) => r.classList.remove('current'));
}

function next(auto) {
  if (!state.order.length) return;
  if (auto && state.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (state.idx < state.order.length - 1) state.idx++;
  else if (state.repeat === 'all' || !auto) { state.idx = 0; if (state.shuffle) buildOrder(state.order[0]); }
  else { audio.pause(); audio.currentTime = 0; return; }
  start();
}
function prev() {
  if (audio.currentTime > 3 || state.idx === 0) { audio.currentTime = 0; return; }
  state.idx--; start();
}
function togglePlay() {
  if (!currentTrack()) return;
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

audio.addEventListener('ended', () => next(true));
audio.addEventListener('play', syncPlay);
audio.addEventListener('pause', syncPlay);
audio.addEventListener('timeupdate', syncTime);
audio.addEventListener('loadedmetadata', syncTime);

function syncPlay() {
  const playing = !audio.paused;
  $('#mini-play').innerHTML = playing ? ICON.pause : ICON.play;
  $('#btn-play').innerHTML = playing ? ICON.pause : ICON.play;
  $('#player').classList.toggle('playing', playing);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}
function syncTime() {
  const d = audio.duration || currentTrack()?.duration || 0, c = audio.currentTime || 0;
  $('#mini-bar').style.width = d ? (c / d) * 100 + '%' : '0';
  $('#t-cur').textContent = fmt(c); $('#t-dur').textContent = '-' + fmt(Math.max(0, d - c));
  drawWave(d ? c / d : 0);
  if ('mediaSession' in navigator && d && navigator.mediaSession.setPositionState) {
    try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(c, d), playbackRate: 1 }); } catch {}
  }
}
function syncControls() {
  $('#btn-shuffle').classList.toggle('on', state.shuffle);
  const r = $('#btn-repeat'); r.classList.toggle('on', state.repeat !== 'off'); r.classList.toggle('repeat-one', state.repeat === 'one');
}

function setAccent(t) {
  const hue = t?.hue ?? 16;
  document.documentElement.style.setProperty('--accent', `hsl(${hue} 85% 60%)`);
  document.documentElement.style.setProperty('--accent-soft', `hsla(${hue} 85% 60% / .16)`);
}

function contextLabel(ctx) {
  const [k, a] = ctx.split(':');
  if (k === 'pl') return state.playlists.find((p) => p.id === a)?.name || 'Playlist';
  return { all: 'Todas as músicas', added: 'Adicionadas recentemente', liked: 'Curtidas', artist: decodeURIComponent(a || ''), search: 'Busca', recent: 'Tocadas recentemente' }[k] || 'Tocando agora';
}

function updateNowPlaying() {
  const t = currentTrack(); if (!t) return;
  $('#mini').classList.remove('hidden');
  $('#mini-cover').outerHTML = coverHTML(t, 'sm').replace('<div class="cover sm"', '<div class="cover sm" id="mini-cover"');
  $('#mini-title').textContent = t.title; $('#mini-artist').textContent = t.artist;
  $('#player-cover').outerHTML = coverHTML(t, 'xl').replace('<div class="cover xl"', '<div class="cover xl" id="player-cover"');
  $('#player-title').textContent = t.title; $('#player-artist').textContent = t.artist;
  $('#player-from').textContent = contextLabel(state.context);
  syncLike(); setAccent(t); drawWave(0);
  if ('mediaSession' in navigator) {
    const url = urls.get(t.id);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist, album: t.album || 'Noisy Sound',
      artwork: url ? [{ src: url, sizes: '512x512', type: 'image/jpeg' }] : [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
  }
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  const h = (a, fn) => { try { ms.setActionHandler(a, fn); } catch {} };
  h('play', () => audio.play()); h('pause', () => audio.pause());
  h('previoustrack', prev); h('nexttrack', () => next(false));
  h('seekto', (e) => { audio.currentTime = e.seekTime; });
}

// ---------- forma de onda ----------
const canvas = $('#wave-canvas');
function drawWave(p) {
  if (!$('#player').classList.contains('open')) return;
  const t = currentTrack(); const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w) return;
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const bars = Math.floor(w / 4);
  const src = t?.peaks || fakePeaks(t?.id || 'x');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent');
  for (let i = 0; i < bars; i++) {
    const v = src[Math.floor((i / bars) * src.length)] ?? 0.3;
    const bh = Math.max(3, Math.pow(v, 0.8) * (h - 6));
    g.fillStyle = i / bars < p ? accent : 'rgba(255,255,255,.28)';
    const x = i * 4, y = (h - bh) / 2;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, 2.4, bh, 1.2) : g.rect(x, y, 2.4, bh); g.fill();
  }
}
function fakePeaks(seed) {
  let s = hashHue(seed) + 1; const out = [];
  for (let i = 0; i < 120; i++) { s = (s * 9301 + 49297) % 233280; out.push(.25 + (s / 233280) * .6 * Math.sin((i / 120) * Math.PI + .3)); }
  return out;
}
let seeking = false;
function seekFrom(e) {
  const r = $('#wave').getBoundingClientRect(); const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const d = audio.duration || 0; if (d) { audio.currentTime = p * d; drawWave(p); }
}
$('#wave').addEventListener('pointerdown', (e) => { seeking = true; $('#wave').setPointerCapture(e.pointerId); seekFrom(e); });
$('#wave').addEventListener('pointermove', (e) => seeking && seekFrom(e));
$('#wave').addEventListener('pointerup', () => { seeking = false; });

// ---------- player ----------
function openPlayer() { $('#player').classList.add('open'); $('#player').setAttribute('aria-hidden', 'false'); requestAnimationFrame(() => syncTime()); }
function closePlayer() { $('#player').classList.remove('open'); $('#player').setAttribute('aria-hidden', 'true'); }
$('#mini-open').onclick = openPlayer;
$('#player-close').onclick = closePlayer;
$('#mini-play').onclick = togglePlay;
$('#btn-play').onclick = togglePlay;
$('#mini-next').onclick = () => next(false);
$('#btn-next').onclick = () => next(false);
$('#btn-prev').onclick = prev;
$('#btn-shuffle').onclick = () => {
  state.shuffle = !state.shuffle; saveSettings(); syncControls();
  if (state.queue.length) { const cur = state.order[state.idx]; buildOrder(cur); if (!state.shuffle) state.idx = cur; }
  toast(state.shuffle ? 'Aleatório ligado' : 'Aleatório desligado');
};
$('#btn-repeat').onclick = () => {
  state.repeat = { off: 'all', all: 'one', one: 'off' }[state.repeat]; saveSettings(); syncControls();
  toast({ off: 'Repetir desligado', all: 'Repetindo tudo', one: 'Repetindo esta música' }[state.repeat]);
};
$('#player-like').onclick = () => { const t = currentTrack(); if (t) toggleLike(t); };
$('#player-more').onclick = () => { const t = currentTrack(); if (t) trackMenu(t.id, state.context, true); };

// Arrastar para baixo fecha o player
(() => {
  let y0 = null; const p = $('#player');
  p.addEventListener('touchstart', (e) => { if (e.target.closest('#wave')) return; y0 = e.touches[0].clientY; }, { passive: true });
  p.addEventListener('touchmove', (e) => {
    if (y0 == null) return; const dy = e.touches[0].clientY - y0;
    if (dy > 0) { p.style.transition = 'none'; p.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  p.addEventListener('touchend', (e) => {
    if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
    p.style.transition = ''; p.style.transform = '';
    if (dy > 120) closePlayer();
  });
})();

function syncLike() {
  const t = currentTrack(); const b = $('#player-like');
  b.innerHTML = ICON.heart; b.classList.toggle('on', !!t?.liked);
}
async function toggleLike(t) {
  t.liked = !t.liked; t.likedAt = t.liked ? Date.now() : null;
  await DB.put('tracks', t); syncLike();
  toast(t.liked ? 'Adicionada às curtidas' : 'Removida das curtidas');
  if (!$('#player').classList.contains('open')) render();
}

// ---------- folha de opções ----------
function showSheet(html, { locked } = {}) {
  $('#sheet-card').innerHTML = html; $('#sheet').classList.add('open'); $('#sheet').dataset.locked = locked ? '1' : '';
}
function hideSheet(force) { if ($('#sheet').dataset.locked && !force) return; $('#sheet').classList.remove('open'); }
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') hideSheet(); });

function trackMenu(id, ctx, fromPlayer) {
  const t = byId(id); if (!t) return;
  const inPl = ctx?.startsWith('pl:') ? ctx.slice(3) : null;
  showSheet(`<div class="sheet-head">${coverHTML(t, 'md')}<div class="meta"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div></div>
    <button class="opt" data-opt="next">${ICON.next} Tocar a seguir</button>
    <button class="opt" data-opt="like">${ICON.heart} ${t.liked ? 'Remover das curtidas' : 'Curtir'}</button>
    <button class="opt" data-opt="add">${ICON.list} Adicionar à playlist</button>
    ${fromPlayer ? '' : `<button class="opt" data-opt="artist">${ICON.music} Ver artista</button>`}
    <button class="opt" data-opt="edit">${ICON.edit} Editar nome e artista</button>
    ${inPl ? `<button class="opt" data-opt="unlist">${ICON.minus} Remover desta playlist</button>` : ''}
    <button class="opt danger" data-opt="delete">${ICON.trash} Apagar do app</button>`);
  $('#sheet-card').onclick = async (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt; if (!o) return;
    if (o === 'next') { playNext(t); hideSheet(); }
    else if (o === 'like') { hideSheet(); toggleLike(t); }
    else if (o === 'add') addToPlaylist(t);
    else if (o === 'artist') { hideSheet(); closePlayer(); go('artist:' + encodeURIComponent(t.artist)); }
    else if (o === 'edit') editTrack(t);
    else if (o === 'unlist') { const p = state.playlists.find((x) => x.id === inPl); p.trackIds = p.trackIds.filter((x) => x !== t.id); await DB.put('playlists', p); hideSheet(); render(); toast('Removida da playlist'); }
    else if (o === 'delete') confirmDelete(t);
  };
}

function playNext(t) {
  if (!currentTrack()) { state.queue = [t.id]; state.context = 'all'; buildOrder(0); start(); return; }
  state.queue.push(t.id);
  state.order.splice(state.idx + 1, 0, state.queue.length - 1);
  toast('Toca em seguida');
}

function addToPlaylist(t) {
  showSheet(`<div class="sheet-title">Adicionar à playlist</div>
    <button class="opt" data-opt="new">${ICON.plus} Nova playlist</button>
    ${state.playlists.map((p) => `<button class="opt" data-opt="pl" data-id="${p.id}">${ICON.list} ${esc(p.name)}</button>`).join('')}`);
  $('#sheet-card').onclick = async (e) => {
    const b = e.target.closest('[data-opt]'); if (!b) return;
    if (b.dataset.opt === 'new') return newPlaylist(t);
    const p = state.playlists.find((x) => x.id === b.dataset.id);
    if (p.trackIds.includes(t.id)) { hideSheet(); return toast('Já está nessa playlist'); }
    p.trackIds.push(t.id); await DB.put('playlists', p); hideSheet(); toast(`Adicionada a ${p.name}`); render();
  };
}

function newPlaylist(withTrack) {
  showSheet(`<div class="sheet-title">Nova playlist</div>
    <div style="padding:0 2px"><input class="field" id="pl-name" placeholder="Nome da playlist" maxlength="60" enterkeyhint="done"></div>
    <div class="row-btns"><button class="btn ghost" data-opt="cancel">Cancelar</button><button class="btn" data-opt="ok">Criar</button></div>`);
  setTimeout(() => $('#pl-name')?.focus(), 250);
  const create = async () => {
    const name = $('#pl-name').value.trim(); if (!name) return $('#pl-name').focus();
    const p = { id: uid(), name, trackIds: withTrack ? [withTrack.id] : [], created: Date.now() };
    await DB.put('playlists', p); state.playlists.push(p); hideSheet();
    toast(withTrack ? `Adicionada a ${name}` : 'Playlist criada');
    if (withTrack) render(); else go('pl:' + p.id);
  };
  $('#pl-name').onkeydown = (e) => { if (e.key === 'Enter') create(); };
  $('#sheet-card').onclick = (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt;
    if (o === 'cancel') hideSheet(); else if (o === 'ok') create();
  };
}

function playlistMenu(id) {
  const p = state.playlists.find((x) => x.id === id); if (!p) return;
  showSheet(`<div class="sheet-title">${esc(p.name)}</div>
    <button class="opt" data-opt="rename">${ICON.edit} Renomear</button>
    <button class="opt danger" data-opt="del">${ICON.trash} Apagar playlist</button>`);
  $('#sheet-card').onclick = async (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt;
    if (o === 'rename') {
      showSheet(`<div class="sheet-title">Renomear playlist</div><div style="padding:0 2px"><input class="field" id="pl-name" value="${esc(p.name)}" maxlength="60"></div>
        <div class="row-btns"><button class="btn ghost" data-opt="cancel">Cancelar</button><button class="btn" data-opt="ok">Salvar</button></div>`);
      $('#sheet-card').onclick = async (ev) => {
        const oo = ev.target.closest('[data-opt]')?.dataset.opt;
        if (oo === 'cancel') hideSheet();
        if (oo === 'ok') { const n = $('#pl-name').value.trim(); if (n) { p.name = n; await DB.put('playlists', p); } hideSheet(); render(); }
      };
    } else if (o === 'del') {
      await DB.del('playlists', p.id); state.playlists = state.playlists.filter((x) => x !== p);
      hideSheet(); state.route = null; render(); toast('Playlist apagada');
    }
  };
}

function editTrack(t) {
  showSheet(`<div class="sheet-title">Editar informações</div>
    <div style="padding:0 2px"><input class="field" id="ed-title" value="${esc(t.title)}" placeholder="Nome da música">
    <input class="field" id="ed-artist" value="${esc(t.artist)}" placeholder="Artista"></div>
    <div class="row-btns"><button class="btn ghost" data-opt="cancel">Cancelar</button><button class="btn" data-opt="ok">Salvar</button></div>`);
  $('#sheet-card').onclick = async (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt;
    if (o === 'cancel') hideSheet();
    if (o === 'ok') {
      t.title = $('#ed-title').value.trim() || t.title; t.artist = $('#ed-artist').value.trim() || t.artist;
      await DB.put('tracks', t); hideSheet(); render();
      if (currentTrack()?.id === t.id) updateNowPlaying();
      toast('Informações salvas');
    }
  };
}

function confirmDelete(t) {
  showSheet(`<div class="sheet-title">Apagar “${esc(t.title)}”?</div>
    <div class="a" style="padding:0 10px 16px;white-space:normal">A música sai do app e de todas as playlists. O arquivo original no iPhone não é afetado.</div>
    <div class="row-btns"><button class="btn ghost" data-opt="cancel">Cancelar</button><button class="btn" style="background:#e5484d" data-opt="ok">Apagar</button></div>`);
  $('#sheet-card').onclick = async (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt;
    if (o === 'cancel') return hideSheet();
    if (o !== 'ok') return;
    if (currentTrack()?.id === t.id) { audio.pause(); audio.removeAttribute('src'); state.queue = []; state.order = []; state.idx = -1; $('#mini').classList.add('hidden'); closePlayer(); }
    await DB.del('tracks', t.id); await DB.del('blobs', 'audio:' + t.id); await DB.del('blobs', 'cover:' + t.id);
    state.tracks = state.tracks.filter((x) => x.id !== t.id);
    for (const p of state.playlists) if (p.trackIds.includes(t.id)) { p.trackIds = p.trackIds.filter((x) => x !== t.id); await DB.put('playlists', p); }
    state.recents = state.recents.filter((x) => x !== t.id); DB.put('kv', state.recents, 'recents');
    hideSheet(); render(); toast('Música apagada');
  };
}

window.addEventListener('resize', () => syncTime());
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
load();
