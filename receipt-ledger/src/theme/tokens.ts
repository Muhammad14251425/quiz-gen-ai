export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  sent: string;
  sentMuted: string;
  received: string;
  receivedMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  overlay: string;
}

// Contrast: text on background/surface ≥ 7:1; muted text ≥ 4.5:1 in both themes.
export const lightPalette: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F4',
  border: '#DCE1E6',
  text: '#11181C',
  textMuted: '#57606A',
  textInverse: '#FFFFFF',
  primary: '#0E7C66',
  primaryMuted: '#D7F0EA',
  onPrimary: '#FFFFFF',
  sent: '#C2410C',
  sentMuted: '#FDE8DC',
  received: '#15803D',
  receivedMuted: '#DCF5E3',
  warning: '#B45309',
  warningMuted: '#FEF3C7',
  danger: '#B91C1C',
  overlay: 'rgba(0,0,0,0.45)',
};

export const darkPalette: Palette = {
  background: '#0D1117',
  surface: '#161B22',
  surfaceAlt: '#21262D',
  border: '#30363D',
  text: '#F0F3F6',
  textMuted: '#9DA7B3',
  textInverse: '#0D1117',
  primary: '#3DD6B0',
  primaryMuted: '#123B33',
  onPrimary: '#04201A',
  sent: '#FB923C',
  sentMuted: '#3A2214',
  received: '#4ADE80',
  receivedMuted: '#123321',
  warning: '#FBBF24',
  warningMuted: '#3A2E0F',
  danger: '#F87171',
  overlay: 'rgba(0,0,0,0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

/** Minimum touch target (dp). */
export const HIT = 48;

export const BANK_COLOR_CHOICES = [
  '#0E7C66',
  '#C8102E',
  '#1EB25A',
  '#00856F',
  '#6E1E5A',
  '#0057A8',
  '#1C3F94',
  '#E2231A',
  '#F15A24',
  '#00A0AF',
  '#8B5CF6',
  '#6B7280',
];
