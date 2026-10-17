// Noisy Sound: app de música. O catálogo vem do Audius; curtidas e playlists ficam no aparelho.
const $ = (s, el = document) => el.querySelector(s);

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
  minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
};

const state = {
  tracks: [], playlists: [], recents: [],
  lists: new Map(), loading: new Set(), failed: new Set(), query: '',
  queue: [], order: [], idx: -1, context: '',
  shuffle: false, repeat: 'off',
  tab: 'home', route: null, libFilter: 'songs',
};
const urls = new Map(); // id -> URL da capa

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const fmt = (s) => { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const cache = new Map(); // id -> faixa (todas as que já apareceram nesta sessão ou foram salvas)
const byId = (id) => cache.get(id);
function remember(list) { return list.map((t) => { const old = cache.get(t.id); if (old) return Object.assign(old, { ...t, liked: old.liked, likedAt: old.likedAt, hue: old.hue }); cache.set(t.id, t); if (t.artUrl) urls.set(t.id, t.artUrl); return t; }); }
// Guarda a faixa no aparelho (para curtidas, playlists e recentes funcionarem sem buscar de novo).
function keep(t) { if (!state.tracks.includes(t)) state.tracks.push(t); DB.put('tracks', t); }
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
  state.tracks = ((await DB.all('tracks')) || []).filter((t) => t.source === 'audius');
  remember(state.tracks);
  state.playlists = ((await DB.all('playlists')) || []).sort((a, b) => a.created - b.created);
  state.recents = ((await DB.get('kv', 'recents')) || []).filter((id) => cache.has(id));
  const s = (await DB.get('kv', 'settings')) || {};
  state.shuffle = !!s.shuffle; state.repeat = s.repeat || 'off';
  navigator.storage?.persist?.();
  render(); syncControls();
}
const saveSettings = () => DB.put('kv', { shuffle: state.shuffle, repeat: state.repeat }, 'settings');

// ---------- listas que vêm do catálogo ----------
// Contextos remotos: "trend", "genre:<nome>", "q:<texto>", "artist:<id>:<nome>"
const isRemote = (ctx) => /^(trend|genre|q|artist):?/.test(ctx);
function fetchList(ctx) {
  const [kind, ...rest] = ctx.split(':'); const arg = decodeURIComponent(rest[0] || '');
  if (kind === 'trend') return Catalog.trending(null, 50);
  if (kind === 'genre') { const g = GENRES.find((x) => x.name === arg); return g?.genre ? Catalog.trending(g.genre, 50) : Catalog.search(g?.q || arg, 50); }
  if (kind === 'q') return Catalog.search(arg, 40);
  if (kind === 'artist') return Catalog.artistTracks(arg, 50);
  return Promise.resolve([]);
}
async function ensureList(ctx) {
  if (state.lists.has(ctx) || state.loading.has(ctx)) return;
  state.loading.add(ctx); state.failed.delete(ctx);
  try { state.lists.set(ctx, remember(await fetchList(ctx))); }
  catch (err) { console.error(err); state.failed.add(ctx); }
  state.loading.delete(ctx);
  render(true);
}
function listState(ctx) {
  if (state.lists.has(ctx)) return null;
  if (!state.failed.has(ctx)) ensureList(ctx);
  if (state.failed.has(ctx)) return `<div class="empty"><p>Não consegui carregar as músicas. Confira a internet.</p><button class="btn ghost" data-retry="${esc(ctx)}">Tentar de novo</button></div>`;
  return `<div class="loading"><span></span><span></span><span></span></div>`;
}

function hueFromImage(src) {
  return new Promise((resolve) => {
    const img = new Image(); const remote = typeof src === 'string';
    const u = remote ? src : URL.createObjectURL(src);
    if (remote) img.crossOrigin = 'anonymous';
    setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 24;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24);
      let d; try { d = g.getImageData(0, 0, 24, 24).data; } catch { return resolve(null); }
      let best = null, bestScore = -1;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx - mn;
        const score = sat * (1 - Math.abs(mx - .65));
        if (score > bestScore) { bestScore = score; best = [r, gg, b, mx, mn]; }
      }
      if (!remote) URL.revokeObjectURL(u);
      if (!best || bestScore < .08) return resolve(null);
      const [r, gg, b, mx, mn] = best; const dd = mx - mn; let h;
      if (mx === r) h = ((gg - b) / dd) % 6; else if (mx === gg) h = (b - r) / dd + 2; else h = (r - gg) / dd + 4;
      resolve(Math.round((h * 60 + 360) % 360));
    };
    img.onerror = () => { if (!remote) URL.revokeObjectURL(u); resolve(null); };
    img.src = u;
  });
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

const TITLES = { home: 'Início', search: 'Pesquisar', library: 'Biblioteca' };
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

// soft = recarregar só o conteúdo, sem perder o que está sendo digitado na busca
function render(soft) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  $('#screen-title').textContent = state.route ? '' : state.tab === 'home' ? greeting() : TITLES[state.tab];
  document.body.dataset.view = state.route ? 'route' : state.tab;
  const v = $('#view');
  if (state.route) { v.innerHTML = renderCollection(state.route); return; }
  if (state.tab === 'search') {
    if (!soft || !$('#q')) { v.innerHTML = renderSearch(); bindSearch(); }
    $('#results').innerHTML = renderResults();
    return;
  }
  v.innerHTML = { home: renderHome, library: renderLibrary }[state.tab]();
}

function trackRow(t, ctx, i, rank) {
  const cur = currentTrack()?.id === t.id ? ' current' : '';
  return `<div class="row${cur}" data-play="${esc(ctx)}" data-i="${i}">
    ${rank ? `<span class="rank">${i + 1}</span>` : ''}${coverHTML(t, 'md')}
    <div class="meta"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div>
    <button class="icon-btn more" data-menu="${t.id}" data-ctx="${esc(ctx)}" aria-label="Opções">${ICON.more}</button>
  </div>`;
}
function trackList(list, ctx, rank, offset = 0) {
  return `<div class="list">${list.map((t, i) => trackRow(t, ctx, i + offset, rank)).join('')}</div>`;
}

// Cada "contexto" sabe gerar sua lista de faixas, para tocar em sequência.
function contextTracks(ctx) {
  if (isRemote(ctx)) return state.lists.get(ctx) || [];
  const [kind, arg] = ctx.split(':');
  if (kind === 'liked') return state.tracks.filter((t) => t.liked).sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));
  if (kind === 'pl') { const p = state.playlists.find((x) => x.id === arg); return p ? p.trackIds.map(byId).filter(Boolean) : []; }
  if (kind === 'recent') return state.recents.map(byId).filter(Boolean);
  if (kind === 'one') return [byId(decodeURIComponent(arg))].filter(Boolean);
  return [];
}

function genreTile(g) {
  return `<button class="genre" data-go="genre:${encodeURIComponent(g.name)}" style="--h:${g.hue}"><span>${esc(g.name)}</span></button>`;
}

function renderHome() {
  const recent = contextTracks('recent').slice(0, 12);
  const trend = contextTracks('trend');
  const quick = [
    { route: 'liked', label: 'Curtidas', cover: `<div class="cover md" style="background:linear-gradient(135deg,var(--accent),#7a2cff)">${ICON.heart}</div>` },
    ...state.playlists.slice(0, 5).map((p) => ({ route: 'pl:' + p.id, label: p.name, cover: coverHTML(p.trackIds.map(byId).find(Boolean), 'md', p.name) })),
  ];
  const top = trend[0];
  const hero = top ? `<div class="hero-card" data-play="trend" data-i="0">
      <div class="hero-bg" style="${coverStyle(top)}"></div>
      ${coverHTML(top, 'hero-art')}
      <div class="hero-info"><div class="eyebrow">Destaque da semana</div><div class="t">${esc(top.title)}</div><div class="a">${esc(top.artist)}</div>
        <span class="hero-play">${ICON.play}</span></div>
    </div>` : '';
  return `
    ${hero}
    <div class="quick">${quick.map((q) => `<button data-go="${q.route}">${q.cover}<span class="t">${esc(q.label)}</span></button>`).join('')}</div>
    <h2>Gêneros</h2>
    <div class="shelf genres-shelf">${GENRES.slice(0, 8).map(genreTile).join('')}</div>
    ${recent.length ? `<h2>Tocadas recentemente</h2>
      <div class="shelf">${recent.map((t, i) => `<button class="tile" data-play="recent" data-i="${i}"><div class="tile-art">${coverHTML(t, 'lg')}<span class="tile-play">${ICON.play}</span></div><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></button>`).join('')}</div>` : ''}
    <h2 class="link" data-go="trend">Em alta esta semana <span>Ver tudo</span></h2>
    ${listState('trend') || trackList(trend.slice(1, 11), 'trend', true, 1)}`;
}

function renderSearch() {
  return `<label class="search">${ICON.search}
    <input id="q" type="search" placeholder="Músicas ou artistas" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search"></label>
    <div id="results"></div>`;
}
function bindSearch() {
  const inp = $('#q'); let h;
  inp.oninput = () => { clearTimeout(h); h = setTimeout(() => { state.query = inp.value.trim(); $('#results').innerHTML = renderResults(); }, 350); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') { inp.blur(); clearTimeout(h); state.query = inp.value.trim(); $('#results').innerHTML = renderResults(); } };
}
function renderResults() {
  if (!state.query) return `<h2>Gêneros</h2><div class="genres">${GENRES.map(genreTile).join('')}</div>`;
  const ctx = 'q:' + encodeURIComponent(state.query);
  const r = contextTracks(ctx);
  return listState(ctx) || (r.length ? trackList(r, ctx) : `<div class="empty"><p>Nada encontrado para “${esc(state.query)}”.</p></div>`);
}

function artistList() {
  const m = new Map();
  for (const t of state.tracks.filter((x) => x.liked || state.playlists.some((p) => p.trackIds.includes(x.id)))) {
    const a = m.get(t.artistId) || { id: t.artistId, name: t.artist, tracks: [] }; a.tracks.push(t); m.set(t.artistId, a);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
const artistRoute = (id, name) => `artist:${encodeURIComponent(id)}:${encodeURIComponent(name)}`;

function renderLibrary() {
  const f = state.libFilter;
  const chips = [['songs', 'Curtidas'], ['playlists', 'Playlists'], ['artists', 'Artistas']]
    .map(([k, l]) => `<button class="chip${f === k ? ' on' : ''}" data-filter="${k}">${l}</button>`).join('');
  let body = '';
  if (f === 'songs') {
    const liked = contextTracks('liked');
    body = liked.length ? `<div style="display:flex;gap:10px;margin:14px 0 10px">
      <button class="btn" data-play="liked" data-i="0">${ICON.play} Tocar</button>
      <button class="btn ghost" data-shuffle="liked">${ICON.shuffle} Aleatório</button></div>
      ${trackList(liked, 'liked')}` : `<div class="empty"><div class="big">${ICON.heart}</div><h3>Nenhuma curtida ainda</h3><p>Toque no coração de uma música para guardar ela aqui.</p><button class="btn" data-tab-go="search">${ICON.search} Pesquisar músicas</button></div>`;
  } else if (f === 'playlists') {
    body = `<div class="list" style="margin-top:10px">
      <button class="row" data-act="new-playlist"><div class="cover md">${ICON.plus}</div><div class="meta"><div class="t">Nova playlist</div></div></button>
      ${state.playlists.map((p) => {
        const t = p.trackIds.map(byId).find(Boolean);
        return `<button class="row" data-go="pl:${p.id}">${coverHTML(t, 'md', p.name)}<div class="meta"><div class="t">${esc(p.name)}</div><div class="a">${p.trackIds.length} ${p.trackIds.length === 1 ? 'música' : 'músicas'}</div></div></button>`;
      }).join('')}</div>`;
  } else {
    const artists = artistList();
    body = artists.length ? `<div class="list" style="margin-top:10px">${artists.map((a) =>
      `<button class="row" data-go="${artistRoute(a.id, a.name)}"><div class="cover md round" style="${coverStyle(a.tracks[0])}"></div><div class="meta"><div class="t">${esc(a.name)}</div><div class="a">${a.tracks.length} ${a.tracks.length === 1 ? 'música salva' : 'músicas salvas'}</div></div></button>`).join('')}</div>`
      : `<div class="empty"><p>Os artistas das músicas que você curtir aparecem aqui.</p></div>`;
  }
  return `<div class="chips">${chips}</div>${body}`;
}

function renderCollection(route) {
  const [kind, arg, arg2] = route.split(':');
  const list = contextTracks(route);
  let title = '', cover = '', extra = '', rank = false;
  const big = (inner, style = '') => `<div class="cover" style="${style}">${inner}</div>`;
  if (kind === 'liked') { title = 'Curtidas'; cover = big(ICON.heart.replace('<svg', '<svg style="width:64px;height:64px"').replace('<path', '<path class="fill"'), 'background:linear-gradient(135deg,var(--accent),#7a2cff)'); }
  else if (kind === 'trend') { title = 'Em alta esta semana'; rank = true; cover = big('🔥', 'font-size:72px;background:linear-gradient(135deg,#ff6a3d,#ff2d6e)'); }
  else if (kind === 'genre') { title = decodeURIComponent(arg); const g = GENRES.find((x) => x.name === title); cover = big(esc(title), `font-size:30px;background:linear-gradient(135deg,hsl(${g?.hue ?? 20} 75% 50%),hsl(${((g?.hue ?? 20) + 40) % 360} 70% 25%))`); }
  else if (kind === 'artist') { title = decodeURIComponent(arg2 || ''); cover = `<div class="cover" style="border-radius:50%;${coverStyle(list[0] || state.tracks.find((t) => String(t.artistId) === decodeURIComponent(arg)))}"></div>`; }
  else if (kind === 'pl') {
    const p = state.playlists.find((x) => x.id === arg);
    if (!p) { state.route = null; return renderLibrary(); }
    title = p.name; cover = coverHTML(list[0], '', p.name);
    extra = `<button class="btn ghost" data-plmenu="${p.id}" aria-label="Opções da playlist">${ICON.more}</button>`;
  }
  const pending = isRemote(route) ? listState(route) : null;
  const sub = pending ? '' : `${list.length} ${list.length === 1 ? 'música' : 'músicas'}`;
  return `<button class="back" data-act="back">${ICON.chevron} Voltar</button>
    <div class="hero">${cover}<h3>${esc(title)}</h3><div class="a">${sub}</div>
      <div class="actions">${list.length ? `<button class="btn" data-play="${esc(route)}" data-i="0">${ICON.play} Tocar</button>
      <button class="btn ghost" data-shuffle="${esc(route)}">${ICON.shuffle} Aleatório</button>` : ''}${extra}</div></div>
    ${pending || (list.length ? trackList(list, route, rank) : `<div class="empty"><p>${kind === 'liked' ? 'Toque no coração de uma música para ela aparecer aqui.' : kind === 'pl' ? 'Adicione músicas pelo menu ••• de cada faixa.' : 'Nada por aqui ainda.'}</p></div>`)}`;
}

// ---------- cliques (delegação) ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-menu],[data-play],[data-go],[data-act],[data-filter],[data-shuffle],[data-plmenu],[data-opt],[data-retry],[data-tab-go]');
  if (!el) return;
  const d = el.dataset;
  if (d.menu) { e.stopPropagation(); return trackMenu(d.menu, d.ctx); }
  if (d.opt) return;
  if (d.play) return playContext(d.play, +d.i || 0);
  if (d.shuffle) return playContext(d.shuffle, -1, true);
  if (d.go) return go(d.go);
  if (d.retry) { state.failed.delete(d.retry); return render(true); }
  if (d.tabGo) return $(`.tabs [data-tab="${d.tabGo}"]`).click();
  if (d.filter) { state.libFilter = d.filter; return render(); }
  if (d.plmenu) return playlistMenu(d.plmenu);
  if (d.act === 'back') return back();
  if (d.act === 'new-playlist') return newPlaylist();
});

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

async function start(autoplay = true) {
  const t = currentTrack(); if (!t) return;
  updateNowPlaying();
  try { player.load(await Catalog.streamUrl(t), autoplay); } catch { return toast('Sem conexão com o catálogo'); }
  keep(t);
  state.recents = [t.id, ...state.recents.filter((x) => x !== t.id)].slice(0, 30);
  DB.put('kv', state.recents, 'recents');
  if (state.tab === 'home' && !state.route) render();
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('current', contextTracks(r.dataset.play || '')[+r.dataset.i]?.id === t.id));
  if (t.hue == null && t.artUrl) hueFromImage(t.artUrl).then((h) => { t.hue = h ?? hashHue(t.artist + t.title); DB.put('tracks', t); if (currentTrack() === t) setAccent(t); });
}

function next(auto) {
  if (!state.order.length) return;
  if (auto && state.repeat === 'one') { player.currentTime = 0; player.play(); return; }
  if (state.idx < state.order.length - 1) state.idx++;
  else if (state.repeat === 'all' || !auto) { state.idx = 0; if (state.shuffle) buildOrder(state.order[0]); }
  else { player.pause(); player.currentTime = 0; return; }
  start();
}
function prev() {
  if (player.currentTime > 3 || state.idx === 0) { player.currentTime = 0; return; }
  state.idx--; start();
}
function togglePlay() {
  if (!currentTrack()) return;
  if (player.paused) player.play(); else player.pause();
}

player.on.ended = () => next(true);
player.on.play = syncPlay;
player.on.pause = syncPlay;
player.on.time = syncTime;
player.on.error = () => { toast('Essa música não está disponível agora'); setTimeout(() => next(false), 800); };

function syncPlay() {
  const playing = !player.paused;
  $('#mini-play').innerHTML = playing ? ICON.pause : ICON.play;
  $('#btn-play').innerHTML = playing ? ICON.pause : ICON.play;
  $('#player').classList.toggle('playing', playing);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}
function syncTime() {
  const d = player.duration || currentTrack()?.duration || 0, c = player.currentTime || 0;
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
  const hue = t?.hue ?? (t ? hashHue(t.artist + t.title) : 16);
  document.documentElement.style.setProperty('--accent', `hsl(${hue} 85% 60%)`);
  document.documentElement.style.setProperty('--accent-soft', `hsla(${hue} 85% 60% / .16)`);
}

function contextLabel(ctx) {
  const [k, a] = ctx.split(':');
  if (k === 'pl') return state.playlists.find((p) => p.id === a)?.name || 'Playlist';
  if (k === 'genre') return decodeURIComponent(a);
  if (k === 'artist') return decodeURIComponent(ctx.split(':')[2] || '');
  return { trend: 'Em alta', q: 'Pesquisa', liked: 'Curtidas', recent: 'Tocadas recentemente' }[k] || 'Tocando agora';
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
  h('play', () => player.play()); h('pause', () => player.pause());
  h('previoustrack', prev); h('nexttrack', () => next(false));
  h('seekto', (e) => { player.currentTime = e.seekTime; });
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
  const d = player.duration || 0; if (d) { player.currentTime = p * d; drawWave(p); }
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
  keep(t); syncLike();
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
  showSheet(`<div class="sheet-head">${coverHTML(t, 'md')}<div class="meta"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}${t.genre ? ' · ' + esc(t.genre) : ''}</div></div></div>
    <button class="opt" data-opt="next">${ICON.next} Tocar a seguir</button>
    <button class="opt" data-opt="like">${ICON.heart} ${t.liked ? 'Remover das curtidas' : 'Curtir'}</button>
    <button class="opt" data-opt="add">${ICON.list} Adicionar à playlist</button>
    ${t.artistId ? `<button class="opt" data-opt="artist">${ICON.user} Ver artista</button>` : ''}
    ${inPl ? `<button class="opt danger" data-opt="unlist">${ICON.minus} Remover desta playlist</button>` : ''}`);
  $('#sheet-card').onclick = async (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt; if (!o) return;
    if (o === 'next') { playNext(t); hideSheet(); }
    else if (o === 'like') { hideSheet(); toggleLike(t); }
    else if (o === 'add') addToPlaylist(t);
    else if (o === 'artist') { hideSheet(); closePlayer(); go(artistRoute(t.artistId, t.artist)); }
    else if (o === 'unlist') { const p = state.playlists.find((x) => x.id === inPl); p.trackIds = p.trackIds.filter((x) => x !== t.id); await DB.put('playlists', p); hideSheet(); render(); toast('Removida da playlist'); }
  };
}

function playNext(t) {
  if (!currentTrack()) { state.queue = [t.id]; state.context = 'one:' + encodeURIComponent(t.id); buildOrder(0); start(); return; }
  state.queue.push(t.id);
  state.order.splice(state.idx + 1, 0, state.queue.length - 1);
  toast('Toca em seguida');
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
    p.trackIds.push(t.id); keep(t); await DB.put('playlists', p); hideSheet(); toast(`Adicionada a ${p.name}`); render();
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
    if (withTrack) keep(withTrack);
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



window.addEventListener('resize', () => syncTime());
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
load();
