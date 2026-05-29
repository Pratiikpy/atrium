import { useCallback, useSyncExternalStore } from 'react';

/**
 * PERF-07: localStorage hook using useSyncExternalStore.
 * SSR-safe: getServerSnapshot returns the default value.
 * Cross-tab sync via 'storage' event.
 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.storageArea === localStorage) cb(); };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

function notify() {
  listeners.forEach((cb) => cb());
}

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const getSnapshot = useCallback(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (v: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // quota exceeded or private mode — fail silently
      }
      notify();
    },
    [key],
  );

  return [value, setValue];
}
