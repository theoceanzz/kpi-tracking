import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'
import { useEffect } from 'react'
import GlobalUploadProgress from '@/components/common/GlobalUploadProgress'
import { useThemeStore } from '@/store/themeStore'

export default function App() {
  const { isDark, primaryColor } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.setProperty('--color-primary', primaryColor)
  }, [isDark, primaryColor])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <GlobalUploadProgress />
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif' },
        }}
      />
    </QueryClientProvider>
  )
}
