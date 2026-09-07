import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useDrillDown, useMatrixOverview, useUnitClassification } from '../hooks/useAnalytics'
import { cn, getInitials } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users, X, Search, Building2, Target,
  ChevronDown, ChevronRight, Network, Grid3x3, Award,
} from 'lucide-react'
import AnalyticsTabSkeleton from '@/components/common/AnalyticsTabSkeleton'
import { CopyButton } from '@/components/common/CopyButton'
import Pagination from '@/components/common/Pagination'
import { useAnalyticsDateFilter } from '@/components/common/AnalyticsDateFilter'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import OrgUnitTreeSidebar from '../components/OrgUnitTreeSidebar'
import { MatrixMetricCards, MatrixDistHeatmap } from '../components/MatrixOverviewPanel'
import BehaviorCompletionScatter from '../components/BehaviorCompletionScatter'
import Lollipop from '@/components/charts/primitives/Lollipop'
import { useChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
import { KpiCascadeSection, UnitBoxplotSection } from '../components/advanced/DrillDownAdvanced'
import { useBehaviorCompletion } from '../hooks/useAdvancedAnalytics'
import { useStatsTier } from '../hooks/useStatsTier'
import UnitClassificationSection from '../components/UnitClassificationSection'
import type { EmployeeDrillSummary } from '@/types/stats'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'

const EMP_PAGE_SIZE = 5

/** Cắt cây tại đơn vị gốc (subtree) — để không lộ đơn vị ngoài quyền drill của user. */
function subtreeOf(nodes: OrgUnitTreeResponse[], rootId?: string): OrgUnitTreeResponse[] {
  if (!rootId) return nodes
  const find = (list: OrgUnitTreeResponse[]): OrgUnitTreeResponse | null => {
    for (const n of list) {
      if (n.id === rootId) return n
      const r = find(n.children || [])
      if (r) return r
    }
    return null
  }
  const node = find(nodes)
  return node ? [node] : nodes
}

/**
 * Hai cách đọc CÙNG một dữ liệu (điểm hành vi × % hoàn thành):
 * - "Ô ma trận": đếm số người rơi vào từng ô — thấy được mật độ, mất từng cá nhân.
 * - "Phân tán": mỗi người một chấm — thấy được người lệch hẳn khỏi đám đông, thứ mà ô đếm giấu đi.
 */
type MatrixView = 'CELLS' | 'SCATTER'

/**
 * Bộ chọn cách xem dữ liệu ma trận: ô đếm hay phân tán từng người.
 *
 * <p>Trước đây là một cặp nút pill nằm góc tiêu đề — nhìn như nhãn trang trí nên hầu như
 * không ai nhận ra bấm được, và cũng không nói ra hai lựa chọn đó đang chi phối cái gì. Dùng
 * `Select` có nhãn "Xem:" và mũi tên xổ xuống thì người dùng đọc ra ngay đây là một ô điều khiển.
 */
function MatrixViewSelect({ view, onChange }: { view: MatrixView; onChange: (v: MatrixView) => void }) {
  return (
    <Select value={view} onValueChange={v => onChange(v as MatrixView)}>
      <SelectTrigger
        className="h-8 w-auto gap-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0"
        title="Cách xem dữ liệu ma trận"
      >
        <span className="text-slate-400 dark:text-slate-500">Xem:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="CELLS">Ô ma trận</SelectItem>
        <SelectItem value="SCATTER">Phân tán từng người</SelectItem>
      </SelectContent>
    </Select>
  )
}

/** Khối "Ma trận xếp loại" cho đơn vị đang chọn (chỉ render khi org bật đánh giá định tính):
 *  thẻ chỉ số LUÔN hiển thị; phân bố + heatmap nằm trong mục thu gọn. */
function DrillMatrixSection({ orgUnitId, periodId, periodIdTo }: { orgUnitId?: string; periodId?: string; periodIdTo?: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<MatrixView>('CELLS')
  // Vai trò không có quyền thống kê nào sẽ bị backend trả 403 — ẩn luôn lựa chọn thay vì để
  // người dùng bấm vào rồi nhận lỗi.
  const { canView } = useStatsTier()
  const { data: overview } = useMatrixOverview({ orgUnitId, periodId, periodIdTo })
  // Chỉ tải dữ liệu phân tán khi người dùng thực sự mở mục và chọn cách xem đó.
  const scatter = useBehaviorCompletion({ orgUnitId, periodId, periodIdTo }, canView && open && view === 'SCATTER')
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
        <Grid3x3 size={12} className="text-indigo-500" /> Ma trận xếp loại (theo đơn vị)
      </h3>
      <MatrixMetricCards overview={overview} />
      <section className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        >
          <h3 className="text-sm font-black flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Grid3x3 size={16} className="text-indigo-600" /> Phân bố xếp loại &amp; Heatmap ma trận
          </h3>
          {open ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>
        {open && (
          <div className="p-5 pt-0">
            <MatrixDistHeatmap
              overview={overview}
              viewToggle={canView ? <MatrixViewSelect view={view} onChange={setView} /> : undefined}
              heatmapSlot={canView && view === 'SCATTER'
                ? <BehaviorCompletionScatter data={scatter.data} isLoading={scatter.isLoading} />
                : undefined}
            />
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Khối "Xếp loại đơn vị". Được gọi HAI lần trong tab này với hai giá trị `part` khác nhau:
 * nửa `unit` thuộc khối "Đơn vị hiện tại", nửa `children` thuộc khối "Đơn vị con". React Query
 * gộp chung một request vì cùng khoá, nên hai lần gọi không tốn thêm lượt mạng nào.
 */
function DrillClassificationSection({ orgUnitId, periodId, periodIdTo, part }: {
  orgUnitId?: string; periodId?: string; periodIdTo?: string; part?: 'unit' | 'children'
}) {
  const { data: overview } = useUnitClassification({ orgUnitId, periodId, periodIdTo })
  return (
    <div className="space-y-4">
      {part !== 'children' && (
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
          <Award size={12} className="text-emerald-500" /> Xếp loại đơn vị (theo phân bố)
        </h3>
      )}
      <UnitClassificationSection overview={overview} part={part} />
    </div>
  )
}

/**
 * Khối lớn của tab Phân cấp: một số thứ tự, một tiêu đề, một dòng giải thích, thu gọn được.
 *
 * <p>Trước đây bảy khối xếp nối đuôi nhau không theo mạch nào, nên người dùng vừa vào không
 * biết đơn vị mình đang xem tình hình ra sao. Gom lại theo đối tượng — đơn vị này → người của
 * nó → đơn vị bên dưới — trả lại một thứ tự đọc có nghĩa.
 */
function DrillSection({ step, title, hint, icon, meta, defaultOpen = true, children }: {
  step: number
  title: string
  hint: string
  icon: React.ReactNode
  meta?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
      >
        <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
          {step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            {icon} {title}
          </span>
          <span className="block text-[11px] text-slate-500 font-medium mt-0.5 truncate">{hint}</span>
        </span>
        {meta && <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">{meta}</span>}
        {open
          ? <ChevronDown size={18} className="text-slate-400 shrink-0" />
          : <ChevronRight size={18} className="text-slate-400 shrink-0" />}
      </button>
      {open && <div className="space-y-6 p-5 pt-0">{children}</div>}
    </section>
  )
}

export default function DrillDownTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedUnitId = searchParams.get('unitId') || undefined

  const { periodId, periodIdTo, from, to, controls } = useAnalyticsDateFilter({ selectClassName: 'h-9' })
  const advancedFilter = { orgUnitId: selectedUnitId, periodId, periodIdTo }
  const perf = usePerformanceScale()

  // Cây điều hướng + gốc drill (scope quyền) + chi tiết đơn vị đang chọn.
  const { data: tree } = useOrgUnitTree()
  const { data: rootData } = useDrillDown(undefined, from, to, periodId, periodIdTo)
  const { data, isLoading } = useDrillDown(selectedUnitId, from, to, periodId, periodIdTo)

  // ── UI state ────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [empPage, setEmpPage] = useState(0)
  const { view: empView, setView: setEmpView } = useChartTableView('drill-employees')
  const navigate = useNavigate()
  const { canView: canViewStats } = useStatsTier()
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)

  const employeeTableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => { setSearchTerm(searchInput); setEmpPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Đổi đơn vị đang chọn (đồng bộ URL để back/forward + chia sẻ link).
  const select = (id: string) => { setSearchParams({ unitId: id }); setEmpPage(0); setSearchInput('') }

  const rootUnitId = rootData?.orgUnitId || undefined
  const treeNodes = useMemo(() => subtreeOf(tree || [], rootUnitId), [tree, rootUnitId])
  const treeSelectedId = selectedUnitId ?? rootUnitId

  const filteredEmployees = useMemo((): EmployeeDrillSummary[] => {
    if (!data?.employees) return []
    if (!searchTerm) return data.employees
    const low = searchTerm.toLowerCase()
    return data.employees.filter(e =>
      e.fullName.toLowerCase().includes(low) ||
      e.email.toLowerCase().includes(low) ||
      e.roleName.toLowerCase().includes(low) ||
      (e.orgUnitName?.toLowerCase().includes(low) ?? false)
    )
  }, [data?.employees, searchTerm])

  const totalEmpPages = Math.ceil(filteredEmployees.length / EMP_PAGE_SIZE)
  const paginatedEmployees = useMemo(() => {
    const start = empPage * EMP_PAGE_SIZE
    return filteredEmployees.slice(start, start + EMP_PAGE_SIZE)
  }, [filteredEmployees, empPage])

  const isLeafUnit = (data?.childUnits?.length ?? 0) === 0

  if (isLoading && !data) return <AnalyticsTabSkeleton variant="drilldown" className="p-6" />

  // ── Biểu đồ (dùng lại cho khối thu gọn + portal phóng to) ────────────────
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Bộ lọc thời gian — sticky */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30">
              <Target size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">Lọc theo thời gian</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Dữ liệu phân tích đồng bộ cho tất cả biểu đồ</p>
            </div>
          </div>
          {controls}
        </div>
      </div>

      {/* Master–detail: cây trái · chi tiết phải */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        {/* Cây đơn vị (desktop) */}
        <aside className="hidden lg:block lg:sticky lg:top-4 h-[calc(100vh-2rem)]">
          <OrgUnitTreeSidebar nodes={treeNodes} selectedId={treeSelectedId} onSelect={select} />
        </aside>

        {/* Panel chi tiết */}
        <div className="space-y-6 min-w-0">
          {/* Nút mở cây trên mobile */}
          <button
            onClick={() => setMobileTreeOpen(true)}
            className="lg:hidden w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-indigo-600 shadow-sm"
          >
            <Network size={16} /> Chọn đơn vị
          </button>

          {/* Banner đơn vị đang chọn */}
          {data && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[24px] p-5 text-white shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{data.levelName || 'Cấp đơn vị'}</p>
                  <h2 className="text-lg md:text-2xl font-black mt-0.5 truncate">{data.orgUnitName || 'Tất cả'}</h2>
                </div>
                <div className="flex items-center gap-4 md:gap-8 shrink-0">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-xl md:text-2xl font-black">{data.memberCount}</p>
                    <p className="text-[10px] text-white/70 font-bold uppercase whitespace-nowrap">Nhân sự</p>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-xl md:text-2xl font-black">{data.totalKpi}</p>
                    <p className="text-[10px] text-white/70 font-bold uppercase whitespace-nowrap">KPI Tổng</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!data ? (
            <div className="text-center py-20 text-slate-400">Chọn một đơn vị ở cây bên trái để xem chi tiết</div>
          ) : (
            <>
              {/* ① Đơn vị hiện tại — đặt đầu tiên để vừa vào là biết ngay tình hình đơn vị đang xem */}
              <DrillSection
                step={1}
                title="Đơn vị hiện tại"
                hint="Xếp loại, dịch chuyển chất lượng qua các đợt và cách KPI được chia xuống"
                icon={<Building2 size={16} className="text-indigo-600" />}
              >
                <DrillClassificationSection orgUnitId={selectedUnitId} periodId={periodId} periodIdTo={periodIdTo} part="unit" />
                {canViewStats && <KpiCascadeSection filter={advancedFilter} />}
              </DrillSection>

              {/* ② Thành viên trực thuộc */}
              <DrillSection
                step={2}
                title="Thành viên trực thuộc"
                hint="Danh sách nhân sự và xếp loại từng người"
                icon={<Users size={16} className="text-indigo-600" />}
                meta={`${filteredEmployees.length} người`}
              >
                {/* Bảng thành viên (ưu tiên) */}
                {data.employees.length > 0 ? (
                  <section ref={employeeTableRef} className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm flex items-center gap-2">
                          <Users size={16} className="text-indigo-600" /> Danh sách nhân sự
                        </h3>
                        <CopyButton targetRef={employeeTableRef} />
                        <ViewToggleButtons view={empView} onChange={setEmpView} />
                      </div>
                      <div className="relative w-full md:w-64">
                        <input
                          type="text"
                          placeholder="Tìm tên, email, vai trò..."
                          value={searchInput}
                          onChange={e => setSearchInput(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    {empView === 'chart' ? (
                      <div className="p-5">
                        {filteredEmployees.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 font-bold italic">Không tìm thấy thành viên nào</div>
                        ) : (
                          <Lollipop
                            data={filteredEmployees.map(emp => ({
                              id: emp.userId,
                              name: emp.fullName,
                              subText: [emp.roleName, emp.orgUnitName].filter(Boolean).join(' · '),
                              value: emp.performanceRate ?? 0,
                            }))}
                            unit={` ${perf.unit}`}
                            domainMax={perf.axisMax}
                            onSelect={d => { if (d.id) navigate(`/employees/${d.id}/performance`) }}
                          />
                        )}
                      </div>
                    ) : (
                    <>
                    <div className="hidden md:block overflow-x-auto scrollbar-hide custom-scrollbar">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            <th className="px-6 py-4 text-left">Họ tên &amp; Vai trò</th>
                            <th className="px-3 py-4 text-left">Đơn vị trực thuộc</th>
                            <th className="px-3 py-4 text-center">Số KPI được giao</th>
                            <th className="px-3 py-4 text-center">Tiến độ</th>
                            <th className="px-3 py-4 text-center">Hiệu suất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {paginatedEmployees.map(emp => {
                            const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
                            const perfPct = emp.performanceRate != null ? perf.toPct(emp.performanceRate) : null
                            return (
                              <tr key={emp.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-black text-slate-600">
                                      {getInitials(emp.fullName)}
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-900 dark:text-white leading-none">{emp.fullName}</p>
                                      <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.roleName}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-4">
                                  {emp.orgUnitId && emp.orgUnitId === data.orgUnitId ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                      <Building2 size={11} /> Đơn vị hiện tại
                                    </span>
                                  ) : (
                                    <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300">{emp.orgUnitName || '—'}</span>
                                  )}
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="font-black text-slate-800 dark:text-slate-200">{emp.assignedKpi}</span>
                                  <span className="text-[10px] text-slate-400 ml-1">KPI</span>
                                </td>
                                <td className="px-3 py-4">
                                  <div className="flex items-center gap-2 min-w-[80px]">
                                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-black w-8 text-right">{progressPct}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  {perfPct === null ? (
                                    <span className="text-slate-300 text-xs">—</span>
                                  ) : (
                                    <span className={cn('text-xs font-black px-2 py-1 rounded-lg',
                                      perfPct >= 80 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                                      perfPct >= 50 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                                      'bg-red-50 text-red-600 dark:bg-red-900/20'
                                    )}>
                                      {perf.formatShort(emp.performanceRate)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {filteredEmployees.length === 0 && (
                        <div className="py-12 text-center text-slate-400 text-xs italic">Không tìm thấy kết quả phù hợp</div>
                      )}
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
                      {paginatedEmployees.map(emp => {
                        const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
                        const perfPct = emp.performanceRate != null ? perf.toPct(emp.performanceRate) : null
                        return (
                          <div key={emp.userId} className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-black text-slate-600 shrink-0">
                                {getInitials(emp.fullName)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 dark:text-white leading-none truncate">{emp.fullName}</p>
                                <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.roleName}</p>
                              </div>
                              <div className="ml-auto shrink-0">
                                {emp.orgUnitId && emp.orgUnitId === data.orgUnitId ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                    <Building2 size={10} /> Đơn vị hiện tại
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{emp.orgUnitName || '—'}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-emerald-500' : progressPct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-black w-8 text-right shrink-0">{progressPct}%</span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                              <div>
                                <span className="font-black text-slate-800 dark:text-slate-200">{emp.assignedKpi}</span>
                                <span className="text-[10px] text-slate-400 ml-1">KPI</span>
                              </div>
                              {perfPct !== null && (
                                <span className={cn('text-xs font-black px-2 py-1 rounded-lg',
                                  perfPct >= 80 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                                  perfPct >= 50 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                                  'bg-red-50 text-red-600 dark:bg-red-900/20'
                                )}>
                                  Hiệu suất {perf.formatShort(emp.performanceRate)}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {filteredEmployees.length === 0 && (
                        <div className="py-12 text-center text-slate-400 text-xs italic">Không tìm thấy kết quả phù hợp</div>
                      )}
                    </div>
                    </>
                    )}
                    {empView === 'table' && filteredEmployees.length > EMP_PAGE_SIZE && (
                      <Pagination
                        currentPage={empPage}
                        totalPages={totalEmpPages}
                        onPageChange={setEmpPage}
                        totalElements={filteredEmployees.length}
                        size={EMP_PAGE_SIZE}
                        itemLabel="thành viên"
                      />
                    )}
                  </section>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm py-12 text-center text-slate-400 text-sm">
                    Đơn vị này chưa có nhân sự trực thuộc
                  </div>
                )}

                {perf.isMatrix && (
                  <DrillMatrixSection orgUnitId={selectedUnitId} periodId={periodId} periodIdTo={periodIdTo} />
                )}
              </DrillSection>

              {/* ③ Đơn vị con — ẩn hẳn ở đơn vị lá: bốn biểu đồ trống không nói lên điều gì */}
              {!isLeafUnit && (
                <DrillSection
                  step={3}
                  title="Đơn vị con"
                  hint="Xếp loại và mức phân tán điểm giữa các đơn vị bên dưới"
                  icon={<Building2 size={16} className="text-emerald-600" />}
                  defaultOpen={false}
                >
                  <DrillClassificationSection orgUnitId={selectedUnitId} periodId={periodId} periodIdTo={periodIdTo} part="children" />
                  {canViewStats && <UnitBoxplotSection filter={advancedFilter} />}
                </DrillSection>
              )}
            </>
          )}
        </div>
      </div>

      {/* Drawer cây trên mobile */}
      {mobileTreeOpen && createPortal(
        <div className="fixed inset-0 z-[900] lg:hidden animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileTreeOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[340px] p-3 animate-in slide-in-from-left duration-200">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-end mb-2">
                <button onClick={() => setMobileTreeOpen(false)} className="p-2 rounded-xl bg-white/90 dark:bg-slate-800 text-red-500 shadow"><X size={18} /></button>
              </div>
              <div className="flex-1 min-h-0">
                <OrgUnitTreeSidebar nodes={treeNodes} selectedId={treeSelectedId} onSelect={select} onAfterSelect={() => setMobileTreeOpen(false)} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
