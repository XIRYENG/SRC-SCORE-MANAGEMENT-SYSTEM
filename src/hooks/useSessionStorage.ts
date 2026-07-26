import { useState, useEffect } from 'react';

/**
 * A custom React hook to manage state synchronized with sessionStorage.
 * This will automatically restore saved inputs when the page is reloaded.
 * 
 * @param key The sessionStorage key name
 * @param initialValue The default fallback starting value
 */
export function useSessionStorage(key: string, initialValue: string) {
  const [state, setState] = useState<string>(() => {
    try {
      const item = sessionStorage.getItem(key);
      return item !== null ? item : initialValue;
    } catch (error) {
      console.warn(`sessionStorage error reading key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, state);
    } catch (error) {
      console.warn(`sessionStorage error writing key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState] as const;
}
