import { LocaleDateInput } from '@/components/ui/date-input'
import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { format, addDays, parseISO, addMonths, addYears, subDays, differenceInCalendarDays } from 'date-fns'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useNextStepHint } from '../workflow/nextStep/useNextStepHint'
import { useKpiCycles } from '../hooks/useKpiCycles'
import { useAuthStore } from '@/store/authStore'
import { formatDateTime, FREQUENCY_MAP } from '@/lib/utils'
import type { KpiPeriod, KpiFrequency } from '@/types/kpi'
import {
  Calendar, CalendarRange, Plus, Pencil, Trash2,
  LayoutGrid, List, Target
} from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { useDebounce } from '@/hooks/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker, DatePicker } from '@/components/common/DateTimePicker'
import { toast } from 'sonner'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import { SortHeader } from '@/components/common/SortHeader'
import Pagination from '@/components/common/Pagination'
import { Badge } from '@/components/ui/badge'
import EntityCard from '@/components/common/EntityCard'
import { LockedBadge, LockedHint } from '../components/CycleLockHint'
import { periodLockReason } from '../utils/cycleLockReason'
import { PERIOD_STATUS_LABEL } from '../types/cycleLock'
import { useTranslation } from 'react-i18next'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useCreateFromLink, useCreatePeriodCycleOption } from '@/components/common/CreatePeriodCycleOption'
import DraftNotice from '@/components/common/DraftNotice'

export default function KpiPeriodsPage() {
  const { t } = useTranslation('kpi')
  const suggestNextStep = useNextStepHint()
  const [showForm, setShowForm] = useState(false)
  const [editPeriod, setEditPeriod] = useState<KpiPeriod | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  // Đến từ mục "+ Tạo đợt mới" trong một ô chọn: mở sẵn form, tạo xong quay về trang cũ.
  const { returnAfterCreate, cancelReturn } = useCreateFromLink('period', () => { setEditPeriod(null); setShowForm(true) })

  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [periodType, setPeriodType] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState('startDate')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  const debouncedKeyword = useDebounce(keyword, 500)

  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const {
    data, isLoading, createPeriod, updatePeriod, deletePeriod,
    isCreating, isUpdating, isDeleting
  } = useKpiPeriods({
    page,
    size: pageSize,
    organizationId,
    keyword: debouncedKeyword,
    periodType: periodType === 'ALL' ? undefined : periodType,
    startDate: startDateFilter ? new Date(startDateFilter).toISOString() : undefined,
    endDate: endDateFilter ? new Date(endDateFilter).toISOString() : undefined,
    sortBy,
    direction
  })

  // Tiêu đề trang không còn tự dựng ở đây: nhãn tuỳ chỉnh của tổ chức đã hiện ở
  // breadcrumb và ở tab "Đợt đánh giá" ngay trên card, viết lại lần nữa là thừa.

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setDirection(direction === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setDirection('desc')
    }
    setPage(0)
  }


  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deletePeriod(deleteId)
      setDeleteId(null)
    } catch { /* lỗi ở đây không đổi được gì cho người dùng */ }
  }

  const stats = useMemo(() => {
    if (!data) return { total: 0, monthly: 0, quarterly: 0, semiAnnually: 0 }
    const items = data.content || []
    return {
      total: data.totalElements || 0,
      monthly: items.filter(p => p.periodType === 'MONTHLY').length,
      quarterly: items.filter(p => p.periodType === 'QUARTERLY').length,
      semiAnnually: items.filter(p => p.periodType === 'SEMI_ANNUALLY').length,
    }
  }, [data])

  return (
    // Không tự bọc `max-w`/padding: khung `SettingsSectionLayout` bên ngoài đã lo phần đó.
    <div className="space-y-4">
        <WorkspaceHeader
          id="tour-periods-header"
          description={t('KpiPeriodsPage.setUpEvaluationPeriodsMonthQuarter')}
          stats={[
            { label: t('KpiPeriodsPage.totalPeriods'), value: stats.total },
            {
              label: t('KpiPeriodsPage.mostCommonType'),
              value: stats.monthly + stats.quarterly + stats.semiAnnually,
              icon: Target,
            },
          ]}
          actions={
            <Button onClick={() => { setEditPeriod(null); setShowForm(true) }}>
              <Plus aria-hidden="true" /> {t('KpiPeriodsPage.createANewPeriod')}
            </Button>
          }
        />

        <FilterBar
          id="tour-periods-toolbar"
          search={{ value: keyword, onChange: v => { setKeyword(v); setPage(0) }, placeholder: t('KpiPeriodsPage.searchPeriodNames') }}
          overflowActiveCount={(startDateFilter ? 1 : 0) + (endDateFilter ? 1 : 0)}
          overflow={
            <div className="space-y-3">
              <div>
                <label className="text-label mb-1 block">{t('KpiPeriodsPage.startingFrom')}</label>
                <DatePicker value={startDateFilter} onChange={(v) => { setStartDateFilter(v); setPage(0) }} onClear={() => { setStartDateFilter(''); setPage(0) }} placeholder={t('KpiPeriodsPage.fromDate')} className="w-full" />
              </div>
              <div>
                <label className="text-label mb-1 block">{t('KpiPeriodsPage.endingBefore')}</label>
                <DatePicker value={endDateFilter} onChange={(v) => { setEndDateFilter(v); setPage(0) }} onClear={() => { setEndDateFilter(''); setPage(0) }} placeholder={t('KpiPeriodsPage.toDate')} className="w-full" />
              </div>
            </div>
          }
          trailing={
            <SegmentedControl ariaLabel={t('KpiPeriodsPage.display')} value={viewMode} onChange={setViewMode}
              options={[{ value: 'TABLE', label: <List aria-hidden="true" />, title: t('KpiPeriodsPage.tableView') }, { value: 'CARD', label: <LayoutGrid aria-hidden="true" />, title: t('KpiPeriodsPage.cardView') }]} />
          }
        >
          <Select value={periodType} onValueChange={val => { setPeriodType(val); setPage(0) }}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-48" aria-label={t('KpiPeriodsPage.periodType')}><SelectValue placeholder={t('KpiPeriodsPage.allPeriodTypes')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('KpiPeriodsPage.allPeriodTypes')}</SelectItem>
              {(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY'] as KpiFrequency[]).map(type => <SelectItem key={type} value={type}>{FREQUENCY_MAP()[type]}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>

        <div id="tour-periods-content">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={pageSize} />
        ) : !data?.content.length ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={Calendar}
              title={keyword || periodType !== 'ALL' || startDateFilter || endDateFilter ? t('KpiPeriodsPage.noMatchingPeriodFound') : t('KpiPeriodsPage.noEvaluationPeriodsYet')}
              description={keyword || periodType !== 'ALL' || startDateFilter || endDateFilter ? t('KpiPeriodsPage.tryChangingTheKeywordOrRemoving') : t('KpiPeriodsPage.createTheFirstPeriodToStart')}
              action={!(keyword || periodType !== 'ALL' || startDateFilter || endDateFilter) ? <Button onClick={() => { setEditPeriod(null); setShowForm(true) }}><Plus aria-hidden="true" /> {t('KpiPeriodsPage.createANewPeriod')}</Button> : undefined}
            />
          </div>
        ) : viewMode === 'TABLE' ? (
          <div className="overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow"><SortHeader field="name" active={sortBy} dir={direction} onToggle={toggleSort}>{t('KpiPeriodsPage.periodName')}</SortHeader></th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow"><SortHeader field="periodType" active={sortBy} dir={direction} onToggle={toggleSort}>{t('KpiPeriodsPage.periodType')}</SortHeader></th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{t('KpiPeriodsPage.aCycle')}</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow"><SortHeader field="startDate" active={sortBy} dir={direction} onToggle={toggleSort}>{t('KpiPeriodsPage.start')}</SortHeader></th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow"><SortHeader field="endDate" active={sortBy} dir={direction} onToggle={toggleSort}>{t('KpiPeriodsPage.end')}</SortHeader></th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{t('KpiPeriodsPage.submissionReminder')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('KpiPeriodsPage.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.content.map((period) => (
                  <tr key={period.id} className="transition-colors hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--color-foreground)]">
                      <span className="flex flex-wrap items-center gap-2">
                        {period.name}
                        <PeriodLockBadge period={period} />
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{FREQUENCY_MAP()[period.periodType as KpiFrequency]}</Badge></td>
                    <td className="px-4 py-3">{period.cycleName ? <Badge variant="success"><CalendarRange size={11} aria-hidden="true" /> {period.cycleName}</Badge> : <span className="text-caption">—</span>}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--color-muted-foreground)]">{period.startDate ? formatDateTime(period.startDate) : '—'}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--color-muted-foreground)]">{period.endDate ? formatDateTime(period.endDate) : '—'}</td>
                    <td className="px-4 py-3 text-sm tabular-nums text-[var(--color-muted-foreground)]">{period.notificationDate ? format(parseISO(period.notificationDate), 'HH:mm dd/MM') : '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <LockedHint reason={periodLockReason(period)}>
                          <Button variant="ghost" size="icon-sm" disabled={!!periodLockReason(period)} onClick={() => { setEditPeriod(period); setShowForm(true) }} aria-label={t('KpiPeriodsPage.edit')} title={periodLockReason(period) ? undefined : t('KpiPeriodsPage.edit')}><Pencil aria-hidden="true" /></Button>
                        </LockedHint>
                        <LockedHint reason={periodLockReason(period)}>
                          <Button variant="ghost" size="icon-sm" disabled={!!periodLockReason(period)} onClick={() => setDeleteId(period.id)} aria-label={t('KpiPeriodsPage.delete')} title={periodLockReason(period) ? undefined : t('KpiPeriodsPage.delete')} className="text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"><Trash2 aria-hidden="true" /></Button>
                        </LockedHint>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.content.map((period) => (
              <EntityCard
                key={period.id}
                leading={<Calendar />}
                title={period.name}
                description={period.cycleName ? t('KpiPeriodsPage.inCycle', { cycleName: period.cycleName }) : t('KpiPeriodsPage.notInAnyCycleYet')}
                meta={<><Badge variant="outline">{FREQUENCY_MAP()[period.periodType as KpiFrequency]}</Badge><PeriodLockBadge period={period} />{period.notificationDate && <span>{t('KpiPeriodsPage.remind')} {format(parseISO(period.notificationDate), 'HH:mm dd/MM')}</span>}</>}
                footerLeft={<span>{t('KpiPeriodsPage.from')} {period.startDate ? formatDateTime(period.startDate).split(' ')[0] : '—'}</span>}
                footerRight={<span>{t('KpiPeriodsPage.to')} {period.endDate ? formatDateTime(period.endDate).split(' ')[0] : '—'}</span>}
                // Đợt thuộc kỳ đã khoá / đã đóng khi khoá kỳ: chỉ xem (server cũng chặn).
                menu={periodLockReason(period) ? [] : [
                  { label: t('KpiPeriodsPage.edit'), icon: <Pencil />, onClick: () => { setEditPeriod(period); setShowForm(true) } },
                  { label: t('KpiPeriodsPage.delete'), icon: <Trash2 />, destructive: true, onClick: () => setDeleteId(period.id) },
                ]}
              />
            ))}
          </div>
        )}
        </div>

        {data && data.totalPages > 1 && (
          <Pagination currentPage={page} totalPages={data.totalPages} totalElements={data.totalElements} size={pageSize} onPageChange={setPage} itemLabel={t('KpiPeriodsPage.periods')} />
        )}

        {/* Form Modal */}
        {showForm && (
          <PeriodFormModal
            onClose={() => { setShowForm(false); cancelReturn() }}
            editPeriod={editPeriod}
            organizationId={organizationId!}
            onSubmit={async (payload) => {
              if (editPeriod) {
                await updatePeriod({ id: editPeriod.id, data: payload })
              } else {
                const created = await createPeriod(payload)
                if (!returnAfterCreate()) suggestNextStep({ type: 'PERIOD_CREATED', period: created })
              }
            }}
            isSubmitting={isCreating || isUpdating}
          />
        )}

        <ConfirmDialog
          open={!!deleteId}
          title={t('KpiPeriodsPage.deleteThisKpiPeriod')}
          description={t('KpiPeriodsPage.theKpiPeriodDataWillBe')}
          confirmLabel={t('KpiPeriodsPage.deletePermanently')}
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={isDeleting}
        />

    </div>
  )
}

// --- Internal Form Modal for Auto-calculation ---
interface PeriodFormModalProps {
  onClose: () => void
  editPeriod: KpiPeriod | null
  organizationId: string
  onSubmit: (payload: any) => Promise<void>
  isSubmitting: boolean
}

function computeStandardEndDate(start: Date, type: KpiFrequency): Date {
  let end: Date
  switch (type) {
    case 'DAILY':
      end = new Date(start)
      break
    case 'WEEKLY':
      end = addDays(start, 6)
      break
    case 'MONTHLY':
      end = subDays(addMonths(start, 1), 1)
      break
    case 'QUARTERLY':
      end = subDays(addMonths(start, 3), 1)
      break
    case 'SEMI_ANNUALLY':
      end = subDays(addMonths(start, 6), 1)
      break
    case 'YEARLY':
      end = subDays(addYears(start, 1), 1)
      break
    default:
      end = new Date(start)
  }
  end.setHours(23, 59, 59, 999)
  return end
}

function PeriodFormModal({ onClose, editPeriod, organizationId, onSubmit, isSubmitting }: PeriodFormModalProps) {
  const { t } = useTranslation('kpi')
  const [formData, setFormData] = useState({
    name: editPeriod?.name || '',
    periodType: (editPeriod?.periodType as KpiFrequency) || 'MONTHLY',
    startDate: editPeriod?.startDate ? format(parseISO(editPeriod.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'07:00"),
    endDate: editPeriod?.endDate ? format(parseISO(editPeriod.endDate), "yyyy-MM-dd'T'HH:mm") : '',
    notificationDate: editPeriod?.notificationDate ? format(parseISO(editPeriod.notificationDate), "yyyy-MM-dd'T'HH:mm") : '',
    cycleId: editPeriod?.cycleId || 'NONE',
  })
  const draft = useStateDraft(formData, setFormData, { key: `kpi-period:${editPeriod?.id ?? 'new:'}`, enabled: true })
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false)

  // Danh sách kỳ để gán đợt vào (tuỳ chọn).
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesData?.content || []
  const createCycle = useCreatePeriodCycleOption('cycle')
  const selectedCycle = formData.cycleId !== 'NONE' ? cycles.find(c => c.id === formData.cycleId) : undefined

  // Auto calculate end date on mount if creating new
  useState(() => {
    if (!editPeriod) {
      calculateEndDate(formData.startDate, formData.periodType)
    }
  })

  function calculateEndDate(startStr: string, type: KpiFrequency) {
    if (!startStr) return
    const start = new Date(startStr)
    const end = computeStandardEndDate(start, type)
    const notification = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)

    setFormData(prev => ({
      ...prev,
      endDate: format(end, "yyyy-MM-dd'T'HH:mm"),
      notificationDate: format(notification, "yyyy-MM-dd'T'HH:mm")
    }))
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'startDate' || field === 'periodType') {
        const start = field === 'startDate' ? value : prev.startDate
        const type = field === 'periodType' ? value as KpiFrequency : prev.periodType

        const startDateObj = new Date(start)
        const endDateObj = computeStandardEndDate(startDateObj, type)

        next.endDate = format(endDateObj, "yyyy-MM-dd'T'HH:mm")

        // Auto calculate notification date (50% of period)
        const notificationDateObj = new Date(startDateObj.getTime() + (endDateObj.getTime() - startDateObj.getTime()) / 2)
        next.notificationDate = format(notificationDateObj, "yyyy-MM-dd'T'HH:mm")

        if (!next.name || next.name.includes('Tháng') || next.name.includes('Quý') || next.name.includes('6 Tháng') || next.name.includes('Năm')) {
          if (type === 'MONTHLY') next.name = t('KpiPeriodsPage.month', { startDateObj: format(startDateObj, 'MM/yyyy') })
          else if (type === 'QUARTERLY') next.name = t('KpiPeriodsPage.q', { value: Math.floor(startDateObj.getMonth() / 3) + 1, startDateObj: format(startDateObj, 'yyyy') })
          else if (type === 'SEMI_ANNUALLY') next.name = t('KpiPeriodsPage.h', { value: Math.floor(startDateObj.getMonth() / 6) + 1, startDateObj: format(startDateObj, 'yyyy') })
          else if (type === 'YEARLY') next.name = t('KpiPeriodsPage.year', { startDateObj: format(startDateObj, 'yyyy') })
        }
      }
      return next
    })
  }

  const submitForm = async () => {
    await onSubmit({
      ...formData,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      notificationDate: formData.notificationDate ? new Date(formData.notificationDate).toISOString() : null,
      cycleId: formData.cycleId === 'NONE' ? null : formData.cycleId,
      organizationId
    })
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const start = new Date(formData.startDate).getTime()
    const end = new Date(formData.endDate).getTime()
    const notification = formData.notificationDate ? new Date(formData.notificationDate).getTime() : null

    if (end <= start) {
      toast.error(t('KpiPeriodsPage.theEndTimeMustBeAfter'))
      return
    }

    if (notification) {
      if (notification <= start || notification >= end) {
        toast.error(t('KpiPeriodsPage.theNotificationTimeMustBeBetween'))
        return
      }
    }

    // Đợt thuộc một kỳ ⇒ thời gian đợt phải nằm gọn trong thời gian của kỳ.
    if (selectedCycle?.startDate && selectedCycle?.endDate) {
      const cycleStart = new Date(selectedCycle.startDate).getTime()
      const cycleEnd = new Date(selectedCycle.endDate).getTime()
      if (start < cycleStart || end > cycleEnd) {
        toast.error(
          t('KpiPeriodsPage.thePeriodDatesMustBeWithin', { name: selectedCycle.name }) +
          `(${format(new Date(selectedCycle.startDate), 'dd/MM/yyyy')} – ${format(new Date(selectedCycle.endDate), 'dd/MM/yyyy')})`
        )
        return
      }
    }

    const standardEnd = computeStandardEndDate(new Date(formData.startDate), formData.periodType).getTime()
    if (Math.abs(end - standardEnd) > 60 * 1000) {
      setShowMismatchConfirm(true)
      return
    }

    await submitForm()
  }

  const selectedDays = formData.startDate && formData.endDate
    ? differenceInCalendarDays(new Date(formData.endDate), new Date(formData.startDate)) + 1
    : 0
  const standardDays = formData.startDate
    ? differenceInCalendarDays(computeStandardEndDate(new Date(formData.startDate), formData.periodType), new Date(formData.startDate)) + 1
    : 0
  const mismatchDescription = t('KpiPeriodsPage.youChoseDaysWhileTheStandard', { selectedDays, value: FREQUENCY_MAP()[formData.periodType], standardDays })

  return (
    <>
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isSubmitting}
      title={editPeriod ? t('KpiPeriodsPage.editPeriod') : t('KpiPeriodsPage.createANewPeriod')}
      description={t('KpiPeriodsPage.configureTheEvaluationPeriodDates')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t('KpiPeriodsPage.cancel')}</Button>}
          primary={
            <Button type="submit" form="period-form-page" disabled={isSubmitting}>
              {isSubmitting ? t('KpiPeriodsPage.saving') : t('KpiPeriodsPage.confirm')}
            </Button>
          }
        />
      }
    >
      <div className="space-y-5">
      <form id="period-form-page" onSubmit={handleSubmit} className="space-y-5">
        <DraftNotice draft={draft} />
        <div className="space-y-2">
          <label className="text-label">{t('KpiPeriodsPage.kpiPeriodName')} <span className="text-[var(--color-error)]">*</span></label>
          <input
            value={formData.name}
            onChange={e => handleFieldChange('name', e.target.value)}
            required
            placeholder={t('KpiPeriodsPage.eGMay2026')}
            className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-medium transition-all placeholder:text-[var(--color-subtle-foreground)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-label">{t('KpiPeriodsPage.periodType2')} <span className="text-[var(--color-error)]">*</span></label>
          <Select value={formData.periodType} onValueChange={val => handleFieldChange('periodType', val)}>
            <SelectTrigger className="w-full px-5 h-[56px] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium shadow-sm focus:ring-4 focus:ring-[var(--color-primary)]/15">
              <SelectValue placeholder={t('KpiPeriodsPage.choosePeriodType')} />
            </SelectTrigger>
            <SelectContent className="rounded-card border-[var(--color-border)] p-2">
              {['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY'].map(type => (
                <SelectItem key={type} value={type} className="rounded-card focus:bg-[var(--color-primary)]/10 text-sm font-medium">
                  {FREQUENCY_MAP()[type as KpiFrequency]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-label">{t('KpiPeriodsPage.evaluationCycleOptional')}</label>
          <Select value={formData.cycleId} onValueChange={createCycle.wrap(val => setFormData(prev => ({ ...prev, cycleId: val })))}>
            <SelectTrigger className="w-full px-5 h-[56px] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium shadow-sm focus:ring-4 focus:ring-[var(--color-primary)]/15">
              <SelectValue placeholder={t('KpiPeriodsPage.notInAnyCycle')} />
            </SelectTrigger>
            <SelectContent className="rounded-card border-[var(--color-border)] p-2">
              <SelectItem value="NONE" className="rounded-card text-sm font-medium text-[var(--color-muted-foreground)]">{t('KpiPeriodsPage.notInAnyCycle')}</SelectItem>
              {cycles.map(cycle => (
                <SelectItem key={cycle.id} value={cycle.id} disabled={cycle.status === 'LOCKED'} className="rounded-card text-sm font-medium">
                  {cycle.name}{cycle.status === 'LOCKED' && t('KpiPeriodsPage.locked')}
                </SelectItem>
              ))}
              {createCycle.item}
            </SelectContent>
          </Select>
          {selectedCycle?.startDate && selectedCycle?.endDate && (
            <p className="text-caption font-medium ml-1">
              {t('KpiPeriodsPage.thePeriodMustBeWithinThe')}{' '}
              <span className="font-semibold text-[var(--color-muted-foreground)]">
                {format(new Date(selectedCycle.startDate), 'dd/MM/yyyy')} – {format(new Date(selectedCycle.endDate), 'dd/MM/yyyy')}
              </span>
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label">{t('KpiPeriodsPage.start')} <span className="text-[var(--color-error)]">*</span></label>
              {/* Mobile */}
              <div className="sm:hidden">
                <DateTimePicker value={formData.startDate} onChange={val => handleFieldChange('startDate', val)} />
              </div>
              {/* Desktop */}
              <div className="hidden sm:block relative">
                <LocaleDateInput type="datetime-local" value={formData.startDate} onChange={e => handleFieldChange('startDate', e.target.value)} required className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-medium transition-all"/>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label">{t('KpiPeriodsPage.end')} <span className="text-[var(--color-error)]">*</span></label>
              {/* Mobile */}
              <div className="sm:hidden">
                <DateTimePicker value={formData.endDate} onChange={val => handleFieldChange('endDate', val)} />
              </div>
              {/* Desktop */}
              <div className="hidden sm:block relative">
                <LocaleDateInput type="datetime-local" value={formData.endDate} onChange={e => handleFieldChange('endDate', e.target.value)} required className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-medium transition-all"/>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-label">{t('KpiPeriodsPage.reminderNotificationDefault50OfThe')}</label>
            {/* Mobile */}
            <div className="sm:hidden">
              <DateTimePicker value={formData.notificationDate} onChange={val => handleFieldChange('notificationDate', val)} />
            </div>
            {/* Desktop */}
            <div className="hidden sm:block relative">
              <LocaleDateInput type="datetime-local" value={formData.notificationDate} onChange={e => handleFieldChange('notificationDate', e.target.value)} required className="w-full px-6 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)]/50 outline-none text-sm font-medium transition-all"/>
            </div>
          </div>
        </div>
        </form>
      </div>
    </Dialog>

      <ConfirmDialog
        open={showMismatchConfirm}
        title={t('KpiPeriodsPage.areYouSure')}
        description={mismatchDescription}
        confirmLabel={t('KpiPeriodsPage.createThisPeriodAnyway')}
        onConfirm={async () => { setShowMismatchConfirm(false); await submitForm() }}
        onClose={() => setShowMismatchConfirm(false)}
        loading={isSubmitting}
      />
    </>
  )
}

/** Badge trạng thái khoá của đợt: kỳ đã khoá, hoặc đợt đã đóng/chuyển/huỷ khi khoá kỳ. */
function PeriodLockBadge({ period }: { period: KpiPeriod }) {
  const { t } = useTranslation('kpi')
  const reason = periodLockReason(period)
  if (!reason) return null
  const label = period.status && period.status !== 'ACTIVE' ? PERIOD_STATUS_LABEL()[period.status] : t('KpiPeriodsPage.locked2')
  return <LockedBadge reason={reason} label={label} />
}
