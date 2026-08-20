import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Building2, Users, Target, Award, FileText, AlertTriangle, CheckCircle,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { exportDetailedPerformanceToExcel } from '@/utils/performanceExport'
import { statsApi } from '../../api/statsApi'
import { WidgetShell } from '../../components/WidgetShell'
import { CriticalAlertsSection } from '../../components/CriticalAlertsSection'
import { useDirectorDashboard } from '../../context/DirectorDashboardContext'
import {
  PremiumStatCard, PremiumRankingTable, OrgUnitsGrid, EmployeesExecutiveTable,
} from './DirectorParts'
import { LabeledBar, progressTone } from '../shared/Primitives'

// ── Dải chỉ số tổ chức ────────────────────────────────────────────────────────
export function DirectorStatsWidget() {
  const { stats, totalEmployees, activePeriod, summary, isLoading } = useDirectorDashboard()

  if (isLoading) return <WidgetShell title="Chỉ số tổ chức" isLoading bare><span /></WidgetShell>

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
      <PremiumStatCard icon={<Building2 size={20} />} label="Phòng ban" value={stats?.totalOrgUnits ?? 0} color="emerald" trend="Active" />
      <PremiumStatCard icon={<Users size={20} />} label="Nhân sự" value={totalEmployees} color="indigo" />
      <PremiumStatCard icon={<Target size={20} />} label="Chỉ tiêu KPI" value={stats?.totalKpiCriteria ?? 0} sub={`${stats?.approvedKpi ?? 0} đã duyệt`} color="blue" />
      <PremiumStatCard
        icon={<ShieldAlert size={20} />}
        label="KPI quá hạn"
        labelNote={activePeriod ? `kỳ ${activePeriod.name}` : undefined}
        value={`${Math.round(summary?.overdueKpiRate ?? 0)}%`}
        sub={`${stats?.pendingSubmissions ?? 0} báo cáo đang chờ duyệt`}
        hint="Tỷ lệ chỉ tiêu toàn tổ chức đã quá hạn. Tiến độ chấm điểm nằm ở widget riêng."
        to="/performance?section=submissions-org-unit"
        color="amber"
      />
    </div>
  )
}

// ── Cảnh báo nghiêm trọng ─────────────────────────────────────────────────────
export function DirectorAlertsWidget() {
  const { criticalAlerts, activePeriod, daysRemaining, setEvaluatingUser } = useDirectorDashboard()
  return (
    <CriticalAlertsSection
      alerts={criticalAlerts}
      periodName={activePeriod?.name}
      daysRemaining={daysRemaining}
      onSelectEmployee={activePeriod ? (id, name) => setEvaluatingUser({ id, name }) : undefined}
    />
  )
}

// ── Tỷ lệ hoàn thành toàn công ty ─────────────────────────────────────────────
export function DirectorCompletionWidget() {
  const { companyWeightedAvg, groupRates, stats, kpiParticipantCount, isLoading } = useDirectorDashboard()

  const unitBreakdown = useMemo(
    () => Object.entries(groupRates)
      .map(([name, members]) => ({
        name,
        count: members.length,
        rate: Math.round((members.reduce((s, m) => s + m.rate, 0) / members.length) * 100),
      }))
      .sort((a, b) => a.rate - b.rate),
    [groupRates]
  )

  return (
    <WidgetShell title="Tỷ lệ hoàn thành" icon={<Target size={17} />} isLoading={isLoading}>
      <div className="flex items-center gap-5 shrink-0">
        <div className="relative w-[104px] h-[104px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img" aria-label={`Tỷ lệ hoàn thành toàn công ty ${companyWeightedAvg} phần trăm`}>
            <defs>
              <linearGradient id="directorRadial" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="42" stroke="#f1f5f9" strokeWidth="9" fill="transparent" className="dark:stroke-slate-800" />
            <circle
              cx="50" cy="50" r="42" stroke="url(#directorRadial)" strokeWidth="9" fill="transparent"
              strokeDasharray={263.8}
              strokeDashoffset={263.8 - (263.8 * companyWeightedAvg) / 100}
              strokeLinecap="round"
              className="transition-all duration-1000 motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white tabular-nums" aria-hidden="true">{companyWeightedAvg}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <MiniRow icon={<Building2 size={13} />} label="Cơ cấu đơn vị" value={stats?.totalOrgUnits ?? 0} />
          <MiniRow icon={<Users size={13} />} label="Đối tượng KPI" value={kpiParticipantCount} />
        </div>
      </div>

      {/*
        Trước đây chỗ này liệt kê từng nhân viên kèm %, lặp lại đúng nội dung của
        "Top hiệu suất" và "Quản lý nhân sự". Phân rã theo đơn vị mới cho biết con số
        tổng đang được kéo lên/xuống bởi đơn vị nào.
      */}
      <div className="flex-1 min-h-0 mt-5 flex flex-col">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 shrink-0">
          Theo đơn vị ({unitBreakdown.length})
        </p>
        {unitBreakdown.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">Chưa có đơn vị nào có dữ liệu.</p>
        ) : (
          <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-3.5 pr-1">
            {unitBreakdown.map(u => (
              <li key={u.name}>
                <LabeledBar
                  label={u.name}
                  percent={u.rate}
                  tone={progressTone(u.rate)}
                  right={`${u.count} người · ${u.rate}%`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </WidgetShell>
  )
}

function MiniRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-[18px] bg-slate-50 dark:bg-slate-800/40">
      <span className="flex items-center gap-2 text-slate-400 min-w-0">
        <span className="shrink-0" aria-hidden="true">{icon}</span>
        <span className="text-[9px] font-black uppercase tracking-widest truncate">{label}</span>
      </span>
      <span className="text-sm font-black text-slate-900 dark:text-white shrink-0 tabular-nums">{value}</span>
    </div>
  )
}

// ── Phân tích bài nộp ─────────────────────────────────────────────────────────
export function DirectorSubmissionsWidget() {
  const { stats, isLoading } = useDirectorDashboard()

  const data = [
    { name: 'Đã duyệt', value: stats?.approvedSubmissions ?? 0, color: '#10b981' },
    { name: 'Chờ duyệt', value: stats?.pendingSubmissions ?? 0, color: '#f59e0b' },
    { name: 'Từ chối', value: stats?.rejectedSubmissions ?? 0, color: '#ef4444' },
  ]
  const total = data.reduce((s, i) => s + i.value, 0)

  return (
    <WidgetShell
      title="Phân tích bài nộp"
      icon={<FileText size={17} />}
      isLoading={isLoading}
      isEmpty={total === 0}
      emptyMessage="Chưa có bài nộp nào trong tổ chức."
      actions={
        <span className="flex items-baseline gap-1.5">
          <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{total}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tổng nộp</span>
        </span>
      }
    >
      <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 gap-0.5 mb-5 shrink-0">
        {data.map(item => (
          <div
            key={item.name}
            title={`${item.name}: ${item.value}`}
            className="h-full transition-all duration-700 motion-reduce:transition-none first:rounded-l-full last:rounded-r-full"
            style={{ width: `${total ? (item.value / total) * 100 : 0}%`, backgroundColor: item.color }}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {data.map(item => (
          <div key={item.name} className="flex items-center justify-between sm:flex-col sm:items-start gap-1 p-3 rounded-[18px] bg-slate-50 dark:bg-slate-800/40">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.name}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{item.value}</span>
              <span className="text-[10px] font-black text-slate-400 tabular-nums">
                {total ? Math.round((item.value / total) * 100) : 0}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </WidgetShell>
  )
}

// ── Top hiệu suất ─────────────────────────────────────────────────────────────
export function DirectorTopWidget() {
  const { allEmployees, employees, setEvaluatingUser, isLoading } = useDirectorDashboard()
  const pool = allEmployees.length ? allEmployees : employees

  return (
    <WidgetShell title="Top hiệu suất" icon={<Award size={17} />} isLoading={isLoading} isEmpty={pool.length === 0} bare>
      <PremiumRankingTable employees={pool} onSelectUser={(id, name) => setEvaluatingUser({ id, name })} />
    </WidgetShell>
  )
}

// ── Lưới đơn vị ───────────────────────────────────────────────────────────────
export function DirectorUnitsWidget() {
  const { filteredOrgUnits, unitAverageScores, isLoading } = useDirectorDashboard()

  return (
    <WidgetShell
      title="Cơ cấu đơn vị"
      icon={<Building2 size={17} />}
      isLoading={isLoading}
      isEmpty={filteredOrgUnits.length === 0}
      emptyMessage="Chưa có đơn vị con nào được giao KPI."
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <OrgUnitsGrid units={filteredOrgUnits} averageScores={unitAverageScores} />
      </div>
    </WidgetShell>
  )
}

// ── Bảng nhân sự điều hành ────────────────────────────────────────────────────
export function DirectorEmployeesWidget() {
  const {
    filteredEmployees, isEmployeesLoading, empSearch, setEmpSearch, empPage, setEmpPage,
    totalEmployeePages, orgUnitFilter, setOrgUnitFilter, orgUnitStats, activePeriod, organization,
  } = useDirectorDashboard()
  const { user } = useAuthStore()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!activePeriod) { toast.error('Không xác định được chu kỳ hiện tại'); return }
    setIsExporting(true)
    try {
      const detailed = await statsApi.getDetailedExportStats(
        orgUnitFilter !== 'ALL' ? orgUnitFilter : undefined,
        activePeriod.id
      )
      if (!detailed?.length) { toast.error('Không có dữ liệu chi tiết để xuất'); return }
      await exportDetailedPerformanceToExcel(
        detailed,
        user?.memberships?.[0]?.levelOrder ?? 2,
        `BÁO CÁO CHI TIẾT KPI - ${activePeriod.name.toUpperCase()}`,
        organization?.enableOkr
      )
      toast.success('Đã xuất báo cáo chi tiết thành công')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Có lỗi xảy ra khi xuất báo cáo chi tiết')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <WidgetShell title="Quản lý nhân sự" icon={<Users size={17} />} bare>
      <EmployeesExecutiveTable
        employees={filteredEmployees}
        loading={isEmployeesLoading}
        search={empSearch}
        onSearchChange={setEmpSearch}
        page={empPage}
        totalPages={totalEmployeePages}
        onPageChange={setEmpPage}
        onExport={handleExport}
        isExporting={isExporting}
        orgUnitFilter={orgUnitFilter}
        onOrgUnitFilterChange={setOrgUnitFilter}
        orgUnits={orgUnitStats || []}
        periodName={activePeriod?.name}
      />
    </WidgetShell>
  )
}



// ── Tiến độ chấm điểm ─────────────────────────────────────────────────────────
/** Trước đây chỉ là một dòng chú thích nhỏ trong thẻ số, dễ bị bỏ qua. */
export function DirectorEvalProgressWidget() {
  const { activePeriod, periodEvaluationCount, kpiParticipantCount, pendingEvaluationCount, daysRemaining, isLoading } = useDirectorDashboard()

  const percent = kpiParticipantCount > 0
    ? Math.round((periodEvaluationCount / kpiParticipantCount) * 100)
    : 0
  const urgent = daysRemaining !== null && daysRemaining <= 7 && (pendingEvaluationCount ?? 0) > 0

  return (
    <WidgetShell
      title="Tiến độ chấm điểm"
      icon={<CheckCircle size={17} />}
      isLoading={isLoading}
      isEmpty={!activePeriod}
      emptyMessage="Hiện không có kỳ đánh giá nào đang mở."
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kỳ {activePeriod?.name}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">{percent}%</span>
            <span className="text-xs font-bold text-slate-500 tabular-nums">{periodEvaluationCount}/{kpiParticipantCount} nhân sự</span>
          </p>
        </div>

        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', percent >= 90 ? 'bg-emerald-500' : percent >= 50 ? 'bg-indigo-600' : 'bg-amber-500')}
            style={{ width: `${percent}%` }}
          />
        </div>

        {(pendingEvaluationCount ?? 0) > 0 ? (
          <p className={cn('flex items-start gap-2 text-xs font-bold', urgent ? 'text-red-600 dark:text-red-400' : 'text-slate-500')}>
            {urgent && <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />}
            Còn {pendingEvaluationCount} nhân sự chưa được chấm
            {daysRemaining !== null ? `, kỳ còn ${daysRemaining} ngày.` : '.'}
          </p>
        ) : (
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Đã chấm đủ nhân sự trong kỳ.</p>
        )}
      </div>
    </WidgetShell>
  )
}
