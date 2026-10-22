// FILE: modules/db.js
const DB_NAME = 'ImpactoWebDB';
const DB_VERSION = 1;

export const db = {
  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('leads')) {
          const store = database.createObjectStore('leads', { keyPath: 'place_id' });
          store.createIndex('score', 'score');
          store.createIndex('status', 'status');
        }
        if (!database.objectStoreNames.contains('history')) {
          database.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveLead(lead) {
    const database = await this.init();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');
      
      // Verifica duplicata para não sobrescrever dados manuais (status, obs)
      const getReq = store.get(lead.place_id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          // Atualiza apenas dados do Maps, preserva status e observações
          const updated = { ...existing, ...lead, status: existing.status, obs: existing.obs };
          store.put(updated);
        } else {
          store.put(lead);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAllLeads() {
    const database = await this.init();
    return new Promise((resolve) => {
      const tx = database.transaction('leads', 'readonly');
      const req = tx.objectStore('leads').getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  },

  async updateLead(place_id, data) {
    const database = await this.init();
    return new Promise((resolve) => {
      const tx = database.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');
      const getReq = store.get(place_id);
      getReq.onsuccess = () => {
        const lead = getReq.result;
        if (lead) {
          store.put({ ...lead, ...data });
        }
      };
      tx.oncomplete = () => resolve();
    });
  },

  async saveHistory(historyEntry) {
    const database = await this.init();
    return new Promise((resolve) => {
      const tx = database.transaction('history', 'readwrite');
      tx.objectStore('history').add(historyEntry);
      tx.oncomplete = () => resolve();
    });
  },

  async getHistory() {
    const database = await this.init();
    return new Promise((resolve) => {
      const tx = database.transaction('history', 'readonly');
      const req = tx.objectStore('history').getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  }
};