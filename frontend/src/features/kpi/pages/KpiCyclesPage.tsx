import { useState, useMemo, useEffect, useRef } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format, parseISO, addMonths, addYears, subDays, differenceInCalendarDays } from 'date-fns'
import { useKpiCycles } from '../hooks/useKpiCycles'
import { useNextStepHint } from '../workflow/nextStep/useNextStepHint'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, FREQUENCY_MAP, cn } from '@/lib/utils'
import type { KpiCycle, KpiCyclePayload, KpiPeriod, KpiFrequency, CycleEvaluationMode } from '@/types/kpi'
import {
  CalendarRange, Plus, Pencil, Trash2, Layers, Calendar,
  List, LayoutGrid, Check, AlertTriangle
} from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker, DatePicker } from '@/components/common/DateTimePicker'
import { toast } from 'sonner'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import Pagination from '@/components/common/Pagination'
import { Badge } from '@/components/ui/badge'
import EntityCard from '@/components/common/EntityCard'
import { ChoiceChip } from '@/components/ui/choice-chip'

// Loại kỳ: Tháng / Quý / 6 Tháng / Năm — mẫu gợi ý, thời gian vẫn chỉnh tự do.
const CYCLE_TYPES: KpiFrequency[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY']

function computeStandardEndDate(start: Date, type: KpiFrequency): Date {
  let end: Date
  switch (type) {
    case 'QUARTERLY': end = subDays(addMonths(start, 3), 1); break
    case 'SEMI_ANNUALLY': end = subDays(addMonths(start, 6), 1); break
    case 'YEARLY': end = subDays(addYears(start, 1), 1); break
    case 'MONTHLY':
    default: end = subDays(addMonths(start, 1), 1)
  }
  end.setHours(23, 59, 59, 999)
  return end
}

/**
 * Cuối phút chứa {@code date} (giây 59, mili giây 999).
 *
 * <p>Ô chọn thời gian chỉ tới PHÚT, trong khi đợt kết thúc ở 23:59:59.999. Gửi thẳng
 * 23:59:00 lên server thì kỳ ngắn hơn đợt đúng 59 giây và bị chặn với thông báo khó hiểu
 * "thời gian đợt phải nằm trong thời gian của kỳ". Chọn 23:59 nghĩa là "hết phút đó",
 * nên quy đổi ở đây chứ không bắt người dùng gõ được giây.
 */
function endOfMinute(date: Date): Date {
  const d = new Date(date)
  d.setSeconds(59, 999)
  return d
}

/**
 * Loại kỳ khớp nhất với một khoảng thời gian có sẵn — dùng khi thời gian kỳ được suy ra
 * từ các đợt đã chọn, lúc đó không ai gõ loại kỳ vào trước.
 *
 * <p>So theo SỐ NGÀY chứ không theo số tháng: gom 3 đợt tuần thành 21 ngày thì "Tháng"
 * vẫn là nhãn gần đúng nhất, còn đếm tháng sẽ ra 0 và không chọn được gì.
 */
function inferCycleType(start: Date, end: Date): KpiFrequency {
  const days = differenceInCalendarDays(end, start) + 1
  return CYCLE_TYPES.reduce((best, type) => {
    const diffOf = (t: KpiFrequency) =>
      Math.abs(differenceInCalendarDays(computeStandardEndDate(start, t), start) + 1 - days)
    return diffOf(type) < diffOf(best) ? type : best
  }, CYCLE_TYPES[0]!)
}

/**
 * Tên kỳ gợi ý theo mốc bắt đầu và loại kỳ. Chỉ ghi đè khi tên đang trống hoặc vẫn là
 * một tên máy tự đặt trước đó — người dùng đã gõ tên riêng thì không được đụng vào.
 */
function suggestCycleName(currentName: string, start: Date, type: KpiFrequency): string {
  const isAutoName = !currentName || ['Tháng', 'Quý', '6 Tháng', 'Năm'].some(p => currentName.startsWith(p))
  if (!isAutoName) return currentName

  switch (type) {
    case 'MONTHLY': return `Tháng ${format(start, 'MM/yyyy')}`
    case 'QUARTERLY': return `Quý ${Math.floor(start.getMonth() / 3) + 1} / ${format(start, 'yyyy')}`
    case 'SEMI_ANNUALLY': return `6 Tháng ${Math.floor(start.getMonth() / 6) + 1} / ${format(start, 'yyyy')}`
    case 'YEARLY': return `Năm ${format(start, 'yyyy')}`
    default: return currentName
  }
}

export default function KpiCyclesPage() {
  const suggestNextStep = useNextStepHint()
  const [showForm, setShowForm] = useState(false)
  const [editCycle, setEditCycle] = useState<KpiCycle | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [cycleType, setCycleType] = useState<string>('ALL')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')

  const debouncedKeyword = useDebounce(keyword, 500)
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const {
    data, isLoading, createCycle, updateCycle, deleteCycle,
    isCreating, isUpdating, isDeleting
  } = useKpiCycles({
    page,
    size: pageSize,
    organizationId,
    keyword: debouncedKeyword,
    cycleType: cycleType === 'ALL' ? undefined : cycleType,
    startDate: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
    endDate: endDateFilter ? new Date(endDateFilter).toISOString() : undefined,
    sortBy: 'startDate',
    direction: 'desc',
  })

  const stats = useMemo(() => ({
    total: data?.totalElements || 0,
    periods: (data?.content || []).reduce((sum, c) => sum + (c.periodCount || 0), 0),
  }), [data])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteCycle(deleteId)
      setDeleteId(null)
    } catch { /* toast handled in hook */ }
  }

  return (
    // Không tự bọc `max-w`/padding: khung `SettingsSectionLayout` bên ngoài đã lo phần
    // đó. Bọc thêm ở đây là nguyên nhân cũ khiến card thụt vào ~40px so với hàng tab.
    <div className="space-y-4">
        <WorkspaceHeader
          id="tour-cycles-header"
          description="Một kỳ (Tháng/Quý/6 Tháng/Năm) gom nhiều đợt để đánh giá tổng thể."
          stats={[
            { label: 'Tổng số kỳ', value: stats.total },
            { label: 'Đợt đã gom', value: stats.periods, icon: Layers },
          ]}
          actions={
            <Button onClick={() => { setEditCycle(null); setShowForm(true) }}>
              <Plus aria-hidden="true" /> Tạo kỳ mới
            </Button>
          }
        />

        <FilterBar
          id="tour-cycles-toolbar"
          search={{ value: keyword, onChange: v => { setKeyword(v); setPage(0) }, placeholder: 'Tìm tên kỳ…' }}
          overflowActiveCount={(startDateFilter ? 1 : 0) + (endDateFilter ? 1 : 0)}
          overflow={
            <div className="space-y-3">
              <div>
                <label className="text-label mb-1 block">Bắt đầu từ ngày</label>
                <DatePicker value={startDateFilter} onChange={(v) => { setStartDateFilter(v); setPage(0) }} onClear={() => { setStartDateFilter(''); setPage(0) }} placeholder="Từ ngày" className="w-full" />
              </div>
              <div>
                <label className="text-label mb-1 block">Kết thúc trước ngày</label>
                <DatePicker value={endDateFilter} onChange={(v) => { setEndDateFilter(v); setPage(0) }} onClear={() => { setEndDateFilter(''); setPage(0) }} placeholder="Đến ngày" className="w-full" />
              </div>
            </div>
          }
          trailing={
            <SegmentedControl ariaLabel="Dạng hiển thị" value={viewMode} onChange={setViewMode}
              options={[{ value: 'TABLE', label: <List aria-hidden="true" />, title: 'Dạng bảng' }, { value: 'CARD', label: <LayoutGrid aria-hidden="true" />, title: 'Dạng thẻ' }]} />
          }
        >
          <Select value={cycleType} onValueChange={val => { setCycleType(val); setPage(0) }}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-48" aria-label="Loại kỳ"><SelectValue placeholder="Tất cả loại kỳ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả loại kỳ</SelectItem>
              {CYCLE_TYPES.map(type => <SelectItem key={type} value={type}>{FREQUENCY_MAP[type]}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>

        <div id="tour-cycles-content" className="min-w-0">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={pageSize} />
        ) : !data?.content.length ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={CalendarRange}
              title={keyword || cycleType !== 'ALL' || startDateFilter || endDateFilter ? 'Không tìm thấy kỳ phù hợp' : 'Chưa có kỳ đánh giá nào'}
              description={keyword || cycleType !== 'ALL' || startDateFilter || endDateFilter ? 'Thử đổi từ khoá hoặc bỏ bớt bộ lọc.' : 'Tạo kỳ đầu tiên để gom các đợt lại đánh giá tổng hợp.'}
              action={!(keyword || cycleType !== 'ALL' || startDateFilter || endDateFilter) ? <Button onClick={() => { setEditCycle(null); setShowForm(true) }}><Plus aria-hidden="true" /> Tạo kỳ mới</Button> : undefined}
            />
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Tên kỳ</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Loại</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Bắt đầu</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Kết thúc</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Số đợt</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.content.map((cycle) => (
                  <tr key={cycle.id} className="transition-colors hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[var(--color-foreground)]">{cycle.name}</p>
                      {cycle.description && <p className="line-clamp-1 text-caption">{cycle.description}</p>}
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{FREQUENCY_MAP[cycle.cycleType]}</Badge></td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--color-muted-foreground)]">{cycle.startDate ? formatDateTime(cycle.startDate) : '—'}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--color-muted-foreground)]">{cycle.endDate ? formatDateTime(cycle.endDate) : '—'}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-[var(--color-foreground)]">{cycle.periodCount}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => { setEditCycle(cycle); setShowForm(true) }} aria-label="Chỉnh sửa" title="Chỉnh sửa"><Pencil aria-hidden="true" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteId(cycle.id)} aria-label="Xoá" title="Xoá" className="text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"><Trash2 aria-hidden="true" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.content.map((cycle) => (
              <EntityCard
                key={cycle.id}
                leading={<CalendarRange />}
                title={cycle.name}
                description={cycle.description}
                meta={<><Badge variant="outline">{FREQUENCY_MAP[cycle.cycleType]}</Badge><span>{cycle.periodCount} đợt</span></>}
                footerLeft={<span>Từ {cycle.startDate ? formatDateTime(cycle.startDate).split(' ')[0] : '—'}</span>}
                footerRight={<span>đến {cycle.endDate ? formatDateTime(cycle.endDate).split(' ')[0] : '—'}</span>}
                menu={[
                  { label: 'Chỉnh sửa', icon: <Pencil />, onClick: () => { setEditCycle(cycle); setShowForm(true) } },
                  { label: 'Xoá', icon: <Trash2 />, destructive: true, onClick: () => setDeleteId(cycle.id) },
                ]}
              />
            ))}
          </div>
        )}
        </div>

        {data && data.totalPages > 1 && (
          <Pagination currentPage={page} totalPages={data.totalPages} totalElements={data.totalElements} size={pageSize} onPageChange={setPage} itemLabel="kỳ" />
        )}

        {showForm && (
          <CycleFormModal
            onClose={() => setShowForm(false)}
            editCycle={editCycle}
            organizationId={organizationId!}
            onSubmit={async (payload) => {
              if (editCycle) {
                await updateCycle({ id: editCycle.id, data: payload })
              } else {
                const created = await createCycle(payload)
                suggestNextStep({ type: 'CYCLE_CREATED', cycle: created })
              }
            }}
            isSubmitting={isCreating || isUpdating}
          />
        )}

        <ConfirmDialog
          open={!!deleteId}
          title="Xoá kỳ đánh giá này?"
          description="Kỳ sẽ bị xoá vĩnh viễn. Các đợt đang thuộc kỳ này sẽ được gỡ khỏi kỳ (đợt không bị xoá). Bạn có chắc chắn?"
          confirmLabel="Xoá vĩnh viễn"
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={isDeleting}
        />
    </div>
  )
}

/**
 * Ô thời gian ở chế độ chọn đợt trước: chỉ đọc, vì giá trị do các đợt đã chọn quyết định.
 * Dùng ô tĩnh thay vì khoá {@link DateTimePicker} — người dùng bấm vào lịch rồi mới biết
 * mình không sửa được thì khó chịu hơn là nhìn thấy ngay đây là số máy tự điền.
 */
function DerivedDateBox({ value, hasPeriods }: { value: string; hasPeriods: boolean }) {
  return (
    <div className="w-full px-6 py-4 rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium">
      {hasPeriods && value
        ? <span className="text-[var(--color-foreground)]">{format(new Date(value), 'dd/MM/yyyy HH:mm')}</span>
        : <span className="text-[var(--color-subtle-foreground)] font-medium">Tự điền theo đợt</span>}
    </div>
  )
}

interface CycleFormModalProps {
  onClose: () => void
  editCycle: KpiCycle | null
  organizationId: string
  onSubmit: (payload: KpiCyclePayload) => Promise<void>
  isSubmitting: boolean
}

function CycleFormModal({ onClose, editCycle, organizationId, onSubmit, isSubmitting }: CycleFormModalProps) {
  const [formData, setFormData] = useState(() => {
    const start = editCycle?.startDate ? format(parseISO(editCycle.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'07:00")
    const type = (editCycle?.cycleType as KpiFrequency) || 'SEMI_ANNUALLY'
    const end = editCycle?.endDate
      ? format(parseISO(editCycle.endDate), "yyyy-MM-dd'T'HH:mm")
      : format(computeStandardEndDate(new Date(start), type), "yyyy-MM-dd'T'HH:mm")
    return { name: editCycle?.name || '', cycleType: type, startDate: start, endDate: end, description: editCycle?.description || '', evaluationMode: (editCycle?.evaluationMode as CycleEvaluationMode) || 'BOTH' }
  })
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false)

  /**
   * Hai đường dựng kỳ, cùng dẫn tới một payload:
   * - TIME_FIRST: gõ thời gian rồi nhặt đợt nằm trong khoảng đó (đường cũ).
   * - PERIOD_FIRST: nhặt đợt trước, thời gian kỳ tự ôm trọn các đợt đã chọn. Hợp với
   *   thực tế "kỳ này gồm mấy đợt kia" — sếp nhớ tên đợt chứ ít khi nhớ ngày.
   */
  const [mode, setMode] = useState<'TIME_FIRST' | 'PERIOD_FIRST'>('TIME_FIRST')
  const isPeriodFirst = mode === 'PERIOD_FIRST'

  // Gom đợt ngay tại đây, không cần sang tab Đợt để gán từng cái.
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([])
  const { data: periodsData, isLoading: isLoadingPeriods } = useKpiPeriods({
    organizationId, size: 200, sortBy: 'startDate', direction: 'asc',
  })
  const periods = useMemo(() => periodsData?.content || [], [periodsData])

  const cycleStartMs = formData.startDate ? new Date(formData.startDate).getTime() : NaN
  // Cùng quy ước với lúc gửi lên server: kết thúc "23:59" là hết phút 23:59.
  const cycleEndMs = formData.endDate ? endOfMinute(new Date(formData.endDate)).getTime() : NaN

  // Đợt hợp lệ khi nằm trọn trong thời gian kỳ (BE cũng chặn tương tự).
  const fitsCycle = (p: KpiPeriod) => {
    if (!p.startDate || !p.endDate || Number.isNaN(cycleStartMs) || Number.isNaN(cycleEndMs)) return false
    return new Date(p.startDate).getTime() >= cycleStartMs && new Date(p.endDate).getTime() <= cycleEndMs
  }

  // Chọn đợt trước thì không có khoảng thời gian nào để lọc — mọi đợt có ngày đều chọn được.
  const canPick = (p: KpiPeriod) => (isPeriodFirst ? !!(p.startDate && p.endDate) : fitsCycle(p))

  // Đợt phù hợp lên trước, phần còn lại vẫn hiển thị (mờ) để biết vì sao không chọn được.
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => {
      const diff = Number(canPick(b)) - Number(canPick(a))
      if (diff !== 0) return diff
      return (a.startDate || '').localeCompare(b.startDate || '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, cycleStartMs, cycleEndMs, isPeriodFirst])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eligiblePeriods = useMemo(() => sortedPeriods.filter(canPick), [sortedPeriods, cycleStartMs, cycleEndMs, isPeriodFirst])

  // Sửa kỳ: nạp sẵn các đợt đang thuộc kỳ này (chỉ nạp 1 lần khi có dữ liệu).
  const didInitSelection = useRef(false)
  useEffect(() => {
    if (didInitSelection.current || !periodsData) return
    didInitSelection.current = true
    if (editCycle) setSelectedPeriodIds(periods.filter(p => p.cycleId === editCycle.id).map(p => p.id))
  }, [periodsData, periods, editCycle])

  /**
   * Chọn đợt trước ⇒ thời gian kỳ ôm trọn các đợt đã chọn, loại kỳ và tên tự suy theo.
   * Chạy trước effect cắt tỉa bên dưới, và effect đó tự tắt ở chế độ này, nên không có
   * vòng lặp "ngày đổi → bỏ đợt → ngày đổi".
   */
  useEffect(() => {
    if (!isPeriodFirst) return
    const picked = periods.filter(p => selectedPeriodIds.includes(p.id) && p.startDate && p.endDate)
    if (!picked.length) return

    const start = new Date(Math.min(...picked.map(p => new Date(p.startDate!).getTime())))
    const end = new Date(Math.max(...picked.map(p => new Date(p.endDate!).getTime())))
    const startStr = format(start, "yyyy-MM-dd'T'HH:mm")
    const endStr = format(end, "yyyy-MM-dd'T'HH:mm")

    setFormData(prev => {
      if (prev.startDate === startStr && prev.endDate === endStr) return prev
      const type = inferCycleType(start, end)
      return { ...prev, startDate: startStr, endDate: endStr, cycleType: type, name: suggestCycleName(prev.name, start, type) }
    })
  }, [isPeriodFirst, selectedPeriodIds, periods])

  // Đổi thời gian kỳ ⇒ bỏ chọn các đợt vừa rơi ra ngoài khoảng mới.
  useEffect(() => {
    // Ở chế độ chọn đợt trước, thời gian là HỆ QUẢ của lựa chọn nên không được cắt ngược lại.
    if (!didInitSelection.current || isPeriodFirst) return
    setSelectedPeriodIds(prev => {
      const next = prev.filter(id => {
        const p = periods.find(x => x.id === id)
        return p ? fitsCycle(p) : true
      })
      return next.length === prev.length ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleStartMs, cycleEndMs, periods, isPeriodFirst])

  const togglePeriod = (id: string) => {
    setSelectedPeriodIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const allEligibleSelected = eligiblePeriods.length > 0 && eligiblePeriods.every(p => selectedPeriodIds.includes(p.id))
  const toggleAllEligible = () => {
    setSelectedPeriodIds(allEligibleSelected ? [] : eligiblePeriods.map(p => p.id))
  }

  // Không bật KPI định tính ⇒ chỉ được đánh giá theo Định lượng.
  const { data: org } = useOrganization(organizationId)
  const enableQualitative = org?.enableQualitative ?? false
  useEffect(() => {
    if (!enableQualitative && formData.evaluationMode !== 'QUANTITATIVE') {
      setFormData(p => ({ ...p, evaluationMode: 'QUANTITATIVE' }))
    }
  }, [enableQualitative, formData.evaluationMode])

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'startDate' || field === 'cycleType') {
        const start = field === 'startDate' ? value : prev.startDate
        const type = field === 'cycleType' ? value as KpiFrequency : prev.cycleType
        const startObj = new Date(start)
        // Chọn đợt trước: thời gian do đợt quyết định. Đổi loại kỳ ở đây chỉ là đổi nhãn,
        // kéo ngày kết thúc về độ dài tiêu chuẩn sẽ cắt mất chính những đợt vừa chọn.
        if (!isPeriodFirst) {
          next.endDate = format(computeStandardEndDate(startObj, type), "yyyy-MM-dd'T'HH:mm")
        }
        next.name = suggestCycleName(next.name, startObj, type)
      }
      return next
    })
  }

  const submitForm = async () => {
    await onSubmit({
      name: formData.name,
      cycleType: formData.cycleType,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: endOfMinute(new Date(formData.endDate)).toISOString(),
      description: formData.description || null,
      evaluationMode: formData.evaluationMode,
      organizationId,
      periodIds: selectedPeriodIds,
    })
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isPeriodFirst && !selectedPeriodIds.length) {
      toast.error('Hãy chọn ít nhất một đợt để suy ra thời gian kỳ')
      return
    }
    const start = new Date(formData.startDate).getTime()
    const end = endOfMinute(new Date(formData.endDate)).getTime()
    if (end <= start) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }
    // Hỏi lại khi độ dài lệch chuẩn — nhưng chỉ ở đường gõ tay. Chọn đợt trước thì lệch
    // chuẩn là chuyện đương nhiên (đợt hiếm khi phủ kín tròn tháng/quý), hỏi mỗi lần lưu
    // sẽ thành hộp thoại bấm cho qua.
    const standardEnd = computeStandardEndDate(new Date(formData.startDate), formData.cycleType).getTime()
    if (!isPeriodFirst && Math.abs(end - standardEnd) > 60 * 1000) {
      setShowMismatchConfirm(true)
      return
    }
    await submitForm()
  }

  const selectedDays = formData.startDate && formData.endDate
    ? differenceInCalendarDays(new Date(formData.endDate), new Date(formData.startDate)) + 1 : 0
  const standardDays = formData.startDate
    ? differenceInCalendarDays(computeStandardEndDate(new Date(formData.startDate), formData.cycleType), new Date(formData.startDate)) + 1 : 0
  const mismatchDescription = `Bạn đã chọn ${selectedDays} ngày, trong khi loại kỳ "${FREQUENCY_MAP[formData.cycleType]}" tiêu chuẩn là ${standardDays} ngày. Bạn tự chịu trách nhiệm với khoảng thời gian đã chọn.`

  return (
    <>
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isSubmitting}
      title={editCycle ? 'Chỉnh sửa kỳ' : 'Tạo kỳ mới'}
      description="Cấu hình kỳ đánh giá tổng hợp"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isSubmitting}>Hủy</Button>}
          primary={
            <Button type="submit" form="cycle-form-page" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
            </Button>
          }
        />
      }
    >
      <div className="space-y-5">
      {/* Hai đường dựng kỳ. Đổi qua lại không mất dữ liệu đã nhập. */}
      <div className="space-y-2">
        <span className="text-label block">Cách dựng kỳ</span>
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-card bg-[var(--color-muted)]">
          {([
            { key: 'TIME_FIRST', icon: <Calendar size={14} />, label: 'Chọn thời gian trước' },
            { key: 'PERIOD_FIRST', icon: <Layers size={14} />, label: 'Chọn đợt trước' },
          ] as const).map(opt => (
            <ChoiceChip selected={mode === opt.key} variant="segment" className="py-2.5" key={opt.key} onClick={() => setMode(opt.key)}>
              {opt.icon}
              <span className="truncate">{opt.label}</span>
            </ChoiceChip>
          ))}
        </div>
        <p className="text-caption font-medium ml-1 leading-relaxed">
          {isPeriodFirst
            ? 'Chọn các đợt cần gom, thời gian kỳ tự ôm trọn từ đợt sớm nhất tới đợt muộn nhất.'
            : 'Đặt thời gian kỳ trước, sau đó nhặt các đợt nằm trọn trong khoảng đó.'}
        </p>
      </div>

      <form id="cycle-form-page" onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-label">Tên kỳ <span className="text-[var(--color-error)]">*</span></label>
          <input value={formData.name} onChange={e => handleFieldChange('name', e.target.value)} required placeholder="Ví dụ: 6 Tháng đầu năm 2026"
            className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-medium transition-all placeholder:text-[var(--color-subtle-foreground)]"/>
        </div>

        <div className="space-y-2">
          <label className="text-label">Loại kỳ <span className="text-[var(--color-error)]">*</span></label>
          <Select value={formData.cycleType} onValueChange={val => handleFieldChange('cycleType', val)}>
            <SelectTrigger className="w-full px-5 h-[56px] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium shadow-sm focus:ring-4 focus:ring-[var(--color-primary)]/15">
              <SelectValue placeholder="Chọn loại kỳ" />
            </SelectTrigger>
            <SelectContent className="rounded-card border-[var(--color-border)] p-2">
              {CYCLE_TYPES.map(type => (
                <SelectItem key={type} value={type} className="rounded-card text-sm font-medium">{FREQUENCY_MAP[type]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-label">Chế độ đánh giá cuối kỳ</label>
          <Select
            value={formData.evaluationMode}
            onValueChange={val => setFormData(p => ({ ...p, evaluationMode: val as CycleEvaluationMode }))}
            disabled={!enableQualitative}
          >
            <SelectTrigger className="w-full px-5 h-[56px] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium shadow-sm focus:ring-4 focus:ring-[var(--color-primary)]/15 disabled:opacity-70">
              <SelectValue placeholder="Chọn chế độ đánh giá" />
            </SelectTrigger>
            <SelectContent className="rounded-card border-[var(--color-border)] p-2">
              <SelectItem value="QUANTITATIVE" className="rounded-card text-sm font-medium">Định lượng</SelectItem>
              {enableQualitative && <SelectItem value="QUALITATIVE" className="rounded-card text-sm font-medium">Định tính</SelectItem>}
              {enableQualitative && <SelectItem value="BOTH" className="rounded-card text-sm font-medium">Cả hai</SelectItem>}
            </SelectContent>
          </Select>
          {!enableQualitative && (
            <p className="text-caption font-medium ml-1">
              Tổ chức chưa bật KPI định tính nên kỳ chỉ đánh giá theo <span className="font-semibold text-[var(--color-muted-foreground)]">Định lượng</span>.
            </p>
          )}
        </div>

        {/* Chọn đợt trước thì danh sách đợt phải đứng trên thời gian — thời gian là kết quả. */}
        <div className={cn('flex flex-col gap-6', isPeriodFirst && 'flex-col-reverse')}>

        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label">Bắt đầu <span className="text-[var(--color-error)]">*</span></label>
              {isPeriodFirst ? (
                <DerivedDateBox value={formData.startDate} hasPeriods={selectedPeriodIds.length > 0} />
              ) : (
                <DateTimePicker value={formData.startDate} onChange={val => handleFieldChange('startDate', val)} />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-label">Kết thúc <span className="text-[var(--color-error)]">*</span></label>
              {isPeriodFirst ? (
                <DerivedDateBox value={formData.endDate} hasPeriods={selectedPeriodIds.length > 0} />
              ) : (
                <DateTimePicker value={formData.endDate} onChange={val => handleFieldChange('endDate', val)} />
              )}
            </div>
          </div>
          {isPeriodFirst && (
            <p className="text-caption font-medium ml-1 leading-relaxed">
              {selectedPeriodIds.length > 0
                ? <>Suy ra từ {selectedPeriodIds.length} đợt đã chọn — dài <span className="font-semibold text-[var(--color-muted-foreground)]">{selectedDays} ngày</span>, gần nhất với loại kỳ <span className="font-semibold text-[var(--color-muted-foreground)]">{FREQUENCY_MAP[formData.cycleType]}</span> ({standardDays} ngày). Muốn tự chỉnh giờ/ngày thì đổi sang "Chọn thời gian trước".</>
                : 'Chọn đợt ở trên để hệ thống điền thời gian kỳ.'}
            </p>
          )}
        </div>

        {/* Gom đợt vào kỳ ngay khi tạo — khỏi phải sang tab Đợt chỉnh từng đợt. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 ml-1">
            <label className="text-label">
              Đợt trong kỳ
              {selectedPeriodIds.length > 0 && (
                <span className="ml-2 text-[var(--color-primary)]">({selectedPeriodIds.length})</span>
              )}
            </label>
            {eligiblePeriods.length > 0 && (
              <Button variant="ghost" type="button" onClick={toggleAllEligible}>
                {allEligibleSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${eligiblePeriods.length})`}
              </Button>
            )}
          </div>

          <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-2 max-h-56 overflow-y-auto scrollbar-thin">
            {isLoadingPeriods ? (
              <p className="px-3 py-4 text-caption text-center">Đang tải danh sách đợt...</p>
            ) : !sortedPeriods.length ? (
              <p className="px-3 py-4 text-caption text-center">Chưa có đợt nào trong tổ chức.</p>
            ) : !eligiblePeriods.length ? (
              <p className="px-3 py-4 text-caption text-center">
                {isPeriodFirst
                  ? 'Các đợt hiện có đều thiếu ngày bắt đầu hoặc kết thúc.'
                  : 'Không có đợt nào nằm trọn trong thời gian kỳ đã chọn.'}
              </p>
            ) : sortedPeriods.map(period => {
              const eligible = canPick(period)
              const selected = selectedPeriodIds.includes(period.id)
              const fromOtherCycle = !!period.cycleId && period.cycleId !== editCycle?.id
              return (
                <button
                  key={period.id}
                  type="button"
                  disabled={!eligible}
                  onClick={() => togglePeriod(period.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-card text-left transition-all',
                    eligible ? 'hover:bg-[var(--color-card)] cursor-pointer' : 'opacity-40 cursor-not-allowed',
                    selected && 'bg-[var(--color-card)] shadow-sm'
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-control border flex items-center justify-center shrink-0 transition-all',
                    selected ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border-strong)]'
                  )}>
                    {selected && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--color-foreground)] truncate">{period.name}</span>
                      <span className="text-eyebrow shrink-0">
                        {FREQUENCY_MAP[period.periodType]}
                      </span>
                    </span>
                    <span className="block text-caption mt-0.5">
                      {period.startDate ? format(parseISO(period.startDate), 'dd/MM/yyyy') : '—'}
                      {' – '}
                      {period.endDate ? format(parseISO(period.endDate), 'dd/MM/yyyy') : '—'}
                    </span>
                    {!eligible ? (
                      <span className="block text-caption mt-0.5">
                        {isPeriodFirst ? 'Đợt chưa có ngày bắt đầu/kết thúc' : 'Ngoài thời gian kỳ'}
                      </span>
                    ) : fromOtherCycle && (
                      <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-warning)] mt-0.5">
                        <AlertTriangle size={10} /> Đang thuộc kỳ "{period.cycleName}"{selected && ' — sẽ chuyển sang kỳ này'}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-caption font-medium ml-1">
            {isPeriodFirst
              ? 'Chọn đợt nào cũng được, kể cả đợt rời rạc — thời gian kỳ sẽ trải từ đợt sớm nhất tới đợt muộn nhất.'
              : 'Chỉ chọn được đợt nằm trọn trong thời gian kỳ. Đổi thời gian kỳ sẽ tự bỏ các đợt không còn phù hợp.'}
          </p>
        </div>

        </div>

        <div className="space-y-2">
          <label className="text-label">Mô tả</label>
          <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Mục tiêu tổng thể của kỳ..."
            className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-medium transition-all placeholder:text-[var(--color-subtle-foreground)] resize-none"/>
        </div>
        </form>
      </div>
    </Dialog>

      <ConfirmDialog
        open={showMismatchConfirm}
        title="Bạn có chắc chắn?"
        description={mismatchDescription}
        confirmLabel="Vẫn lưu kỳ này"
        onConfirm={async () => { setShowMismatchConfirm(false); await submitForm() }}
        onClose={() => setShowMismatchConfirm(false)}
        loading={isSubmitting}
      />
    </>
  )
}
