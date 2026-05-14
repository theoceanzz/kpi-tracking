import { cn, getInitials } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { ChevronRight,
  Star,
  AlertTriangle, Trophy, Medal
} from 'lucide-react'
import type { OrgUnitStats, EmployeeKpiStats } from '@/types/stats'

/* ========== STAT CARD ========== */
export function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
    red: "text-red-600 bg-red-50 dark:bg-red-900/20",
  }
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", colors[color])}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <h4 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h4>
      {sub && <p className="text-[11px] font-medium text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

/* ========== RATE CARD ========== */
export function RateCard({ label, rate, num, denom, color }: { label: string; rate: number; num: number; denom: number; color: string }) {
  const colorCfg: Record<string, { text: string; bg: string; bar: string }> = {
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30', bar: 'bg-emerald-500' },
    blue: { text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30', bar: 'bg-blue-500' },
  }
  const c = colorCfg[color] ?? colorCfg['emerald']!
  return (
    <div className={cn("p-5 rounded-[24px] border shadow-sm", c.bg)}>
      <p className="text-xs font-bold text-slate-500 mb-2">{label}</p>
      <div className="flex items-end gap-2 mb-3">
        <span className={cn("text-4xl font-black", c.text)}>{rate}</span>
        <span className={cn("text-xl font-black mb-0.5", c.text)}>%</span>
      </div>
      <div className="h-2 bg-white/60 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
        <div className={cn("h-full rounded-full transition-all duration-1000", c.bar)} style={{ width: `${rate}%` }} />
      </div>
      <p className="text-[11px] text-slate-500 font-medium">{num} / {denom}</p>
    </div>
  )
}

/* ========== DEPARTMENT RANKING CARD ========== */
export function DeptRankingCard({ units }: { units: OrgUnitStats[] }) {
  const ranked = [...units].sort((a, b) => {
    const rA = a.totalKpi > 0 ? a.approvedKpi / a.totalKpi : 0
    const rB = b.totalKpi > 0 ? b.approvedKpi / b.totalKpi : 0
    if (rB !== rA) return rB - rA
    const sA = a.totalSubmissions > 0 ? a.approvedSubmissions / a.totalSubmissions : 0
    const sB = b.totalSubmissions > 0 ? b.approvedSubmissions / b.totalSubmissions : 0
    return sB - sA
  })

  const medalColors = [
    'from-amber-400 to-yellow-500',
    'from-slate-300 to-slate-400',
    'from-orange-400 to-amber-600',
  ]

  return (
    <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Trophy size={18} className="text-amber-500" />
        <h3 className="font-black text-sm">Xếp hạng Phòng ban</h3>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {ranked.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Chưa có dữ liệu</p>
        ) : ranked.map((u, i) => {
          const kRate = u.totalKpi > 0 ? Math.round((u.approvedKpi / u.totalKpi) * 100) : 0
          const sRate = u.totalSubmissions > 0 ? Math.round((u.approvedSubmissions / u.totalSubmissions) * 100) : 0
          return (
            <div key={u.orgUnitId} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0",
                i < 3 ? `bg-gradient-to-br ${medalColors[i]} text-white shadow-md` : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                {i < 3 ? <Medal size={14} /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.orgUnitName}</p>
                <p className="text-[10px] text-slate-500">{u.memberCount} thành viên</p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <span className={cn("text-xs font-black px-2 py-0.5 rounded-md",
                  kRate >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                  kRate >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                )}>{kRate}% KPI</span>
                <p className="text-[10px] text-slate-400">Bài nộp: {sRate}%</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function EmployeeRankingTable({ employees, title, showOrgUnit, page = 0, totalPages = 1, onPageChange, totalElements }: { 
  employees: EmployeeKpiStats[]; title: string; showOrgUnit?: boolean;
  page?: number; totalPages?: number; onPageChange?: (p: number) => void;
  totalElements?: number;
}) {
  const ranked = [...employees]
    .sort((a, b) => {
      const rA = a.totalSubmissions > 0 ? a.approvedSubmissions / a.totalSubmissions : 0
      const rB = b.totalSubmissions > 0 ? b.approvedSubmissions / b.totalSubmissions : 0
      if (rB !== rA) return rB - rA
      return (b.averageScore ?? 0) - (a.averageScore ?? 0)
    })

  return (
    <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Star size={18} className="text-amber-500" />
        <h3 className="font-black text-sm">{title}</h3>
        {totalElements != null && <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">{totalElements} nhân sự</span>}
      </div>
      {ranked.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">Chưa có dữ liệu</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3 w-8">#</th>
                <th className="px-3 py-3">Nhân viên</th>
                {showOrgUnit && <th className="px-3 py-3">Đơn vị</th>}
                <th className="px-3 py-3 text-center">Hoàn thành</th>
                <th className="px-3 py-3 text-center">Duyệt</th>
                <th className="px-3 py-3 text-center">Từ chối</th>
                <th className="px-3 py-3 text-center">Điểm TB</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {ranked.map((emp, i) => {
                const rate = emp.totalSubmissions > 0 ? Math.round((emp.approvedSubmissions / emp.totalSubmissions) * 100) : 0
                return (
                  <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
                        (page === 0 && i === 0) ? "bg-amber-100 text-amber-700" : (page === 0 && i === 1) ? "bg-slate-200 text-slate-600" : (page === 0 && i === 2) ? "bg-orange-100 text-orange-700" : "text-slate-400"
                      )}>{(page * 5) + i + 1}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0">{getInitials(emp.fullName)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{emp.fullName}</p>
                          <p className="text-[10px] text-slate-500 truncate">{emp.role}</p>
                        </div>
                      </div>
                    </td>
                    {showOrgUnit && <td className="px-3 py-3 text-xs font-medium text-slate-600">{emp.orgUnitName}</td>}
                    <td className="px-3 py-3 text-center">
                      <span className={cn("text-xs font-black", rate >= 70 ? "text-emerald-600" : rate >= 40 ? "text-amber-600" : "text-red-600")}>{rate}%</span>
                    </td>
                    <td className="px-3 py-3 text-center"><span className="text-xs font-bold text-emerald-600">{emp.approvedSubmissions}</span></td>
                    <td className="px-3 py-3 text-center"><span className="text-xs font-bold text-red-600">{emp.rejectedSubmissions}</span></td>
                    <td className="px-3 py-3 text-center">
                      {emp.averageScore != null ? (
                        <span className={cn("text-xs font-black px-2 py-0.5 rounded-md",
                          emp.averageScore >= 8 ? "bg-emerald-100 text-emerald-700" : emp.averageScore >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        )}>{emp.averageScore.toFixed(1)}</span>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Link to={`/employees/${emp.userId}/performance`} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Pagination */}
      {onPageChange && totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/20">
          <span className="text-[10px] font-bold text-slate-400">Trang {page + 1}/{totalPages}</span>
          <div className="flex gap-1">
            <button 
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              Trước
            </button>
            <button 
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function NeedsImprovementSection({ employees, page = 0, totalPages = 1, onPageChange, totalElements }: { 
  employees: EmployeeKpiStats[];
  page?: number; totalPages?: number; onPageChange?: (p: number) => void;
  totalElements?: number;
}) {
  const atRisk = employees
    .filter(e => e.rejectedSubmissions > 0 || (e.assignedKpi > 0 && e.totalSubmissions === 0) || e.lateSubmissions > 0)
    .sort((a, b) => (b.rejectedSubmissions + b.lateSubmissions) - (a.rejectedSubmissions + a.lateSubmissions))

  if (atRisk.length === 0) return null

  return (
    <section className="bg-white dark:bg-slate-900 rounded-[28px] border border-red-200 dark:border-red-900/30 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-red-100 dark:border-red-900/20 bg-red-50/50 dark:bg-red-900/5 flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-500" />
        <h3 className="font-black text-sm text-red-700 dark:text-red-400">Nhân viên cần cải thiện</h3>
        <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-md bg-red-100 text-red-600">{totalElements ?? atRisk.length} người</span>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-800">
        {atRisk.map(emp => {
          const issues: string[] = []
          if (emp.assignedKpi > 0 && emp.totalSubmissions === 0) issues.push('Chưa nộp bài')
          if (emp.rejectedSubmissions > 0) issues.push(`${emp.rejectedSubmissions} bài bị từ chối`)
          if (emp.lateSubmissions > 0) issues.push(`${emp.lateSubmissions} bài nộp trễ`)

          return (
            <div key={emp.userId} className="px-5 py-4 flex items-start gap-3 hover:bg-red-50/30 dark:hover:bg-red-900/5 transition-colors">
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-[10px] font-black text-red-600 shrink-0">{getInitials(emp.fullName)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{emp.fullName}</p>
                  <span className="text-[10px] font-medium text-slate-500">• {emp.orgUnitName}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {issues.map((issue, idx) => (
                    <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">{issue}</span>
                  ))}
                </div>
                {emp.assignedKpi > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[200px]">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.round((emp.approvedSubmissions / Math.max(1, emp.assignedKpi)) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{emp.approvedSubmissions}/{emp.assignedKpi} KPI</span>
                  </div>
                )}
              </div>
              <Link to={`/employees/${emp.userId}/performance`} className="p-2 rounded-xl hover:bg-red-100 text-red-400 hover:text-red-600 transition-all shrink-0">
                <ChevronRight size={16} />
              </Link>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {onPageChange && totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-red-50/20 dark:bg-red-900/5">
          <span className="text-[10px] font-bold text-red-400">Trang {page + 1}/{totalPages}</span>
          <div className="flex gap-1">
            <button 
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-[10px] font-bold text-red-600 disabled:opacity-30 hover:bg-red-50 transition-all"
            >
              Trước
            </button>
            <button 
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-[10px] font-bold text-red-600 disabled:opacity-30 hover:bg-red-50 transition-all"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/* ========== STATUS BADGES ========== */
export function KpiStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    PENDING_APPROVAL: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    APPROVED: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    REJECTED: { label: 'Từ chối', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  const c = cfg[status] ?? cfg['DRAFT']!
  return <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shrink-0", c.cls)}>{c.label}</span>
}

export function SubmissionStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Nháp', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    APPROVED: { label: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    REJECTED: { label: 'Từ chối', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }
  const c = cfg[status] ?? cfg['DRAFT']!
  return <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shrink-0", c.cls)}>{c.label}</span>
}

/* ========== MINI STAT BOX ========== */
export function MiniStatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("p-3 rounded-2xl text-center", highlight ? "bg-amber-50 dark:bg-amber-900/10" : "bg-slate-50 dark:bg-slate-800/50")}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className={cn("text-lg font-black", highlight ? "text-amber-600" : "text-slate-900 dark:text-white")}>{value}</p>
    </div>
  )
}

/* ========== EMPTY MESSAGE ========== */
export function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-dashed border-slate-300 dark:border-slate-700 p-16 text-center">
      <p className="font-bold text-slate-500">{text}</p>
    </div>
  )
}
