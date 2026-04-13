import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  primaryColor: string
  isDark: boolean
  setPrimaryColor: (color: string) => void
  toggleDark: () => void
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
    }),
    { name: 'kpi-theme' }
  )
)
