import type { DepartmentMember } from '@/types/department'
import { getInitials } from '@/lib/utils'
import { Trash2, Shield, User, CornerDownRight } from 'lucide-react'

const positionMap: Record<string, { label: string; color: string; icon: any }> = {
  HEAD: { label: 'Trưởng phòng', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800', icon: Shield },
  DEPUTY: { label: 'Phó phòng', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800', icon: Shield },
  STAFF: { label: 'Thành viên', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700', icon: User },
}

interface MemberListProps {
  members: DepartmentMember[]
  onRemove?: (userId: string) => void
  canRemove?: boolean
}

export default function MemberList({ members, onRemove, canRemove }: MemberListProps) {
  if (members.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
             <User size={32} />
          </div>
          <h4 className="font-bold text-slate-600 dark:text-slate-300 mb-1">Chưa có Nhân sự</h4>
          <p className="text-sm text-slate-400 font-medium text-center">Đơn vị này hiện vẫn đang trống. Vui lòng thêm cán bộ vào để bắt đầu phân công KPI.</p>
       </div>
    )
  }

  // Sắp xếp Trưởng phòng -> Phó phòng -> Thành viên
  const sortedMembers = [...members].sort((a, b) => {
     const weight: Record<string, number> = { HEAD: 1, DEPUTY: 2, STAFF: 3 }
     return (weight[a.position] || 99) - (weight[b.position] || 99)
  })

  return (
    <div className="space-y-3">
      {sortedMembers.map((m, index) => {
         const posConfig = positionMap[m.position as string] || positionMap['STAFF']!
         const PositionIcon = posConfig.icon!

         return (
         <div key={m.id} className="group flex items-center gap-4 p-4 md:px-6 rounded-[20px] bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-900/30 dark:hover:bg-slate-900/80 border border-slate-100 dark:border-slate-800/80 transition-all">
            <div className="font-bold text-slate-300 dark:text-slate-700 text-sm hidden sm:block w-6 text-center">
               #{index + 1}
            </div>

            <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${posConfig.color.split(' ').slice(0, 2).join(' ')}`}>
               {getInitials(m.userFullName)}
            </div>

            <div className="flex-1 min-w-0">
               <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {m.userFullName}
               </h4>
               <p className="text-sm text-slate-500 font-medium truncate flex items-center gap-1.5 mt-0.5">
                  <CornerDownRight size={14} className="text-slate-400" />
                  {m.userEmail}
               </p>
            </div>

            <div className="hidden md:flex shrink-0 w-32 justify-end">
               <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${posConfig.color}`}>
                  <PositionIcon size={12} />
                  {posConfig.label}
               </span>
            </div>

            {canRemove && onRemove && (
               <button 
                  onClick={() => onRemove(m.userId)} 
                  title="Xóa khỏi phòng"
                  className="shrink-0 p-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
               >
                  <Trash2 size={18} />
               </button>
            )}
         </div>
      )})}
    </div>
  )
}
