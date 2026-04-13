import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Target } from 'lucide-react'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
            <Target className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">KPI Tracking</h1>
          <p className="text-[var(--color-muted-foreground)] mt-1">Hệ thống quản lý chỉ tiêu hiệu suất</p>
        </div>

        <div className="bg-[var(--color-card)] rounded-2xl shadow-xl shadow-black/5 border border-[var(--color-border)] p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
