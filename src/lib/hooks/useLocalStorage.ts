import { useState, useEffect } from 'react';

const MAX_STORAGE_SIZE = 1024 * 1024; // 1MB limit

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      
      // Validate JSON before parsing
      const parsed = JSON.parse(item);
      
      // Basic type validation
      if (typeof parsed === typeof initialValue || initialValue === null) {
        return parsed;
      }
      
      // Type mismatch, return initial value and clear storage
      window.localStorage.removeItem(key);
      return initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      // Clear corrupted data
      try {
        window.localStorage.removeItem(key);
      } catch (removeError) {
        console.error('Failed to remove corrupted localStorage item:', removeError);
      }
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      if (typeof window !== 'undefined') {
        const serialized = JSON.stringify(valueToStore);
        
        // Check storage size limit
        if (serialized.length > MAX_STORAGE_SIZE) {
          console.warn(`localStorage value for "${key}" exceeds size limit`);
          return;
        }
        
        // Check if there's enough space
        try {
          window.localStorage.setItem(key, serialized);
          setStoredValue(valueToStore);
        } catch (quotaError) {
          // Handle quota exceeded error
          console.warn('localStorage quota exceeded, clearing old data');
          
          // Try to clear some space by removing non-essential items
          const keysToRemove = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const storageKey = window.localStorage.key(i);
            if (storageKey && storageKey.startsWith('temp-') || storageKey?.includes('cache')) {
              keysToRemove.push(storageKey);
            }
          }
          
          keysToRemove.forEach(keyToRemove => {
            window.localStorage.removeItem(keyToRemove);
          });
          
          // Try again
          try {
            window.localStorage.setItem(key, serialized);
            setStoredValue(valueToStore);
          } catch (secondAttemptError) {
            console.error(`Failed to save to localStorage even after cleanup:`, secondAttemptError);
          }
        }
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}