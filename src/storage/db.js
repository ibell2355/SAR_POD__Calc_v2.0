const DB_NAME = 'sar-pod-v2';
const DB_VERSION = 1;
const STORE = 'profiles';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProfiles() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return JSON.parse(localStorage.getItem('sar_fallback_profiles') || '[]');
  }
}

export async function saveProfile(profile) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(profile);
      tx.oncomplete = () => resolve(profile);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const all = JSON.parse(localStorage.getItem('sar_fallback_profiles') || '[]');
    const idx = all.findIndex((p) => p.id === profile.id);
    if (idx >= 0) all[idx] = profile; else all.push(profile);
    localStorage.setItem('sar_fallback_profiles', JSON.stringify(all));
    return profile;
  }
}
