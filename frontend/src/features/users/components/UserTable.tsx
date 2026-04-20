import { useState, useEffect } from 'react'
import StatusBadge from '@/components/common/StatusBadge'
import type { User } from '@/types/user'
import { Pencil, Trash2, MoreVertical, Shield, User as UserIcon, Mail, Phone, Building2 } from 'lucide-react'
import { getInitials, getHighestRole } from '@/lib/utils'

interface UserTableProps {
  users: User[]
  orgUnitMap?: Record<string, string>
  onRowClick?: (user: User) => void
  onDelete?: (user: User) => void
}

const roleMap: Record<string, { label: string; color: string; icon: any }> = {
  DIRECTOR: { label: 'Giám đốc', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400', icon: Shield },
  HEAD: { label: 'Trưởng đơn vị', color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400', icon: Shield },
  DEPUTY: { label: 'Phó đơn vị', color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Shield },
  STAFF: { label: 'Nhân viên', color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300', icon: UserIcon },
}


export default function UserTable({ users, onRowClick, onDelete }: UserTableProps) {
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
       <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
          <UserIcon size={32} className="text-slate-400 mb-4" />
          <p className="font-bold text-slate-600 dark:text-slate-300">Không có dữ liệu nhân sự</p>
       </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-10">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">Định danh Cán bộ</th>
            <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">Vai trò</th>
            <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-[var(--color-muted-foreground)] hidden md:table-cell">Đơn vị</th>
            <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-[var(--color-muted-foreground)] hidden sm:table-cell">Liên lạc</th>
            <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-[var(--color-muted-foreground)]">Trạng thái</th>
            <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-right text-[var(--color-muted-foreground)] whitespace-nowrap">Công cụ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {users.map((u) => {
            const highestRole = getHighestRole(u)
            const roleConf = roleMap[highestRole] || roleMap['STAFF']!
            const RoleIcon = roleConf.icon!

            const isActionOpen = openActionId === u.id

            return (
              <tr 
                 key={u.id} 
                 className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                 onClick={() => setOpenActionId(null)}
              >
                {/* 1. Identity Col */}
                <td className="py-4 px-6">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center font-bold text-sm shrink-0 border ${roleConf.color.split(' ').slice(0, 3).join(' ')}`}>
                        {getInitials(u.fullName)}
                     </div>
                     <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                           {u.fullName}
                        </p>
                        <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1 mt-1">
                           <Mail size={12} className="text-slate-400" /> {u.email}
                        </p>
                     </div>
                  </div>
                </td>

                {/* 2. Role Col */}
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${roleConf.color}`}>
                     <RoleIcon size={12} /> {roleConf.label}
                  </span>
                </td>

                {/* 3. OrgUnit Col */}
                <td className="py-4 px-6 hidden md:table-cell">
                  {u.memberships && u.memberships.length > 0 ? (
                     <div className="flex flex-wrap gap-2 max-w-[280px]">
                        {u.memberships.map((m, idx) => (
                           <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 text-[11px] font-semibold">
                              <Building2 size={10} className="shrink-0" />
                              <span className="truncate max-w-[100px]" title={m.orgUnitName}>{m.orgUnitName}</span>
                              {m.roleLabel && (
                                <span className="opacity-50 text-[10px]">({m.roleLabel})</span>
                              )}
                           </div>
                        ))}
                     </div>
                  ) : (
                     <span className="text-xs text-slate-400 italic font-medium">Chưa phân bổ</span>
                  )}
                </td>

                {/* 3. Contact Col */}
                <td className="py-4 px-6 hidden sm:table-cell">
                  {u.phone ? (
                     <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
                        <Phone size={14} className="text-slate-400" /> {u.phone}
                     </div>
                  ) : (
                     <span className="text-xs text-slate-400 italic font-medium">Chưa cung cấp</span>
                  )}
                </td>

                {/* 4. Status Col */}
                <td className="py-4 px-6">
                  <StatusBadge status={u.status} />
                </td>

                {/* 5. Actions Col */}
                <td className="py-4 px-4 text-right">
                  <div className="relative inline-block text-left" onClick={e => e.stopPropagation()}>
                    <button 
                       onClick={() => setOpenActionId(isActionOpen ? null : u.id)}
                       className="p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 outline-none hover:bg-white dark:hover:bg-slate-800 transition-all"
                    >
                       <MoreVertical size={16} />
                    </button>

                    {/* Popover Menu */}
                    {isActionOpen && (
                       <div className="absolute right-0 mt-2 w-56 rounded-[20px] bg-white dark:bg-slate-800 shadow-2xl border border-slate-200/60 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                          <div className="p-2 space-y-1">
                            <button 
                              onClick={() => { onRowClick?.(u); setOpenActionId(null) }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all whitespace-nowrap group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                  <Pencil size={15} className="text-blue-600" />
                              </div>
                              Chỉnh sửa hồ sơ
                            </button>

                            {/* Đường kẻ mờ phân tách cho chuyên nghiệp */}
                            <div className="h-px bg-slate-100 dark:bg-slate-700/50 mx-2 my-1" />

                            <button 
                              onClick={() => { onDelete?.(u); setOpenActionId(null) }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-bold rounded-[14px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all whitespace-nowrap group"
                            >
                              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                  <Trash2 size={15} className="text-red-600" />
                              </div>
                              Ngắt quyền hệ thống
                            </button>
                          </div>
                        </div>
                    )}
                  </div>
                </td>

              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
