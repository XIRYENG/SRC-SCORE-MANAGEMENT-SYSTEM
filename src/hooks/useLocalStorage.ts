import { useState, useEffect } from 'react';

/**
 * A custom React hook to manage state synchronized with localStorage.
 * This will automatically restore saved inputs even after the browser tab is closed.
 * 
 * @param key The localStorage key name
 * @param initialValue The default fallback starting value
 */
export function useLocalStorage(key: string, initialValue: string) {
  const [state, setState] = useState<string>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? item : initialValue;
    } catch (error) {
      console.warn(`localStorage error reading key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, state);
    } catch (error) {
      console.warn(`localStorage error writing key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState] as const;
}
