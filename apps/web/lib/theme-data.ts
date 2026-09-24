/** Device-local custom background choices and their pre-paint bootstrap. */

export const CUSTOM_DARK_BACKGROUNDS = [
  { id: 'charcoal', label: 'Charcoal', color: '#151515' },
  { id: 'navy', label: 'Midnight blue', color: '#101827' },
  { id: 'forest', label: 'Deep forest', color: '#101b17' },
  { id: 'plum', label: 'Deep plum', color: '#1c1320' },
  { id: 'aubergine', label: 'Aubergine', color: '#211219' },
] as const

export const CUSTOM_LIGHT_BACKGROUNDS = [
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'slate-mist', label: 'Slate mist', color: '#f1f4f7' },
  { id: 'stone', label: 'Soft stone', color: '#f5f5f4' },
  { id: 'parchment', label: 'Parchment', color: '#faf5e8' },
  { id: 'mist', label: 'Blue mist', color: '#f3f7fa' },
  { id: 'sage', label: 'Sage mist', color: '#f1f7f2' },
  { id: 'lavender', label: 'Lavender mist', color: '#f6f2fb' },
  { id: 'rose', label: 'Rose mist', color: '#fff4f7' },
  { id: 'lilac', label: 'Lilac mist', color: '#faf2f8' },
  { id: 'blush', label: 'Blush mist', color: '#fff1f3' },
] as const

export type CustomThemeMode = 'custom-dark' | 'custom-light'
export type CustomDarkBackground = (typeof CUSTOM_DARK_BACKGROUNDS)[number]['id']
export type CustomLightBackground = (typeof CUSTOM_LIGHT_BACKGROUNDS)[number]['id']
export type CustomThemeBackground = CustomDarkBackground | CustomLightBackground

export const CUSTOM_THEME_STORAGE_KEYS: Readonly<Record<CustomThemeMode, string>> = {
  'custom-dark': 'nostrich:theme-custom-dark',
  'custom-light': 'nostrich:theme-custom-light',
}

const darkMap = Object.fromEntries(CUSTOM_DARK_BACKGROUNDS.map(item => [item.id, item.color]))
const lightMap = Object.fromEntries(CUSTOM_LIGHT_BACKGROUNDS.map(item => [item.id, item.color]))

/** Runs immediately after the shared theme bootstrap, before page content paints. */
export const CUSTOM_THEME_BOOTSTRAP_SCRIPT =
  `(function(){try{var t=localStorage.getItem("nostrich:theme"),m=t==="custom-dark"?${JSON.stringify(
    darkMap,
  )}:t==="custom-light"?${JSON.stringify(lightMap)}:null;if(!m)return;var k=t==="custom-dark"?"nostrich:theme-custom-dark":"nostrich:theme-custom-light",v=localStorage.getItem(k),c=m[v]||Object.values(m)[0],r=document.documentElement;r.style.setProperty("--nosu-custom-theme-bg",c);var q=document.querySelector('meta[name="theme-color"]');if(q)q.setAttribute("content",c)}catch(e){}})();`
