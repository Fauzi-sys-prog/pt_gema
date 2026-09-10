import { useEffect, useRef } from 'react';

export function useEscapeKey(closers: Array<{ condition: boolean; close: () => void }>) {
  const ref = useRef(closers);
  ref.current = closers;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const list = ref.current;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].condition) { list[i].close(); return; }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
