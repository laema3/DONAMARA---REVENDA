// Safe wrapper for localStorage and sessionStorage to avoid DOMException / SecurityError
// in sandboxed iframes and privacy-restricted browsing environments.

class MemoryStorage implements Storage {
  private data: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.data).length;
  }

  clear(): void {
    this.data = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.data);
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.data[key];
  }

  setItem(key: string, value: string): void {
    this.data[key] = String(value);
  }
}

const memoryLocalStorage = new MemoryStorage();
const memorySessionStorage = new MemoryStorage();

function getStorage(type: 'localStorage' | 'sessionStorage'): Storage {
  try {
    const storage = window[type];
    const testKey = `__test_${type}__`;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch {
    return type === 'localStorage' ? memoryLocalStorage : memorySessionStorage;
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return getStorage('localStorage').getItem(key);
    } catch {
      return memoryLocalStorage.getItem(key);
    }
  },
  setItem(key: string, value: string): void {
    try {
      getStorage('localStorage').setItem(key, value);
    } catch {
      // If QuotaExceededError occurs, clean up bloated logs/debug keys to free space
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('donamara_sync_logs');
          window.localStorage.removeItem('bluefocus_raw_xml');
          window.localStorage.removeItem('bluefocus_last_debug_xml');
          window.localStorage.removeItem('donamara_active_cart');
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {}
      memoryLocalStorage.setItem(key, value);
    }
  },
  removeItem(key: string): void {
    try {
      getStorage('localStorage').removeItem(key);
    } catch {
      memoryLocalStorage.removeItem(key);
    }
  },
  getSession(key: string): string | null {
    try {
      return getStorage('sessionStorage').getItem(key);
    } catch {
      return memorySessionStorage.getItem(key);
    }
  },
  setSession(key: string, value: string): void {
    try {
      getStorage('sessionStorage').setItem(key, value);
    } catch {
      memorySessionStorage.setItem(key, value);
    }
  },
  removeSession(key: string): void {
    try {
      getStorage('sessionStorage').removeItem(key);
    } catch {
      memorySessionStorage.removeItem(key);
    }
  }
};
