import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const THEME_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Slate', value: '#475569' },
]

interface ThemeState {
  primaryColor: string
  isDark: boolean
  setPrimaryColor: (color: string) => void
  toggleDark: () => void
  setDark: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      primaryColor: '#6366f1',
      isDark: false,
      setPrimaryColor: (color) => {
        document.documentElement.style.setProperty('--color-primary', color)
        set({ primaryColor: color })
      },
      toggleDark: () =>
        set((state) => {
          const newDark = !state.isDark
          document.documentElement.classList.toggle('dark', newDark)
          return { isDark: newDark }
        }),
      setDark: (isDark) => {
        document.documentElement.classList.toggle('dark', isDark)
        set({ isDark })
      },
    }),
    { name: 'kpi-theme' }
  )
)
