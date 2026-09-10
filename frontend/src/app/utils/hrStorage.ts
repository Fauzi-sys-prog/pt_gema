const DB_NAME = 'gtp-hr-v1';
const DB_VERSION = 1;
const STORES = ['employeeAdvances','employeeCompensations','payrollRuns','payrollPolicy'] as const;
type StoreName = typeof STORES[number];

class HRStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = (e.target as IDBOpenDBRequest).result;
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = e => {
        this.db = (e.target as IDBOpenDBRequest).result;
        this.db.onversionchange = () => { this.db?.close(); this.db = null; };
        this.initPromise = null;
        resolve();
      };
      req.onerror = () => { this.initPromise = null; reject(req.error); };
      req.onblocked = () => { this.initPromise = null; reject(new Error('IndexedDB open blocked')); };
    });
    return this.initPromise;
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      tx.onerror = () => reject(tx.error);
    });
  }

  async put<T extends { id: string }>(store: StoreName, item: T): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(store: StoreName, id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(store: StoreName): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const hrStorage = new HRStorage();
