import { NavLink, Link, useLocation } from 'react-router-dom'
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
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Settings,
  Lightbulb,
  CircleHelp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationDots } from '../hooks/useNotificationDots'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { useTourStore } from '@/store/tourStore'
import { pathToTourKey } from '@/components/common/tourSteps'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'

interface NavItem {
  label: string
  path?: string
  icon: React.ReactNode
  permission?: string
  end?: boolean
  children?: NavItem[]
  okrOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Tổng quan', path: '/dashboard', icon: <LayoutDashboard size={20} />, permission: 'DASHBOARD:VIEW', end: true },
  { label: 'Dashboard cá nhân', path: '/dashboard/staff', icon: <UserCircle size={20} />, permission: 'KPI:VIEW_MY', end: true },
  {
    label: 'Thiết lập công ty',
    icon: <Building2 size={20} />,
    children: [
      { label: 'Công ty', path: '/company', icon: <Building2 size={18} />, permission: 'COMPANY:VIEW' },
      { label: 'Quản lý OKR', path: '/okr', icon: <Target size={18} />, permission: 'COMPANY:VIEW', okrOnly: true },
      {
        label: 'Tổ chức',
        icon: <Network size={18} />,
        children: [
          { label: 'Vai trò', path: '/roles', icon: <Shield size={18} />, permission: 'ROLE:VIEW' },
          { label: 'Sơ đồ tổ chức', path: '/org-structure', icon: <Network size={18} />, permission: 'ORG:VIEW' },
        ]
      },
      { label: 'Nhân sự', path: '/users', icon: <Users size={18} />, permission: 'USER:VIEW' },
      { label: 'Cấu hình hệ thống', path: '/settings', icon: <Settings size={18} />, permission: 'COMPANY:UPDATE' },
    ]
  },
  {
    label: 'Quản lý KPI',
    icon: <Target size={20} />,
    children: [
      { label: 'Quản lý đợt ', path: '/kpi-periods', icon: <Layers size={18} />, permission: 'KPI_PERIOD:CREATE' },
      { label: 'Quản lý chỉ tiêu', path: '/kpi-criteria', icon: <Target size={18} />, permission: 'KPI:VIEW', end: true },
      { label: 'Duyệt chỉ tiêu', path: '/kpi-criteria/pending', icon: <ClipboardCheck size={18} />, permission: 'KPI:APPROVE_CRITERIA' },
      { label: 'Duyệt điều chỉnh', path: '/kpi-adjustments/pending', icon: <MessageSquare size={18} />, permission: 'KPI:APPROVE_ADJUSTMENT' },
      { label: 'Phê duyệt & đánh giá ', path: '/submissions/org-unit', icon: <ClipboardCheck size={18} />, permission: 'SUBMISSION:REVIEW' },
      { label: 'Kết quả đánh giá', path: '/evaluations', icon: <Star size={18} />, permission: 'EVALUATION:VIEW_MY' },
    ]
  },
  { label: 'KPI của tôi', path: '/my-kpi', icon: <ListChecks size={20} />, permission: 'KPI:VIEW_MY' },
  { label: 'Bài nộp của tôi', path: '/submissions', icon: <FileText size={20} />, permission: 'SUBMISSION:VIEW_MY', end: true },
  { label: 'Điều chỉnh của tôi', path: '/my-adjustments', icon: <History size={20} />, permission: 'KPI:VIEW_MY' },
  { label: 'Thống kê', path: '/analytics', icon: <TrendingUp size={20} />, permission: 'DASHBOARD:VIEW', end: true },
]

/* ─── Tour Replay Button ─── */
function TourReplayButton({ path }: { path: string }) {
  const { user } = useAuthStore()
  const tourKey = pathToTourKey[path]
  const { startTour, activeTour, hasSeen } = useTourStore()
  
  if (!tourKey || !user?.id) return null
  
  const seen = hasSeen(tourKey, user.id)
  const isActive = activeTour === tourKey
  
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!isActive) startTour(tourKey)
      }}
      className={cn(
        'shrink-0 p-1 rounded-full transition-all border',
        isActive
          ? 'text-indigo-500 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800'
          : seen 
            ? 'text-slate-400 border-transparent opacity-40 group-hover:opacity-100 hover:text-indigo-500 hover:bg-indigo-50 hover:border-indigo-100 dark:hover:bg-indigo-900/20'
            : 'text-amber-500 border-amber-200 bg-amber-50 animate-pulse opacity-100 dark:bg-amber-900/20 dark:border-amber-800'
      )}
      title={seen ? "Xem lại hướng dẫn" : "Trang này có hướng dẫn mới"}
    >
      {seen ? <CircleHelp size={13} /> : <Lightbulb size={13} />}
    </button>
  )
}

export default function Sidebar({ isMobileOpen, onCloseMobile }: { isMobileOpen?: boolean; onCloseMobile?: () => void }) {
  const { user, logout } = useAuthStore()
  const { isCollapsed } = useSidebarStore()
  const { hasSeen, startTour, stopTour } = useTourStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { hasPermission } = useHasPermission()
  const location = useLocation()

  const handleNavClick = (path?: string) => {
    if (!path) return
    onCloseMobile?.()
    
    const tourKey = pathToTourKey[path]
    if (tourKey && user?.id && !hasSeen(tourKey, user.id)) {
      // Force stop any existing tour and restart the specific one
      stopTour()
      setTimeout(() => startTour(tourKey), 10)
    }
  }
  
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && item.children.some(child => location.pathname.startsWith(child.path || ''))) {
        setExpandedMenus(prev => ({ ...prev, [item.label]: true }))
      }
    })
  }, [location.pathname])

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }))
  }

  const isAnyChildActive = (item: NavItem): boolean => {
    return !!item.children?.some(child => {
      if (child.path && location.pathname.startsWith(child.path)) return true
      if (child.children) return isAnyChildActive(child)
      return false
    })
  }

  const getLabel = (item: NavItem) => {
    const key = item.path || item.label
    return (customLabels as Record<string, string>)[key] || item.label
  }

  const filteredItems = navItems.map((item) => {
    // Override main item label
    const updatedItem = { ...item, label: getLabel(item) }

    if (item.children) {
      const filteredChildren = item.children
        .map(child => {
          if (child.children) {
            const filteredSubChildren = child.children.filter(sub => !sub.permission || hasPermission(sub.permission))
            if (filteredSubChildren.length > 0) {
              return { ...child, label: getLabel(child), children: filteredSubChildren }
            }
            return null
          }
          if (child.okrOnly && !enableOkr) return null

          if (child.path === '/evaluations') {
            if (! hasPermission('EVALUATION:VIEW_MY')) {
              return null
            }
            return { ...child, label: getLabel(child) }
          }

          if (!child.permission || hasPermission(child.permission)) {
            return { ...child, label: getLabel(child) }
          }
          return null
        })
        .filter(Boolean) as NavItem[]

      if (filteredChildren.length > 0) {
        return { ...updatedItem, children: filteredChildren }
      }
      return null
    }

    if (!user) return null
    
    let processedItem: NavItem | null = updatedItem

    if (item.path === '/dashboard/staff') {
      const isManager = hasPermission(['KPI:APPROVE', 'SUBMISSION:REVIEW', 'ORG:CREATE', 'USER:VIEW_LIST'])
      if (!(isManager && hasPermission('KPI:VIEW_MY'))) {
        processedItem = null
      }
    } else if (item.permission && hasPermission(item.permission)) {
      if (item.path === '/dashboard') {
        const dashboardPath = hasPermission(['ORG:CREATE', 'ROLE:VIEW']) 
          ? '/dashboard/director' 
          : hasPermission(['KPI:APPROVE', 'SUBMISSION:REVIEW', 'USER:VIEW_LIST']) 
            ? '/dashboard/head' 
            : '/dashboard/staff'
        processedItem = { ...updatedItem, path: dashboardPath }
      }
    } else {
      processedItem = null
    }

    return processedItem
  }).filter(Boolean) as NavItem[]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { counts } = useNotificationDots()

  const getBadge = (path: string) => {
    if (path === '/kpi-criteria/pending' && counts.pendingKpis > 0) return counts.pendingKpis
    if (path === '/kpi-adjustments/pending' && counts.pendingAdjustments > 0) return counts.pendingAdjustments
    if (path === '/submissions/org-unit' && counts.pendingSubmissions > 0) return counts.pendingSubmissions
    if (path === '/my-kpi' && counts.myPendingTasks > 0) return true // Just a dot for staff tasks
    return null
  }

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
        id="sidebar-container"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--color-card)] border-r border-[var(--color-border)] h-screen transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:sticky lg:top-0",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "translate-x-0 shadow-2xl w-64" : "-translate-x-full"
        )}
      >
        <Link to="/" className={cn("flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]", isCollapsed && !isMobileOpen && "px-4")}>
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
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCloseMobile?.() }}
          >
            <X size={20} />
          </button>
        </Link>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedMenus[item.label] || isAnyChildActive(item)
              const hasActiveChild = isAnyChildActive(item)
              const hasChildBadge = item.children.some(child => !!getBadge(child.path || ''))
              
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    id={item.label === 'Thiết lập công ty' ? 'tour-company-nav-group' : item.label === 'Quản lý KPI' ? 'tour-kpi-nav-group' : item.label.includes('Phê duyệt') ? 'tour-approve-nav-group' : `nav-group-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group relative',
                      isCollapsed && !isMobileOpen ? 'justify-center px-0 mx-2' : '',
                      hasActiveChild 
                        ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5' 
                        : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                    )}
                    title={isCollapsed ? item.label : ''}
                  >
                    <div className={cn("shrink-0 transition-transform group-hover:scale-110 relative", isCollapsed && !isMobileOpen ? "m-0" : "")}>
                      {item.icon}
                      {hasChildBadge && isCollapsed && !isMobileOpen && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--color-card)] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      )}
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {hasChildBadge && !isExpanded && (
                          <div className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        )}
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </>
                    )}
                  </button>
                  
                  {isExpanded && (!isCollapsed || isMobileOpen) && (
                    <div className="ml-4 space-y-1 border-l border-[var(--color-border)] pl-3">
                      {item.children.map((child) => {
                        const childBadgeValue = child.path ? getBadge(child.path) : null
                        
                        // Handle sub-children (2nd level)
                        if (child.children) {
                          const isSubExpanded = expandedMenus[child.label] || child.children.some(c => location.pathname.startsWith(c.path || ''))
                          
                          return (
                            <div key={child.label} className="space-y-1 my-1">
                              <button
                                onClick={() => toggleMenu(child.label)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold transition-all group',
                                  child.children.some(c => location.pathname.startsWith(c.path || ''))
                                    ? 'text-[var(--color-primary)]'
                                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'
                                )}
                              >
                                <div className="shrink-0 opacity-70 group-hover:opacity-100">{child.icon}</div>
                                <span className="truncate flex-1 text-left">{child.label}</span>
                                {isSubExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                              
                              {isSubExpanded && (
                                <div className="ml-3 space-y-1 border-l border-[var(--color-border)]/50 pl-3">
                                  {child.children.map((subChild) => (
                                    <NavLink
                                      key={subChild.path}
                                      to={subChild.path!}
                                      onClick={() => handleNavClick(subChild.path)}
                                      className={({ isActive }) =>
                                        cn(
                                          'flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all group',
                                          isActive
                                            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                            : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'
                                        )
                                      }
                                    >
                                      <div className="shrink-0 opacity-70 group-hover:opacity-100">
                                        {subChild.icon}
                                      </div>
                                      <span className="truncate flex-1">{subChild.label}</span>
                                      {subChild.path && <TourReplayButton path={subChild.path} />}
                                    </NavLink>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        }

                        return (
                          <NavLink
                            id={`nav-item-${child.path?.replace(/\//g, '-')}`}
                            key={child.path}
                            to={child.path!}
                            end={child.end} 
                            onClick={() => handleNavClick(child.path)}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold transition-all group relative',
                                isActive
                                  ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                  : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'
                              )
                            }
                          >
                            <div className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                              {child.icon}
                            </div>
                            <span className="truncate flex-1">{child.label}</span>
                            {child.path && <TourReplayButton path={child.path} />}
                            {typeof childBadgeValue === 'number' && (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[9px] text-white font-black shadow-lg shadow-red-500/20">
                                {childBadgeValue}
                              </span>
                            )}
                            {typeof childBadgeValue === 'boolean' && childBadgeValue && (
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            )}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const badgeValue = item.path ? getBadge(item.path) : null
            
            return (
              <NavLink
                id={item.path?.startsWith('/dashboard') && item.path !== '/dashboard/staff' ? 'tour-dashboard-nav' : `nav-item-${item.path?.replace(/\//g, '-')}`}
                key={item.path}
                to={item.path!}
                end={item.end} 
                onClick={() => handleNavClick(item.path)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group relative',
                    isCollapsed && !isMobileOpen ? 'justify-center px-0 mx-2' : '',
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/25 scale-[1.02]'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                  )
                }
                title={isCollapsed ? item.label : ''}
              >
                <div className={cn("shrink-0 transition-transform group-hover:scale-110 relative", isCollapsed && !isMobileOpen ? "m-0" : "")}>
                  {item.icon}
                  {badgeValue && isCollapsed && !isMobileOpen && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--color-card)] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  )}
                </div>
                {(!isCollapsed || isMobileOpen) && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {item.path && <TourReplayButton path={item.path} />}
                    {typeof badgeValue === 'number' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500 text-[10px] text-white font-black shadow-lg shadow-red-500/20 animate-pulse">
                        {badgeValue}
                      </span>
                    )}
                    {typeof badgeValue === 'boolean' && badgeValue && (
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User Account Section */}
        <div id="user-section" className={cn("p-4 border-t border-[var(--color-border)] bg-[var(--color-card)] mt-auto relative", isCollapsed && !isMobileOpen && "p-2")} ref={menuRef}>
          
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
                      const membership = (() => {
                        const ms = user?.memberships || [];
                        if (ms.length <= 1) return ms[0];
                        // Just pick the first non-root one, or the first one
                        return ms.find(m => (m.levelOrder ?? 0) > 0) || ms[0];
                      })();
                      return membership?.roleDisplayName || membership?.roleName || 'Thành viên';
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
