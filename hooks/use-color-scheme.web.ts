import { useEffect, useState } from 'react';
import { useColorScheme as _useColorScheme } from 'react-native';

export function useColorScheme() {
  const colorScheme = _useColorScheme();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) {
    return 'light';
  }

  return colorScheme ?? 'light';
}
