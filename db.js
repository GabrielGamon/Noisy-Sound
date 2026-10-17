// Armazenamento local (IndexedDB): faixas, arquivos de áudio e playlists ficam no aparelho.
const DB = (() => {
  let dbp;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('noisy-sound', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('tracks', { keyPath: 'id' });
        db.createObjectStore('blobs');
        db.createObjectStore('playlists', { keyPath: 'id' });
        db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  return {
    all: (store) => tx(store, 'readonly', (s) => s.getAll()),
    get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
    put: (store, value, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))),
    del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
  };
})();
