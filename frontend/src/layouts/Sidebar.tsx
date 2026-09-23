import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { useSidebarStore } from '@/store/sidebarStore'
import { useState, useRef, useEffect } from 'react'
import { useHasPermission } from '../components/auth/PermissionGate'
import {
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
import { useStageVisible } from '@/features/kpi/workflow/hooks/useStageVisible'
import {
  navItems,
  flatNavPaths,
  isFeatureEnabled,
  navItemKey,
  type NavItem,
  type NavFeatureFlags,
} from '@/config/navigation'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/common/BrandLogo'

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
  const stageVisible = useStageVisible()

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
        // Bước bị tổ chức tắt (hoặc người dùng tự ẩn) thì mục menu của nó biến mất.
        if (!stageVisible([item.path, ...(item.legacyKeys ?? [])])) return null

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
          isFeatureEnabled(sec, flags)
          && stageVisible([sec.path, ...(sec.legacyKeys ?? [])])
          && (!sec.permission || hasPermission(sec.permission, sec.requireAllPermissions))
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
    // Số việc chứ không phải chấm đỏ: "còn 3 việc" và "còn 30 việc" là hai tình huống
    // rất khác nhau, một cái chấm thì cả hai trông như nhau.
    if (path === '/my-kpi' && counts.myPendingTasks > 0) return counts.myPendingTasks
    if (path === '/submissions' && counts.myRejectedSubmissions > 0) return counts.myRejectedSubmissions
    if (path === '/rewards/me' && counts.myPendingRedemptions > 0) return counts.myPendingRedemptions
    if (path === '/wallet/me' && counts.myPendingTopups > 0) return counts.myPendingTopups
    if (path === '/bsc' && counts.pendingScorecards > 0) return counts.pendingScorecards
    if (path === '/rewards' && counts.pendingRewards > 0) return counts.pendingRewards
    if (path === '/wallet' && counts.pendingWallet > 0) return counts.pendingWallet
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
   * Đích của một dòng sidebar luôn là TRANG (lưới thẻ), kể cả khi một mục con đang mang số đỏ.
   * Từng tự nhảy thẳng vào mục có việc chờ (bỏ 18/09): bấm "Quản lý hiệu suất" mà rơi vào
   * "Đánh giá đợt" làm người dùng tưởng mình bấm nhầm — số đỏ vẫn hiện trên thẻ ở lưới để biết
   * đường vào.
   */
  const navTo = (item: NavItem): string => item.path!

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside 
        id="sidebar-container"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] transition-[width,transform] duration-200 ease-out motion-reduce:transition-none lg:static lg:sticky lg:top-0 lg:translate-x-0",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "w-64 translate-x-0 shadow-lg" : "-translate-x-full"
        )}
      >
        {/* Đầu thanh bên. Khi thu gọn, chính ô logo là nút mở — không còn chỗ nào khác
            để đặt nút, và người dùng vốn đã nhắm vào góc đó. Rê chuột thì logo mờ đi,
            hiện icon thanh bên để nói rõ bấm vào sẽ ra gì. */}
        <div className={cn(
          "flex h-14 items-center justify-between border-b border-[var(--color-border)]",
          isCollapsed && !isMobileOpen ? "justify-center px-0" : "px-4"
        )}>
          {isCollapsed && !isMobileOpen ? (
            <div className="relative group/toggle">
              <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Mở thanh bên">
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 group-hover/toggle:opacity-0">
                    <BrandLogo variant="icon" className="h-8 rounded-control" />
                  </span>
                  <PanelLeft aria-hidden="true"
                    className="relative opacity-0 group-hover/toggle:opacity-100 transition-opacity duration-150 text-[var(--color-foreground)]"
                  />
                </span>
              </Button>
              {/* Nằm ngoài <nav> nên không bị vùng cuộn cắt mất. */}
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-control bg-[var(--color-foreground)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-background)] shadow-md opacity-0 transition-opacity duration-150 group-hover/toggle:opacity-100">
                Mở thanh bên
              </span>
            </div>
          ) : (
            <>
              <Link to="/" className="flex min-w-0 items-center" aria-label="KeyGo">
                <BrandLogo className="h-8 dark:hidden" />
                <BrandLogo variant="white" className="hidden h-8 dark:block" />
              </Link>

              <Button variant="ghost" size="icon" className="hidden shrink-0 lg:flex" onClick={toggleSidebar} aria-label="Thu gọn thanh bên" title="Thu gọn thanh bên">
                <PanelLeft aria-hidden="true" />
              </Button>

              <Button variant="ghost" size="icon" className="lg:hidden" onClick={onCloseMobile} aria-label="Đóng menu">
                <X aria-hidden="true" />
              </Button>
            </>
          )}
        </div>

        <nav className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
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
                      'group relative flex h-9 w-full items-center gap-3 rounded-control px-2.5 text-sm font-medium transition-colors',
                      isCollapsed && !isMobileOpen ? 'justify-center px-0' : '',
                      hasActiveChild 
                        ? 'text-[var(--color-foreground)]'
                        : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                    )}
                    title={isCollapsed ? item.label : ''}
                  >
                    <div className="relative shrink-0">
                      {item.icon}
                      {hasChildBadge && isCollapsed && !isMobileOpen && (
                        <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-card)] bg-[var(--color-destructive)]" />
                      )}
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {hasChildBadge && !isExpanded && (
                          <span aria-hidden="true" className="mr-1 h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)]" />
                        )}
                        {isExpanded ? <ChevronUp size={16} className="text-[var(--color-subtle-foreground)]" /> : <ChevronDown size={16} className="text-[var(--color-subtle-foreground)]" />}
                      </>
                    )}
                  </button>
                  
                  {isExpanded && (!isCollapsed || isMobileOpen) && (
                    <div className="ml-[19px] space-y-0.5 border-l border-[var(--color-border)] pl-2">
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
                                  'group flex h-8 w-full items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium transition-colors',
                                  isSubActive
                                    ? 'text-[var(--color-foreground)]'
                                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                                )}
                              >
                                <div className="shrink-0 [&_svg]:size-4">{child.icon}</div>
                                <span className="flex-1 truncate text-left">{child.label}</span>
                                {hasSubBadge && !isSubExpanded && (
                                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)]" />
                                )}
                                {isSubExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>

                              {isSubExpanded && (
                                <div className="ml-[17px] space-y-0.5 border-l border-[var(--color-border)] pl-2">
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
                                          'group flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium transition-colors',
                                          isNavPathActive(subChild.path!, subChild.matchPrefix)
                                            ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                                            : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                                        )}
                                      >
                                        <div className="shrink-0 [&_svg]:size-4">
                                          {subChild.icon}
                                        </div>
                                        <span className="flex-1 truncate">{subChild.label}</span>
                                        {typeof subBadgeValue === 'number' && (
                                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-destructive)] px-1 text-xs font-semibold tabular-nums leading-none text-white">
                                            {subBadgeValue}
                                          </span>
                                        )}
                                        {typeof subBadgeValue === 'boolean' && subBadgeValue && (
                                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)]" />
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
                              'group relative flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium transition-colors',
                              isNavPathActive(child.path!, child.matchPrefix)
                                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                            )}
                          >
                            <div className="shrink-0 [&_svg]:size-4">
                              {child.icon}
                            </div>
                            <span className="flex-1 truncate">{child.label}</span>
                            {typeof childBadgeValue === 'number' && (
                              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-destructive)] px-1 text-xs font-semibold tabular-nums leading-none text-white">
                                {childBadgeValue}
                              </span>
                            )}
                            {typeof childBadgeValue === 'boolean' && childBadgeValue && (
                              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)]" />
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
                  'group relative flex h-9 items-center gap-3 rounded-control px-2.5 text-sm font-medium transition-colors',
                  isCollapsed && !isMobileOpen ? 'justify-center px-0' : '',
                  isNavPathActive(item.path!, item.matchPrefix)
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                )}
                title={isCollapsed ? item.label : ''}
              >
                <div className="relative shrink-0">
                  {item.icon}
                  {badgeValue && isCollapsed && !isMobileOpen && (
                    <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-card)] bg-[var(--color-destructive)]" />
                  )}
                </div>
                {(!isCollapsed || isMobileOpen) && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {typeof badgeValue === 'number' && (
                      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-destructive)] px-1 text-xs font-semibold tabular-nums leading-none text-white">
                        {badgeValue}
                      </span>
                    )}
                    {typeof badgeValue === 'boolean' && badgeValue && (
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)]" />
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
                'group mt-1 flex h-9 items-center gap-3 rounded-control px-2.5 text-sm font-medium transition-colors',
                isCollapsed && !isMobileOpen ? 'justify-center px-0' : '',
                isActive
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
              )}
              title={isCollapsed ? 'Quản trị nền tảng' : ''}
            >
              <ShieldCheck size={20} className="shrink-0" />
              {(!isCollapsed || isMobileOpen) && (
                <span className="truncate flex-1">Quản trị nền tảng</span>
              )}
            </NavLink>
          )}
        </nav>

        {/* User Account Section */}
        <div id="user-section" className={cn("relative mt-auto border-t border-[var(--color-border)] bg-[var(--color-card)] p-2", isCollapsed && !isMobileOpen && "p-2")} ref={menuRef}>
          
          {/* Popover Menu */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 z-50 mb-1 rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] py-1 shadow-lg animate-in fade-in-0 motion-reduce:animate-none">
              <Link 
                to="/profile" 
                onClick={() => { setUserMenuOpen(false); onCloseMobile?.() }}
                className="flex h-9 items-center gap-2.5 px-3 text-sm transition-colors hover:bg-[var(--color-muted)]"
              >
                <UserCircle size={16} className="text-[var(--color-muted-foreground)]" />
                Hồ sơ cá nhân
              </Link>
              <Link 
                to="/profile?tab=security" 
                onClick={() => { setUserMenuOpen(false); onCloseMobile?.() }}
                className="flex h-9 items-center gap-2.5 px-3 text-sm transition-colors hover:bg-[var(--color-muted)]"
              >
                <KeyRound size={16} className="text-[var(--color-muted-foreground)]" />
                Bảo mật & Mật khẩu
              </Link>
              <div className="h-px bg-[var(--color-border)] my-1" />
              <Button variant="ghost" className="w-full text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => { logout(); setUserMenuOpen(false) }}>
                <LogOut aria-hidden="true" />
                Đăng xuất
              </Button>
            </div>
          )}

          {/* Trigger Button */}
          <button 
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              "group flex w-full items-center justify-between rounded-control p-1.5 transition-colors hover:bg-[var(--color-muted)]",
              isCollapsed && !isMobileOpen ? "justify-center" : ""
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                fullName={user?.fullName}
                avatarUrl={user?.avatarUrl}
                className="h-8 w-8 rounded-control"
                fallbackClassName="bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-primary-foreground)]"
              />
              {(!isCollapsed || isMobileOpen) && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate text-[13px] font-medium text-[var(--color-foreground)]">{user?.fullName}</p>
                  <p className="truncate text-caption">
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
            {(!isCollapsed || isMobileOpen) && <MoreVertical size={16} className="shrink-0 text-[var(--color-subtle-foreground)]" />}
          </button>
        </div>
      </aside>
    </>
  )
}
