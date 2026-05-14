export const DB_NAME = 'dienPhamPaliDB';
export const DB_VERSION = 8; // Upgraded version for new stores

export interface IDBTranslation {
  id: string; // e.g., `${script}_${nodeHref}_${mode}` or `${script}_${nodeHref}_para_${idx}`
  text: string;
  timestamp: number;
}

export interface IDBHistory {
  id: string; 
  type: 'chat' | 'translate' | 'lookup' | 'read';
  title?: string;
  detail?: string;
  data?: any;
  timestamp: number;
}

export interface IDBNote {
  id: string; // e.g., `${script}_${nodeHref}_para_${idx}`
  text: string;
  timestamp: number;
}

export interface IDBCache {
  id: string; // e.g., URL or unique key
  data: any;
  timestamp: number;
}

export interface IDBBookmark {
  id: string; // e.g., `${script}_${nodeHref}`
  title: string;
  timestamp: number;
  node: any;
}

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
        return resolve(dbInstance);
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onblocked = () => {
          console.warn("IndexedDB update blocked. Closing old connections.");
          if (dbInstance) {
              dbInstance.close();
              dbInstance = null;
          }
      };

      request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
              db.close();
              dbInstance = null;
          };
          dbInstance = db;
          resolve(db);
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        const transaction = event.target.transaction as IDBTransaction;
        
        const stores = ['translations', 'history', 'notes', 'bookmarks', 'highlights', 'cache'];
        for (const store of stores) {
            if (!db.objectStoreNames.contains(store)) {
                db.createObjectStore(store, { keyPath: 'id' });
            } else {
                const existingStore = transaction.objectStore(store);
                if (existingStore.keyPath !== 'id') {
                    db.deleteObjectStore(store);
                    db.createObjectStore(store, { keyPath: 'id' });
                }
            }
        }
      };
    } catch (e) {
      reject(e);
    }
  });
};

const putAction = async (storeName: string, obj: any) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        try {
            const req = store.put(obj);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    }).catch(e => {
        console.error(`Error putting in ${storeName}`, obj, e);
    });
};

export const saveTranslation = async (id: string, text: string) => {
    await putAction('translations', { id: String(id), text, timestamp: Date.now() });
};

export const getTranslation = async (id: string): Promise<string | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('translations', 'readonly');
        const store = transaction.objectStore('translations');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.text : null);
        request.onerror = () => reject(request.error);
    });
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const cleanupOldHistory = async () => {
    const db = await openDB();
    const transaction = db.transaction('history', 'readwrite');
    const store = transaction.objectStore('history');
    
    return new Promise<void>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const items = request.result as IDBHistory[];
            const now = Date.now();
            items.forEach(item => {
                if (now - item.timestamp > THIRTY_DAYS_MS) {
                    store.delete(item.id);
                }
            });
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveHistory = async (type: IDBHistory['type'], title?: string, detail?: string, data?: any) => {
    const id = `${type}_${Date.now()}`;
    await putAction('history', { id: String(id), type, title, detail, data, timestamp: Date.now() });
    cleanupOldHistory();
};

export const getHistory = async (): Promise<IDBHistory[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('history', 'readonly');
        const store = transaction.objectStore('history');
        const request = store.getAll();
        request.onsuccess = () => {
            const items = request.result as IDBHistory[];
            resolve(items.sort((a, b) => b.timestamp - a.timestamp));
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveNote = async (id: string, text: string) => {
    await putAction('notes', { id: String(id), text, timestamp: Date.now() });
};

export const getNotesByDoc = async (docPrefix: string): Promise<IDBNote[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('notes', 'readonly');
        const store = transaction.objectStore('notes');
        const request = store.getAll();
        request.onsuccess = () => {
            const items = request.result as IDBNote[];
            resolve(items.filter(i => i.id.startsWith(docPrefix)));
        };
        request.onerror = () => reject(request.error);
    });
};

export const getNote = async (id: string): Promise<string | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('notes', 'readonly');
        const store = transaction.objectStore('notes');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.text : null);
        request.onerror = () => reject(request.error);
    });
};

export const deleteNote = async (id: string) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('notes', 'readwrite');
        const store = transaction.objectStore('notes');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const toggleBookmark = async (id: string, title: string, node: any): Promise<boolean> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('bookmarks', 'readwrite');
        const store = transaction.objectStore('bookmarks');
        const getRequest = store.get(String(id));
        
        getRequest.onsuccess = async () => {
            if (getRequest.result) {
                const delReq = store.delete(String(id));
                delReq.onsuccess = () => resolve(false); // Removed
                delReq.onerror = () => reject(delReq.error);
            } else {
                try {
                   const putReq = store.put({ id: String(id), title, node, timestamp: Date.now() });
                   putReq.onsuccess = () => resolve(true); // Added
                   putReq.onerror = () => reject(putReq.error);
                } catch(e) {
                   reject(e);
                }
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

export const getBookmarks = async (): Promise<IDBBookmark[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('bookmarks', 'readonly');
        const store = transaction.objectStore('bookmarks');
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as IDBBookmark[]).sort((a, b) => b.timestamp - a.timestamp));
        request.onerror = () => reject(request.error);
    });
};

export const checkBookmark = async (id: string): Promise<boolean> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('bookmarks', 'readonly');
        const store = transaction.objectStore('bookmarks');
        const request = store.get(id);
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => reject(request.error);
    });
};

export const saveHighlight = async (id: string) => {
    await putAction('highlights', { id: String(id), timestamp: Date.now() });
};

export const deleteHighlight = async (id: string) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('highlights', 'readwrite');
        const store = transaction.objectStore('highlights');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};

export const getHighlightsByDoc = async (docPrefix: string): Promise<string[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('highlights', 'readonly');
        const store = transaction.objectStore('highlights');
        const request = store.getAll();
        request.onsuccess = () => {
            const items = request.result as any[];
            resolve(items.filter(i => i.id.startsWith(docPrefix)).map(i => i.id));
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveToCache = async (id: string, data: any) => {
    if (!id) return;
    await putAction('cache', { id: String(id), data, timestamp: Date.now() });
};

export const getFromCache = async (id: string): Promise<any | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('cache', 'readonly');
        const store = transaction.objectStore('cache');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = () => {
            console.warn("Missing index or store?", request.error);
            resolve(null);
        };
    }).catch(e => {
        console.warn("Catch cache get:", e);
        return null;
    });
};
