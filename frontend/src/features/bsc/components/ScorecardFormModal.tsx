import { useEffect, useMemo, useState } from 'react'
import { X, Layers, Loader2, Scale } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useBscPerspectives, useScorecardMutations } from '../hooks/useBsc'
import {
  ScorecardResponse, ScorecardRequest, BscScorecardStatus, BscScoringMode, BscEmptyPerspectivePolicy,
} from '../types'

interface ScorecardFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  scorecard?: ScorecardResponse
}

interface WeightRow {
  perspectiveId: string
  code: string
  name: string
  color?: string
  weight: number
  enabled: boolean
}

export default function ScorecardFormModal({ isOpen, onClose, organizationId, scorecard }: ScorecardFormModalProps) {
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const { data: perspectives } = useBscPerspectives(organizationId)
  const { createScorecard, updateScorecard } = useScorecardMutations()

  const [name, setName] = useState('')
  const [vision, setVision] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [status, setStatus] = useState<BscScorecardStatus>(BscScorecardStatus.DRAFT)
  const [emptyPolicy, setEmptyPolicy] = useState<BscEmptyPerspectivePolicy>(BscEmptyPerspectivePolicy.RENORMALIZE)
  const [rows, setRows] = useState<WeightRow[]>([])

  useEffect(() => {
    if (!isOpen) return
    const list = perspectives || []
    if (scorecard) {
      setName(scorecard.name)
      setVision(scorecard.vision || '')
      setPeriodId(scorecard.kpiPeriodId)
      setStatus(scorecard.status)
      setEmptyPolicy(scorecard.emptyPerspectivePolicy)
      setRows(list.map(p => {
        const existing = scorecard.perspectives.find(sp => sp.perspectiveId === p.id)
        return { perspectiveId: p.id, code: p.code, name: p.name, color: p.color, weight: existing?.weightPercentage ?? 0, enabled: !!existing }
      }))
    } else {
      setName('')
      setVision('')
      setPeriodId('')
      setStatus(BscScorecardStatus.DRAFT)
      setEmptyPolicy(BscEmptyPerspectivePolicy.RENORMALIZE)
      setRows(list.map(p => ({ perspectiveId: p.id, code: p.code, name: p.name, color: p.color, weight: 0, enabled: true })))
    }
  }, [isOpen, scorecard, perspectives])

  const enabledRows = rows.filter(r => r.enabled)
  const total = useMemo(() => enabledRows.reduce((s, r) => s + (Number(r.weight) || 0), 0), [enabledRows])
  const isValid = Math.abs(total - 100) <= 0.01 && enabledRows.length > 0

  const setWeight = (id: string, w: number) => setRows(prev => prev.map(r => r.perspectiveId === id ? { ...r, weight: w } : r))
  const toggle = (id: string) => setRows(prev => prev.map(r => r.perspectiveId === id ? { ...r, enabled: !r.enabled } : r))

  const distributeEvenly = () => {
    const en = rows.filter(r => r.enabled)
    if (en.length === 0) return
    const base = Math.floor((100 / en.length) * 10) / 10
    let remainder = Math.round((100 - base * en.length) * 10) / 10
    setRows(prev => prev.map(r => {
      if (!r.enabled) return r
      let w = base
      if (remainder > 0) { w = Math.round((base + 0.1) * 10) / 10; remainder = Math.round((remainder - 0.1) * 10) / 10 }
      return { ...r, weight: w }
    }))
  }

  const isPending = createScorecard.isPending || updateScorecard.isPending

  const handleSubmit = () => {
    if (!name.trim()) return
    if (!periodId) return
    const payload: ScorecardRequest = {
      name: name.trim(),
      vision: vision.trim() || undefined,
      kpiPeriodId: periodId,
      status,
      scoringMode: scorecard?.scoringMode || BscScoringMode.SHADOW,
      emptyPerspectivePolicy: emptyPolicy,
      perspectives: enabledRows.map((r, idx) => ({ perspectiveId: r.perspectiveId, weightPercentage: Number(r.weight) || 0, displayOrder: idx })),
    }
    if (scorecard) {
      updateScorecard.mutate({ scorecardId: scorecard.id, data: payload }, { onSuccess: () => onClose() })
    } else {
      createScorecard.mutate({ organizationId, data: payload }, { onSuccess: () => onClose() })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[92vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{scorecard ? 'Chỉnh sửa thẻ điểm' : 'Tạo thẻ điểm mới'}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">BSC Scorecard</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên thẻ điểm</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Chiến lược Quý 3/2026"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kỳ áp dụng</label>
              <Select value={periodId} onValueChange={setPeriodId} disabled={!!scorecard}>
                <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none">
                  <SelectValue placeholder="Chọn kỳ" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 max-h-[280px]">
                  {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id} className="text-sm font-bold">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tuyên bố chiến lược (Vision)</label>
            <textarea value={vision} onChange={e => setVision(e.target.value)} rows={2} placeholder="Câu tuyên bố chiến lược trung tâm..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái</label>
              <Select value={status} onValueChange={v => setStatus(v as BscScorecardStatus)}>
                <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value={BscScorecardStatus.DRAFT} className="text-sm font-bold text-slate-500">Nháp</SelectItem>
                  <SelectItem value={BscScorecardStatus.ACTIVE} className="text-sm font-bold text-emerald-600">Đang áp dụng</SelectItem>
                  <SelectItem value={BscScorecardStatus.ARCHIVED} className="text-sm font-bold text-amber-600">Lưu trữ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chính sách viễn cảnh rỗng</label>
              <Select value={emptyPolicy} onValueChange={v => setEmptyPolicy(v as BscEmptyPerspectivePolicy)}>
                <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                  <SelectItem value={BscEmptyPerspectivePolicy.RENORMALIZE} className="text-sm font-bold">Chuẩn hóa lại (khuyên dùng)</SelectItem>
                  <SelectItem value={BscEmptyPerspectivePolicy.ZERO_FILL} className="text-sm font-bold">Tính 0 điểm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Weight editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Scale size={12} /> Trọng số viễn cảnh
              </label>
              <button type="button" onClick={distributeEvenly} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider">Chia đều</button>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {rows.map(r => (
                <div key={r.perspectiveId} className={cn('flex items-center gap-3 px-4 py-2.5', !r.enabled && 'opacity-50')}>
                  <button type="button" onClick={() => toggle(r.perspectiveId)}
                    className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', r.enabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600')}>
                    {r.enabled && <span className="text-[9px] font-black">✓</span>}
                  </button>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color || '#8b5cf6' }} />
                  <span className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{r.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="number" min={0} max={100} step={0.1} value={r.weight} disabled={!r.enabled}
                      onChange={e => setWeight(r.perspectiveId, Number(e.target.value))}
                      className="w-20 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    <span className="text-xs font-black text-slate-400">%</span>
                  </div>
                </div>
              ))}
              {rows.length === 0 && <div className="px-4 py-6 text-center text-xs font-bold text-slate-400">Chưa có viễn cảnh nào — hãy tạo viễn cảnh trước.</div>}
            </div>
            <div className={cn('flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-black border',
              isValid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300')}>
              <span>Tổng trọng số</span>
              <span>{total.toFixed(1)}% {!isValid && `(cần đủ 100%)`}</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={isPending || !isValid || !name.trim() || !periodId}
            className="flex-[2] px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {isPending && <Loader2 className="animate-spin" size={18} />}
            {scorecard ? 'Lưu thay đổi' : 'Xác nhận tạo'}
          </button>
        </div>
      </div>
    </div>
  )
}
