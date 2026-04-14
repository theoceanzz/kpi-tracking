import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { useMyKpiProgress } from '../hooks/useMyKpiProgress'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import { useAuthStore } from '@/store/authStore'
import { Link } from 'react-router-dom'
import { getInitials, formatDateTime, formatNumber, cn } from '@/lib/utils'
import {
  Target, FileText, CheckCircle, XCircle, Clock, Plus,
  TrendingUp, Award, ArrowUpRight, Flame, BarChart3, ListChecks
} from 'lucide-react'

export default function StaffDashboard() {
  const { data: progress, isLoading: progressLoading } = useMyKpiProgress()
  const { data: submissions, isLoading: subLoading } = useMySubmissions(0, 5)
  const { user } = useAuthStore()

  if (progressLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  const totalAssigned = progress?.totalAssignedKpi ?? 0
  const totalSub = progress?.totalSubmissions ?? 0
  const approvedSub = progress?.approvedSubmissions ?? 0
  const pendingSub = progress?.pendingSubmissions ?? 0
  const rejectedSub = progress?.rejectedSubmissions ?? 0
  const avgScore = progress?.averageScore != null ? Number(progress.averageScore).toFixed(1) : '—'

  // Calculate approval rate
  const approvalRate = totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* ===== HERO BANNER ===== */}
      <div className="relative rounded-[32px] overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgMHYyaC0ydi0yaDJ6bTQgMGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30 mix-blend-overlay" />
        
        <div className="relative z-10 px-8 py-10 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black text-white border border-white/30 shadow-inner">
                {getInitials(user?.fullName ?? '')}
              </div>
              <div className="text-white">
                <p className="text-white/80 text-sm font-semibold uppercase tracking-wider">Không gian làm việc</p>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-1">Xin chào, {user?.fullName?.split(' ').pop()}!</h1>
                <p className="text-white/70 text-sm font-medium mt-1.5 flex items-center gap-2">
                  <Flame size={16} className="text-amber-400" /> Tiếp tục duy trì phong độ làm việc xuất sắc nhé!
                </p>
              </div>
            </div>
            
            <Link 
              to="/submissions/new" 
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-indigo-700 text-sm font-black hover:bg-white/90 hover:scale-[1.02] transition-all shadow-xl hover:shadow-2xl hover:shadow-white/20 shrink-0"
            >
              <Plus size={18} /> Nộp Báo cáo KPI
            </Link>
          </div>
        </div>
      </div>

      {/* ===== OVERVIEW GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column - Stats */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              label="KPI Được giao" 
              value={totalAssigned} 
              icon={Target} 
              color="indigo" 
            />
            <StatCard 
              label="Tổng Bài nộp" 
              value={totalSub} 
              icon={FileText} 
              color="blue" 
            />
            <StatCard 
              label="Tỷ lệ Duyệt" 
              value={`${approvalRate}%`} 
              icon={TrendingUp} 
              color="emerald" 
            />
            <StatCard 
              label="Bị Từ chối" 
              value={rejectedSub} 
              icon={XCircle} 
              color="red" 
            />
          </div>

          {/* Progress Details */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-6 w-full">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 size={20} className="text-indigo-500" /> Trạng thái Bài nộp
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">Phân bổ kết quả các báo cáo bạn đã nộp</p>
                </div>
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600"><CheckCircle size={14} /></div>
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600"><Clock size={14} /></div>
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600"><XCircle size={14} /></div>
                </div>
              </div>
              
              <div className="space-y-4">
                <ProgressBar label="Đã phê duyệt" value={approvedSub} total={totalSub} color="bg-emerald-500" textColor="text-emerald-700 dark:text-emerald-400" />
                <ProgressBar label="Đang chờ duyệt" value={pendingSub} total={totalSub} color="bg-amber-500" textColor="text-amber-700 dark:text-amber-400" />
              </div>
            </div>

            {/* Score Highlight */}
            <div className="w-full md:w-48 bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 text-center border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center shrink-0">
              <Award size={28} className="text-amber-500 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Điểm Đánh giá TB</p>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-4xl font-black text-slate-900 dark:text-white">{avgScore}</span>
                <span className="text-sm font-bold text-slate-500">/100</span>
              </div>
              <Link to="/evaluations" className="text-[10px] font-bold text-indigo-600 hover:underline mt-3">Xem chi tiết &rarr;</Link>
            </div>
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/10">
              <div className="flex items-center gap-2">
                <ListChecks size={18} className="text-blue-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">Giao dịch gần đây</h3>
              </div>
              <Link to="/submissions" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center">
                Lịch sử <ArrowUpRight size={14} />
              </Link>
            </div>
            
            <div className="p-2 flex-1">
              {subLoading ? (
                <div className="p-4"><LoadingSkeleton type="table" rows={4} /></div>
              ) : !submissions || submissions.content.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-60">
                  <FileText size={48} className="text-slate-300 mb-4" />
                  <p className="text-sm font-bold text-slate-500">Chưa có bài nộp nào</p>
                  <p className="text-xs text-slate-400 mt-1">Các bài nộp KPI của bạn sẽ hiển thị tại đây.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {submissions.content.map((s) => (
                    <Link 
                      key={s.id} 
                      to={`/submissions/${s.id}`} 
                      className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-indigo-600 transition-colors">
                          {s.kpiCriteriaName}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
                          <span>{formatDateTime(s.createdAt).split(' ')[0]}</span>
                          <span>•</span>
                          <span className="truncate">Thực tế: {formatNumber(s.actualValue)}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={s.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            
            {!subLoading && submissions && submissions.content.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                <Link to="/submissions" className="block w-full py-2.5 text-center text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors">
                  Xem toàn bộ danh sách
                </Link>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  )
}

/* ========== Sub Components ========== */

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: any; color: string
}) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', icon: 'text-indigo-600 dark:text-indigo-400' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400' },
  }
  const c = colorMap[color] ?? colorMap['indigo']!

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-5 transition-all hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 group">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", c.bg)}>
        <Icon size={18} className={c.icon} />
      </div>
      <p className="text-2xl font-black text-slate-900 dark:text-white mb-1">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
    </div>
  )
}

function ProgressBar({ label, value, total, color, textColor }: {
  label: string; value: number; total: number; color: string; textColor: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-slate-500">{label}</span>
        <span className={textColor}>{value} <span className="text-slate-400 dark:text-slate-500 opacity-70">({pct}%)</span></span>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
