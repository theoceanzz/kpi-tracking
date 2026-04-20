import { NavLink, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useState, useRef, useEffect } from 'react'
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
  Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/auth'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: UserRole[]
  end?: boolean // Thêm thuộc tính này để kiểm soát việc active link chính xác
}

const navItems: NavItem[] = [
  { label: 'Tổng quan', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['DIRECTOR', 'HEAD', 'DEPUTY', 'STAFF'] },
  { label: 'Công ty', path: '/company', icon: <Building2 size={20} />, roles: ['DIRECTOR'] },
  { label: 'Cấu trúc thiết lập', path: '/org-structure', icon: <Network size={20} />, roles: ['DIRECTOR'] },
  { label: 'Cơ sở & Chi nhánh', path: '/departments', icon: <Building2 size={20} />, roles: ['DIRECTOR'] },
  { label: 'Nhân sự', path: '/users', icon: <Users size={20} />, roles: ['DIRECTOR'] },
  { label: 'Vai trò', path: '/roles', icon: <Shield size={20} />, roles: ['DIRECTOR'] },
  
  { label: 'Quản lý Chỉ tiêu', path: '/kpi-criteria', icon: <Target size={20} />, roles: ['DIRECTOR', 'HEAD', 'DEPUTY'], end: true },
  { label: 'Duyệt Chỉ tiêu', path: '/kpi-criteria/pending', icon: <ClipboardCheck size={20} />, roles: ['DIRECTOR'] },
  { label: 'KPI của tôi', path: '/my-kpi', icon: <ListChecks size={20} />, roles: ['STAFF', 'HEAD', 'DEPUTY'] },
  
  { label: 'Duyệt Bài nộp', path: '/submissions/org-unit', icon: <ClipboardCheck size={20} />, roles: ['DIRECTOR', 'HEAD', 'DEPUTY'] },
  { label: 'Bài nộp của tôi', path: '/submissions', icon: <FileText size={20} />, roles: ['STAFF', 'HEAD', 'DEPUTY'], end: true },
  
  { label: 'Đánh giá NS', path: '/evaluations', icon: <Star size={20} />, roles: ['DIRECTOR', 'HEAD', 'DEPUTY', 'STAFF'] },
]

export default function Sidebar({ isMobileOpen, onCloseMobile }: { isMobileOpen?: boolean; onCloseMobile?: () => void }) {
  const { user, logout } = useAuthStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const filteredItems = navItems.filter(
    (item) => user && user.roles?.some(r => item.roles.includes(r as any))
  )

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
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-[var(--color-card)] border-r border-[var(--color-border)] h-screen transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:sticky lg:top-0",
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
              <Target className="text-white" size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight">KPI Tracking</span>
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
              // SỬA TẠI ĐÂY: Dùng item.end để kiểm soát active chính xác
              end={item.end} 
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Account Section */}
        <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-card)] mt-auto relative" ref={menuRef}>
          
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
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-accent)] transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-xs font-bold text-[var(--color-primary)] shrink-0">
                {user?.fullName?.charAt(0) ?? 'U'}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate group-hover:text-[var(--color-primary)] transition-colors">{user?.fullName}</p>
                <p className="text-xs text-[var(--color-muted-foreground)] truncate">
                  {user?.memberships?.[0]?.roleLabel || user?.email}
                </p>
              </div>
            </div>
            <MoreVertical size={16} className="text-[var(--color-muted-foreground)] shrink-0" />
          </button>
        </div>
      </aside>
    </>
  )
}
