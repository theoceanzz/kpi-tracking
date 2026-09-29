import { Outlet, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { CheckCircle2 } from 'lucide-react'
import { BrandLogo } from '@/components/common/BrandLogo'
import LanguageSwitcher from '@/components/common/LanguageSwitcher'
import { useTranslation } from 'react-i18next'

export default function AuthLayout() {
  const { t } = useTranslation('layout')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="h-screen w-full flex bg-[var(--color-background)] overflow-hidden">
      {/* Left Pane - Branding & Graphic (Visible only on lg screens) */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative bg-[var(--color-primary-deep)] text-white overflow-hidden items-center justify-center flex-col p-12">

        <div className="relative z-10 max-w-xl w-full">
          <Link to="/" className="mb-10 inline-flex items-center transition-opacity hover:opacity-80" aria-label="KeyGo">
            <BrandLogo variant="white" className="h-12" />
          </Link>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-6">
            Key Insights.<br/>
            <span className="text-white/60">Go Smarter.</span>
          </h1>
          
          <p className="text-lg text-white/75 mb-12 leading-relaxed max-w-md">
            {t('AuthLayout.aModernGoalPerformanceManagementPlatform')}
          </p>

          <div className="space-y-4">
            {[
              t('AuthLayout.trackPerformanceInRealTime'),
              t('AuthLayout.builtInArtificialIntelligenceAi'),
              t('AuthLayout.automatedKpiApprovalCycle'),
              t('AuthLayout.automaticReportsWithVisualCharts')
            ].map((feature, idx) => (
               <div key={idx} className="flex items-center gap-3 text-white/90 font-medium bg-white/5 border border-white/15 w-fit px-4 py-2.5 rounded-full">
                  <CheckCircle2 size={18} className="text-white/80" aria-hidden="true" />
                  {feature}
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Pane - Form Area */}
      <div className="w-full lg:w-1/2 min-w-0 h-full flex flex-col items-center overflow-y-auto overflow-x-hidden px-6 py-12 sm:px-12 custom-scrollbar relative">
        <div className="absolute inset-0 bg-[var(--color-muted)] -z-10"></div>
        {/* Chọn trước khi đăng nhập: lưu ở máy này, đăng nhập xong được đẩy lên tài khoản nếu tài khoản chưa chọn. */}
        <div className="absolute right-4 top-4 sm:right-6">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md my-auto">
          {/* Logo for mobile only */}
          <Link to="/" className="lg:hidden flex justify-center mb-8 transition-transform" aria-label="KeyGo">
            <BrandLogo className="h-12 dark:hidden" />
            <BrandLogo variant="white" className="hidden h-12 dark:block" />
          </Link>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
