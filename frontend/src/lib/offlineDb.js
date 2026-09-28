/**
 * Minimal IndexedDB helper for NTD offline queue + local entities.
 * DB: ntd-offline / v1
 * Stores: outbox, idMap, patients, encounters, suspects
 */

const DB_NAME = "ntd-offline";
const DB_VERSION = 1;

const STORES = ["outbox", "idMap", "patients", "encounters", "suspects"];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          if (name === "outbox") {
            store.createIndex("status", "status", { unique: false });
            store.createIndex("createdAt", "createdAt", { unique: false });
          }
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

export async function idbPut(storeName, record) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(record);
  await txDone(tx);
  db.close();
  return record;
}

export async function idbGet(storeName, id) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const req = tx.objectStore(storeName).get(id);
  const row = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row;
}

export async function idbGetAll(storeName) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const req = tx.objectStore(storeName).getAll();
  const rows = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function idbDelete(storeName, id) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(id);
  await txDone(tx);
  db.close();
}

export async function idbDeleteMany(storeName, ids) {
  if (!ids?.length) return;
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  ids.forEach((id) => store.delete(id));
  await txDone(tx);
  db.close();
}

export async function idbClear(storeName) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  await txDone(tx);
  db.close();
}
