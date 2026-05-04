import { NavLink, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { useState, useRef, useEffect } from 'react'
import { useHasPermission } from '../components/auth/PermissionGate'
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  FileText,
  Star,
  ClipboardCheck,
  ListChecks,
  X,
  MoreVertical,
  UserCircle,
  KeyRound,
  LogOut,
  Network,
  Shield,
  Layers,
  MessageSquare,
  History,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  permission: string
  end?: boolean
}

const navItems: NavItem[] = [
  { label: 'Tổng quan', path: '/dashboard', icon: <LayoutDashboard size={20} />, permission: 'DASHBOARD:VIEW', end: true },
  { label: 'Dashboard cá nhân', path: '/dashboard/staff', icon: <UserCircle size={20} />, permission: 'KPI:VIEW_MY', end: true },
  { label: 'Công ty', path: '/company', icon: <Building2 size={20} />, permission: 'COMPANY:VIEW' },
  { label: 'Cấu trúc thiết lập', path: '/org-structure', icon: <Network size={20} />, permission: 'ORG:CREATE' },
  { label: 'Nhân sự', path: '/users', icon: <Users size={20} />, permission: 'USER:CREATE' },
  { label: 'Vai trò', path: '/roles', icon: <Shield size={20} />, permission: 'ROLE:VIEW' },
  { label: 'Quản lý Chỉ tiêu', path: '/kpi-criteria', icon: <Target size={20} />, permission: 'KPI:VIEW', end: true },
  { label: 'Duyệt Chỉ tiêu', path: '/kpi-criteria/pending', icon: <ClipboardCheck size={20} />, permission: 'KPI:APPROVE' },
  { label: 'Duyệt Điều chỉnh', path: '/kpi-adjustments/pending', icon: <MessageSquare size={20} />, permission: 'KPI:APPROVE' },
  { label: 'Quản lý Đợt KPI', path: '/kpi-periods', icon: <Layers size={20} />, permission: 'KPI_PERIOD:CREATE' },
  { label: 'KPI của tôi', path: '/my-kpi', icon: <ListChecks size={20} />, permission: 'KPI:VIEW_MY' },
  { label: 'Điều chỉnh của tôi', path: '/my-adjustments', icon: <History size={20} />, permission: 'KPI:VIEW_MY' },
  { label: 'Duyệt Bài nộp', path: '/submissions/org-unit', icon: <ClipboardCheck size={20} />, permission: 'SUBMISSION:REVIEW' },
  { label: 'Bài nộp của tôi', path: '/submissions', icon: <FileText size={20} />, permission: 'SUBMISSION:VIEW_MY', end: true },
  { label: 'Đánh giá NS', path: '/evaluations', icon: <Star size={20} />, permission: 'EVALUATION:VIEW' },
  // { label: 'Nguồn dữ liệu', path: '/datasources', icon: <Database size={20} />, permission: 'DASHBOARD:VIEW', end: true },
  // { label: 'Báo cáo', path: '/reports', icon: <BarChart3 size={20} />, permission: 'DASHBOARD:VIEW', end: true },
  { label: 'Thống kê', path: '/analytics', icon: <TrendingUp size={20} />, permission: 'DASHBOARD:VIEW', end: true },
]

export default function Sidebar({ isMobileOpen, onCloseMobile }: { isMobileOpen?: boolean; onCloseMobile?: () => void }) {
  const { user, logout } = useAuthStore()
  const { isCollapsed } = useSidebarStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { hasPermission } = useHasPermission()
  
  const filteredItems = navItems.filter((item) => {
    if (!user) return false
    // Special case for evaluations: show if can view all or just view own
    // Special case for evaluations: show if can view all or just view own
    if (item.path === '/evaluations') {
      return hasPermission('EVALUATION:VIEW') || hasPermission('EVALUATION:VIEW_MY')
    }

    // Special case for Staff Dashboard: Only show it for managers who also have personal KPIs
    // (Staff already use "Tổng quan" which points to /dashboard/staff)
    if (item.path === '/dashboard/staff') {
      const isManager = hasPermission(['KPI:APPROVE', 'SUBMISSION:REVIEW', 'ORG:CREATE'])
      return isManager && hasPermission('KPI:VIEW_MY')
    }

    return hasPermission(item.permission)
  }).map(item => {
    // Dynamic path for "Tổng quan" to match specific dashboard
    if (item.path === '/dashboard') {
      const dashboardPath = hasPermission(['ORG:CREATE', 'ROLE:VIEW']) 
        ? '/dashboard/director' 
        : hasPermission(['KPI:APPROVE', 'SUBMISSION:REVIEW']) 
          ? '/dashboard/head' 
          : '/dashboard/staff'
      return { ...item, path: dashboardPath }
    }
    return item
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--color-card)] border-r border-[var(--color-border)] h-screen transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:sticky lg:top-0",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "translate-x-0 shadow-2xl w-64" : "-translate-x-full"
        )}
      >
        <div className={cn("flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]", isCollapsed && !isMobileOpen && "px-4")}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shrink-0 shadow-lg shadow-[var(--color-primary)]/20">
              <Target className="text-white" size={20} />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <span className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-indigo-600">
                KeyGo
              </span>
            )}
          </div>
          <button 
            className="lg:hidden p-1.5 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
            onClick={onCloseMobile}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end} 
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group',
                  isCollapsed && !isMobileOpen ? 'justify-center px-0 mx-2' : '',
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/25 scale-[1.02]'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                )
              }
              title={isCollapsed ? item.label : ''}
            >
              <div className={cn("shrink-0 transition-transform group-hover:scale-110", isCollapsed && !isMobileOpen ? "m-0" : "")}>
                {item.icon}
              </div>
              {(!isCollapsed || isMobileOpen) && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Account Section */}
        <div className={cn("p-4 border-t border-[var(--color-border)] bg-[var(--color-card)] mt-auto relative", isCollapsed && !isMobileOpen && "p-2")} ref={menuRef}>
          
          {/* Popover Menu */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-lg py-1 z-50 animate-in fade-in slide-in-from-bottom-2">
              <Link 
                to="/profile" 
                onClick={() => { setUserMenuOpen(false); onCloseMobile?.() }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
              >
                <UserCircle size={16} className="text-[var(--color-muted-foreground)]" />
                Hồ sơ cá nhân
              </Link>
              <Link 
                to="/profile?tab=security" 
                onClick={() => { setUserMenuOpen(false); onCloseMobile?.() }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-accent)] transition-colors"
              >
                <KeyRound size={16} className="text-[var(--color-muted-foreground)]" />
                Bảo mật & Mật khẩu
              </Link>
              <div className="h-px bg-[var(--color-border)] my-1" />
              <button 
                onClick={() => { logout(); setUserMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={16} />
                Đăng xuất
              </button>
            </div>
          )}

          {/* Trigger Button */}
          <button 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              "w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--color-accent)] transition-all group border border-transparent hover:border-[var(--color-border)]",
              isCollapsed && !isMobileOpen ? "justify-center" : ""
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md">
                {user?.fullName?.charAt(0) ?? 'U'}
              </div>
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-black truncate text-[var(--color-foreground)]">{user?.fullName}</p>
                  <p className="text-[10px] font-bold text-[var(--color-muted-foreground)] uppercase tracking-widest truncate">
                    {(() => {
                      if (!user?.memberships || user.memberships.length === 0) return 'Thành viên';
                      const sorted = [...(user.memberships || [])].sort((a, b) => (a.roleRank ?? 99) - (b.roleRank ?? 99));
                      return sorted[0]?.roleLabel || 'Thành viên';
                    })()}
                  </p>
                </div>
              )}
            </div>
            {(!isCollapsed || isMobileOpen) && <MoreVertical size={16} className="text-[var(--color-muted-foreground)] shrink-0" />}
          </button>
        </div>
      </aside>
    </>
  )
}
