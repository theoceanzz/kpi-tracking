import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { useThemeStore } from '@/store/themeStore'
import { LogOut, Moon, Sun, Menu } from 'lucide-react'
import NotificationBell from '@/features/notifications/components/NotificationBell'
import { useState, useEffect } from 'react'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { isDark, toggleDark } = useThemeStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      <Sidebar isMobileOpen={isMobileMenuOpen} onCloseMobile={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 md:pl-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 border-b border-[var(--color-border)] bg-[var(--color-card)]/80 backdrop-blur-md">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                <span className="text-white text-sm font-bold">K</span>
              </div>
              <span className="font-bold hidden sm:inline-block">KPI</span>
            </div>
          </div>

          <div className="hidden lg:block">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Xin chào, <span className="font-semibold text-[var(--color-foreground)]">{user?.fullName}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
            <NotificationBell />

            <button
              onClick={toggleDark}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--color-accent)] transition-colors"
              title="Đổi giao diện"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={logout}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 w-full max-w-[100vw] overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
