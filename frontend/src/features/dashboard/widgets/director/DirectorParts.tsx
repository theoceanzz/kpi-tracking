import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Users, Building2, ChevronRight, Search, ChevronLeft, ArrowUpRight,
  Award, Copy, Check, Mail, Clock, FileText,
} from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, getInitials, abbreviateOrgUnitName } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions } from '@/lib/scoring'
import type { OrgUnitStats, EmployeeKpiStats } from '@/types/stats'
import KpiReminderModal, { type ReminderRecipient } from '../../components/KpiReminderModal'

/**
 * Các khối giao diện gốc của dashboard giám đốc, tách nguyên vẹn khỏi DirectorDashboard.tsx
 * để dùng lại được trong lưới widget tuỳ chỉnh. Hành vi giữ y như trước khi tách.
 */

export function PremiumStatCard({ icon, label, labelNote, value, sub, footer, footerTitle, color, trend, progress, hint, to }: any) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500/20 to-indigo-600/20 text-indigo-600 dark:text-indigo-400",
    emerald: "from-emerald-500/20 to-emerald-600/20 text-emerald-600 dark:text-emerald-400",
    blue: "from-blue-500/20 to-blue-600/20 text-blue-600 dark:text-blue-400",
    amber: "from-amber-500/20 to-amber-600/20 text-amber-600 dark:text-amber-400",
    purple: "from-purple-500/20 to-purple-600/20 text-purple-600 dark:text-purple-400",
  }

  const iconColors: Record<string, string> = {
    indigo: "bg-indigo-500 shadow-indigo-500/40",
    emerald: "bg-emerald-500 shadow-emerald-500/40",
    blue: "bg-blue-500 shadow-blue-500/40",
    amber: "bg-amber-500 shadow-amber-500/40",
    purple: "bg-purple-500 shadow-purple-500/40",
  }

  const Wrapper: any = to ? Link : 'div'
  const wrapperProps = to ? { to } : {}

  return (
    <Wrapper {...wrapperProps} title={hint} className="group relative h-full block">
       <div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-[24px] md:rounded-[28px] border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden h-full flex flex-col gap-3">
          <div className={cn("absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br opacity-10 rounded-full transition-all duration-700 group-hover:scale-150 group-hover:opacity-20", colors[color])}></div>

          {/* Hàng đầu: icon + nhãn nằm cùng dòng để thẻ thấp lại và các số liệu thẳng hàng nhau */}
          <div className="flex items-center gap-2.5 relative z-10 min-w-0">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white bg-gradient-to-br shadow-lg transition-transform duration-500 group-hover:rotate-6", iconColors[color])}>
              {icon}
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] leading-tight text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors min-w-0" title={label}>
              {label}
            </p>
          </div>

          <div className="relative z-10 min-w-0 space-y-1">
             <div className="flex items-baseline gap-2 min-w-0">
                <h4 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white transition-all duration-500 group-hover:tracking-normal shrink-0">{value}</h4>
                {labelNote && (
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate" title={labelNote}>
                    {labelNote}
                  </span>
                )}
                {trend && (
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                    {trend}
                  </span>
                )}
             </div>
             {sub && <p className="text-[11px] md:text-xs font-bold text-slate-500 truncate" title={sub}>{sub}</p>}
          </div>

          {progress != null && (
            <div className="hidden md:block mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5 w-full relative z-10">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Tiến độ</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-[1500ms] ease-out shadow-[0_0_8px_rgba(99,102,241,0.4)]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {footer && (
            <div
              className="mt-auto pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] md:text-xs font-bold text-slate-500 relative z-10 min-w-0"
              title={footerTitle || footer}
            >
              <Clock size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">{footer}</span>
            </div>
          )}
       </div>
    </Wrapper>
  )
}

export function PremiumRankingTable({
  employees, onSelectUser
}: {
  employees: EmployeeKpiStats[],
  onSelectUser: (id: string, name: string) => void,
}) {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreLabel, getScoreColor, maxScore } = getScoringFunctions(org)

  const getPerformanceInfo = (score: number) => {
    return { color: getScoreColor(score), label: getScoreLabel(score) }
  }

  const sorted = [...employees].sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)).slice(0, 5)
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
           <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
             <Award size={16} />
           </div>
           TOP HIỆU SUẤT
        </h3>
        <div className="flex -space-x-2">
          {sorted.slice(0, 3).map((emp, i) => (
            <UserAvatar
              key={i}
              fullName={emp.fullName}
              avatarUrl={emp.avatarUrl}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900"
              fallbackClassName="bg-slate-200 dark:bg-slate-800 text-[10px] font-black"
            />
          ))}
        </div>
      </div>
      <div className="hidden md:block overflow-x-auto lg:overflow-x-hidden scrollbar-hide custom-scrollbar">
        <table className="w-full min-w-[800px] lg:min-w-full">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 dark:border-slate-800/50">
              <th className="px-10 py-6">Nhân viên</th>
              <th className="px-6 py-6 text-center">Hoàn thành</th>
              <th className="px-6 py-6 text-center">KPI Duyệt</th>
              <th className="px-10 py-6 text-right">Điểm TB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {sorted.map((emp, index) => (
              <tr
                key={emp.userId}
                onClick={() => onSelectUser(emp.userId, emp.fullName)}
                title="Nhấn để xem chi tiết bài nộp"
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all group cursor-pointer"
              >
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <UserAvatar
                        fullName={emp.fullName}
                        avatarUrl={emp.avatarUrl}
                        className="w-12 h-12 rounded-2xl group-hover:scale-110 transition-transform"
                        fallbackClassName="bg-indigo-100 dark:bg-indigo-900/40 font-black text-sm text-indigo-600"
                      />
                      {index < 3 && (
                        <div className={cn(
                          "absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white dark:border-slate-900 shadow-sm",
                          index === 0 ? "bg-amber-400 text-white" : index === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-400 text-white"
                        )}>
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{emp.fullName}</p>
                      <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5" title={emp.orgUnitName}>
                        <Building2 size={10} className="shrink-0" /> <span className="truncate">{abbreviateOrgUnitName(emp.orgUnitName, 24)}</span>
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                       <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                      {Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6 text-center">
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-100/50 dark:border-indigo-500/20">
                    {emp.approvedSubmissions}/{emp.assignedKpi}
                  </span>
                </td>
                <td className="px-10 py-6 text-right">
                   <div className="flex flex-col items-end">
                     <span className={cn("text-2xl font-black tracking-tighter", getPerformanceInfo(emp.averageScore ?? 0).color)}>
                       {(emp.averageScore ?? 0).toFixed(1)}
                     </span>
                     <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">
                        {getPerformanceInfo(emp.averageScore ?? 0).label} • Hệ số {maxScore}
                     </span>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
        {sorted.map((emp, index) => (
          <div
            key={emp.userId}
            onClick={() => onSelectUser(emp.userId, emp.fullName)}
            className="p-5 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/50 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <UserAvatar
                    fullName={emp.fullName}
                    avatarUrl={emp.avatarUrl}
                    className="w-11 h-11 rounded-2xl"
                    fallbackClassName="bg-indigo-100 dark:bg-indigo-900/40 font-black text-sm text-indigo-600"
                  />
                  {index < 3 && (
                    <div className={cn(
                      "absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white dark:border-slate-900 shadow-sm",
                      index === 0 ? "bg-amber-400 text-white" : index === 1 ? "bg-slate-300 text-slate-700" : "bg-orange-400 text-white"
                    )}>
                      {index + 1}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-snug break-words">{emp.fullName}</p>
                  <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5" title={emp.orgUnitName}>
                    <Building2 size={10} className="shrink-0" /> <span className="truncate">{abbreviateOrgUnitName(emp.orgUnitName)}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className={cn("text-xl font-black tracking-tighter", getPerformanceInfo(emp.averageScore ?? 0).color)}>
                  {(emp.averageScore ?? 0).toFixed(1)}
                </span>
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                  {getPerformanceInfo(emp.averageScore ?? 0).label}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500" style={{ width: `${Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%` }} />
                </div>
                <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 shrink-0">
                  {Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%
                </span>
              </div>
              <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-100/50 dark:border-indigo-500/20 shrink-0">
                {emp.approvedSubmissions}/{emp.assignedKpi}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrgUnitsGrid({ units, averageScores }: { units: OrgUnitStats[], averageScores: Record<string, number> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
       {units.map((unit) => {
         const unitName = (unit.orgUnitName || 'Chưa gán').trim()
         const avgScore = averageScores[unitName]
         const kRate = (avgScore !== undefined && avgScore !== null && avgScore > 0) 
           ? Math.round(avgScore) 
           : (unit.totalAssignments > 0 ? Math.round((unit.totalSubmissions / unit.totalAssignments) * 100) : 0)
         
         return (
           <div key={unit.orgUnitId} className="group relative bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200/50 dark:border-slate-800/50 p-8 hover:shadow-[0_30px_60px_-15px_rgba(99,102,241,0.15)] transition-all duration-500 flex flex-col justify-between overflow-hidden hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20 group-hover:rotate-6 transition-all">
                      {getInitials(unit.orgUnitName)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-lg leading-tight group-hover:text-indigo-600 transition-colors">{unit.orgUnitName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Users size={14} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{unit.memberCount} Nhân viên</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{kRate}%</span>
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">Tiến Độ</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { label: 'KPIs', val: unit.totalKpi, color: 'indigo' },
                    { label: 'Đã nộp', val: unit.totalSubmissions, color: 'blue' },
                    { label: 'Đã duyệt', val: unit.approvedSubmissions, color: 'emerald' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-50/50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/30 text-center group/stat hover:bg-white dark:hover:bg-slate-800 transition-all">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover/stat:text-indigo-500 transition-colors">{stat.label}</p>
                      <p className="text-base font-black text-slate-900 dark:text-white">{stat.val}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ hoàn thành</span>
                    <span className="text-xs font-black text-indigo-600">{kRate}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full transition-all duration-[1500ms] shadow-[0_0_8px_rgba(79,70,229,0.4)]" 
                      style={{ width: `${kRate}%` }} 
                    />
                  </div>
                </div>
              </div>

              <Link to={`/org-units/${unit.orgUnitId}`} className="relative z-10 w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white transition-all shadow-xl hover:shadow-indigo-500/20 active:scale-95">
                Quản lý Đơn vị <ArrowUpRight size={16} />
              </Link>
           </div>
         )
       })}
    </div>
  )
}

/**
 * Email + 2 hành động nhanh: chép địa chỉ / mở popup soạn thư nhắc KPI.
 * Nằm trong hàng bấm được nên phải chặn nổi bọt.
 */
export function EmailQuickActions({ employee, onCompose, className }: { employee: any, onCompose: (emp: any) => void, className?: string }) {
  const [copied, setCopied] = useState(false)
  const email: string | undefined = employee?.email
  if (!email) return null

  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const copy = async (e: React.MouseEvent) => {
    stop(e)
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      toast.success('Đã sao chép email')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Trình duyệt không cho phép sao chép')
    }
  }

  const btn = "p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"

  return (
    <span className={cn("flex items-center gap-0.5 shrink-0", className)}>
      <button type="button" onClick={copy} title="Sao chép email" aria-label="Sao chép email" className={btn}>
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      </button>
      <button
        type="button"
        onClick={e => { stop(e); onCompose(employee) }}
        title={`Soạn thư nhắc tiến độ KPI gửi ${email}`}
        aria-label="Soạn thư nhắc tiến độ KPI"
        className={btn}
      >
        <Mail size={13} />
      </button>
    </span>
  )
}

export function EmployeesExecutiveTable({
  employees, loading, search, onSearchChange, 
  page, totalPages, onPageChange, onExport, 
  isExporting, orgUnitFilter, onOrgUnitFilterChange, orgUnits, periodName
}: any) {
  const navigate = useNavigate()
  const [reminderTarget, setReminderTarget] = useState<ReminderRecipient | null>(null)
  const detailPath = (userId: string) => `/employees/${userId}/performance`

  if (loading) return (
    <div className="space-y-6">
       {[1,2,3,4,5].map(i => (
         <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-[24px] animate-pulse" />
       ))}
    </div>
  )
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
       <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-50/30 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
               <Users size={20} />
             </div>
             <div>
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Quản lý Nhân sự</h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Thống kê hiệu suất cá nhân</p>
             </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="relative w-full lg:w-[350px] group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                id="tour-dashboard-search"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-14 pr-8 py-3.5 rounded-[22px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-sm transition-all shadow-sm"
              />
            </div>
            <div className="w-full md:w-[220px]">
              <Select value={orgUnitFilter} onValueChange={onOrgUnitFilterChange}>
                <SelectTrigger className="w-full h-[54px] rounded-[22px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold text-xs uppercase tracking-widest px-6">
                   <SelectValue placeholder="Chọn đơn vị..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl border-slate-100 dark:border-slate-800">
                  {orgUnits.map((u: any) => (
                    <SelectItem key={u.orgUnitId} value={u.orgUnitId} className="text-xs font-bold uppercase tracking-widest py-3">
                      {u.orgUnitName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              id="tour-dashboard-export-btn"
              onClick={onExport}
              disabled={isExporting}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-[22px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-95 shrink-0"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              {isExporting ? 'Đang xuất...' : 'Xuất báo cáo'}
            </button>
          </div>
       </div>
        <div className="hidden md:block overflow-x-auto lg:overflow-x-hidden scrollbar-hide custom-scrollbar">
          <table className="w-full min-w-[800px] lg:min-w-full text-left">
            <thead>
               <tr className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 border-b border-slate-50 dark:border-slate-800/50">
                  <th className="px-10 py-6">Nhân viên</th>
                  <th className="px-6 py-6 text-center">Tiến độ Hoàn thành</th>
                  <th className="px-10 py-6 text-right">Thao tác</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
               {employees.map((emp: any) => (
                 <tr
                   key={emp.userId}
                   onClick={() => navigate(detailPath(emp.userId))}
                   title={`Xem hiệu suất chi tiết của ${emp.fullName}`}
                   className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group cursor-pointer"
                 >
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <UserAvatar
                          fullName={emp.fullName}
                          avatarUrl={emp.avatarUrl}
                          className="w-12 h-12 rounded-[18px] transition-all duration-300"
                          fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-sm text-slate-500 group-hover:bg-indigo-600 group-hover:text-white"
                        />
                        {/* Tên là thông tin chính; đơn vị rút gọn thành badge phụ để không đẩy tên/email bị cụt */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">{emp.fullName}</p>
                            <span
                              title={emp.orgUnitName}
                              className="shrink-0 text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 uppercase tracking-widest whitespace-nowrap"
                            >
                              {abbreviateOrgUnitName(emp.orgUnitName)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 min-w-0">
                            <span className="text-[11px] text-slate-500 font-bold truncate">{emp.email}</span>
                            <EmailQuickActions employee={emp} onCompose={setReminderTarget} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                       <div className="flex flex-col items-center gap-2">
                          <div className="w-40 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                             <div 
                               className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-[2000ms] shadow-[0_0_8px_rgba(99,102,241,0.3)]" 
                               style={{ width: `${Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%` }} 
                             />
                          </div>
                          <span className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                            {Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}% • {emp.approvedSubmissions}/{emp.assignedKpi} KPIs
                          </span>
                       </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                       <div className="flex items-center justify-end">
                          {/* Tertiary: cả hàng đã bấm được nên nút chỉ đóng vai trò gợi ý, không tranh chú ý với "Xuất báo cáo" */}
                          <Link
                            to={detailPath(emp.userId)}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                          >
                            Chi tiết <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                       </div>
                    </td>
                 </tr>
               ))}
            </tbody>
          </table>
       </div>

       <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
          {employees.map((emp: any) => (
            <div
              key={emp.userId}
              onClick={() => navigate(detailPath(emp.userId))}
              className="p-5 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <UserAvatar
                  fullName={emp.fullName}
                  avatarUrl={emp.avatarUrl}
                  className="w-11 h-11 rounded-[16px]"
                  fallbackClassName="bg-slate-100 dark:bg-slate-800 font-black text-sm text-slate-500"
                />
                {/* Tên hiển thị đủ (xuống dòng thay vì cắt) — mobile cần đọc được tên để tìm đúng người */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-snug break-words">{emp.fullName}</p>
                  <div className="flex items-center gap-1 mt-0.5 min-w-0">
                    <span className="text-[11px] text-slate-500 font-bold truncate">{emp.email}</span>
                    <EmailQuickActions employee={emp} onCompose={setReminderTarget} />
                  </div>
                  <span
                    title={emp.orgUnitName}
                    className="inline-block mt-1.5 text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 uppercase tracking-widest whitespace-nowrap"
                  >
                    {abbreviateOrgUnitName(emp.orgUnitName)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                    style={{ width: `${Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 shrink-0">
                  {Math.round((emp.approvedSubmissions / (emp.assignedKpi || 1)) * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500">{emp.approvedSubmissions}/{emp.assignedKpi} KPIs</span>
                <Link
                  to={detailPath(emp.userId)}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 active:bg-indigo-50 dark:active:bg-indigo-500/10"
                >
                  Chi tiết <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
       </div>

       <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Trang {page + 1}/{totalPages}</p>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => onPageChange(Math.max(0, page - 1))}
               disabled={page === 0}
               className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm"
             >
               <ChevronLeft size={20} />
             </button>
             <button
               onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
               disabled={page >= totalPages - 1}
               className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm"
             >
               <ChevronRight size={20} />
             </button>
          </div>
       </div>

       <KpiReminderModal
         open={!!reminderTarget}
         onClose={() => setReminderTarget(null)}
         recipient={reminderTarget}
         periodName={periodName}
       />
    </div>
  )
}
