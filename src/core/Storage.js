/** localStorage wrapper that never throws (private mode, quota, disabled storage). */
const PREFIX = 'steelwarden:';

export const Storage = {
  load(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  save(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* storage unavailable — nothing to remove */
    }
  },
};
