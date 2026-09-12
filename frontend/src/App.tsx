import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/router'
import { useEffect } from 'react'
import GlobalUploadProgress from '@/components/common/GlobalUploadProgress'
import { useThemeStore, applyTheme } from '@/store/themeStore'
import { useClearNumberInputOnFocus } from '@/hooks/useClearNumberInputOnFocus'

export default function App() {
  const { isDark, primaryColor } = useThemeStore()

  useClearNumberInputOnFocus()

  // Giá trị persist chỉ nằm trong localStorage; phải ghi lên <html> một lần khi khởi động.
  useEffect(() => {
    applyTheme(primaryColor, isDark)
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
