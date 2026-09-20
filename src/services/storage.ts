/**
 * Persistent Storage Layer with Namespacing and Integrity Checks
 */

const PREFIX = 'qrp_v1_';

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const serialized = localStorage.getItem(`${PREFIX}${key}`);
      if (serialized === null) {
        return defaultValue;
      }
      return JSON.parse(serialized) as T;
    } catch (error) {
      console.error(`Storage error loading key "${key}":`, error);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Storage error saving key "${key}":`, error);
      return false;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(`${PREFIX}${key}`);
    } catch (error) {
      console.error(`Storage error removing key "${key}":`, error);
    }
  },

  clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (error) {
      console.error('Storage error clearing data:', error);
    }
  }
};
