import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  THEME_PALETTES,
  applyCustomThemeBackground,
  applyThemePreference,
  currentTheme,
  readCustomThemeBackground,
  readThemePreference,
  resolveThemePreference,
} from './theme'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

describe('theme preference', () => {
  it.each([
    ['light', '', 'light'],
    ['black', 'dark', 'dark'],
    ['brown', 'dark theme-brown', 'dark'],
    ['slate', 'dark theme-slate', 'dark'],
    ['purple', 'dark theme-purple', 'dark'],
    ['pink', 'dark theme-pink', 'dark'],
    ['custom-dark', 'dark theme-custom-dark', 'dark'],
    ['custom-light', 'theme-custom-light', 'light'],
  ] as const)('applies and remembers %s', (theme, classes, colorScheme) => {
    applyThemePreference(theme)

    expect(document.documentElement.className).toBe(classes)
    expect(document.documentElement.style.colorScheme).toBe(colorScheme)
    expect(window.localStorage.getItem('nostrich:theme')).toBe(theme)
    expect(readThemePreference()).toBe(theme)
    expect(currentTheme()).toBe(theme)
  })

  it('uses Slate as the default palette', () => {
    expect(readThemePreference()).toBe('slate')
    expect(resolveThemePreference('slate')).toBe('slate')
  })

  it('falls back to Slate for an unknown or legacy System Default value', () => {
    window.localStorage.setItem('nostrich:theme', 'unknown')
    expect(readThemePreference()).toBe('slate')
    window.localStorage.setItem('nostrich:theme', 'system')
    expect(readThemePreference()).toBe('slate')
  })

  it('offers ten dark and ten light palette colors', () => {
    expect(THEME_PALETTES.map(palette => [palette.id, palette.options.length])).toEqual([
      ['dark', 10],
      ['light', 10],
    ])
  })

  it('applies a curated custom background and remembers it separately', () => {
    applyThemePreference('custom-dark')
    applyCustomThemeBackground('custom-dark', 'forest')

    expect(readCustomThemeBackground('custom-dark')).toBe('forest')
    expect(document.documentElement.style.getPropertyValue('--nosu-custom-theme-bg')).toBe(
      '#101b17',
    )
    expect(readThemePreference()).toBe('custom-dark')
  })
})
