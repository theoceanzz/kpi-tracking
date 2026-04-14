import type { Department } from '@/types/department'
import { Building2, Users, Crown, ArrowRight, ActivitySquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface DepartmentCardProps {
  department: Department
}

export default function DepartmentCard({ department }: DepartmentCardProps) {
  // Determine if it has members at all
  const isEmpty = department.memberCount === 0

  return (
    <Link
      to={`/departments/${department.id}`}
      className={cn(
        "group relative flex flex-col justify-between h-full min-h-[220px]",
        "bg-[var(--color-card)] rounded-[24px] border shadow-sm p-6 overflow-hidden",
        "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        isEmpty 
           ? "border-dashed border-red-200 dark:border-red-900/40 hover:border-red-400" 
           : "border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500"
      )}
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
         <ActivitySquare size={120} />
      </div>

      <div className="relative z-10 flex flex-col h-full space-y-4">
        {/* Header Block */}
        <div className="flex items-start justify-between gap-4">
          <div className={cn(
             "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
             isEmpty 
                ? "bg-red-50 text-red-500 dark:bg-red-900/20" 
                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          )}>
            <Building2 size={24} />
          </div>
          
          {/* Status Chip */}
          <div className={cn(
             "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
             isEmpty 
               ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400" 
               : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          )}>
            {isEmpty ? 'Cần nhân sự' : 'Đang hoạt động'}
          </div>
        </div>

        {/* Content Block */}
        <div className="flex-1 space-y-2 mt-2">
           <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1" title={department.name}>
              {department.name}
           </h3>
           <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed h-[40px]">
              {department.description || 'Không có mô tả chi tiết cho đơn vị này.'}
           </p>
        </div>

        {/* Footer Block / Staff Info */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-col space-y-3">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 max-w-[70%]">
                 <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Crown size={12} />
                 </div>
                 <span className="text-sm font-semibold truncate text-slate-700 dark:text-slate-300">
                    {department.headName || <span className="text-slate-400 italic font-normal">Chưa bổ nhiệm</span>}
                 </span>
              </div>
              
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                 <Users size={12} />
                 {department.memberCount}
              </div>
           </div>
           
           <div className="group-hover:opacity-100 opacity-0 transform group-hover:translate-x-0 -translate-x-2 transition-all flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 gap-1 uppercase tracking-widest mt-2">
             Truy cập quản trị <ArrowRight size={14} />
           </div>
        </div>
      </div>
    </Link>
  )
}
