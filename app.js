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
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>',
  radio: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.6 5.6a9 9 0 000 12.8M18.4 5.6a9 9 0 010 12.8"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  playSm: '<svg viewBox="0 0 24 24" class="xs"><path d="M8 5.5v13l10.5-6.5z" class="fill"/></svg>',
  heartSm: '<svg viewBox="0 0 24 24" class="xs"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" class="fill"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
};

const state = {
  tracks: [], playlists: [], recents: [],
  lists: new Map(), loading: new Set(), failed: new Set(), query: '', history: [],
  queue: [], order: [], idx: -1, context: '',
  shuffle: false, repeat: 'off',
  tab: 'home', route: null, pick: [],
  settings: { accent: 'orange', radio: true, name: '' },
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
  state.history = (await DB.get('kv', 'history')) || [];
  const s = (await DB.get('kv', 'settings')) || {};
  state.shuffle = !!s.shuffle; state.repeat = s.repeat || 'off';
  Object.assign(state.settings, s.prefs || {});
  setAccent(null);
  navigator.storage?.persist?.();
  render(); syncControls();
}
const saveSettings = () => DB.put('kv', { shuffle: state.shuffle, repeat: state.repeat, prefs: state.settings }, 'settings');

// ---------- listas que vêm do catálogo ----------
// Contextos remotos: "trend", "genre:<nome>", "q:<texto>", "artist:<id>:<nome>"
const isRemote = (ctx) => /^(trend|genre|q|artist|for|like):?/.test(ctx);
const likeRoute = (h) => ['like', h.artistId, h.artist, h.genre || ''].map(encodeURIComponent).join(':').replace(/^like/, 'like');
function fetchList(ctx) {
  const [kind, ...rest] = ctx.split(':'); const arg = decodeURIComponent(rest[0] || '');
  if (kind === 'trend') return Catalog.trending(null, 50);
  if (kind === 'genre') { const g = GENRES.find((x) => x.name === arg); return g?.genre ? Catalog.trending(g.genre, 50) : Catalog.search(g?.q || arg, 50); }
  if (kind === 'q') return Catalog.search(arg, 40);
  if (kind === 'artist') return Catalog.artistTracks(arg, 50);
  if (kind === 'for') return Recs.mix(40);
  if (kind === 'like') return Recs.similar(arg, decodeURIComponent(rest[2] || ''), 30);
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

const TITLES = { home: 'Noisy Sound', search: 'Pesquisar', library: 'Biblioteca', menu: 'Menu' };
function greeting() { const h = new Date().getHours(); return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const compact = (n) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

// soft = recarregar só o conteúdo, sem perder o que está sendo digitado na busca
function render(soft) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  $('#screen-title').textContent = state.route ? '' : TITLES[state.tab];
  document.body.dataset.view = state.route ? 'route' : state.tab;
  const v = $('#view');
  if (state.route) { v.innerHTML = renderCollection(state.route); return; }
  if (state.tab === 'search') {
    if (!soft || !$('#q')) { v.innerHTML = renderSearch(); bindSearch(); }
    $('#results').innerHTML = renderResults();
    return;
  }
  v.innerHTML = { home: renderHome, library: renderLibrary, menu: renderMenu }[state.tab]();
}

function trackRow(t, ctx, i, rank) {
  const cur = currentTrack()?.id === t.id ? ' current' : '';
  const stats = [t.plays ? `${ICON.playSm} ${compact(t.plays)}` : '', t.duration ? fmt(t.duration) : '', t.liked ? `<span class="liked-dot">${ICON.heartSm}</span>` : ''].filter(Boolean).join('<i class="sep"></i>');
  return `<div class="row${cur}" data-play="${esc(ctx)}" data-i="${i}">
    ${rank ? `<span class="rank">${i + 1}</span>` : ''}${coverHTML(t, 'md')}
    <div class="meta"><div class="a">${esc(t.artist)}</div><div class="t">${esc(t.title)}</div>${stats ? `<div class="stats">${stats}</div>` : ''}</div>
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
  if (kind === 'pick') return (state.pick || []).map(byId).filter(Boolean);
  return [];
}

function genreTile(g) {
  return `<button class="genre" data-go="genre:${encodeURIComponent(g.name)}" style="--h:${g.hue}"><span>${esc(g.name)}</span></button>`;
}

// Capa de playlist em mosaico (até 4 capas), como nas playlists do SoundCloud.
function mosaic(p, size = '') {
  const ts = p.trackIds.map(byId).filter(Boolean).slice(0, 4);
  if (ts.length < 4) return coverHTML(ts[0], size, p.name).replace('class="cover', 'class="cover pl-cover');
  return `<div class="cover pl-cover mosaic ${size}">${ts.map((t) => `<span style="${coverStyle(t)}"></span>`).join('')}</div>`;
}

function sectionHead(title, ctx, sub) {
  return `<div class="sec-head"${ctx ? ` data-go="${esc(ctx)}"` : ''}><div>${sub ? `<small>${esc(sub)}</small>` : ''}<h2>${esc(title)}</h2></div>${ctx ? `<span class="see">Ver tudo</span>` : ''}</div>`;
}

function renderHome() {
  const recent = contextTracks('recent').slice(0, 12);
  const trend = contextTracks('trend');
  const top = trend[0];
  const hero = top ? `<div class="feature" data-play="trend" data-i="0">
      <div class="feature-art" style="${coverStyle(top)}"></div>
      <div class="feature-body">
        <span class="badge">Destaque da semana</span>
        <div class="labels"><span class="lbl lbl-t">${esc(top.title)}</span><span class="lbl lbl-a">${esc(top.artist)}</span></div>
        <div class="feature-foot"><span class="play-circle">${ICON.play}</span><div class="mini-wave">${waveBars(top.id, 48)}</div></div>
      </div>
    </div>` : (listState('trend') || '');
  return `
    <div class="greet">${greeting()}${state.settings.name ? `, ${esc(state.settings.name)}` : ''}</div>
    ${hero}
    <div class="quick">
      <button data-go="liked"><span class="q-ic liked-ic">${ICON.heart}</span><span class="t">Curtidas</span></button>
      ${state.playlists.slice(0, 3).map((p) => `<button data-go="pl:${p.id}">${mosaic(p, 'q')}<span class="t">${esc(p.name)}</span></button>`).join('')}
      ${state.playlists.length < 3 ? `<button data-act="new-playlist"><span class="q-ic">${ICON.plus}</span><span class="t">Nova playlist</span></button>` : ''}
    </div>
    ${recShelves()}
    ${sectionHead('Gêneros', null, 'Explore')}
    <div class="shelf genres-shelf">${GENRES.slice(0, 10).map(genreTile).join('')}</div>
    ${recent.length ? sectionHead('Tocadas recentemente', 'recent') + tileShelf('recent', recent) : ''}
    ${sectionHead('Em alta esta semana', 'trend', 'Top 50')}
    ${listState('trend') || trackList(trend.slice(1, 11), 'trend', true, 1)}`;
}

// Barrinhas estáticas de forma de onda (decoração dos cartões).
function waveBars(seed, n) {
  const p = fakePeaks(String(seed));
  return Array.from({ length: n }, (_, i) => `<i style="height:${Math.round(18 + p[Math.floor(i / n * p.length)] * 82)}%"></i>`).join('');
}

function tileShelf(ctx, list) {
  return `<div class="shelf">${list.map((t, i) => `<button class="tile" data-play="${esc(ctx)}" data-i="${i}"><div class="tile-art">${coverHTML(t, 'lg')}<span class="tile-play">${ICON.play}</span></div><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></button>`).join('')}</div>`;
}
function recShelves() {
  if (!state.history.length) return '';
  const part = (ctx, title, sub) => {
    const list = contextTracks(ctx);
    const pending = listState(ctx);
    if (!pending && !list.length) return '';
    return sectionHead(title, ctx, sub) + (pending || tileShelf(ctx, list.slice(0, 12)));
  };
  return part('for:you', 'Feito para você', 'Com base no que você ouve') +
    Recs.recentArtists(2).map((h) => part(likeRoute(h), h.artist, 'Porque você ouviu')).join('');
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
  if (!state.query) return `${sectionHead('Navegue por gênero')}<div class="genres">${GENRES.map(genreTile).join('')}</div>`;
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

function navRow(icon, label, route, count, act) {
  return `<button class="nav-row" ${act ? `data-act="${act}"` : `data-go="${route}"`}><span class="nav-ic">${icon}</span><span class="nav-label">${esc(label)}</span>${count != null ? `<span class="nav-count">${count}</span>` : ''}<span class="chev">${ICON.chevron}</span></button>`;
}

function playlistGrid() {
  return `<div class="pl-grid">
    <button class="pl-card new" data-act="new-playlist"><div class="cover pl-cover">${ICON.plus}</div><div class="t">Nova playlist</div><div class="a">Crie e escolha as músicas</div></button>
    ${state.playlists.map((p) => `<button class="pl-card" data-go="pl:${p.id}">${mosaic(p)}<div class="t">${esc(p.name)}</div><div class="a">${plural(p.trackIds.length, 'música', 'músicas')}</div></button>`).join('')}
  </div>`;
}

function renderLibrary() {
  const recent = contextTracks('recent').slice(0, 12);
  return `<div class="nav-list">
      ${navRow(ICON.heart, 'Curtidas', 'liked', contextTracks('liked').length)}
      ${navRow(ICON.list, 'Playlists', 'playlists', state.playlists.length)}
      ${navRow(ICON.user, 'Artistas', 'artists', artistList().length)}
      ${navRow(ICON.clock, 'Tocadas recentemente', 'recent')}
    </div>
    ${recent.length ? sectionHead('Ouvidas recentemente', 'recent') + tileShelf('recent', recent) : ''}
    <div class="sec-head"><div><h2>Suas playlists</h2></div><button class="see btn-link" data-act="new-playlist">${ICON.plus} Nova</button></div>
    ${playlistGrid()}`;
}

function renderMenu() {
  const s = state.settings;
  const name = s.name || 'Seu nome';
  return `<div class="profile">
      <div class="avatar">${esc((s.name || 'N').charAt(0).toUpperCase())}</div>
      <div class="meta"><div class="t">${esc(name)}</div><div class="a">${plural(contextTracks('liked').length, 'curtida', 'curtidas')} · ${plural(state.playlists.length, 'playlist', 'playlists')}</div></div>
      <button class="btn ghost sm" data-act="edit-name">Editar</button>
    </div>
    <div class="menu-group"><div class="menu-title">Sua música</div>
      ${navRow(ICON.heart, 'Curtidas', 'liked', contextTracks('liked').length)}
      ${navRow(ICON.list, 'Playlists', 'playlists', state.playlists.length)}
      ${navRow(ICON.user, 'Artistas', 'artists', artistList().length)}
      ${navRow(ICON.clock, 'Tocadas recentemente', 'recent')}
    </div>
    <div class="menu-group"><div class="menu-title">Aparência</div>
      <div class="set-row"><div><div class="t">Cor do app</div><div class="a">Laranja ou a cor da capa que está tocando</div></div>
        <div class="seg"><button class="${s.accent !== 'cover' ? 'on' : ''}" data-set="accent:orange">Laranja</button><button class="${s.accent === 'cover' ? 'on' : ''}" data-set="accent:cover">Capa</button></div></div>
    </div>
    <div class="menu-group"><div class="menu-title">Reprodução</div>
      <div class="set-row" data-set="radio:toggle"><div><div class="t">Continuar com músicas parecidas</div><div class="a">Quando a lista acabar, o app segue tocando</div></div><span class="switch${s.radio ? ' on' : ''}"><i></i></span></div>
    </div>
    <div class="menu-group"><div class="menu-title">Seus dados</div>
      ${navRow(ICON.trash, 'Limpar histórico de reprodução', null, null, 'clear-history')}
    </div>
    <div class="menu-group"><div class="menu-title">Sobre</div>
      <div class="about"><span class="logo big" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <div><div class="t">Noisy Sound</div><div class="a">Só música, sem propaganda. Músicas do catálogo aberto do Audius.</div></div></div>
      <a class="nav-row" href="https://github.com/GabrielGamon/Noisy-Sound#readme" target="_blank" rel="noopener"><span class="nav-ic">${ICON.info}</span><span class="nav-label">Como o app funciona</span><span class="chev">${ICON.chevron}</span></a>
    </div>`;
}

function renderCollection(route) {
  const [kind, arg, arg2] = route.split(':');
  if (kind === 'playlists') return `${backBtn()}<div class="page-title">Playlists</div>${playlistGrid()}`;
  if (kind === 'artists') {
    const artists = artistList();
    return `${backBtn()}<div class="page-title">Artistas</div>` + (artists.length ? `<div class="list">${artists.map((a) =>
      `<button class="row" data-go="${artistRoute(a.id, a.name)}"><div class="cover md round" style="${coverStyle(a.tracks[0])}"></div><div class="meta"><div class="t">${esc(a.name)}</div><div class="a">${plural(a.tracks.length, 'música salva', 'músicas salvas')}</div></div><span class="chev">${ICON.chevron}</span></button>`).join('')}</div>`
      : `<div class="empty"><p>Os artistas das músicas que você curtir ou colocar em playlists aparecem aqui.</p></div>`);
  }
  const list = contextTracks(route);
  let title = '', cover = '', extra = '', rank = false, sub2 = '';
  const big = (inner, style = '') => `<div class="cover" style="${style}">${inner}</div>`;
  if (kind === 'liked') { title = 'Curtidas'; cover = big(ICON.heart.replace('<svg', '<svg style="width:64px;height:64px"').replace('<path', '<path class="fill"'), 'background:linear-gradient(135deg,#ff7a00,#ff2d55)'); }
  else if (kind === 'recent') { title = 'Tocadas recentemente'; cover = big(ICON.clock.replace('<svg', '<svg style="width:64px;height:64px"'), 'background:linear-gradient(135deg,#3a3a3a,#1b1b1b)'); }
  else if (kind === 'for') { title = 'Feito para você'; sub2 = 'Com base no que você ouve'; cover = big('✨', 'font-size:72px;background:linear-gradient(135deg,var(--accent),#3d5afe)'); }
  else if (kind === 'like') { title = 'Parecidas com ' + decodeURIComponent(arg2 || ''); cover = big('🎧', 'font-size:72px;background:linear-gradient(135deg,#7a2cff,var(--accent))'); }
  else if (kind === 'trend') { title = 'Em alta esta semana'; rank = true; cover = big('🔥', 'font-size:72px;background:linear-gradient(135deg,#ff7a00,#ff2d55)'); }
  else if (kind === 'genre') { title = decodeURIComponent(arg); const g = GENRES.find((x) => x.name === title); cover = big(esc(title), `font-size:30px;font-weight:800;background:linear-gradient(135deg,hsl(${g?.hue ?? 20} 75% 50%),hsl(${((g?.hue ?? 20) + 40) % 360} 70% 25%))`); }
  else if (kind === 'artist') { title = decodeURIComponent(arg2 || ''); cover = `<div class="cover round" style="${coverStyle(list[0] || state.tracks.find((t) => String(t.artistId) === decodeURIComponent(arg)))}"></div>`; }
  else if (kind === 'pl') {
    const p = state.playlists.find((x) => x.id === arg);
    if (!p) { state.route = null; return renderLibrary(); }
    title = p.name; cover = mosaic(p); sub2 = 'Sua playlist';
    extra = `<button class="btn ghost" data-addsongs="${p.id}">${ICON.plus} Adicionar músicas</button><button class="btn ghost icon" data-plmenu="${p.id}" aria-label="Opções da playlist">${ICON.more}</button>`;
  }
  const pending = isRemote(route) ? listState(route) : null;
  const total = list.reduce((s, t) => s + (t.duration || 0), 0);
  const sub = pending ? '' : `${plural(list.length, 'música', 'músicas')}${total >= 60 ? ' · ' + Math.round(total / 60) + ' min' : ''}`;
  const empty = kind === 'liked' ? 'Toque no coração de uma música para ela aparecer aqui.'
    : kind === 'pl' ? 'Sua playlist está vazia. Toque em “Adicionar músicas” para escolher.' : 'Nada por aqui ainda.';
  return `${backBtn()}
    <div class="hero">${cover}<div class="hero-text">${sub2 ? `<small>${esc(sub2)}</small>` : ''}<h3>${esc(title)}</h3><div class="a">${sub}</div></div></div>
    <div class="actions">${list.length ? `<button class="btn play" data-play="${esc(route)}" data-i="0">${ICON.play} Tocar</button>
      <button class="btn ghost" data-shuffle="${esc(route)}">${ICON.shuffle} Aleatório</button>` : ''}${extra}</div>
    ${pending || (list.length ? trackList(list, route, rank) : `<div class="empty"><p>${empty}</p>${kind === 'pl' ? `<button class="btn" data-addsongs="${arg}">${ICON.plus} Adicionar músicas</button>` : ''}</div>`)}`;
}
const backBtn = () => `<button class="back" data-act="back">${ICON.chevron} Voltar</button>`;

// ---------- cliques (delegação) ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-menu],[data-play],[data-go],[data-act],[data-shuffle],[data-plmenu],[data-opt],[data-retry],[data-tab-go],[data-addsongs],[data-set]');
  if (!el) return;
  const d = el.dataset;
  if (d.menu) { e.stopPropagation(); return trackMenu(d.menu, d.ctx); }
  if (d.opt) return;
  if (d.play) return playContext(d.play, +d.i || 0);
  if (d.shuffle) return playContext(d.shuffle, -1, true);
  if (d.go) return go(d.go);
  if (d.retry) { state.failed.delete(d.retry); return render(true); }
  if (d.tabGo) return $(`.tabs [data-tab="${d.tabGo}"]`).click();
  if (d.plmenu) return playlistMenu(d.plmenu);
  if (d.addsongs) return addSongsSheet(d.addsongs);
  if (d.set) return changeSetting(d.set);
  if (d.act === 'back') return back();
  if (d.act === 'new-playlist') return newPlaylist();
  if (d.act === 'edit-name') return editName();
  if (d.act === 'clear-history') return clearHistory();
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
  state.history = [...state.history, { id: t.id, artistId: t.artistId, artist: t.artist, genre: t.genre, at: Date.now() }].slice(-300);
  DB.put('kv', state.history, 'history');
  // A cada 4 músicas, o "Feito para você" é refeito com o gosto atualizado.
  if (state.history.length % 4 === 0 && state.context !== 'for:you') state.lists.delete('for:you');
  if (state.tab === 'home' && !state.route) render();
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('current', contextTracks(r.dataset.play || '')[+r.dataset.i]?.id === t.id));
  if (t.hue == null && t.artUrl) hueFromImage(t.artUrl).then((h) => { t.hue = h ?? hashHue(t.artist + t.title); DB.put('tracks', t); if (currentTrack() === t) setAccent(t); });
}

function next(auto) {
  if (!state.order.length) return;
  if (auto && state.repeat === 'one') { player.currentTime = 0; player.play(); return; }
  if (state.idx < state.order.length - 1) state.idx++;
  else if (state.repeat === 'all') { state.idx = 0; if (state.shuffle) buildOrder(state.order[0]); }
  else return keepGoing();
  start();
}

// Quando a fila acaba, continua tocando músicas parecidas com a última.
async function keepGoing() {
  const t = currentTrack(); if (!t) return;
  let more = [];
  if (state.settings.radio) try { more = remember(await Recs.similar(t.artistId, t.genre, 20)).filter((x) => !state.queue.includes(x.id)); } catch {}
  if (!state.settings.radio || !more.length) { player.pause(); player.currentTime = 0; return; }
  const start0 = state.queue.length;
  state.queue.push(...more.map((x) => x.id));
  state.order.push(...more.map((_, i) => start0 + i));
  state.idx++;
  toast('Tocando músicas parecidas');
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

// Laranja fixo (padrão) ou a cor tirada da capa que está tocando, conforme o Menu.
function setAccent(t) {
  const root = document.documentElement.style;
  if (state.settings.accent !== 'cover' || !t) { root.setProperty('--accent', '#ff5500'); root.setProperty('--accent-2', '#ff8800'); root.setProperty('--accent-soft', 'rgba(255,85,0,.16)'); return; }
  const hue = t.hue ?? hashHue(t.artist + t.title);
  root.setProperty('--accent', `hsl(${hue} 90% 55%)`); root.setProperty('--accent-2', `hsl(${(hue + 25) % 360} 95% 60%)`);
  root.setProperty('--accent-soft', `hsla(${hue} 90% 55% / .16)`);
}

function contextLabel(ctx) {
  const [k, a] = ctx.split(':');
  if (k === 'pl') return state.playlists.find((p) => p.id === a)?.name || 'Playlist';
  if (k === 'genre') return decodeURIComponent(a);
  if (k === 'artist') return decodeURIComponent(ctx.split(':')[2] || '');
  if (k === 'like') return 'Parecidas com ' + decodeURIComponent(ctx.split(':')[2] || '');
  if (k === 'for') return 'Feito para você';
  return { trend: 'Em alta', q: 'Pesquisa', liked: 'Curtidas', recent: 'Tocadas recentemente' }[k] || 'Tocando agora';
}

function updateNowPlaying() {
  const t = currentTrack(); if (!t) return;
  $('#mini').classList.remove('hidden');
  $('#mini-cover').outerHTML = coverHTML(t, 'sm').replace('<div class="cover sm"', '<div class="cover sm" id="mini-cover"');
  $('#mini-title').textContent = t.title; $('#mini-artist').textContent = t.artist;
  $('#player-art').setAttribute('style', coverStyle(t));
  $('#player-cover').setAttribute('style', coverStyle(t)); $('#player-cover').textContent = urls.get(t.id) ? '' : t.title.charAt(0).toUpperCase();
  $('#player-title').textContent = t.title; $('#player-artist').textContent = t.artist;
  $('#player-add').innerHTML = `${ICON.list}<span>Playlist</span>`;
  $('#player-artist-btn').innerHTML = `${ICON.radio}<span>Parecidas</span>`;
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

// ---------- barra de progresso ----------
function drawWave(p) { $('#wave').style.setProperty('--p', (Math.min(1, Math.max(0, p)) * 100).toFixed(2) + '%'); }
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
$('#mini-like').onclick = () => { const t = currentTrack(); if (t) toggleLike(t); };
$('#player-add').onclick = () => { const t = currentTrack(); if (t) addToPlaylist(t); };
$('#player-artist-btn').onclick = () => { const t = currentTrack(); if (t) { closePlayer(); go(likeRoute(t)); } };

// Arrastar para baixo fecha o player
(() => {
  let y0 = null; const p = $('#player');
  p.addEventListener('touchstart', (e) => { if (e.target.closest('#wave, .player-actions')) return; y0 = e.touches[0].clientY; }, { passive: true });
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
  const t = currentTrack(); const liked = !!t?.liked;
  const b = $('#player-like'); b.innerHTML = `${liked ? ICON.heartSm.replace(' class="xs"', '') : ICON.heart}<span>${liked ? 'Curtida' : 'Curtir'}</span>`; b.classList.toggle('on', liked);
  const m = $('#mini-like'); m.innerHTML = liked ? ICON.heartSm.replace(' class="xs"', '') : ICON.heart; m.classList.toggle('on', liked);
}
async function toggleLike(t) {
  t.liked = !t.liked; t.likedAt = t.liked ? Date.now() : null;
  keep(t); syncLike();
  toast(t.liked ? 'Adicionada às curtidas' : 'Removida das curtidas');
  if (!$('#player').classList.contains('open')) render();
}

// ---------- folha de opções ----------
// A folha só fecha tocando fora dela; toques logo depois de abrir (ou com o teclado aberto) são ignorados,
// porque no iPhone o teclado fechando faz o conteúdo pular e o toque cairia no fundo.
let sheetOpenedAt = 0;
function showSheet(html, { locked, tall } = {}) {
  $('#sheet-card').innerHTML = html; $('#sheet').classList.add('open'); $('#sheet').classList.toggle('tall', !!tall);
  $('#sheet').dataset.locked = locked ? '1' : ''; sheetOpenedAt = Date.now();
}
function hideSheet(force) { if ($('#sheet').dataset.locked && !force) return; $('#sheet').classList.remove('open'); }
$('#sheet').addEventListener('click', (e) => {
  if (e.target.id !== 'sheet' || Date.now() - sheetOpenedAt < 400) return;
  if (document.activeElement?.matches('#sheet input')) return document.activeElement.blur();
  hideSheet();
});

// Caixa de diálogo no topo da tela (fica longe do teclado do iPhone). Enviar = botão ou "Ir" do teclado.
function askText({ title, value = '', placeholder = '', ok = 'Salvar' }) {
  return new Promise((resolve) => {
    const d = $('#dialog'), f = $('#dialog-card');
    f.innerHTML = `<div class="dialog-title">${esc(title)}</div>
      <input class="field" name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="60" enterkeyhint="done" autocapitalize="sentences">
      <div class="row-btns"><button type="button" class="btn ghost" data-x="cancel">Cancelar</button><button type="submit" class="btn">${esc(ok)}</button></div>`;
    d.classList.add('open');
    const inp = f.querySelector('input');
    inp.focus(); // no iPhone só abre o teclado se for no mesmo toque; tudo bem se não abrir
    const done = (v) => { d.classList.remove('open'); f.onsubmit = null; f.onclick = null; d.onclick = null; inp.blur(); resolve(v); };
    f.onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return inp.focus(); done(v); };
    f.onclick = (e) => { if (e.target.closest('[data-x="cancel"]')) done(null); };
    d.onclick = (e) => { if (e.target === d) done(null); };
  });
}
function askConfirm({ title, text, ok = 'Confirmar', danger }) {
  return new Promise((resolve) => {
    const d = $('#dialog'), f = $('#dialog-card');
    f.innerHTML = `<div class="dialog-title">${esc(title)}</div>${text ? `<p class="dialog-text">${esc(text)}</p>` : ''}
      <div class="row-btns"><button type="button" class="btn ghost" data-x="cancel">Cancelar</button><button type="submit" class="btn${danger ? ' danger' : ''}">${esc(ok)}</button></div>`;
    d.classList.add('open');
    const done = (v) => { d.classList.remove('open'); f.onsubmit = null; f.onclick = null; d.onclick = null; resolve(v); };
    f.onsubmit = (e) => { e.preventDefault(); done(true); };
    f.onclick = (e) => { if (e.target.closest('[data-x="cancel"]')) done(false); };
    d.onclick = (e) => { if (e.target === d) done(false); };
  });
}

function trackMenu(id, ctx, fromPlayer) {
  const t = byId(id); if (!t) return;
  const inPl = ctx?.startsWith('pl:') ? ctx.slice(3) : null;
  showSheet(`<div class="sheet-head">${coverHTML(t, 'md')}<div class="meta"><div class="a">${esc(t.artist)}</div><div class="t">${esc(t.title)}</div>${t.genre ? `<div class="stats">${esc(t.genre)}</div>` : ''}</div></div>
    <button class="opt" data-opt="next">${ICON.next} Tocar a seguir</button>
    <button class="opt" data-opt="like">${ICON.heart} ${t.liked ? 'Remover das curtidas' : 'Curtir'}</button>
    <button class="opt" data-opt="add">${ICON.list} Adicionar à playlist</button>
    <button class="opt" data-opt="radio">${ICON.radio} Tocar parecidas</button>
    ${t.artistId ? `<button class="opt" data-opt="artist">${ICON.user} Ver artista</button>` : ''}
    ${inPl ? `<button class="opt danger" data-opt="unlist">${ICON.minus} Remover desta playlist</button>` : ''}`);
  $('#sheet-card').onclick = async (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt; if (!o) return;
    if (o === 'next') { playNext(t); hideSheet(); }
    else if (o === 'like') { hideSheet(); toggleLike(t); }
    else if (o === 'add') addToPlaylist(t);
    else if (o === 'radio') { hideSheet(); closePlayer(); go(likeRoute(t)); }
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

async function putInPlaylist(p, t) {
  if (p.trackIds.includes(t.id)) return false;
  p.trackIds.push(t.id); keep(t); await DB.put('playlists', p); return true;
}

function addToPlaylist(t) {
  showSheet(`<div class="sheet-title">Adicionar à playlist</div>
    <button class="opt" data-opt="new">${ICON.plus} Nova playlist</button>
    ${state.playlists.map((p) => `<button class="opt" data-opt="pl" data-id="${p.id}">${mosaic(p, 'xs')} ${esc(p.name)}${p.trackIds.includes(t.id) ? ` <span class="check">${ICON.check}</span>` : ''}</button>`).join('')}`);
  $('#sheet-card').onclick = async (e) => {
    const b = e.target.closest('[data-opt]'); if (!b) return;
    if (b.dataset.opt === 'new') { hideSheet(true); return newPlaylist(t); }
    const p = state.playlists.find((x) => x.id === b.dataset.id);
    hideSheet(true);
    toast((await putInPlaylist(p, t)) ? `Adicionada a ${p.name}` : 'Já está nessa playlist');
    render();
  };
}

async function newPlaylist(withTrack) {
  const name = await askText({ title: 'Nova playlist', placeholder: 'Nome da playlist', ok: 'Criar' });
  if (!name) return;
  const p = { id: uid(), name, trackIds: [], created: Date.now() };
  state.playlists.push(p);
  if (withTrack) await putInPlaylist(p, withTrack); else await DB.put('playlists', p);
  toast(withTrack ? `Adicionada a ${name}` : 'Playlist criada');
  if (withTrack) return render();
  closePlayer(); go('pl:' + p.id);
  addSongsSheet(p.id);
}

// Folha para escolher músicas para a playlist: busca + sugestões, com botão de adicionar em cada uma.
function addSongsSheet(plId) {
  const p = state.playlists.find((x) => x.id === plId); if (!p) return;
  const suggest = () => {
    const seen = new Set(); const out = [];
    for (const t of [...contextTracks('liked'), ...contextTracks('recent'), ...contextTracks('for:you'), ...contextTracks('trend')]) if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
    return out.slice(0, 40);
  };
  let q = '', results = null, timer;
  showSheet(`<div class="sheet-bar"><div class="sheet-title">Adicionar a ${esc(p.name)}</div><button class="btn sm" data-opt="done">Pronto</button></div>
    <label class="search">${ICON.search}<input id="add-q" type="search" placeholder="Buscar músicas ou artistas" autocomplete="off" enterkeyhint="search"></label>
    <div id="add-list" class="add-list"></div>`, { tall: true });
  if (!state.lists.has('trend')) ensureList('trend').then(() => draw());
  const draw = () => {
    const box = $('#add-list'); if (!box) return;
    const list = q ? results : suggest();
    if (q && !results) { box.innerHTML = `<div class="loading"><span></span><span></span><span></span></div>`; return; }
    box.innerHTML = (q ? '' : `<div class="add-hint">Sugestões</div>`) + (list.length ? list.map((t) => {
      const has = p.trackIds.includes(t.id);
      return `<div class="row add-row">${coverHTML(t, 'md')}<div class="meta"><div class="a">${esc(t.artist)}</div><div class="t">${esc(t.title)}</div></div>
        <button class="add-btn${has ? ' on' : ''}" data-opt="toggle" data-id="${t.id}" aria-label="${has ? 'Remover' : 'Adicionar'}">${has ? ICON.check : ICON.plus}</button></div>`;
    }).join('') : `<div class="empty"><p>${q ? 'Nada encontrado.' : 'Pesquise uma música acima.'}</p></div>`);
  };
  draw();
  const inp = $('#add-q');
  inp.oninput = () => {
    clearTimeout(timer); q = inp.value.trim(); results = null; draw();
    if (!q) return;
    const mine = q;
    timer = setTimeout(async () => { try { const r = remember(await Catalog.search(mine, 30)); if (mine === q) { results = r; draw(); } } catch { if (mine === q) { results = []; draw(); } } }, 350);
  };
  $('#sheet-card').onclick = async (e) => {
    const b = e.target.closest('[data-opt]'); if (!b) return;
    if (b.dataset.opt === 'done') { hideSheet(); return render(); }
    if (b.dataset.opt === 'toggle') {
      const t = byId(b.dataset.id); if (!t) return;
      if (p.trackIds.includes(t.id)) { p.trackIds = p.trackIds.filter((x) => x !== t.id); await DB.put('playlists', p); }
      else await putInPlaylist(p, t);
      const has = p.trackIds.includes(t.id);
      b.classList.toggle('on', has); b.innerHTML = has ? ICON.check : ICON.plus;
      if (state.route === 'pl:' + p.id) render();
    }
  };
}

function playlistMenu(id) {
  const p = state.playlists.find((x) => x.id === id); if (!p) return;
  showSheet(`<div class="sheet-title">${esc(p.name)}</div>
    <button class="opt" data-opt="add">${ICON.plus} Adicionar músicas</button>
    <button class="opt" data-opt="rename">${ICON.edit} Renomear</button>
    <button class="opt danger" data-opt="del">${ICON.trash} Apagar playlist</button>`);
  $('#sheet-card').onclick = async (e) => {
    const o = e.target.closest('[data-opt]')?.dataset.opt; if (!o) return;
    hideSheet(true);
    if (o === 'add') return addSongsSheet(p.id);
    if (o === 'rename') {
      const n = await askText({ title: 'Renomear playlist', value: p.name, ok: 'Salvar' });
      if (n) { p.name = n; await DB.put('playlists', p); render(); }
    } else if (o === 'del') {
      if (!(await askConfirm({ title: `Apagar “${p.name}”?`, text: 'As músicas continuam no app, só a playlist some.', ok: 'Apagar', danger: true }))) return;
      await DB.del('playlists', p.id); state.playlists = state.playlists.filter((x) => x !== p);
      state.route = null; render(); toast('Playlist apagada');
    }
  };
}

// ---------- menu / preferências ----------
async function changeSetting(spec) {
  const [k, v] = spec.split(':');
  if (k === 'accent') state.settings.accent = v;
  if (k === 'radio') state.settings.radio = !state.settings.radio;
  saveSettings(); setAccent(currentTrack()); render();
}
async function editName() {
  const n = await askText({ title: 'Como você quer ser chamado?', value: state.settings.name || '', placeholder: 'Seu nome', ok: 'Salvar' });
  if (n == null) return;
  state.settings.name = n; saveSettings(); render();
}
async function clearHistory() {
  if (!(await askConfirm({ title: 'Limpar histórico?', text: 'As recomendações recomeçam do zero. Curtidas e playlists continuam.', ok: 'Limpar', danger: true }))) return;
  state.history = []; state.recents = [];
  DB.put('kv', [], 'history'); DB.put('kv', [], 'recents');
  for (const k of [...state.lists.keys()]) if (/^(for|like):/.test(k)) state.lists.delete(k);
  render(); toast('Histórico limpo');
}


window.addEventListener('resize', () => syncTime());
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
load();
