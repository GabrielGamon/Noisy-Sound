// Leitura simples de tags ID3v2 (MP3): título, artista, álbum e capa.
const Tags = (() => {
  function syncsafe(b, o) { return (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3]; }
  function u32(b, o) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
  function decode(bytes, enc) {
    try {
      if (enc === 0) return new TextDecoder('latin1').decode(bytes);
      if (enc === 1) return new TextDecoder('utf-16').decode(bytes);
      if (enc === 2) return new TextDecoder('utf-16be').decode(bytes);
      return new TextDecoder('utf-8').decode(bytes);
    } catch { return ''; }
  }
  function clean(s) { return s.replace(/\u0000/g, '').trim(); }
  function textEnd(b, o, enc) {
    if (enc === 1 || enc === 2) { while (o + 1 < b.length && !(b[o] === 0 && b[o + 1] === 0)) o += 2; return o; }
    while (o < b.length && b[o] !== 0) o++;
    return o;
  }

  async function read(file) {
    const out = {};
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return out;
    const ver = head[3];
    const size = syncsafe(head, 6);
    const b = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
    let o = 0;
    if (head[5] & 0x40) o += ver === 4 ? syncsafe(b, 0) : u32(b, 0) + 4; // cabeçalho estendido
    const idLen = ver === 2 ? 3 : 4;
    const hdrLen = ver === 2 ? 6 : 10;
    while (o + hdrLen <= b.length) {
      const id = String.fromCharCode(...b.slice(o, o + idLen));
      if (!/^[A-Z0-9]+$/.test(id)) break;
      const len = ver === 2 ? (b[o + 3] << 16) | (b[o + 4] << 8) | b[o + 5] : ver === 4 ? syncsafe(b, o + 4) : u32(b, o + 4);
      const body = b.slice(o + hdrLen, o + hdrLen + len);
      o += hdrLen + len;
      if (!len) continue;
      const enc = body[0];
      if (id === 'TIT2' || id === 'TT2') out.title = clean(decode(body.slice(1), enc));
      else if (id === 'TPE1' || id === 'TP1') out.artist = clean(decode(body.slice(1), enc));
      else if (id === 'TALB' || id === 'TAL') out.album = clean(decode(body.slice(1), enc));
      else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
        let p = 1, mime;
        if (id === 'PIC') { mime = 'image/' + String.fromCharCode(...body.slice(1, 4)).toLowerCase().replace('jpg', 'jpeg'); p = 4; }
        else { const e = body.indexOf(0, 1); mime = decode(body.slice(1, e), 0) || 'image/jpeg'; p = e + 1; }
        p += 1; // tipo de imagem
        p = textEnd(body, p, enc) + (enc === 1 || enc === 2 ? 2 : 1); // descrição
        if (!mime.includes('/')) mime = 'image/' + mime;
        out.cover = new Blob([body.slice(p)], { type: mime });
      }
    }
    return out;
  }
  return { read };
})();
