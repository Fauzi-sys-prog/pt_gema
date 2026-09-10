import { useState, useCallback } from 'react';

const PREFIX = 'gtp_erp_v1_';

export function useStoredState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(PREFIX + key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {}
    return initialValue;
  });

  const setStoredState = useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (value) => {
      setState((prev) => {
        const next =
          typeof value === 'function'
            ? (value as (p: T) => T)(prev)
            : value;
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(next));
        } catch (e) {
          // localStorage penuh atau disabled — tetap update state
          console.warn('localStorage write failed for', key, e);
        }
        return next;
      });
    },
    [key]
  );

  return [state, setStoredState];
}

/** Hapus semua data ERP dari localStorage (untuk reset/logout) */
export function clearAllStoredState(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}
