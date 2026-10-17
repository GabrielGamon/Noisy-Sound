// Recomendações: cada aparelho aprende com o que a própria pessoa ouve e curte.
const Recs = (() => {
  const heardIds = () => new Set(state.history.map((h) => h.id));

  // Gêneros e artistas preferidos: cada vez que ouviu conta 1, curtida conta 3; o recente pesa mais.
  function profile() {
    const genres = new Map(), artists = new Map();
    const add = (m, k, w) => k && m.set(k, (m.get(k) || 0) + w);
    state.history.forEach((h, i) => { const w = 1 + i / state.history.length; add(genres, h.genre, w); add(artists, h.artistId, w); });
    for (const t of state.tracks) if (t.liked) { add(genres, t.genre, 3); add(artists, t.artistId, 3); }
    const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
    return { genres: top(genres, 3), artists: top(artists, 3) };
  }

  // Intercala várias listas (uma de cada vez), sem repetir faixa nem passar de 2 por artista.
  function blend(lists, { skip = new Set(), limit = 40, perArtist = 2, avoidArtist } = {}) {
    const out = [], seen = new Set(), byArtist = new Map();
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < max && out.length < limit; i++) {
      for (const l of lists) {
        const t = l[i]; if (!t || seen.has(t.id) || skip.has(t.id) || t.artistId === avoidArtist) continue;
        const n = byArtist.get(t.artistId) || 0; if (n >= perArtist) continue;
        seen.add(t.id); byArtist.set(t.artistId, n + 1); out.push(t);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  async function fromRelated(artistId, perArtist = 4) {
    const rel = (await Catalog.relatedArtists(artistId, 8)).slice(0, 6);
    return Promise.all(rel.map((u) => Catalog.artistTracks(u.id, perArtist).catch(() => [])));
  }

  // "Porque você ouviu X": artistas parecidos + o que está em alta no mesmo gênero.
  async function similar(artistId, genre, limit = 30) {
    const [rel, inGenre] = await Promise.all([fromRelated(artistId), genre ? Catalog.trending(genre, 40).catch(() => []) : []]);
    const list = blend([...rel, inGenre], { skip: heardIds(), limit, avoidArtist: artistId });
    // Se a pessoa já ouviu quase tudo, deixa repetir o que já ouviu para não ficar vazio.
    return list.length >= 8 ? list : blend([...rel, inGenre], { limit, avoidArtist: artistId });
  }

  // "Feito para você": mistura dos gêneros e artistas preferidos.
  async function mix(limit = 40) {
    const p = profile();
    if (!p.genres.length && !p.artists.length) return Catalog.trending(null, limit);
    const [byGenre, rel] = await Promise.all([
      Promise.all(p.genres.map((g) => Catalog.trending(g, 30).catch(() => []))),
      p.artists[0] ? fromRelated(p.artists[0], 3) : [],
    ]);
    const list = blend([...byGenre, ...rel], { skip: heardIds(), limit });
    return list.length >= 10 ? list : blend([...byGenre, ...rel], { limit });
  }

  // Artistas diferentes ouvidos por último, para as prateleiras "Porque você ouviu…".
  function recentArtists(n = 2) {
    const out = [], seen = new Set();
    for (let i = state.history.length - 1; i >= 0 && out.length < n; i--) {
      const h = state.history[i];
      if (h.artistId && !seen.has(h.artistId)) { seen.add(h.artistId); out.push(h); }
    }
    return out;
  }

  return { similar, mix, recentArtists };
})();
