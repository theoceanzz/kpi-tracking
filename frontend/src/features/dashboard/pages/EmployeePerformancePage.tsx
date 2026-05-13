import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { useEmployeeProgress } from '../hooks/useEmployeeProgress'
import { useUsers } from '@/features/users/hooks/useUsers'
import { formatDateTime, getInitials, cn } from '@/lib/utils'
import {
  Target, Clock, CheckCircle, Sparkles,
  ChevronLeft, ChevronRight, TrendingUp, AlertCircle, Bell, Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import { reminderApi } from '../api/reminderApi'
import type { KpiTask } from '@/types/stats'

export default function EmployeePerformancePage() {
  const { userId } = useParams<{ userId: string }>()
  const [page, setPage] = useState(0)
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [remindingAll, setRemindingAll] = useState(false)
  const size = 10

  const { data: progress, isLoading: progressLoading } = useEmployeeProgress(userId!, page, size)
  
  // Also fetch user details to show name
  const { data: usersData } = useUsers({ page: 0, size: 500 })
  const employee = usersData?.content.find(u => u.id === userId)

  if (progressLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  const tasksData = progress?.tasks
  const tasks = tasksData?.content ?? []
  const totalPages = tasksData?.totalPages ?? 0

  const handleRemind = async (taskId: string) => {
    if (!userId) return
    setRemindingId(taskId)
    try {
      await reminderApi.sendReminder(taskId, userId)
      toast.success('Đã gửi thông báo nhắc nhở nộp KPI')
    } catch (error) {
      toast.error('Gửi nhắc nhở thất bại')
    } finally {
      setRemindingId(null)
    }
  }

  const handleRemindAll = async () => {
    const unfinishedTasks = tasks.filter(t => t.status !== 'APPROVED' && t.status !== 'PENDING' && t.status !== 'REJECTED')
    if (unfinishedTasks.length === 0) {
      toast.info('Không có nhiệm vụ nào cần nhắc nhở')
      return
    }

    setRemindingAll(true)
    try {
      await Promise.all(unfinishedTasks.map(t => reminderApi.sendReminder(t.id, userId!)))
      toast.success(`Đã gửi nhắc nhở cho ${unfinishedTasks.length} nhiệm vụ`)
    } catch (error) {
      toast.error('Gửi nhắc nhở hàng loạt thất bại')
    } finally {
      setRemindingAll(false)
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-10 animate-in fade-in duration-700">
      
      {/* Premium Header */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[32px] blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
        <div className="relative flex flex-col lg:flex-row justify-between items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl"></div>
          
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Link 
              to="/dashboard"
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-200 dark:border-slate-700 active:scale-90"
            >
              <ChevronLeft size={24} />
            </Link>
            
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-indigo-500/20">
                  {getInitials(employee?.fullName ?? 'U')}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-900 shadow-sm" />
              </div>
              
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em]">
                  Personnel Insight
                </div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
                  {employee?.fullName}
                </h1>
                <p className="text-slate-500 font-bold text-[11px] uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                  <TrendingUp size={12} className="text-indigo-500" /> {employee?.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <StatMini label="Đã duyệt" value={progress?.approvedSubmissions ?? 0} color="emerald" />
            <StatMini label="Quá hạn" value={progress?.lateSubmissions ?? 0} color="rose" />
          </div>
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

      {/* Task List Header */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles size={22} className="text-indigo-500" /> Tình trạng thực hiện KPI
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Chi tiết từng chỉ tiêu được giao</p>
          </div>
          <div className="flex items-center gap-3">
             {tasks.some(t => t.status !== 'APPROVED' && t.status !== 'PENDING' && t.status !== 'REJECTED') && (
               <button 
                  onClick={handleRemindAll}
                  disabled={remindingAll}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                    remindingAll
                      ? "bg-slate-100 border-slate-200 text-slate-400"
                      : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 active:scale-95"
                  )}
               >
                  <Bell size={14} className={cn(remindingAll && "animate-pulse")} />
                  Nhắc nhở tất cả
               </button>
             )}
             <div className="px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest shadow-inner">
               {tasksData?.totalElements ?? 0} Chỉ tiêu
             </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {tasks.length === 0 ? (
            <div className="p-20 text-center opacity-60">
              <Target size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="font-bold text-slate-500">Nhân viên này chưa được giao KPI nào</p>
            </div>
          ) : (
            tasks.map((task: KpiTask, idx: number) => {
              const progressPercent = task.expectedSubmissions > 0 
                ? Math.min(Math.round((task.submissionCount / task.expectedSubmissions) * 100), 100) 
                : 0;

              return (
                <div 
                  key={task.id} 
                  className="p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-8 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group animate-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div className={cn(
                      "w-16 h-16 rounded-[24px] flex items-center justify-center shrink-0 shadow-sm border transition-transform group-hover:scale-105",
                      task.status === 'OVERDUE' ? "bg-red-50 border-red-100 text-red-500" :
                      task.status === 'APPROVED' ? "bg-emerald-50 border-emerald-100 text-emerald-500" :
                      task.status === 'PENDING' ? "bg-amber-50 border-amber-100 text-amber-500" :
                      "bg-indigo-50 border-indigo-100 text-indigo-500"
                    )}>
                      {task.status === 'OVERDUE' ? <AlertCircle size={32} /> :
                       task.status === 'APPROVED' ? <CheckCircle size={32} /> :
                       task.status === 'PENDING' ? <Clock size={32} /> :
                       <Target size={32} />}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                          {task.name}
                        </p>
                        <StatusBadge status={task.status} />
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Chu kỳ</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{task.periodName}</span>
                        </div>
                        
                        <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 hidden md:block" />

                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Thời hạn</span>
                          <span className={cn(
                            "text-xs font-bold flex items-center gap-1.5",
                            task.status === 'OVERDUE' ? "text-red-500" : "text-slate-600 dark:text-slate-400"
                          )}>
                            <Calendar size={12} /> {task.deadline ? formatDateTime(task.deadline).split(' ')[0] : 'Không có'}
                          </span>
                        </div>

                        <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 hidden md:block" />

                        <div className="flex-1 min-w-[200px] space-y-1.5">
                          <div className="flex justify-between items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiến độ nộp bài</span>
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{task.submissionCount}/{task.expectedSubmissions}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                             <div 
                                className={cn(
                                  "h-full transition-all duration-1000 ease-out rounded-full",
                                  task.status === 'OVERDUE' ? "bg-red-500" : 
                                  progressPercent >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                                )}
                                style={{ width: `${progressPercent}%` }}
                             />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {task.status !== 'APPROVED' && task.status !== 'PENDING' && task.status !== 'REJECTED' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemind(task.id) }}
                        disabled={remindingId === task.id}
                        className={cn(
                          "flex items-center gap-2 px-5 py-3 rounded-2xl transition-all border shadow-sm",
                          remindingId === task.id 
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 border-amber-200 active:scale-95"
                        )}
                      >
                        <Bell size={18} className={cn(remindingId === task.id && "animate-pulse")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Nhắc nhở</span>
                      </button>
                    )}

                  </div>
                </div>
              );
            })
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
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
    rose: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30"
  }
  return (
    <div className={cn("px-5 py-2.5 rounded-2xl border flex items-center gap-3 shadow-sm", styles[color])}>
      <span className="text-xl font-black">{value}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</span>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: 'indigo' | 'emerald' | 'blue' }) {
  const styles = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-indigo-100 dark:border-indigo-900/20",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border-emerald-100 dark:border-emerald-900/20",
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-100 dark:border-blue-900/20"
  }
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-200 dark:border-slate-800 shadow-sm group hover:shadow-xl transition-all duration-500 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-slate-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-inner border transition-transform group-hover:rotate-6", styles[color])}>
        <Icon size={22} />
      </div>
      <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</p>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 leading-none">{label}</p>
    </div>
  )
}
