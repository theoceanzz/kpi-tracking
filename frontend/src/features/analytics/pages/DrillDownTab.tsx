import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useDrillDown, useMatrixOverview, useUnitClassification } from '../hooks/useAnalytics'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Users, X, Search, Building2,
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
import AnalyticsTabHeader from '../components/AnalyticsTabHeader'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/common/EmptyState'

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
        className="h-8 w-auto gap-1.5 px-2.5 bg-[var(--color-muted)] border-[var(--color-border)] rounded-control text-caption shrink-0"
        title="Cách xem dữ liệu ma trận"
      >
        <span className="text-[var(--color-subtle-foreground)]">Xem:</span>
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
      <h3 className="text-eyebrow flex items-center gap-1.5 ml-1">
        <Grid3x3 size={12} className="text-[var(--color-primary)]" /> Ma trận xếp loại (theo đơn vị)
      </h3>
      <MatrixMetricCards overview={overview} />
      <section className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] shadow-sm overflow-hidden">
        <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)]" onClick={() => setOpen(o => !o)}>
          <h3 className="text-section-title flex items-center gap-2 text-[var(--color-foreground)]">
            <Grid3x3 aria-hidden="true" className="text-[var(--color-primary)]" /> Phân bố xếp loại &amp; Heatmap ma trận
          </h3>
          {open ? <ChevronDown aria-hidden="true" className="text-[var(--color-subtle-foreground)]" /> : <ChevronRight aria-hidden="true" className="text-[var(--color-subtle-foreground)]" />}
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
        <h3 className="text-eyebrow flex items-center gap-1.5 ml-1">
          <Award size={12} className="text-[var(--color-success)]" /> Xếp loại đơn vị (theo phân bố)
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
    <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] overflow-hidden">
      <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" onClick={() => setOpen(o => !o)}>
        <span className="w-7 h-7 rounded-card bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-xs font-semibold flex items-center justify-center shrink-0">
          {step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-[var(--color-foreground)] flex items-center gap-2">
            {icon} {title}
          </span>
          <span className="block text-caption font-medium mt-0.5 truncate">{hint}</span>
        </span>
        {meta && <span className="text-caption shrink-0 tabular-nums">{meta}</span>}
        {open
          ? <ChevronDown aria-hidden="true" className="text-[var(--color-subtle-foreground)] shrink-0" />
          : <ChevronRight aria-hidden="true" className="text-[var(--color-subtle-foreground)] shrink-0" />}
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
  // Ghi đè CẢ query thì mất `?section=drilldown` — SettingsSectionLayout hết biết đang ở mục nào và
  // văng về trang hub (lỗi từng sửa một lần rồi tái phát khi tab chuyển từ `?tab=` sang `?section=`).
  const select = (id: string) => {
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('unitId', id); return p })
    setEmpPage(0); setSearchInput('')
  }

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
    <div className="space-y-4">
      <AnalyticsTabHeader
        title="Phân cấp"
        description="Chọn một đơn vị trên cây để xem xếp loại, cách KPI chia xuống và danh sách thành viên; lọc thời gian áp cho mọi khối bên dưới."
        filters={controls}
      />

      {/* Master–detail: cây trái · chi tiết phải */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        {/* Cây đơn vị (desktop) */}
        <aside className="hidden lg:block lg:sticky lg:top-4 h-[calc(100vh-2rem)]">
          <OrgUnitTreeSidebar nodes={treeNodes} selectedId={treeSelectedId} onSelect={select} />
        </aside>

        {/* Panel chi tiết */}
        <div className="space-y-6 min-w-0">
          {/* Nút mở cây trên mobile */}
          <Button variant="outline" className="w-full lg:hidden" onClick={() => setMobileTreeOpen(true)}>
            <Network aria-hidden="true" /> Chọn đơn vị
          </Button>

          {/* Đơn vị đang chọn: tên + hai con số, cùng khuôn card như mọi khối khác (không tô nền primary — chữ token không đọc được trên nền màu). */}
          {data && (
            <div className="flex flex-col gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-eyebrow">{data.levelName || 'Cấp đơn vị'}</p>
                <h2 className="mt-0.5 truncate text-section-title">{data.orgUnitName || 'Tất cả'}</h2>
              </div>
              <dl className="flex shrink-0 items-center gap-6">
                <div><dt className="text-eyebrow">Nhân sự</dt><dd className="mt-0.5 text-stat">{data.memberCount}</dd></div>
                <div><dt className="text-eyebrow">KPI tổng</dt><dd className="mt-0.5 text-stat">{data.totalKpi}</dd></div>
              </dl>
            </div>
          )}

          {!data ? (
            <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
              <EmptyState icon={Network} title="Chưa chọn đơn vị" description="Chọn một đơn vị ở cây bên trái để xem chi tiết." />
            </div>
          ) : (
            <>
              {/* ① Đơn vị hiện tại — đặt đầu tiên để vừa vào là biết ngay tình hình đơn vị đang xem */}
              <DrillSection
                step={1}
                title="Đơn vị hiện tại"
                hint="Xếp loại, dịch chuyển chất lượng qua các đợt và cách KPI được chia xuống"
                icon={<Building2 size={16} className="text-[var(--color-primary)]" />}
              >
                <DrillClassificationSection orgUnitId={selectedUnitId} periodId={periodId} periodIdTo={periodIdTo} part="unit" />
                {canViewStats && <KpiCascadeSection filter={advancedFilter} />}
              </DrillSection>

              {/* ② Thành viên trực thuộc */}
              <DrillSection
                step={2}
                title="Thành viên trực thuộc"
                hint="Danh sách nhân sự và xếp loại từng người"
                icon={<Users size={16} className="text-[var(--color-primary)]" />}
                meta={`${filteredEmployees.length} người`}
              >
                {/* Bảng thành viên (ưu tiên) */}
                {data.employees.length > 0 ? (
                  <section ref={employeeTableRef} className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-section-title flex items-center gap-2">
                          <Users size={16} className="text-[var(--color-primary)]" /> Danh sách nhân sự
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
                          className="w-full pl-10 pr-4 py-2 bg-[var(--color-muted)] border-none rounded-card text-xs font-medium focus:ring-2 focus:ring-[var(--color-ring)] transition-all"
                        />
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
                      </div>
                    </div>
                    {empView === 'chart' ? (
                      <div className="p-5">
                        {filteredEmployees.length === 0 ? (
                          <div className="py-12 text-center text-[var(--color-subtle-foreground)] font-semibold italic">Không tìm thấy thành viên nào</div>
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
                          <tr className="text-eyebrow border-b border-[var(--color-border)]">
                            <th className="px-6 py-4 text-left">Họ tên &amp; Vai trò</th>
                            <th className="px-3 py-4 text-left">Đơn vị trực thuộc</th>
                            <th className="px-3 py-4 text-center">Số KPI được giao</th>
                            <th className="px-3 py-4 text-center">Tiến độ</th>
                            <th className="px-3 py-4 text-center">Hiệu suất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {paginatedEmployees.map(emp => {
                            const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
                            const perfPct = emp.performanceRate != null ? perf.toPct(emp.performanceRate) : null
                            return (
                              <tr key={emp.userId} className="hover:bg-[var(--color-muted)] transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <UserAvatar
                                      fullName={emp.fullName}
                                      avatarUrl={emp.avatarUrl}
                                      className="w-9 h-9 rounded-card"
                                      fallbackClassName="bg-[var(--color-muted)] text-caption"
                                    />
                                    <div>
                                      <p className="font-semibold text-[var(--color-foreground)] leading-none">{emp.fullName}</p>
                                      <p className="text-caption mt-1">{emp.roleName}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-4">
                                  {emp.orgUnitId && emp.orgUnitId === data.orgUnitId ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                                      <Building2 size={11} /> Đơn vị hiện tại
                                    </span>
                                  ) : (
                                    <span className="text-[12px] font-medium text-[var(--color-muted-foreground)]">{emp.orgUnitName || '—'}</span>
                                  )}
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="font-semibold text-[var(--color-foreground)]">{emp.assignedKpi}</span>
                                  <span className="text-caption ml-1">KPI</span>
                                </td>
                                <td className="px-3 py-4">
                                  <div className="flex items-center gap-2 min-w-[80px]">
                                    <div className="flex-1 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                                      <div
                                        className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-[var(--color-success-solid)]' : progressPct >= 50 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-error-solid)]')}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold w-8 text-right">{progressPct}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  {perfPct === null ? (
                                    <span className="text-[var(--color-subtle-foreground)] text-xs">—</span>
                                  ) : (
                                    <span className={cn('text-xs font-semibold px-2 py-1 rounded-control',
                                      perfPct >= 80 ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]' :
                                      perfPct >= 50 ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]' :
                                      'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]'
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
                        <div className="py-12 text-center text-[var(--color-subtle-foreground)] text-xs italic">Không tìm thấy kết quả phù hợp</div>
                      )}
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-[var(--color-border)]">
                      {paginatedEmployees.map(emp => {
                        const progressPct = emp.assignedKpi > 0 ? Math.round(emp.approvedSubmissions / emp.assignedKpi * 100) : 0
                        const perfPct = emp.performanceRate != null ? perf.toPct(emp.performanceRate) : null
                        return (
                          <div key={emp.userId} className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar
                                fullName={emp.fullName}
                                avatarUrl={emp.avatarUrl}
                                className="w-9 h-9 rounded-card shrink-0"
                                fallbackClassName="bg-[var(--color-muted)] text-caption"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-[var(--color-foreground)] leading-none truncate">{emp.fullName}</p>
                                <p className="text-caption mt-1">{emp.roleName}</p>
                              </div>
                              <div className="ml-auto shrink-0">
                                {emp.orgUnitId && emp.orgUnitId === data.orgUnitId ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                                    <Building2 size={10} /> Đơn vị hiện tại
                                  </span>
                                ) : (
                                  <span className="text-caption">{emp.orgUnitName || '—'}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', progressPct >= 80 ? 'bg-[var(--color-success-solid)]' : progressPct >= 50 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-error-solid)]')}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold w-8 text-right shrink-0">{progressPct}%</span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)] text-xs">
                              <div>
                                <span className="font-semibold text-[var(--color-foreground)]">{emp.assignedKpi}</span>
                                <span className="text-caption ml-1">KPI</span>
                              </div>
                              {perfPct !== null && (
                                <span className={cn('text-xs font-semibold px-2 py-1 rounded-control',
                                  perfPct >= 80 ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]' :
                                  perfPct >= 50 ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]' :
                                  'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]'
                                )}>
                                  Hiệu suất {perf.formatShort(emp.performanceRate)}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {filteredEmployees.length === 0 && (
                        <div className="py-12 text-center text-[var(--color-subtle-foreground)] text-xs italic">Không tìm thấy kết quả phù hợp</div>
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
                  <div className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] shadow-sm py-12 text-center text-[var(--color-subtle-foreground)] text-sm">
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
                  icon={<Building2 size={16} className="text-[var(--color-success)]" />}
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
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileTreeOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[340px] p-3 animate-in slide-in-from-left duration-200">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-end mb-2">
                <button onClick={() => setMobileTreeOpen(false)} className="p-2 rounded-card bg-[var(--color-card)] text-[var(--color-error)] shadow"><X size={18} /></button>
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
