/** The design system as plain data. */

export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950

export type ColorScale = Readonly<Record<Shade, string>>

/** The brand scale, exactly as specified. */
export const lavenderPurple: ColorScale = {
  50: '#fafafa',
  100: '#e0deed',
  200: '#c1bcdc',
  300: '#a39bca',
  400: '#8479b9',
  500: '#6558a7',
  600: '#514686',
  700: '#3d3564',
  800: '#282343',
  900: '#141221',
  950: '#0a0a0a',
}

/** Greys pulled to the brand's hue (250°) at 14–28% saturation instead of a true grey. */
export const neutral: ColorScale = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#cacaca',
  400: '#9a9a9a',
  500: '#737373',
  600: '#525252',
  700: '#404040',
  800: '#262626',
  900: '#171717',
  950: '#0a0a0a',
}

/** One semantic colour, expressed as the four jobs a status colour actually. */
export interface SemanticColor {
  /** Filled badge/button. Always paired with `onSolid`. */
  readonly solid: string
  /** `onSolid` for this fill. */
  readonly onSolid: string
  /** Text and icons, per theme. */
  readonly text: Readonly<{ light: string }>
  /** Tinted banner/callout background, per theme. */
  readonly surface: Readonly<{ light: string }>
  /** Hairline for that banner, per theme. */
  readonly border: Readonly<{ light: string }>
}

/** Hues are spaced 26–28° apart across the warm end. */
export const semantic: Readonly<Record<'success' | 'warning' | 'danger', SemanticColor>> = {
  success: {
    solid: '#217d52',
    onSolid: '#ffffff',
    text: { light: '#1c6e48' },
    surface: { light: '#effaf5' },
    border: { light: '#b5e3ce' },
  },
  warning: {
    solid: '#a54a1d',
    onSolid: '#ffffff',
    text: { light: '#954218' },
    surface: { light: '#fdf2ed' },
    border: { light: '#edc8b6' },
  },
  danger: {
    solid: '#bf2237',
    onSolid: '#ffffff',
    text: { light: '#ab1c2f' },
    surface: { light: '#fdedef' },
    border: { light: '#efbec4' },
  },
}

/** Zaps. */
export const zap: SemanticColor & {
  readonly glow: string
  readonly icon: { readonly light: string }
} = {
  /** Gold, sized to read on white. */
  solid: '#e08a00',
  icon: { light: '#e08a00' },
  onSolid: '#ffffff',
  /** The count beside the bolt, and the one place the split earns itself. */
  text: { light: '#e08a00' },
  /* The chip a bolt11 invoice renders in, re-warmed from the orange to the gold. */
  surface: { light: '#fff8e8' },
  border: { light: '#f6dda6' },
  /** The lightning effects' hue. */
  glow: '#ffb020',
}

/** THE THREE CHART SERIES, for /stats. */
export const chart = {
  /** Accounts and people. The link blue's hue, stepped into the mark band. */
  people: { light: '#0f6fd4' },
  /** Sats. */
  sats: { light: '#ce7d00' },
  /** Notes and content. The brand purple. */
  notes: { light: '#6558a7' },
} as const

/** THE LOGO'S OWN COLOURS, named so nothing has to eyedropper the SVG. */
export const brand = {
  /** #F0DFC6. */
  cream: '#F0DFC6',
  /** A shade down, for a card or a pressed state ON cream, where white would glare. */
  creamDeep: '#DCBB86',
  /** #F97316. */
  ember: '#F97316',
  /** #1F1B18. */
  ink: '#1F1B18',
  /** #3A322A. */
  inkSoft: '#3A322A',
  /** #C89A52. */
  rim: '#C89A52',
} as const

export const palette = {
  lavenderPurple,
  neutral,
  brand,
  success: semantic.success,
  warning: semantic.warning,
  danger: semantic.danger,
  zap,
  chart,
  white: '#ffffff',
  black: '#000000',
} as const

// --------------------------------------------------------------------------- Surface.

export type ThemeName =
  | 'light'
  | 'black'
  | 'brown'
  | 'slate'
  | 'purple'
  | 'pink'
  | 'custom-dark'
  | 'custom-light'

/** The indirection every component should use. */
/** #1d9bf0. See `verified` below for why it is this exact blue and not a brand colour. */
const VERIFIED_BLUE = '#1d9bf0'

export interface ThemeRoles {
  /** Page canvas. */
  bg: string
  /** Cards, popovers, sheets. */
  bgElevated: string
  /** Recessed wells: inputs, code blocks, quoted notes. */
  bgInset: string
  /** The surface a row takes on hover. */
  hover: string
  /** Resting surface for small filled chips. */
  bgChip: string
  /** Hairline dividers. */
  border: string
  /** Borders that carry meaning. */
  borderStrong: string
  /** The hairline for a card that sits ON `bgInset` rather than on the page. */
  borderInset: string
  /** Body text. */
  text: string
  /** Secondary text: metadata, timestamps, counts. */
  textMuted: string
  /** Least important text still meant to be read. */
  textFaint: string
  /** Primary-navigation glyphs, and only. */
  navIcon: string

  /** Interactive text inside a note: links, hashtags, mentions. */
  link: string

  /** Primary fill: buttons, active tabs, the selected state. */
  accent: string
  accentHover: string
  accentActive: string
  /** Tinted background for selected rows and accent callouts. */
  accentSubtle: string
  accentBorder: string
  /** Accent as *text*: links, mentions, hashtags. */
  accentText: string
  /** The only text colour verified against `accent`. */
  onAccent: string
  /** Focus ring. Kept ≥3:1 against every surface it can land. */
  focusRing: string

  success: string
  onSuccess: string
  successText: string
  successSurface: string
  successBorder: string

  warning: string
  onWarning: string
  warningText: string
  warningSurface: string
  warningBorder: string

  danger: string
  onDanger: string
  dangerText: string
  dangerSurface: string
  dangerBorder: string

  zap: string
  onZap: string
  zapText: string
  /** The bolt glyph. Brighter than `zapText`, and never used for anything to be read. */
  zapIcon: string
  /** The NIP-05 verified tick. */
  verified: string
  zapSurface: string
  zapBorder: string

  /** The three chart series. */
  chartPeople: string
  chartSats: string
  chartNotes: string

  /** Scrim behind modals. */
  overlay: string
}

export type ColorRole = keyof ThemeRoles

/** Light is the product default, so it is measured against the strictest case: a white. */
const light: ThemeRoles = {
  bg: palette.white,
  bgElevated: neutral[50],
  bgInset: neutral[100],
  hover: '#ededed',
  bgChip: '#ededed',
  border: neutral[200],
  borderStrong: neutral[400],
  // One step past `border` on the same scale.
  borderInset: neutral[300],
  text: neutral[900],
  textMuted: neutral[600],
  textFaint: neutral[500],
  // 18.68:1 on white.
  navIcon: '#0f1419',

  // 4.95:1 on white.
  link: '#0f6fd4',
  accent: neutral[900],
  accentHover: neutral[700],
  accentActive: neutral[600],
  accentSubtle: neutral[50],
  accentBorder: neutral[300],
  accentText: neutral[900],
  onAccent: palette.white,
  focusRing: neutral[900],

  success: semantic.success.solid,
  onSuccess: semantic.success.onSolid,
  successText: semantic.success.text.light,
  successSurface: semantic.success.surface.light,
  successBorder: semantic.success.border.light,

  warning: semantic.warning.solid,
  onWarning: semantic.warning.onSolid,
  warningText: semantic.warning.text.light,
  warningSurface: semantic.warning.surface.light,
  warningBorder: semantic.warning.border.light,

  danger: semantic.danger.solid,
  onDanger: semantic.danger.onSolid,
  dangerText: semantic.danger.text.light,
  dangerSurface: semantic.danger.surface.light,
  dangerBorder: semantic.danger.border.light,

  zap: zap.solid,
  onZap: zap.onSolid,
  zapText: zap.text.light,
  zapIcon: zap.icon.light,
  verified: VERIFIED_BLUE,
  zapSurface: zap.surface.light,
  zapBorder: zap.border.light,

  chartPeople: chart.people.light,
  chartSats: chart.sats.light,
  chartNotes: chart.notes.light,

  // Tinted with the brand hue rather than pure black: a neutral scrim over purple.
  overlay: 'rgb(14 12 23 / 0.48)',
}

const black: ThemeRoles = {
  bg: '#0a0a0a',
  bgElevated: '#171717',
  bgInset: '#050505',
  hover: '#1c1c1c',
  bgChip: '#262626',
  border: '#404040',
  borderStrong: '#737373',
  borderInset: '#525252',
  text: '#fafafa',
  textMuted: '#cacaca',
  textFaint: '#9a9a9a',
  navIcon: '#fafafa',

  link: '#5eb0f5',
  accent: '#fafafa',
  accentHover: '#e5e5e5',
  accentActive: '#cacaca',
  accentSubtle: '#262626',
  accentBorder: '#525252',
  accentText: '#fafafa',
  onAccent: '#0a0a0a',
  focusRing: '#fafafa',

  success: '#217d52',
  onSuccess: '#ffffff',
  successText: '#66d6a2',
  successSurface: '#11271d',
  successBorder: '#2d5844',

  warning: '#a54a1d',
  onWarning: '#ffffff',
  warningText: '#eb8f60',
  warningSurface: '#2c1a11',
  warningBorder: '#5f3c2b',

  danger: '#bf2237',
  onDanger: '#ffffff',
  dangerText: '#e76e7e',
  dangerSurface: '#2c1115',
  dangerBorder: '#5f2b32',

  zap: '#ffb020',
  onZap: '#0a0a0a',
  zapText: '#ffb020',
  zapIcon: '#ffb020',
  verified: VERIFIED_BLUE,
  zapSurface: '#2b1e05',
  zapBorder: '#6b5214',

  chartPeople: '#4296e7',
  chartSats: '#cd8000',
  chartNotes: '#897bcc',
  overlay: 'rgb(10 10 11 / 0.55)',
}

const brown: ThemeRoles = {
  ...black,
  bg: '#16160f',
  bgElevated: '#201f18',
  bgInset: '#100f0a',
  hover: '#24231b',
  bgChip: '#2d2c25',
  border: '#35352d',
  borderStrong: '#7a786c',
  borderInset: '#4b4a41',
  text: '#f2f1e6',
  textMuted: '#a5a495',
  textFaint: '#78776b',
  navIcon: '#f2f1e6',
  overlay: 'rgb(10 10 6 / 0.72)',
}

const slate: ThemeRoles = {
  ...black,
  bg: '#101215',
  bgElevated: '#181b20',
  bgInset: '#0b0d10',
  hover: '#1b1e23',
  bgChip: '#26292e',
  border: '#2c2e31',
  borderStrong: '#767b82',
  borderInset: '#44474b',
  text: '#e8eaed',
  textMuted: '#9aa1ab',
  textFaint: '#6b727c',
  navIcon: '#e8eaed',
  overlay: 'rgb(6 8 10 / 0.72)',
}

const purple: ThemeRoles = {
  ...black,
  bg: '#1b1624',
  bgElevated: '#241c30',
  bgInset: '#120e19',
  hover: '#2c2238',
  bgChip: '#332740',
  border: '#463852',
  borderStrong: '#8d7a9d',
  borderInset: '#5d4a6d',
  text: '#f1eaf7',
  textMuted: '#baaaca',
  textFaint: '#8c7c9b',
  navIcon: '#f1eaf7',
  overlay: 'rgb(13 8 18 / 0.68)',
}

const pink: ThemeRoles = {
  ...black,
  bg: '#25171f',
  bgElevated: '#301d28',
  bgInset: '#190f15',
  hover: '#39232f',
  bgChip: '#422936',
  border: '#533743',
  borderStrong: '#9b7b89',
  borderInset: '#6d4b59',
  text: '#f8e9f0',
  textMuted: '#c7a8b5',
  textFaint: '#957783',
  navIcon: '#f8e9f0',
  overlay: 'rgb(18 8 13 / 0.68)',
}

export const themes: Readonly<Record<ThemeName, ThemeRoles>> = {
  light,
  black,
  brown,
  slate,
  purple,
  pink,
  'custom-dark': black,
  'custom-light': light,
}

export const DEFAULT_THEME: ThemeName = 'slate'

export const THEME_CLASSES: Readonly<Record<ThemeName, readonly string[]>> = {
  light: [],
  black: ['dark'],
  brown: ['dark', 'theme-brown'],
  slate: ['dark', 'theme-slate'],
  purple: ['dark', 'theme-purple'],
  pink: ['dark', 'theme-pink'],
  'custom-dark': ['dark', 'theme-custom-dark'],
  'custom-light': ['theme-custom-light'],
}

/** Every class any theme applies. */
export const ALL_THEME_CLASSES: readonly string[] = [
  'dark',
  'theme-brown',
  'theme-slate',
  'theme-purple',
  'theme-pink',
  'theme-custom-dark',
  'theme-custom-light',
]

/** Namespaced so it cannot collide with a relay/signer key in the same origin. */
export const THEME_STORAGE_KEY = 'nostrich:theme'

// ---------------------------------------------------------------------------.

/** System fonts, no webfont. */
export const fontFamily = {
  sans: [
    'ui-sans-serif',
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    '"Noto Sans"',
    /** Emoji families come BEFORE the generic. */
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Noto Color Emoji"',
    'sans-serif',
  ],
  mono: [
    'ui-monospace',
    'SFMono-Regular',
    '"SF Mono"',
    'Menlo',
    'Consolas',
    '"Liberation Mono"',
    'monospace',
  ],
} as const

export interface TypeStep {
  /** px, at a 16px root. */
  size: number
  /** px. Absolute rather than a multiplier so mixed sizes align on a 4px grid. */
  lineHeight: number
  /** em. Large text needs negative tracking to stop looking loose. */
  letterSpacing?: string
}

export type TypeScaleKey =
  | 'xs'
  | 'sm'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'

export const fontSize: Readonly<Record<TypeScaleKey, TypeStep>> = {
  xs: { size: 12, lineHeight: 16 },
  sm: { size: 14, lineHeight: 20 },
  // Note bodies render at `base`.
  base: { size: 16, lineHeight: 24 },
  lg: { size: 18, lineHeight: 26 },
  xl: { size: 20, lineHeight: 28, letterSpacing: '-0.01em' },
  '2xl': { size: 24, lineHeight: 32, letterSpacing: '-0.014em' },
  '3xl': { size: 30, lineHeight: 38, letterSpacing: '-0.018em' },
  '4xl': { size: 36, lineHeight: 44, letterSpacing: '-0.02em' },
}

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

// --------------------------------------------------------------------------- Space.

/** px, 4px base. `px` and `0.5` exist for hairlines and icon nudges only. */
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const

export type SpacingKey = keyof typeof spacing

/** px. `full` is a large number rather than `50%` so it survives into RN unchanged. */
/** Corner radii. */
export const radius = {
  none: 0,
  sm: 3,
  md: 6,
  lg: 8,
  xl: 10,
  '2xl': 12,
  full: 9999,
} as const

export type RadiusKey = keyof typeof radius

export type ShadowKey = 'sm' | 'md' | 'lg' | 'xl' | 'zapGlow'

/** CSS `box-shadow` strings, one set per theme. */
export const shadows: Readonly<Record<ThemeName, Readonly<Record<ShadowKey, string>>>> = {
  light: {
    sm: '0 1px 2px 0 rgb(14 12 23 / 0.06)',
    md: '0 2px 4px -1px rgb(14 12 23 / 0.08), 0 4px 12px -2px rgb(14 12 23 / 0.06)',
    lg: '0 4px 8px -2px rgb(14 12 23 / 0.10), 0 12px 28px -4px rgb(14 12 23 / 0.08)',
    xl: '0 8px 16px -4px rgb(14 12 23 / 0.12), 0 24px 48px -8px rgb(14 12 23 / 0.10)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.45), 0 4px 16px -2px rgb(245 190 10 / 0.35)',
  },
  black: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.50)',
    md: '0 2px 4px -1px rgb(0 0 0 / 0.55), 0 4px 12px -2px rgb(0 0 0 / 0.45)',
    lg: '0 4px 8px -2px rgb(0 0 0 / 0.60), 0 12px 28px -4px rgb(0 0 0 / 0.50)',
    xl: '0 8px 16px -4px rgb(0 0 0 / 0.65), 0 24px 48px -8px rgb(0 0 0 / 0.55)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.35), 0 4px 20px -2px rgb(245 190 10 / 0.30)',
  },
  brown: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.50)',
    md: '0 2px 4px -1px rgb(0 0 0 / 0.55), 0 4px 12px -2px rgb(0 0 0 / 0.45)',
    lg: '0 4px 8px -2px rgb(0 0 0 / 0.60), 0 12px 28px -4px rgb(0 0 0 / 0.50)',
    xl: '0 8px 16px -4px rgb(0 0 0 / 0.65), 0 24px 48px -8px rgb(0 0 0 / 0.55)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.35), 0 4px 20px -2px rgb(245 190 10 / 0.30)',
  },
  slate: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.50)',
    md: '0 2px 4px -1px rgb(0 0 0 / 0.55), 0 4px 12px -2px rgb(0 0 0 / 0.45)',
    lg: '0 4px 8px -2px rgb(0 0 0 / 0.60), 0 12px 28px -4px rgb(0 0 0 / 0.50)',
    xl: '0 8px 16px -4px rgb(0 0 0 / 0.65), 0 24px 48px -8px rgb(0 0 0 / 0.55)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.35), 0 4px 20px -2px rgb(245 190 10 / 0.30)',
  },
  purple: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.50)',
    md: '0 2px 4px -1px rgb(0 0 0 / 0.55), 0 4px 12px -2px rgb(0 0 0 / 0.45)',
    lg: '0 4px 8px -2px rgb(0 0 0 / 0.60), 0 12px 28px -4px rgb(0 0 0 / 0.50)',
    xl: '0 8px 16px -4px rgb(0 0 0 / 0.65), 0 24px 48px -8px rgb(0 0 0 / 0.55)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.35), 0 4px 20px -2px rgb(245 190 10 / 0.30)',
  },
  pink: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.50)',
    md: '0 2px 4px -1px rgb(0 0 0 / 0.55), 0 4px 12px -2px rgb(0 0 0 / 0.45)',
    lg: '0 4px 8px -2px rgb(0 0 0 / 0.60), 0 12px 28px -4px rgb(0 0 0 / 0.50)',
    xl: '0 8px 16px -4px rgb(0 0 0 / 0.65), 0 24px 48px -8px rgb(0 0 0 / 0.55)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.35), 0 4px 20px -2px rgb(245 190 10 / 0.30)',
  },
  'custom-dark': {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.50)',
    md: '0 2px 4px -1px rgb(0 0 0 / 0.55), 0 4px 12px -2px rgb(0 0 0 / 0.45)',
    lg: '0 4px 8px -2px rgb(0 0 0 / 0.60), 0 12px 28px -4px rgb(0 0 0 / 0.50)',
    xl: '0 8px 16px -4px rgb(0 0 0 / 0.65), 0 24px 48px -8px rgb(0 0 0 / 0.55)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.35), 0 4px 20px -2px rgb(245 190 10 / 0.30)',
  },
  'custom-light': {
    sm: '0 1px 2px 0 rgb(14 12 23 / 0.06)',
    md: '0 2px 4px -1px rgb(14 12 23 / 0.08), 0 4px 12px -2px rgb(14 12 23 / 0.06)',
    lg: '0 4px 8px -2px rgb(14 12 23 / 0.10), 0 12px 28px -4px rgb(14 12 23 / 0.08)',
    xl: '0 8px 16px -4px rgb(14 12 23 / 0.12), 0 24px 48px -8px rgb(14 12 23 / 0.10)',
    zapGlow: '0 0 0 1px rgb(245 190 10 / 0.45), 0 4px 16px -2px rgb(245 190 10 / 0.35)',
  },
}

/** Spaced by 100 so a one-off can slot between two layers without a renumber. */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  toast: 1500,
  tooltip: 1600,
} as const

export type ZIndexKey = keyof typeof zIndex

/** Milliseconds. */
export const duration = {
  instant: 0,
  fast: 120,
  base: 180,
  slow: 240,
  slower: 320,
} as const

export type DurationKey = keyof typeof duration

export const easing = {
  /** Default. */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Slight overshoot. */
  spring: 'cubic-bezier(0.2, 0.9, 0.25, 1.1)',
} as const

export type EasingKey = keyof typeof easing

export const motion = { duration, easing } as const

export const tokens = {
  palette,
  themes,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  radius,
  shadows,
  zIndex,
  motion,
} as const
