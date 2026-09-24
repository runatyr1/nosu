'use client'

import {
  ALL_THEME_CLASSES,
  DEFAULT_THEME,
  THEME_CLASSES,
  THEME_STORAGE_KEY,
  isThemeName,
  type ThemeName,
} from '@nostrich/ui'
import {
  CUSTOM_DARK_BACKGROUNDS,
  CUSTOM_LIGHT_BACKGROUNDS,
  CUSTOM_THEME_STORAGE_KEYS,
  type CustomThemeBackground,
  type CustomThemeMode,
} from './theme-data'

export type Theme = ThemeName
export type ThemePreference = Theme
export { THEME_STORAGE_KEY }

export interface ThemePaletteOption {
  id: string
  label: string
  color: string
  theme: ThemePreference
  background?: CustomThemeBackground
}

export interface ThemePalette {
  id: 'dark' | 'light'
  label: string
  options: readonly ThemePaletteOption[]
}

/** Two compact pickers; legacy named themes remain selectable as dark swatches. */
export const THEME_PALETTES: readonly ThemePalette[] = [
  {
    id: 'dark',
    label: 'Dark',
    options: [
      { id: 'slate', label: 'Slate', color: '#101215', theme: 'slate' },
      { id: 'black', label: 'Black', color: '#0a0a0a', theme: 'black' },
      { id: 'brown', label: 'Brown', color: '#16160f', theme: 'brown' },
      { id: 'purple', label: 'Purple', color: '#1b1624', theme: 'purple' },
      { id: 'pink', label: 'Pink', color: '#25171f', theme: 'pink' },
      ...CUSTOM_DARK_BACKGROUNDS.map(option => ({
        ...option,
        theme: 'custom-dark' as const,
        background: option.id,
      })),
    ],
  },
  {
    id: 'light',
    label: 'Light',
    options: CUSTOM_LIGHT_BACKGROUNDS.map((option, index) => ({
      ...option,
      theme: index === 0 ? ('light' as const) : ('custom-light' as const),
      background: index === 0 ? undefined : option.id,
    })),
  },
]

export { CUSTOM_DARK_BACKGROUNDS, CUSTOM_LIGHT_BACKGROUNDS }
export type { CustomThemeBackground, CustomThemeMode }

const THEME_CHANGE_EVENT = 'nostrix:theme-change'

function isThemePreference(value: unknown): value is ThemePreference {
  return isThemeName(value)
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function resolveThemePreference(preference: ThemePreference): Theme {
  return preference
}

function customChoices(mode: CustomThemeMode) {
  return mode === 'custom-dark' ? CUSTOM_DARK_BACKGROUNDS : CUSTOM_LIGHT_BACKGROUNDS
}

export function readCustomThemeBackground(mode: CustomThemeMode): CustomThemeBackground {
  const choices = customChoices(mode)
  if (typeof window === 'undefined') return choices[0].id
  try {
    const stored = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEYS[mode])
    return choices.some(choice => choice.id === stored)
      ? (stored as CustomThemeBackground)
      : choices[0].id
  } catch {
    return choices[0].id
  }
}

function paintCustomBackground(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme !== 'custom-dark' && theme !== 'custom-light') {
    root.style.removeProperty('--nostrix-custom-theme-bg')
    return
  }
  const selected = readCustomThemeBackground(theme)
  const choice = customChoices(theme).find(item => item.id === selected) ?? customChoices(theme)[0]
  root.style.setProperty('--nostrix-custom-theme-bg', choice.color)
}

/** Read the palette already painted on the root by the pre-hydration script. */
export function currentTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME
  const classes = document.documentElement.classList
  if (classes.contains('theme-custom-dark')) return 'custom-dark'
  if (classes.contains('theme-custom-light')) return 'custom-light'
  if (classes.contains('theme-brown')) return 'brown'
  if (classes.contains('theme-slate')) return 'slate'
  if (classes.contains('theme-purple')) return 'purple'
  if (classes.contains('theme-pink')) return 'pink'
  return classes.contains('dark') ? 'black' : 'light'
}

function paintTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove(...ALL_THEME_CLASSES)
  root.classList.add(...THEME_CLASSES[theme])
  root.style.colorScheme = theme === 'light' || theme === 'custom-light' ? 'light' : 'dark'
  paintCustomBackground(theme)
  paintThemeColor()
}

export function applyThemePreference(preference: ThemePreference): void {
  paintTheme(resolveThemePreference(preference))
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Private-mode storage can fail; the selected theme still applies for this page.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

export function applyCustomThemeBackground(
  mode: CustomThemeMode,
  background: CustomThemeBackground,
): void {
  if (!customChoices(mode).some(choice => choice.id === background)) return
  try {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEYS[mode], background)
  } catch {
    // The active page can still reflect the choice when storage is unavailable.
  }
  if (readThemePreference() === mode) paintTheme(mode)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

/** Keeps React Native Web tokens aligned with the root CSS palette. */
export function subscribeTheme(listener: (theme: Theme) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const update = (): void => {
    paintTheme(resolveThemePreference(readThemePreference()))
    listener(currentTheme())
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY) update()
  }
  window.addEventListener(THEME_CHANGE_EVENT, update)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, update)
    window.removeEventListener('storage', onStorage)
  }
}

/** The address bar, status bar and installed-app title bar. */
export function paintThemeColor(): void {
  if (typeof document === 'undefined') return
  const colour = getComputedStyle(document.documentElement).getPropertyValue('--role-bg').trim()
  if (colour === '') return
  let meta = document.querySelector('meta[name="theme-color"]')
  if (meta === null) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', colour)
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
