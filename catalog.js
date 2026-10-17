// Catálogo de músicas: Audius, uma plataforma aberta onde os próprios artistas publicam
// as músicas (parecido com o SoundCloud). A API é gratuita e o streaming é liberado.
const Catalog = (() => {
  const APP = 'NoisySound';
  const BLOCKED = new Set(['Podcasts', 'Audiobooks', 'Spoken Word', 'Comedy', 'Kids', 'Devotional']);
  let basePromise;

  async function ok(url) {
    try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? r : null; } catch { return null; }
  }
  function base() {
    basePromise ||= (async () => {
      if (await ok(`https://api.audius.co/v1/tracks/trending?limit=1&app_name=${APP}`)) return 'https://api.audius.co';
      const r = await ok('https://api.audius.co');
      const hosts = r ? (await r.json()).data || [] : [];
      for (const h of hosts.sort(() => Math.random() - 0.5).slice(0, 3)) if (await ok(`${h}/v1/tracks/trending?limit=1&app_name=${APP}`)) return h;
      basePromise = null;
      throw new Error('Catálogo indisponível');
    })();
    return basePromise;
  }

  async function get(path, params = {}) {
    const b = await base();
    const q = new URLSearchParams({ ...params, app_name: APP });
    const r = await fetch(`${b}/v1${path}?${q}`);
    if (!r.ok) throw new Error('Erro ' + r.status);
    return (await r.json()).data || [];
  }

  function toTrack(t) {
    const art = t.artwork || {};
    return {
      id: 'au:' + t.id, rid: t.id, source: 'audius',
      title: t.title, artist: t.user?.name || t.user?.handle || 'Artista',
      artistId: t.user?.id, album: '', genre: t.genre || '', mood: t.mood || '', duration: t.duration || 0,
      artUrl: art['480x480'] || art['1000x1000'] || art['150x150'] || null,
      plays: t.play_count || 0,
    };
  }
  const clean = (list) => list.filter((t) => t && t.is_streamable !== false && !BLOCKED.has(t.genre)).map(toTrack);

  return {
    trending: async (genre, limit = 40) => clean(await get('/tracks/trending', { limit, time: 'week', ...(genre ? { genre } : {}) })),
    search: async (query, limit = 40) => clean(await get('/tracks/search', { query, limit })),
    artistTracks: async (userId, limit = 40) => clean(await get(`/users/${userId}/tracks`, { limit, sort: 'plays' })),
    relatedArtists: async (userId, limit = 8) => { try { return await get(`/users/${userId}/related`, { limit }); } catch { return []; } },
    streamUrl: async (t) => `${await base()}/v1/tracks/${t.rid}/stream?app_name=${APP}`,
  };
})();

// Gêneros da aba Pesquisar. "genre" usa a lista oficial de gêneros; "q" faz uma busca por nome.
const GENRES = [
  { name: 'MPB', q: 'mpb', hue: 32 },
  { name: 'Reggae', genre: 'Reggae', hue: 130 },
  { name: 'R&B', genre: 'R&B/Soul', hue: 290 },
  { name: 'Hip-Hop', genre: 'Hip-Hop/Rap', hue: 12 },
  { name: 'Trap', genre: 'Trap', hue: 350 },
  { name: 'Funk', q: 'funk', hue: 320 },
  { name: 'Pop', genre: 'Pop', hue: 200 },
  { name: 'Sertanejo', q: 'sertanejo', hue: 45 },
  { name: 'Pagode', q: 'pagode', hue: 60 },
  { name: 'Eletrônica', genre: 'Electronic', hue: 260 },
  { name: 'House', genre: 'House', hue: 175 },
  { name: 'Rock', genre: 'Rock', hue: 0 },
  { name: 'Lo-Fi', genre: 'Lo-Fi', hue: 230 },
  { name: 'Jazz', genre: 'Jazz', hue: 25 },
  { name: 'Latina', genre: 'Latin', hue: 15 },
  { name: 'Dancehall', genre: 'Dancehall', hue: 100 },
  { name: 'Acústico', genre: 'Acoustic', hue: 80 },
  { name: 'Ambiente', genre: 'Ambient', hue: 190 },
];
