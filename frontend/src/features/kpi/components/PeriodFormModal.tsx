import { useState, useEffect } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { Pencil, Plus } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { useKpiCycles } from '../hooks/useKpiCycles'
import { FREQUENCY_MAP } from '@/lib/utils'
import { toast } from 'sonner'
import { periodStandardEnd as computeStandardEndDate } from '../utils/standardDuration'
import type { KpiPeriod, KpiFrequency } from '@/types/kpi'

interface PeriodFormModalProps {
  onClose: () => void
  editPeriod: KpiPeriod | null
  organizationId: string
  /** Kỳ do bước trước bàn giao qua ?cycleId= — chọn sẵn trong form. */
  initialCycleId?: string | null
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  isSubmitting: boolean
  /**
   * `modal` (mặc định) giữ nguyên lớp phủ + tiêu đề + nút Huỷ như trang quản lý đang dùng.
   * `inline` bỏ khung đó để nhúng vào một bước của trình thiết lập.
   */
  variant?: 'modal' | 'inline'
  submitLabel?: string
}

/**
 * Form tạo/sửa đợt KPI.
 *
 * Trước đây nằm private trong `KpiPeriodsPage`; tách ra để trình thiết lập dùng lại đúng bộ luật
 * ngày tháng và phép kiểm "đợt phải nằm gọn trong kỳ" thay vì có một bản sao thứ hai.
 */
export default function PeriodFormModal({
  onClose,
  editPeriod,
  organizationId,
  initialCycleId,
  onSubmit,
  isSubmitting,
  variant = 'modal',
  submitLabel,
}: PeriodFormModalProps) {
  const isInline = variant === 'inline'

  const [formData, setFormData] = useState({
    name: editPeriod?.name || '',
    periodType: (editPeriod?.periodType as KpiFrequency) || 'MONTHLY',
    startDate: editPeriod?.startDate ? format(parseISO(editPeriod.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'07:00"),
    endDate: editPeriod?.endDate ? format(parseISO(editPeriod.endDate), "yyyy-MM-dd'T'HH:mm") : '',
    notificationDate: editPeriod?.notificationDate ? format(parseISO(editPeriod.notificationDate), "yyyy-MM-dd'T'HH:mm") : '',
    cycleId: editPeriod?.cycleId || initialCycleId || 'NONE',
  })
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false)

  // Danh sách kỳ để gán đợt vào (tuỳ chọn).
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesData?.content || []
  const selectedCycle = formData.cycleId !== 'NONE' ? cycles.find(c => c.id === formData.cycleId) : undefined

  // Điền sẵn ngày kết thúc + ngày nhắc khi tạo mới.
  //
  // Bản cũ viết chỗ này là `useState(() => { ... })` — hàm khởi tạo của useState chạy NGAY GIỮA
  // lúc render và gọi setState, tức là một effect đội lốt. Nó tình cờ chạy được nhưng sẽ hỏng
  // dưới StrictMode. Đây là useEffect thật, chạy đúng một lần sau khi mount.
  useEffect(() => {
    if (!editPeriod) calculateEndDate(formData.startDate, formData.periodType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          if (type === 'MONTHLY') next.name = `Tháng ${format(startDateObj, 'MM/yyyy')}`
          else if (type === 'QUARTERLY') next.name = `Quý ${Math.floor(startDateObj.getMonth() / 3) + 1} / ${format(startDateObj, 'yyyy')}`
          else if (type === 'SEMI_ANNUALLY') next.name = `6 Tháng ${Math.floor(startDateObj.getMonth() / 6) + 1} / ${format(startDateObj, 'yyyy')}`
          else if (type === 'YEARLY') next.name = `Năm ${format(startDateObj, 'yyyy')}`
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
    if (!isInline) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const start = new Date(formData.startDate).getTime()
    const end = new Date(formData.endDate).getTime()
    const notification = formData.notificationDate ? new Date(formData.notificationDate).getTime() : null

    if (end <= start) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }

    if (notification) {
      if (notification <= start || notification >= end) {
        toast.error('Thời gian thông báo phải nằm trong khoảng thời gian bắt đầu và kết thúc')
        return
      }
    }

    // Đợt thuộc một kỳ ⇒ thời gian đợt phải nằm gọn trong thời gian của kỳ.
    if (selectedCycle?.startDate && selectedCycle?.endDate) {
      const cycleStart = new Date(selectedCycle.startDate).getTime()
      const cycleEnd = new Date(selectedCycle.endDate).getTime()
      if (start < cycleStart || end > cycleEnd) {
        toast.error(
          `Thời gian đợt phải nằm trong kỳ "${selectedCycle.name}" ` +
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
  const mismatchDescription = `Bạn đã chọn ${selectedDays} ngày, trong khi chu kỳ "${FREQUENCY_MAP[formData.periodType]}" tiêu chuẩn là ${standardDays} ngày. Hệ thống sẽ không tự kiểm tra lại — bạn tự chịu trách nhiệm với khoảng thời gian đã chọn.`

  const fields = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Tên đợt KPI <span className="text-red-500">*</span></label>
        <input
          value={formData.name}
          onChange={e => handleFieldChange('name', e.target.value)}
          required
          placeholder="Ví dụ: Tháng 05/2026"
          className="w-full px-5 py-4 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none text-sm font-bold transition-all placeholder:text-slate-400"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Loại chu kỳ <span className="text-red-500">*</span></label>
        <Select value={formData.periodType} onValueChange={val => handleFieldChange('periodType', val)}>
          <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/10">
            <SelectValue placeholder="Chọn loại chu kỳ" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
            {['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY'].map(type => (
              <SelectItem key={type} value={type} className="rounded-xl focus:bg-indigo-50 dark:focus:bg-indigo-900/30 text-sm font-bold">
                {FREQUENCY_MAP[type as KpiFrequency]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Thuộc kỳ đánh giá (tuỳ chọn)</label>
        <Select value={formData.cycleId} onValueChange={val => setFormData(prev => ({ ...prev, cycleId: val }))}>
          <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-500/10">
            <SelectValue placeholder="Không thuộc kỳ nào" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
            <SelectItem value="NONE" className="rounded-xl text-sm font-bold text-slate-500">Không thuộc kỳ nào</SelectItem>
            {cycles.map(cycle => (
              <SelectItem key={cycle.id} value={cycle.id} className="rounded-xl text-sm font-bold">{cycle.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCycle?.startDate && selectedCycle?.endDate && (
          <p className="text-[11px] text-slate-400 font-medium ml-1">
            Đợt phải nằm trong kỳ:{' '}
            <span className="font-black text-slate-500">
              {format(new Date(selectedCycle.startDate), 'dd/MM/yyyy')} – {format(new Date(selectedCycle.endDate), 'dd/MM/yyyy')}
            </span>
          </p>
        )}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Bắt đầu <span className="text-red-500">*</span></label>
            <div className="sm:hidden">
              <DateTimePicker value={formData.startDate} onChange={val => handleFieldChange('startDate', val)} />
            </div>
            <div className="hidden sm:block relative">
              <input type="datetime-local" value={formData.startDate} onChange={e => handleFieldChange('startDate', e.target.value)} required className="w-full px-5 py-4 rounded-[22px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none text-sm font-bold transition-all text-transparent" />
              <div className="absolute inset-0 left-5 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
                {formData.startDate ? format(new Date(formData.startDate), 'dd/MM/yyyy HH:mm') : ''}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Kết thúc <span className="text-red-500">*</span></label>
            <div className="sm:hidden">
              <DateTimePicker value={formData.endDate} onChange={val => handleFieldChange('endDate', val)} />
            </div>
            <div className="hidden sm:block relative">
              <input type="datetime-local" value={formData.endDate} onChange={e => handleFieldChange('endDate', e.target.value)} required className="w-full px-5 py-4 rounded-[22px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none text-sm font-bold transition-all text-transparent" />
              <div className="absolute inset-0 left-5 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
                {formData.endDate ? format(new Date(formData.endDate), 'dd/MM/yyyy HH:mm') : ''}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Thông báo nhắc nhở (Mặc định 50% thời gian)</label>
          <div className="sm:hidden">
            <DateTimePicker value={formData.notificationDate} onChange={val => handleFieldChange('notificationDate', val)} />
          </div>
          <div className="hidden sm:block relative">
            <input type="datetime-local" value={formData.notificationDate} onChange={e => handleFieldChange('notificationDate', e.target.value)} required className="w-full px-6 py-4 rounded-[22px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none text-sm font-bold transition-all text-transparent" />
            <div className="absolute inset-0 left-6 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
              {formData.notificationDate ? format(new Date(formData.notificationDate), 'dd/MM/yyyy HH:mm') : ''}
            </div>
          </div>
        </div>
      </div>

      <div className={isInline ? 'pt-2' : 'flex gap-4 pt-6'}>
        {!isInline && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-8 py-4 rounded-[20px] border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
          >
            Huỷ
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 w-full px-8 py-4 rounded-[20px] bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/25 disabled:opacity-50 active:scale-95"
        >
          {isSubmitting ? 'Đang lưu...' : (submitLabel ?? 'Xác nhận')}
        </button>
      </div>
    </form>
  )

  const mismatchDialog = (
    <ConfirmDialog
      open={showMismatchConfirm}
      title="Bạn có chắc chắn?"
      description={mismatchDescription}
      confirmLabel="Vẫn tạo đợt này"
      onConfirm={async () => { setShowMismatchConfirm(false); await submitForm() }}
      onClose={() => setShowMismatchConfirm(false)}
      loading={isSubmitting}
    />
  )

  if (isInline) {
    return (
      <>
        {fields}
        {mismatchDialog}
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-lg mx-auto animate-in zoom-in-95 fade-in duration-500 overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />

        <div className="p-10 space-y-8 relative">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[22px] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner border border-indigo-100/50 dark:border-indigo-800/50">
              {editPeriod ? <Pencil size={28} /> : <Plus size={28} />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {editPeriod ? 'Chỉnh sửa đợt' : 'Tạo đợt mới'}
              </h3>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Cấu hình chu kỳ đánh giá & thời gian</p>
            </div>
          </div>

          {fields}
        </div>
      </div>

      {mismatchDialog}
    </div>
  )
}
