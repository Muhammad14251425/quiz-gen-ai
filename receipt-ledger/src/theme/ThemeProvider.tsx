import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '../store/settings';
import { darkPalette, lightPalette, radius, spacing, typography, type Palette } from './tokens';

export interface Theme {
  dark: boolean;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pref = useSettings((s) => s.theme);
  const system = useColorScheme();
  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const theme = useMemo<Theme>(
    () => ({ dark, colors: dark ? darkPalette : lightPalette, spacing, radius, typography }),
    [dark],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
