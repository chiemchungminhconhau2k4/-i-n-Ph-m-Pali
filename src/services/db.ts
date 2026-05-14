export const DB_NAME = 'dienPhamPaliDB';
export const DB_VERSION = 6; // Upgraded version for new stores

export interface IDBTranslation {
  id: string; // e.g., `${script}_${nodeHref}_${mode}` or `${script}_${nodeHref}_para_${idx}`
  text: string;
  timestamp: number;
}

export interface IDBHistory {
  id: string;
  type: 'read' | 'search' | 'chat' | 'lookup';
  title: string;
  detail: string;
  timestamp: number;
  data?: any;
}

export interface IDBNote {
  id: string; // e.g., `${script}_${nodeHref}_para_${idx}`
  text: string;
  timestamp: number;
}

export interface IDBHighlight {
  id: string; // e.g., `${script}_${nodeHref}_para_${idx}`
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

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        const transaction = event.target.transaction as IDBTransaction;
        
        const stores = ['translations', 'history', 'notes', 'bookmarks', 'highlights', 'cache'];
        for (const store of stores) {
            if (!db.objectStoreNames.contains(store)) {
                db.createObjectStore(store, { keyPath: 'id' });
            } else {
                const existingStore = transaction.objectStore(store);
                // If it lacks key path or the key path is incorrect, drop and recreate
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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const cleanupOldHistory = async () => {
    const db = await openDB();
    const transaction = db.transaction('history', 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.getAll();

    return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
            const now = Date.now();
            const items = request.result as IDBHistory[];
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

export const saveTranslation = async (id: string, text: string) => {
    if (!id) return;
    const db = await openDB();
    const transaction = db.transaction('translations', 'readwrite');
    const store = transaction.objectStore('translations');
    const obj = { id: String(id), text, timestamp: Date.now() };
    try {
        store.put(obj);
    } catch (e) {
        console.error("error putting in translations", obj, e);
    }
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

export const saveHistory = async (type: 'read' | 'search' | 'chat' | 'lookup', title: string, detail: string, data?: any) => {
    const db = await openDB();
    const transaction = db.transaction('history', 'readwrite');
    const store = transaction.objectStore('history');
    const id = `${type}_${Date.now()}`;
    const obj = { id: String(id), type, title, detail, data, timestamp: Date.now() };
    try {
        store.put(obj);
    } catch (e) {
        console.error("Failed to put in history store", obj, e);
    }
    
    // Auto cleanup
    cleanupOldHistory();
};

export const getHistory = async (type?: 'read' | 'search' | 'chat' | 'lookup'): Promise<IDBHistory[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('history', 'readonly');
        const store = transaction.objectStore('history');
        const request = store.getAll();
        request.onsuccess = () => {
            let items = request.result as IDBHistory[];
            if (type) items = items.filter(i => i.type === type);
            // Sort by newest first
            items.sort((a, b) => b.timestamp - a.timestamp);
            resolve(items);
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveNote = async (id: string, text: string) => {
    if (!id) return;
    const db = await openDB();
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const obj = { id: String(id), text, timestamp: Date.now() };
    try {
        store.put(obj);
    } catch (e) {
        console.error("error putting in notes", obj, e);
    }
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
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    store.delete(id);
};

export const toggleBookmark = async (id: string, title: string, node: any): Promise<boolean> => {
    if (!id) return false;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('bookmarks', 'readwrite');
        const store = transaction.objectStore('bookmarks');
        const getRequest = store.get(String(id));
        getRequest.onsuccess = () => {
            if (getRequest.result) {
                store.delete(String(id));
                resolve(false); // Removed
            } else {
                const obj = { id: String(id), title, node, timestamp: Date.now() };
                try {
                    store.put(obj);
                } catch (e) {
                    console.error("error putting in bookmarks", obj, e);
                }
                resolve(true); // Added
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
        request.onsuccess = () => {
            const items = request.result as IDBBookmark[];
            items.sort((a, b) => b.timestamp - a.timestamp);
            resolve(items);
        };
        request.onerror = () => reject(request.error);
    });
};

export const isBookmarked = async (id: string): Promise<boolean> => {
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
    if (!id) return;
    const db = await openDB();
    const transaction = db.transaction('highlights', 'readwrite');
    const store = transaction.objectStore('highlights');
    const obj = { id: String(id), timestamp: Date.now() };
    try {
        store.put(obj);
    } catch (e) {
        console.error("error putting in highlights", obj, e);
    }
};

export const deleteHighlight = async (id: string) => {
    const db = await openDB();
    const transaction = db.transaction('highlights', 'readwrite');
    const store = transaction.objectStore('highlights');
    store.delete(id);
};

export const getHighlightsByDoc = async (docPrefix: string): Promise<IDBHighlight[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('highlights', 'readonly');
        const store = transaction.objectStore('highlights');
        const request = store.getAll();
        request.onsuccess = () => {
            const items = request.result as IDBHighlight[];
            resolve(items.filter(i => i.id.startsWith(docPrefix)));
        };
        request.onerror = () => reject(request.error);
    });
};

export const saveToCache = async (id: string, data: any) => {
    if (!id) return;
    const db = await openDB();
    const transaction = db.transaction('cache', 'readwrite');
    const store = transaction.objectStore('cache');
    const obj = { id: String(id), data, timestamp: Date.now() };
    try {
        store.put(obj);
    } catch (e) {
        console.error("error putting in cache", obj, e);
    }
};

export const getFromCache = async (id: string): Promise<any | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('cache', 'readonly');
        const store = transaction.objectStore('cache');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = () => reject(request.error);
    });
};
