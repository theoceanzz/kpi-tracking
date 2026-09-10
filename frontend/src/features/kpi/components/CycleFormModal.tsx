import { useState } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { Pencil, Plus } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { FREQUENCY_MAP } from '@/lib/utils'
import { toast } from 'sonner'
import { CYCLE_TYPES, cycleStandardEnd as computeStandardEndDate } from '../utils/standardDuration'
import type { KpiCycle, KpiFrequency, CycleEvaluationMode } from '@/types/kpi'

interface CycleFormModalProps {
  onClose: () => void
  editCycle: KpiCycle | null
  organizationId: string
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  isSubmitting: boolean
  /**
   * `modal` (mặc định) giữ nguyên lớp phủ + tiêu đề + nút Huỷ như trang quản lý đang dùng.
   * `inline` bỏ hết phần khung đó để nhúng thẳng vào một bước của trình thiết lập, nơi tiêu đề
   * và nút điều hướng đã do khung wizard lo.
   */
  variant?: 'modal' | 'inline'
  /** Nhãn nút xác nhận. Trong wizard thường là "Tạo kỳ & tiếp tục". */
  submitLabel?: string
}

/**
 * Form tạo/sửa kỳ đánh giá.
 *
 * Trước đây nằm private trong `KpiCyclesPage`. Tách ra file riêng để trình thiết lập dùng lại
 * được đúng bộ trường này — chép sang một bản thứ hai là chấp nhận hai bản luật ngày tháng sẽ
 * lệch nhau theo thời gian.
 *
 * Mutation vẫn do component cha giữ qua `onSubmit`, nên cùng một form phục vụ được cả trang quản
 * lý (tạo xong đóng modal) lẫn wizard (tạo xong sang bước sau).
 */
export default function CycleFormModal({
  onClose,
  editCycle,
  organizationId,
  onSubmit,
  isSubmitting,
  variant = 'modal',
  submitLabel,
}: CycleFormModalProps) {
  const isInline = variant === 'inline'

  const [formData, setFormData] = useState(() => {
    const start = editCycle?.startDate ? format(parseISO(editCycle.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'07:00")
    const type = (editCycle?.cycleType as KpiFrequency) || 'SEMI_ANNUALLY'
    const end = editCycle?.endDate
      ? format(parseISO(editCycle.endDate), "yyyy-MM-dd'T'HH:mm")
      : format(computeStandardEndDate(new Date(start), type), "yyyy-MM-dd'T'HH:mm")
    return { name: editCycle?.name || '', cycleType: type, startDate: start, endDate: end, description: editCycle?.description || '', evaluationMode: (editCycle?.evaluationMode as CycleEvaluationMode) || 'BOTH' }
  })
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false)

  // Không bật KPI định tính ⇒ chỉ được đánh giá theo Định lượng.
  //
  // Ép ngay trong lúc render theo mẫu "chỉnh state khi nguồn đổi" của React, thay vì useEffect:
  // cờ enableQualitative tới sau một nhịp (chờ query tổ chức), và effect sẽ để lọt đúng một lượt
  // render với giá trị sai trước khi sửa lại.
  const { data: org } = useOrganization(organizationId)
  const enableQualitative = org?.enableQualitative ?? false
  if (!enableQualitative && formData.evaluationMode !== 'QUANTITATIVE') {
    setFormData(p => ({ ...p, evaluationMode: 'QUANTITATIVE' }))
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'startDate' || field === 'cycleType') {
        const start = field === 'startDate' ? value : prev.startDate
        const type = field === 'cycleType' ? value as KpiFrequency : prev.cycleType
        const startObj = new Date(start)
        next.endDate = format(computeStandardEndDate(startObj, type), "yyyy-MM-dd'T'HH:mm")
        if (!next.name || next.name.startsWith('Tháng') || next.name.startsWith('Quý') || next.name.startsWith('6 Tháng') || next.name.startsWith('Năm')) {
          if (type === 'MONTHLY') next.name = `Tháng ${format(startObj, 'MM/yyyy')}`
          else if (type === 'QUARTERLY') next.name = `Quý ${Math.floor(startObj.getMonth() / 3) + 1} / ${format(startObj, 'yyyy')}`
          else if (type === 'SEMI_ANNUALLY') next.name = `6 Tháng ${Math.floor(startObj.getMonth() / 6) + 1} / ${format(startObj, 'yyyy')}`
          else if (type === 'YEARLY') next.name = `Năm ${format(startObj, 'yyyy')}`
        }
      }
      return next
    })
  }

  const submitForm = async () => {
    await onSubmit({
      name: formData.name,
      cycleType: formData.cycleType,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      description: formData.description || null,
      evaluationMode: formData.evaluationMode,
      organizationId,
    })
    // Trong wizard, bước sau tự điều hướng nên không có gì để đóng.
    if (!isInline) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const start = new Date(formData.startDate).getTime()
    const end = new Date(formData.endDate).getTime()
    if (end <= start) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }
    const standardEnd = computeStandardEndDate(new Date(formData.startDate), formData.cycleType).getTime()
    if (Math.abs(end - standardEnd) > 60 * 1000) {
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

  const fields = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Tên kỳ <span className="text-red-500">*</span></label>
        <input value={formData.name} onChange={e => handleFieldChange('name', e.target.value)} required placeholder="Ví dụ: 6 Tháng đầu năm 2026"
          className="w-full px-5 py-4 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none text-sm font-bold transition-all placeholder:text-slate-400" />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Loại kỳ <span className="text-red-500">*</span></label>
        <Select value={formData.cycleType} onValueChange={val => handleFieldChange('cycleType', val)}>
          <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-emerald-500/10">
            <SelectValue placeholder="Chọn loại kỳ" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
            {CYCLE_TYPES.map(type => (
              <SelectItem key={type} value={type} className="rounded-xl text-sm font-bold">{FREQUENCY_MAP[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Chế độ đánh giá cuối kỳ</label>
        <Select
          value={formData.evaluationMode}
          onValueChange={val => setFormData(p => ({ ...p, evaluationMode: val as CycleEvaluationMode }))}
          disabled={!enableQualitative}
        >
          <SelectTrigger className="w-full px-5 h-[56px] rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold shadow-sm focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-70">
            <SelectValue placeholder="Chọn chế độ đánh giá" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2">
            <SelectItem value="QUANTITATIVE" className="rounded-xl text-sm font-bold">Định lượng</SelectItem>
            {enableQualitative && <SelectItem value="QUALITATIVE" className="rounded-xl text-sm font-bold">Định tính</SelectItem>}
            {enableQualitative && <SelectItem value="BOTH" className="rounded-xl text-sm font-bold">Cả hai</SelectItem>}
          </SelectContent>
        </Select>
        {!enableQualitative && (
          <p className="text-[11px] text-slate-400 font-medium ml-1">
            Tổ chức chưa bật KPI định tính nên kỳ chỉ đánh giá theo <span className="font-black text-slate-500">Định lượng</span>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Bắt đầu <span className="text-red-500">*</span></label>
          <DateTimePicker value={formData.startDate} onChange={val => handleFieldChange('startDate', val)} />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Kết thúc <span className="text-red-500">*</span></label>
          <DateTimePicker value={formData.endDate} onChange={val => handleFieldChange('endDate', val)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Mô tả</label>
        <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Mục tiêu tổng thể của kỳ..."
          className="w-full px-5 py-4 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none text-sm font-medium transition-all placeholder:text-slate-400 resize-none" />
      </div>

      <div className={isInline ? 'pt-2' : 'flex gap-4 pt-4'}>
        {!isInline && (
          <button type="button" onClick={onClose} className="flex-1 px-8 py-4 rounded-[20px] border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">Huỷ</button>
        )}
        <button type="submit" disabled={isSubmitting} className="flex-1 w-full px-8 py-4 rounded-[20px] bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/25 disabled:opacity-50 active:scale-95">
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
      confirmLabel="Vẫn lưu kỳ này"
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
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="p-10 space-y-8 relative">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[22px] bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner border border-emerald-100/50 dark:border-emerald-800/50">
              {editCycle ? <Pencil size={28} /> : <Plus size={28} />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{editCycle ? 'Chỉnh sửa kỳ' : 'Tạo kỳ mới'}</h3>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Cấu hình kỳ đánh giá tổng hợp</p>
            </div>
          </div>

          {fields}
        </div>
      </div>

      {mismatchDialog}
    </div>
  )
}
