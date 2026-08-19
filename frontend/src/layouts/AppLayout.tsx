import { Outlet, useLocation, Navigate, Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { LogOut, Menu } from 'lucide-react'
import NotificationBell from '@/features/notifications/components/NotificationBell'
import ThemeCustomizer from './components/ThemeCustomizer'
import OnboardingTour from '@/components/common/OnboardingTour'
import AiAssistantWidget from '@/features/analytics/components/AiAssistantWidget'
import HeaderBreadcrumb from '@/components/common/HeaderBreadcrumb'
import CheckinReminderBanner from '@/features/rewards/components/CheckinReminderBanner'
import { useState, useEffect } from 'react'

export default function AppLayout() {
  const { user, logout, refreshUser } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  // Refresh user info on mount to ensure roles/names are up to date
  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  if (user?.requirePasswordChange) {
    return <Navigate to="/force-password-change" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <OnboardingTour />
      {/* Chatbot nổi ở mọi trang. Ẩn trên /ai-assistant vì trang đó đã là trợ lý toàn màn hình.
          Đặt trong AppLayout nên không bị unmount khi đổi route -> hội thoại giữ nguyên. */}
      {location.pathname !== '/ai-assistant' && <AiAssistantWidget />}
      <Sidebar isMobileOpen={isMobileMenuOpen} onCloseMobile={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:pl-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 h-16 px-4 md:px-6 border-b border-[var(--color-border)] bg-[var(--color-card)]/80 backdrop-blur-md">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] transition-colors"
            >
              <Menu size={24} />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                <span className="text-white text-sm font-bold">K</span>
              </div>
              <span className="font-bold hidden sm:inline-block">KPI</span>
            </Link>
          </div>

          {/* Nút đóng/mở thanh bên đã chuyển vào chính thanh bên — nó điều khiển thanh
              bên nên phải nằm ở đó, và khi thu gọn thì vẫn với tới được ngay trên rãnh.
              Chỗ này giờ dành cho đường dẫn phân cấp: nó cho biết đang ở đâu và có nút
              quay ra, hữu ích hơn hẳn lời chào lặp lại ở mọi trang. */}
          <div className="flex-1 min-w-0 lg:pl-1">
            <HeaderBreadcrumb />
          </div>

          <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
            <NotificationBell />
            <ThemeCustomizer />

            <button
              onClick={logout}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Nhắc điểm danh: ngoài <main> nên không cuộn mất theo nội dung, và ngay dưới
            header ở mọi trang. Tự ẩn hoàn toàn khi không có gì để nhắc. */}
        <CheckinReminderBanner />

        {/* Main content — full-page routes opt out of padding */}
        <main className={
          location.pathname === '/ai-assistant'
            ? 'flex-1 overflow-hidden w-full max-w-[100vw] [overflow-x:clip]'
            : 'flex-1 overflow-y-auto p-4 md:p-6 w-full max-w-[100vw] [overflow-x:clip]'
        }>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
