import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import SubmissionStatusChart from '@/components/charts/SubmissionStatusChart'
import { useOverviewStats } from '../hooks/useOverviewStats'
import { useAuthStore } from '@/store/authStore'
import { getInitials } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Target, FileText, CheckCircle, Clock, XCircle,
  Users, Star, ChevronRight, TrendingUp,
  ClipboardCheck, BarChart3, Award, ArrowUpRight
} from 'lucide-react'

export default function HeadDashboard() {
  const { data: stats, isLoading } = useOverviewStats()
  const { user } = useAuthStore()

  if (isLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  const totalSub = stats?.totalSubmissions ?? 0
  const pendingSub = stats?.pendingSubmissions ?? 0
  const approvedSub = stats?.approvedSubmissions ?? 0
  const rejectedSub = stats?.rejectedSubmissions ?? 0
  const approvalRate = totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* ===== HEADER ===== */}
      <div className="relative rounded-[28px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgMHYyaC0ydi0yaDJ6bTQgMGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative z-10 px-8 py-10 md:px-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-black text-white border border-white/20">
                {getInitials(user?.fullName ?? '')}
              </div>
              <div className="text-white">
                <p className="text-white/70 text-sm font-medium">Xin chào,</p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">{user?.fullName}</h1>
                <p className="text-white/60 text-sm font-medium mt-1">Quản lý hiệu suất phòng ban hôm nay</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/submissions/org-unit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white text-sm font-bold hover:bg-white/25 transition-all border border-white/10">
                <ClipboardCheck size={16} /> Duyệt bài nộp
              </Link>
              <Link to="/kpi-criteria" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold hover:bg-white/90 transition-all shadow-lg">
                <Target size={16} /> Quản lý KPI
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          label="Chỉ tiêu KPI"
          value={stats?.totalKpiCriteria ?? 0}
          sub={`${stats?.approvedKpi ?? 0} đã duyệt`}
          icon={Target}
          color="purple"
          link="/kpi-criteria"
        />
        <StatCard
          label="Chờ duyệt"
          value={pendingSub}
          sub="bài nộp"
          icon={Clock}
          color="amber"
          link="/submissions/org-unit"
          pulse={pendingSub > 0}
        />
        <StatCard
          label="Đã duyệt"
          value={approvedSub}
          sub={`${approvalRate}% tỷ lệ`}
          icon={CheckCircle}
          color="emerald"
          link="/submissions/org-unit"
        />
        <StatCard
          label="Tổng đánh giá"
          value={stats?.totalEvaluations ?? 0}
          sub="lượt đánh giá"
          icon={Star}
          color="blue"
          link="/evaluations"
        />
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: Charts & Activity */}
        <div className="lg:col-span-8 space-y-6">

          {/* Submission Status Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">Tổng quan Bài nộp</h3>
                  <p className="text-xs font-medium text-slate-500">Phân bổ trạng thái bài nộp trong phòng ban</p>
                </div>
              </div>
              <Link to="/submissions/org-unit" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                Xem tất cả <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Chart */}
                <div>
                  <SubmissionStatusChart pending={pendingSub} approved={approvedSub} rejected={rejectedSub} />
                </div>
                {/* Progress Bars */}
                <div className="space-y-5">
                  <ProgressBar label="Đã phê duyệt" value={approvedSub} total={totalSub} color="bg-emerald-500" textColor="text-emerald-600" />
                  <ProgressBar label="Đang chờ duyệt" value={pendingSub} total={totalSub} color="bg-amber-500" textColor="text-amber-600" />
                  <ProgressBar label="Bị từ chối" value={rejectedSub} total={totalSub} color="bg-red-500" textColor="text-red-600" />
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-slate-500">Tổng cộng</span>
                      <span className="text-slate-900 dark:text-white text-lg">{totalSub}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiStatusCard
              label="KPI Đã duyệt"
              value={stats?.approvedKpi ?? 0}
              total={stats?.totalKpiCriteria ?? 0}
              icon={CheckCircle}
              color="emerald"
            />
            <KpiStatusCard
              label="KPI Chờ duyệt"
              value={stats?.pendingKpi ?? 0}
              total={stats?.totalKpiCriteria ?? 0}
              icon={Clock}
              color="amber"
            />
            <KpiStatusCard
              label="Bị từ chối"
              value={stats?.rejectedKpi ?? 0}
              total={stats?.totalKpiCriteria ?? 0}
              icon={XCircle}
              color="red"
            />
          </div>
        </div>

        {/* RIGHT: Actions & Info */}
        <div className="lg:col-span-4 space-y-6">

          {/* Pending Alert */}
          {pendingSub > 0 && (
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-[28px] p-7 text-white shadow-xl shadow-amber-500/20">
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-white/80 text-sm font-medium">Cần xử lý ngay</p>
                  <p className="text-4xl font-black">{pendingSub}</p>
                  <p className="text-white/80 text-sm font-medium">bài nộp đang chờ duyệt</p>
                </div>
                <Link
                  to="/submissions/org-unit"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-white text-amber-700 rounded-2xl font-black text-sm hover:bg-white/90 transition-all shadow-lg"
                >
                  Duyệt ngay <ChevronRight size={16} />
                </Link>
              </div>
              <FileText size={140} className="absolute -bottom-10 -right-10 opacity-[0.08]" />
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Thao tác nhanh</h3>

            <QuickAction
              to="/kpi-criteria"
              icon={Target}
              iconColor="text-purple-500"
              iconBg="bg-purple-50 dark:bg-purple-900/20"
              title="Quản lý Chỉ tiêu KPI"
              description="Tạo, sửa, gửi duyệt chỉ tiêu"
            />
            <QuickAction
              to="/kpi-criteria/pending"
              icon={ClipboardCheck}
              iconColor="text-indigo-500"
              iconBg="bg-indigo-50 dark:bg-indigo-900/20"
              title="Duyệt Chỉ tiêu"
              description="Xét duyệt KPI chờ phê duyệt"
            />
            <QuickAction
              to="/submissions/org-unit"
              icon={FileText}
              iconColor="text-amber-500"
              iconBg="bg-amber-50 dark:bg-amber-900/20"
              title="Duyệt Bài nộp"
              description="Xem và xử lý bài nộp nhân viên"
            />
            <QuickAction
              to="/evaluations"
              icon={Award}
              iconColor="text-blue-500"
              iconBg="bg-blue-50 dark:bg-blue-900/20"
              title="Đánh giá Nhân viên"
              description="Xem và phản hồi đánh giá hiệu suất"
            />
          </div>

          {/* Team Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng quan nhân sự</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/50 dark:border-indigo-900/30 text-center">
                <Users size={20} className="text-indigo-500 mx-auto mb-2" />
                <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{stats?.totalUsers ?? 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500/60">Nhân sự</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-900/30 text-center">
                <TrendingUp size={20} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{approvalRate}%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">Tỷ lệ duyệt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========== Sub Components ========== */

function StatCard({ label, value, sub, icon: Icon, color, link, pulse }: {
  label: string; value: number; sub: string; icon: any; color: string; link: string; pulse?: boolean
}) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400', border: 'hover:border-purple-300 dark:hover:border-purple-800' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', border: 'hover:border-amber-300 dark:hover:border-amber-800' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', border: 'hover:border-emerald-300 dark:hover:border-emerald-800' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400', border: 'hover:border-blue-300 dark:hover:border-blue-800' },
  }
  const c = colorMap[color] ?? colorMap['purple']!

  return (
    <Link
      to={link}
      className={cn("bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 transition-all hover:shadow-lg group", c.border)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", c.bg)}>
          <Icon size={22} className={c.icon} />
        </div>
        {pulse && <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-lg shadow-amber-500/50" />}
      </div>
      <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{value}</p>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{sub}</p>
      <p className="text-[10px] font-bold text-slate-400 mt-2">{label}</p>
    </Link>
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
        <span className={textColor}>{value} <span className="text-slate-300">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function KpiStatusCard({ label, value, total, icon: Icon, color }: {
  label: string; value: number; total: number; icon: any; color: string
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
    amber: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
    red: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
  }
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className={cn("p-5 rounded-2xl border", colorMap[color])}>
      <div className="flex items-center justify-between mb-3">
        <Icon size={20} />
        <span className="text-xs font-black">{pct}%</span>
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">{label}</p>
    </div>
  )
}

function QuickAction({ to, icon: Icon, iconColor, iconBg, title, description }: {
  to: string; icon: any; iconColor: string; iconBg: string; title: string; description: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform", iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
    </Link>
  )
}
