import { useState, useEffect } from 'react'
import StatusBadge from '@/components/common/StatusBadge'
import UserAvatar from '@/components/common/UserAvatar'
import type { User } from '@/types/user'
import { Pencil, Trash2, MoreVertical, Shield, User as UserIcon, Mail, Phone, Building2 } from 'lucide-react'
import { getHighestRole, cn, formatPhoneNumber } from '@/lib/utils'



interface UserTableProps {
  users: User[]
  orgUnitMap?: Record<string, string>
  rootUnitId?: string
  onRowClick?: (user: User) => void
  onDelete?: (user: User) => void
  canUpdate?: boolean
  canDelete?: boolean
}

// Dynamic role styling - generates consistent colors for any role name
const roleColorPalette = [
  'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]',
  'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]',
  'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]',
  'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]',
  'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)] dark:bg-[var(--color-error-bg)] dark:text-[var(--color-error)]',
  'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)] dark:bg-[var(--color-info-bg)] dark:text-[var(--color-info)]',
  'bg-[var(--color-muted)] text-[var(--color-foreground)] border-[var(--color-border)]',
]

function getRoleStyle(roleName: string) {
  // Simple hash to consistently assign color
  let hash = 0
  for (let i = 0; i < roleName.length; i++) {
    hash = roleName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colorIdx = Math.abs(hash) % roleColorPalette.length
  return {
    color: roleColorPalette[colorIdx]!,
    icon: Shield,
  }
}


export default function UserTable({ users, orgUnitMap, rootUnitId, onRowClick, onDelete, canUpdate, canDelete }: UserTableProps) {
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  
  // Close popover when clicking outside
  useEffect(() => {
    const handleDocClick = () => setOpenActionId(null)
    if (openActionId) {
      document.addEventListener('click', handleDocClick)
    }
    return () => document.removeEventListener('click', handleDocClick)
  }, [openActionId])

  if (!users || users.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
          <UserIcon size={32} className="mb-3 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
          <p className="text-sm font-medium text-[var(--color-foreground)]">Không có nhân sự phù hợp</p>
          <p className="mt-1 text-caption">Thử đổi từ khoá hoặc bộ lọc.</p>
       </div>
    )
  }

  const hasAnyAction = canUpdate || canDelete

  return (
    <>
    <div className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] pb-10 md:block">
      <table className="w-full min-w-[1000px] text-left border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
            <th scope="col" className="px-3 py-2.5 text-eyebrow whitespace-nowrap">Thông tin</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow whitespace-nowrap">Mã NV</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow whitespace-nowrap">Mã phòng ban</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow whitespace-nowrap">Vai trò</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow hidden md:table-cell whitespace-nowrap">Đơn vị</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow hidden sm:table-cell whitespace-nowrap">Liên lạc</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow whitespace-nowrap">Trạng thái</th>
            {hasAnyAction && <th scope="col" className="px-3 py-2.5 text-right text-eyebrow whitespace-nowrap">Hành động</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {users.map((u, index) => {
            const highestRole = getHighestRole(u)
            const roleConf = getRoleStyle(highestRole)
            const RoleIcon = roleConf.icon!

            const isActionOpen = openActionId === u.id

            return (
              <tr 
                 key={u.id} 
                 className="group hover:bg-[var(--color-muted)] transition-colors"
                 onClick={() => setOpenActionId(null)}
              >
                {/* 1. Identity Col */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                     <UserAvatar
                        fullName={u.fullName}
                        avatarUrl={u.avatarUrl}
                        className="w-9 h-9 rounded-card"
                        fallbackClassName={`font-semibold text-xs border ${roleConf.color.split(' ').slice(0, 3).join(' ')}`}
                     />
                     <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--color-foreground)]">
                           {u.fullName}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-caption">
                           <Mail size={12} className="text-[var(--color-subtle-foreground)]" /> {u.email}
                        </p>
                     </div>
                  </div>
                </td>

                <td className="px-3 py-3">
                   <span className="font-mono text-sm text-[var(--color-foreground)]">
                      {u.employeeCode || '---'}
                   </span>
                </td>

                {/* 1.7. Dept Code Col */}
                <td className="px-3 py-3">
                  {(() => {
                    const nonRootMembership = u.memberships?.find(m => m.orgUnitId !== rootUnitId)
                    const deptCode = nonRootMembership ? orgUnitMap?.[nonRootMembership.orgUnitId] : null
                    
                    if (!deptCode) return <span className="text-xs text-[var(--color-subtle-foreground)] italic">---</span>
                    
                    return (
                      <span className="text-sm font-semibold text-[var(--color-success)] bg-[var(--color-success-bg)] px-2 py-1 rounded-control border border-[var(--color-success-border)]">
                        {deptCode}
                      </span>
                    )
                  })()}
                </td>

                {/* 2. Role Col */}
                 <td className="py-4 px-2.5 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${roleConf.color}`}>
                     <RoleIcon size={12} /> {highestRole}
                  </span>
                </td>

                {/* 3. OrgUnit Col */}
                <td className="py-4 px-2.5 hidden md:table-cell">
                  {u.memberships && u.memberships.length > 0 ? (
                     <div className="flex flex-wrap gap-2 max-w-[280px]">
                        {u.memberships.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] text-caption font-semibold whitespace-nowrap">
                               <Building2 size={10} className="shrink-0" />
                               <span className="truncate max-w-[150px]" title={m.orgUnitName}>{m.orgUnitName}</span>
                               {m.roleName && (
                                 <span className="opacity-50 text-xs whitespace-nowrap">({m.roleDisplayName || m.roleName})</span>
                               )}
                            </div>
                        ))}
                     </div>
                  ) : (
                     <span className="text-xs text-[var(--color-subtle-foreground)] italic font-medium">Chưa phân bổ</span>
                  )}
                </td>

                {/* 3. Contact Col */}
                <td className="py-4 px-2.5 hidden sm:table-cell">
                  {u.phone ? (
                     <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted-foreground)] whitespace-nowrap">
                        <Phone size={14} className="text-[var(--color-subtle-foreground)]" /> {formatPhoneNumber(u.phone)}
                     </div>
                  ) : (
                     <span className="text-xs text-[var(--color-subtle-foreground)] italic font-medium">Chưa cung cấp</span>
                  )}
                </td>

                {/* 4. Status Col */}
                <td className="py-4 px-2.5 whitespace-nowrap">
                  <StatusBadge status={u.status} />
                </td>

                {/* 5. Actions Col */}
                {hasAnyAction && (
                  <td className="py-4 px-4 text-right">
                    <div className="relative inline-block text-left" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => setOpenActionId(isActionOpen ? null : u.id)}
                        className="p-2 rounded-card border border-transparent hover:border-[var(--color-border)] text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)] outline-none hover:bg-[var(--color-card)] transition-all"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {/* Popover Menu */}
                      {isActionOpen && (
                        <div className={cn(
                          "absolute right-0 w-56 rounded-card bg-[var(--color-card)] shadow-2xl border border-[var(--color-border)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200",
                          index >= users.length / 2 ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-2 origin-top-right"
                        )}>
                            <div className="p-2 space-y-1">
                              {canUpdate && (
                                <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] whitespace-nowrap group" onClick={() => { onRowClick?.(u); setOpenActionId(null) }}>
                                  <div className="w-8 h-8 rounded-control bg-[var(--color-info-bg)] flex items-center justify-center shrink-0 transition-transform">
                                      <Pencil aria-hidden="true" className="text-[var(--color-info)]" />
                                  </div>
                                  Chỉnh sửa hồ sơ
                                </button>
                              )}

                              {canUpdate && canDelete && <div className="h-px bg-[var(--color-muted)] mx-2 my-1" />}

                              {canDelete && (
                                <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] whitespace-nowrap group text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => { onDelete?.(u); setOpenActionId(null) }}>
                                  <div className="w-8 h-8 rounded-control bg-[var(--color-error-bg)] flex items-center justify-center shrink-0 transition-transform">
                                      <Trash2 aria-hidden="true" className="text-[var(--color-error)]" />
                                  </div>
                                  Ngắt quyền hệ thống
                                </button>
                              )}
                            </div>
                          </div>
                      )}
                    </div>
                  </td>
                )}

              </tr>
            )
          })}
        </tbody>
      </table>
    </div>

    <div className="md:hidden space-y-3">
      {users.map((u) => {
        const highestRole = getHighestRole(u)
        const roleConf = getRoleStyle(highestRole)
        const RoleIcon = roleConf.icon!
        const isActionOpen = openActionId === u.id
        const nonRootMembership = u.memberships?.find(m => m.orgUnitId !== rootUnitId)
        const deptCode = nonRootMembership ? orgUnitMap?.[nonRootMembership.orgUnitId] : null

        return (
          <div
            key={u.id}
            className="rounded-card border border-[var(--color-border)] p-4 space-y-3"
            onClick={() => setOpenActionId(null)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  fullName={u.fullName}
                  avatarUrl={u.avatarUrl}
                  className="w-9 h-9 rounded-card"
                  fallbackClassName={`font-semibold text-xs border ${roleConf.color.split(' ').slice(0, 3).join(' ')}`}
                />
                <div className="min-w-0">
                  <p className="font-medium text-[13px] text-[var(--color-foreground)] truncate">{u.fullName}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-caption">
                    <Mail size={12} className="text-[var(--color-subtle-foreground)]" /> {u.email}
                  </p>
                </div>
              </div>
              {hasAnyAction && (
                <div className="relative inline-block text-left shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenActionId(isActionOpen ? null : u.id)}
                    className="p-2 rounded-card border border-transparent hover:border-[var(--color-border)] text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)] outline-none hover:bg-[var(--color-card)] transition-all"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {isActionOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-card bg-[var(--color-card)] shadow-2xl border border-[var(--color-border)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                      <div className="p-2 space-y-1">
                        {canUpdate && (
                          <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] whitespace-nowrap group" onClick={() => { onRowClick?.(u); setOpenActionId(null) }}>
                            <div className="w-8 h-8 rounded-control bg-[var(--color-info-bg)] flex items-center justify-center shrink-0 transition-transform">
                              <Pencil aria-hidden="true" className="text-[var(--color-info)]" />
                            </div>
                            Chỉnh sửa hồ sơ
                          </button>
                        )}
                        {canUpdate && canDelete && <div className="h-px bg-[var(--color-muted)] mx-2 my-1" />}
                        {canDelete && (
                          <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] whitespace-nowrap group text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => { onDelete?.(u); setOpenActionId(null) }}>
                            <div className="w-8 h-8 rounded-control bg-[var(--color-error-bg)] flex items-center justify-center shrink-0 transition-transform">
                              <Trash2 aria-hidden="true" className="text-[var(--color-error)]" />
                            </div>
                            Ngắt quyền hệ thống
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${roleConf.color}`}>
                <RoleIcon size={12} /> {highestRole}
              </span>
              <StatusBadge status={u.status} />
              {u.employeeCode && (
                <span className="text-xs font-semibold text-[var(--color-foreground)] bg-[var(--color-muted)] px-2 py-1 rounded-control">{u.employeeCode}</span>
              )}
              {deptCode && (
                <span className="text-xs font-semibold text-[var(--color-success)] bg-[var(--color-success-bg)] px-2 py-1 rounded-control border border-[var(--color-success-border)]">{deptCode}</span>
              )}
            </div>

            {u.memberships && u.memberships.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--color-border)]">
                {u.memberships.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] text-caption font-semibold">
                    <Building2 size={10} className="shrink-0" />
                    <span className="truncate max-w-[150px]">{m.orgUnitName}</span>
                    {m.roleName && <span className="opacity-50 text-xs">({m.roleDisplayName || m.roleName})</span>}
                  </div>
                ))}
              </div>
            )}

            {u.phone && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted-foreground)]">
                <Phone size={14} className="text-[var(--color-subtle-foreground)]" /> {formatPhoneNumber(u.phone)}
              </div>
            )}
          </div>
        )
      })}
    </div>
    </>
  )
}
