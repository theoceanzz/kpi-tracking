import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { useSidebarStore } from '@/store/sidebarStore'
import { useState, useRef, useEffect } from 'react'
import { useHasPermission } from '../components/auth/PermissionGate'
import {
  Target,
  X,
  MoreVertical,
  UserCircle,
  KeyRound,
  LogOut,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  PanelLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { useNotificationDots } from '../hooks/useNotificationDots'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import {
  navItems,
  flatNavPaths,
  isFeatureEnabled,
  navItemKey,
  type NavItem,
  type NavFeatureFlags,
} from '@/config/navigation'

// Mọi path trong cây, phẳng — dùng để biết khi nào một path chỉ đang là TIỀN TỐ của
// route hiện tại (ví dụ /submissions với /submissions/org-unit) thì không được sáng,
// vì đã có mục nav khác khớp chính xác.
const ALL_NAV_PATHS = flatNavPaths()

export default function Sidebar({ isMobileOpen, onCloseMobile }: { isMobileOpen?: boolean; onCloseMobile?: () => void }) {
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const { isCollapsed, toggle: toggleSidebar } = useSidebarStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { hasPermission } = useHasPermission()
  const location = useLocation()

  const handleNavClick = () => {
    onCloseMobile?.()
  }
  
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr
  const enableBsc = org?.enableBsc
  const enableAi = org?.enableAi !== false // default true while loading
  const enableReward = org?.enableReward
  const enableCashWallet = org?.enableCashWallet
  const enableConduct = org?.enableConduct

  const flags: NavFeatureFlags = { enableOkr, enableBsc, enableReward, enableCashWallet, enableAi, enableConduct }

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  /**
   * Một path nav có đang là route hiện tại không.
   *
   * Path chỉ là TIỀN TỐ (ví dụ /submissions với /submissions/org-unit) chỉ tính là
   * active khi không có mục nav nào khớp chính xác — nhờ đó "Tiến độ của tôi" không
   * sáng cùng "Đánh giá đợt", mà vẫn sáng khi ở trang chi tiết /submissions/:id.
   */
  const isNavPathActive = (path: string, matchPrefix?: boolean): boolean => {
    if (path.includes('?')) return location.pathname + location.search === path
    if (location.pathname === path) return true
    if (!location.pathname.startsWith(path.endsWith('/') ? path : `${path}/`)) return false
    return matchPrefix === true || !ALL_NAV_PATHS.includes(location.pathname)
  }

  const isAnyChildActive = (item: NavItem): boolean =>
    !!item.children?.some(child =>
      child.children ? isAnyChildActive(child) : !!child.path && isNavPathActive(child.path, child.matchPrefix)
    )

  // Bung sẵn mọi nhóm cha trên đường tới route hiện tại, ở bao nhiêu cấp cũng được.
  useEffect(() => {
    const expandActiveBranch = (items: NavItem[]): boolean =>
      items.reduce((anyActive, item) => {
        if (item.children) {
          if (expandActiveBranch(item.children)) {
            setExpandedMenus(prev => (prev[item.id] ? prev : { ...prev, [item.id]: true }))
            return true
          }
          return anyActive
        }
        return item.path && isNavPathActive(item.path, item.matchPrefix) ? true : anyActive
      }, false)

    expandActiveBranch(navItems)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Nhãn tuỳ chỉnh của tổ chức. Tra theo khoá hiện tại trước, rồi tới các khoá cũ —
  // nhãn đã đặt từ trước khi đổi cấu trúc sidebar vẫn còn tác dụng, không cần migration.
  const getLabel = (item: NavItem) => {
    const labels = customLabels as Record<string, string>
    return labels[navItemKey(item)] || item.legacyKeys?.map(k => labels[k]).find(Boolean) || item.label
  }

  const filterNav = (items: NavItem[]): NavItem[] =>
    items
      .map(item => {
        if (!isFeatureEnabled(item, flags)) return null

        if (item.children) {
          const children = filterNav(item.children)
          // Nhóm rỗng thì ẩn — đây cũng là cách nhóm không mang cờ (ví dụ "Ví của tôi")
          // tự biến mất khi tổ chức tắt hết tính năng của các mục con.
          if (children.length === 0) return null
          return { ...item, label: getLabel(item), originalLabel: item.label, children }
        }

        if (!user) return null
        if (item.permission && !hasPermission(item.permission, item.requireAllPermissions)) return null

        // Trang gộp: ẩn dòng khi người dùng không mở được mục nào bên trong — vào chỉ
        // thấy một trang rỗng. Suy từ chính các mục con nên không phải bảo trì bằng tay
        // một danh sách quyền hợp nhất mỗi lần thêm mục.
        if (item.sections && !item.sections.some(sec =>
          isFeatureEnabled(sec, flags) && (!sec.permission || hasPermission(sec.permission, sec.requireAllPermissions))
        )) return null

        return { ...item, label: getLabel(item), originalLabel: item.label }
      })
      .filter(Boolean) as NavItem[]

  const filteredItems = filterNav(navItems)

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

  // Badge của một mục. Mục nằm TRONG trang gộp không có path riêng, nên tra thêm theo
  // khoá cũ — chính là path mà nó thay thế.
  const badgeOf = (item: NavItem): number | boolean | null => {
    const keys = [...(item.path ? [item.path] : []), ...(item.legacyKeys ?? [])]
    for (const k of keys) {
      const b = getBadge(k)
      if (b) return b
    }
    return null
  }

  /**
   * Badge hiển thị trên một dòng sidebar, cộng dồn qua nhóm con lẫn mục trong trang.
   * Gộp năm màn hình duyệt về một dòng mà chỉ hiện chấm đỏ là quản lý mất luôn con số
   * "còn bao nhiêu việc" — nên cộng lại thành tổng.
   */
  const aggregateBadge = (item: NavItem): number | boolean | null => {
    const nested = [...(item.children ?? []), ...(item.sections ?? [])]
    if (nested.length === 0) return badgeOf(item)

    let total = 0
    let anyDot = false
    nested.forEach(child => {
      const b = aggregateBadge(child)
      if (typeof b === 'number') total += b
      else if (b) anyDot = true
    })
    return total > 0 ? total : anyDot || null
  }

  const hasBadgeDeep = (item: NavItem): boolean => !!aggregateBadge(item)

  /**
   * Đích của một dòng sidebar. Trang gộp đang có việc chờ thì trỏ THẲNG vào mục con
   * mang số đỏ, thay vì đổ ra lưới thẻ rồi bắt người dùng tự dò xem con số đó đến từ
   * thẻ nào. Không mục con nào có badge (hoặc dòng không phải trang gộp) thì giữ path.
   */
  const navTo = (item: NavItem): string => {
    const path = item.path!
    if (!item.sections?.length) return path

    let bestId: string | null = null
    let bestScore = 0
    for (const sec of item.sections) {
      const b = aggregateBadge(sec)
      if (!b) continue
      // Chấm đỏ (boolean) xếp sau mọi con số: đếm được việc thì cụ thể hơn.
      const score = typeof b === 'number' ? b : 0.5
      if (score > bestScore) {
        bestScore = score
        bestId = sec.id
      }
    }
    return bestId ? `${path}?section=${bestId}` : path
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
        {/* Đầu thanh bên. Khi thu gọn, chính ô logo là nút mở — không còn chỗ nào khác
            để đặt nút, và người dùng vốn đã nhắm vào góc đó. Rê chuột thì logo mờ đi,
            hiện icon thanh bên để nói rõ bấm vào sẽ ra gì. */}
        <div className={cn(
          "flex items-center justify-between border-b border-[var(--color-border)] h-[73px]",
          isCollapsed && !isMobileOpen ? "px-0 justify-center" : "px-6"
        )}>
          {isCollapsed && !isMobileOpen ? (
            <div className="relative group/toggle">
              <button
                onClick={toggleSidebar}
                aria-label="Mở thanh bên"
                className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-[var(--color-accent)] transition-colors"
              >
                <span className="relative w-9 h-9 flex items-center justify-center">
                  <span className="absolute inset-0 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shadow-lg shadow-[var(--color-primary)]/20 transition-opacity duration-150 group-hover/toggle:opacity-0">
                    <Target className="text-white" size={20} />
                  </span>
                  <PanelLeft
                    size={20}
                    className="relative opacity-0 group-hover/toggle:opacity-100 transition-opacity duration-150 text-[var(--color-foreground)]"
                  />
                </span>
              </button>
              {/* Nằm ngoài <nav> nên không bị vùng cuộn cắt mất. */}
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded-full bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-xs font-bold text-white shadow-lg opacity-0 group-hover/toggle:opacity-100 transition-opacity duration-150">
                Mở thanh bên
              </span>
            </div>
          ) : (
            <>
              <Link to="/" className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shrink-0 shadow-lg shadow-[var(--color-primary)]/20">
                  <Target className="text-white" size={20} />
                </div>
                <span className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-indigo-600">
                  KeyGo
                </span>
              </Link>

              <button
                onClick={toggleSidebar}
                aria-label="Thu gọn thanh bên"
                title="Thu gọn thanh bên"
                className="hidden lg:flex w-9 h-9 shrink-0 rounded-lg items-center justify-center text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] transition-colors"
              >
                <PanelLeft size={18} />
              </button>

              <button
                className="lg:hidden p-1.5 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
                onClick={onCloseMobile}
                aria-label="Đóng menu"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item) => {
            if (item.children) {
              const hasActiveChild = isAnyChildActive(item)
              const isExpanded = expandedMenus[item.id] || hasActiveChild
              const hasChildBadge = hasBadgeDeep(item)

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    id={`nav-group-${item.id}`}
                    onClick={() => toggleMenu(item.id)}
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
                        const childBadgeValue = aggregateBadge(child)
                        
                        // Handle sub-children (2nd level)
                        if (child.children) {
                          const isSubActive = isAnyChildActive(child)
                          const isSubExpanded = expandedMenus[child.id] || isSubActive
                          const hasSubBadge = hasBadgeDeep(child)

                          return (
                           <div key={child.id} className="space-y-1 my-1">
                              <button
                                id={`nav-group-${child.id}`}
                                onClick={() => toggleMenu(child.id)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold transition-all group',
                                  isSubActive
                                    ? 'text-[var(--color-primary)]'
                                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'
                                )}
                              >
                                <div className="shrink-0 opacity-70 group-hover:opacity-100">{child.icon}</div>
                                <span className="truncate flex-1 text-left">{child.label}</span>
                                {hasSubBadge && !isSubExpanded && (
                                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                )}
                                {isSubExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>

                              {isSubExpanded && (
                                <div className="ml-3 space-y-1 border-l border-[var(--color-border)]/50 pl-3">
                                  {child.children.map((subChild) => {
                                    const subBadgeValue = aggregateBadge(subChild)

                                    return (
                                      <NavLink
                                        id={`nav-item-${subChild.path?.replace(/\//g, '-')}`}
                                        key={subChild.path}
                                        to={navTo(subChild)}
                                        end={subChild.end}
                                        onClick={handleNavClick}
                                        className={cn(
                                          'flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all group',
                                          isNavPathActive(subChild.path!, subChild.matchPrefix)
                                            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                            : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'
                                        )}
                                      >
                                        <div className="shrink-0 opacity-70 group-hover:opacity-100">
                                          {subChild.icon}
                                        </div>
                                        <span className="truncate flex-1">{subChild.label}</span>
                                        {typeof subBadgeValue === 'number' && (
                                          <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-[9px] text-white font-black shadow-lg shadow-red-500/20">
                                            {subBadgeValue}
                                          </span>
                                        )}
                                        {typeof subBadgeValue === 'boolean' && subBadgeValue && (
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

                        return (
                          <NavLink
                            id={`nav-item-${child.path?.replace(/\//g, '-')}`}
                            key={child.path}
                            to={navTo(child)}
                            end={child.end} 
                            onClick={handleNavClick}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold transition-all group relative',
                              isNavPathActive(child.path!, child.matchPrefix)
                                ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]'
                            )}
                          >
                            <div className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                              {child.icon}
                            </div>
                            <span className="truncate flex-1">{child.label}</span>
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

            const badgeValue = aggregateBadge(item)
            
            return (
              <NavLink
                id={item.id === 'dashboard' ? 'tour-dashboard-nav' : `nav-item-${item.path?.replace(/\//g, '-')}`}
                key={item.id}
                to={navTo(item)}
                end={item.end} 
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group relative',
                  isCollapsed && !isMobileOpen ? 'justify-center px-0 mx-2' : '',
                  isNavPathActive(item.path!, item.matchPrefix)
                    ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/25 scale-[1.02]'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                )}
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

          {/* Platform Admin link — only for platform admins */}
          {user?.isPlatformAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group mt-1',
                isCollapsed && !isMobileOpen ? 'justify-center px-0 mx-2' : '',
                isActive
                  ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/25'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
              )}
              title={isCollapsed ? 'Quản trị nền tảng' : ''}
            >
              <ShieldCheck size={20} className="shrink-0 transition-transform group-hover:scale-110" />
              {(!isCollapsed || isMobileOpen) && (
                <span className="truncate flex-1">Quản trị nền tảng</span>
              )}
            </NavLink>
          )}
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
              <UserAvatar
                fullName={user?.fullName}
                avatarUrl={user?.avatarUrl}
                className="w-9 h-9 rounded-xl shadow-md"
                fallbackClassName="bg-gradient-to-br from-[var(--color-primary)] to-indigo-600 text-xs font-black text-white"
              />
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
                      if (user?.isPlatformAdmin) return 'Quản trị viên';
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
