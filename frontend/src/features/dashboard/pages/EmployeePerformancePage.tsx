import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { useEmployeeProgress } from '../hooks/useEmployeeProgress'
import { useUsers } from '@/features/users/hooks/useUsers'
import { formatDateTime, getInitials, cn } from '@/lib/utils'
import { 
  Target, Clock, CheckCircle, FileText, 
  ChevronLeft, ChevronRight, TrendingUp, AlertCircle
} from 'lucide-react'
import type { KpiTask } from '@/types/stats'

export default function EmployeePerformancePage() {
  const { userId } = useParams<{ userId: string }>()
  const [page, setPage] = useState(0)
  const size = 10

  const { data: progress, isLoading: progressLoading } = useEmployeeProgress(userId!, page, size)
  
  // Also fetch user details to show name
  const { data: usersData } = useUsers({ page: 0, size: 500 })
  const employee = usersData?.content.find(u => u.id === userId)

  if (progressLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  const tasksData = progress?.tasks
  const tasks = tasksData?.content ?? []
  const totalPages = tasksData?.totalPages ?? 0

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ChevronLeft size={24} />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg">
              {getInitials(employee?.fullName ?? 'U')}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Hiệu suất: {employee?.fullName ?? 'Nhân viên'}</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{employee?.email}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <StatMini label="Đã duyệt" value={progress?.approvedSubmissions ?? 0} color="emerald" />
          <StatMini label="Quá hạn" value={progress?.lateSubmissions ?? 0} color="rose" />
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          label="Tổng KPI giao" 
          value={progress?.totalAssignedKpi ?? 0} 
          icon={Target} 
          color="indigo" 
        />
        <MetricCard 
          label="Tỷ lệ hoàn thành" 
          value={`${progress?.totalAssignedKpi ? Math.round(((progress?.approvedSubmissions ?? 0) / progress.totalAssignedKpi) * 100) : 0}%`} 
          icon={TrendingUp} 
          color="emerald" 
        />
        <MetricCard 
          label="Điểm trung bình" 
          value={progress?.averageScore ? Number(progress.averageScore).toFixed(1) : '—'} 
          icon={CheckCircle} 
          color="blue" 
        />
      </div>

      {/* Task List - The "Core" request: What is submitted/not submitted */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={22} className="text-indigo-500" /> Tình trạng thực hiện KPI
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Chi tiết từng chỉ tiêu được giao</p>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest">
            {tasksData?.totalElements ?? 0} Chỉ tiêu
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {tasks.length === 0 ? (
            <div className="p-20 text-center opacity-60">
              <Target size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="font-bold text-slate-500">Nhân viên này chưa được giao KPI nào</p>
            </div>
          ) : (
            tasks.map((task: KpiTask) => (
              <div key={task.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border",
                    task.status === 'OVERDUE' ? "bg-red-50 border-red-100 text-red-500" :
                    task.status === 'APPROVED' ? "bg-emerald-50 border-emerald-100 text-emerald-500" :
                    task.status === 'PENDING' ? "bg-amber-50 border-amber-100 text-amber-500" :
                    "bg-blue-50 border-blue-100 text-blue-500"
                  )}>
                    {task.status === 'OVERDUE' ? <AlertCircle size={24} /> :
                     task.status === 'APPROVED' ? <CheckCircle size={24} /> :
                     task.status === 'PENDING' ? <Clock size={24} /> :
                     <Target size={24} />}
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900 dark:text-white">{task.name}</p>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                         Chu kỳ: <span className="text-slate-600 dark:text-slate-300">{task.periodName}</span>
                      </span>
                      {task.deadline && (
                        <span className={cn(
                          "text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5",
                          task.status === 'OVERDUE' ? "text-red-500" : "text-slate-400"
                        )}>
                          {task.expectedSubmissions > 1 && task.submissionCount < task.expectedSubmissions ? `Hạn lần ${task.submissionCount + 1}: ` : 'Hạn cuối: '}
                          <span className={task.status === 'OVERDUE' ? "text-red-600 font-black" : "text-slate-600 dark:text-slate-300"}>
                            {formatDateTime(task.deadline).split(' ')[0]}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Trạng thái</p>
                     <StatusBadge status={task.status} />
                  </div>
                  <div className="sm:hidden">
                    <StatusBadge status={task.status} />
                  </div>
                  <Link 
                    to={`/submissions/org-unit?userId=${userId}`}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-200 dark:border-slate-700"
                  >
                    <ChevronRight size={20} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 flex items-center justify-between">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Trang {page + 1} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatMini({ label, value, color }: { label: string; value: number; color: 'emerald' | 'rose' }) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100"
  }
  return (
    <div className={cn("px-4 py-2 rounded-2xl border flex items-center gap-3", styles[color])}>
      <span className="text-lg font-black">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: 'indigo' | 'emerald' | 'blue' }) {
  const styles = {
    indigo: "from-indigo-600 to-blue-600 shadow-indigo-500/20",
    emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
    blue: "from-blue-500 to-sky-600 shadow-blue-500/20"
  }
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 border border-slate-200 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all duration-500">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 bg-gradient-to-br shadow-lg", styles[color])}>
        <Icon size={24} />
      </div>
      <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    </div>
  )
}
