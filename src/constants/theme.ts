import '@/global.css';
import { Platform } from 'react-native';

export const Brand = {
  primary: '#007AFF',
  primarySoft: '#E8F2FF',
  primarySoftDark: '#1C2B3F',
  onPrimary: '#FFFFFF',
} as const;

export const Accent = {
  success: '#34C759',
  successSoft: '#E8F8ED',
  warning: '#FF9500',
  warningSoft: '#FFF4E6',
  danger: '#FF3B30',
  dangerSoft: '#FFECEB',
} as const;

export const Colors = {
  light: {
    primary: Brand.primary,
    primarySoft: Brand.primarySoft,
    onPrimary: Brand.onPrimary,
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceMuted: '#F2F2F7',
    border: '#C6C6C8',
    borderLight: '#E5E5EA',
    text: '#000000',
    textSecondary: '#3C3C43',
    textMuted: '#8E8E93',
    onPrimaryText: '#FFFFFF',
    success: Accent.success,
    successSoft: Accent.successSoft,
    warning: Accent.warning,
    warningSoft: Accent.warningSoft,
    danger: Accent.danger,
    dangerSoft: Accent.dangerSoft,
    backgroundElement: '#FFFFFF',
    backgroundSelected: Brand.primarySoft,
  },
  dark: {
    primary: '#0A84FF',
    primarySoft: Brand.primarySoftDark,
    onPrimary: '#FFFFFF',
    background: '#000000',
    surface: '#1C1C1E',
    surfaceMuted: '#1C1C1E',
    border: '#38383A',
    borderLight: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textMuted: '#636366',
    onPrimaryText: '#FFFFFF',
    success: '#30D158',
    successSoft: '#0D2818',
    warning: '#FF9F0A',
    warningSoft: '#2B2110',
    danger: '#FF453A',
    dangerSoft: '#2A1215',
    backgroundElement: '#1C1C1E',
    backgroundSelected: Brand.primarySoftDark,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

export const Spacing = { half: 2, one: 4, two: 8, three: 12, four: 16, five: 20, six: 32, seven: 48, eight: 64 } as const;
export const Radius = { sm: 8, md: 10, lg: 13, xl: 20, pill: 999 } as const;
export const MaxContentWidth = 640;
