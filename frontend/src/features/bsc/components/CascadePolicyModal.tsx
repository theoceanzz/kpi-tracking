import { useMemo, useState } from 'react'
import { X, Sliders, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useCascadePolicies, useCascadePolicyMutations } from '../hooks/useBscCascade'
import {
  BscFactorMode, BscFactorScope, BscLinkedWeightEnforce,
  type CascadePolicyResponse, type FactorBandRequest,
} from '../types'

interface CascadePolicyModalProps {
  open: boolean
  onClose: () => void
  organizationId?: string
}

/** Kỳ nào cũng dùng được chính sách mặc định, nên sentinel thay cho value rỗng của Radix. */
const NO_CYCLE = '__default__'

const MODE_LABELS: Record<BscFactorMode, string> = {
  [BscFactorMode.BAND_TABLE]: 'Tra bảng dải (khuyến nghị)',
  [BscFactorMode.DIRECT_RATIO]: 'Nhân thẳng tỉ lệ đạt',
  [BscFactorMode.NONE]: 'Không áp hệ số',
}

const emptyBand = (scope: BscFactorScope): FactorBandRequest => ({
  scope, fromPercent: null, toPercent: null, factor: 1, label: '', color: '#3b82f6',
})

/**
 * Chính sách hệ số cascade — nơi quyết định mô hình phạt nặng hay nhẹ.
 *
 * <p>Mặc định là TRA BẢNG DẢI chứ không nhân thẳng tỉ lệ: nhân thẳng (112 × 0.92 × 0.97 = 99.96)
 * phạt quá nặng và lệch của phòng lẫn công ty cộng dồn theo cấp số nhân. Tra dải cho ra hệ số gần 1
 * (0.90–1.10), giữ được ý "kết quả cấp trên có ảnh hưởng" mà không triệt tiêu động lực.
 */
export default function CascadePolicyModal({ open, onClose, organizationId }: CascadePolicyModalProps) {
  const { data: policies, isLoading } = useCascadePolicies(open ? organizationId : undefined)
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { createPolicy, updatePolicy } = useCascadePolicyMutations()

  const cycles = useMemo(() => cyclesData?.content || [], [cyclesData])
  const [editingId, setEditingId] = useState<string | null>(null)
  // Bản nháp CHỈ tồn tại sau khi người dùng sửa thứ gì đó. Trước đó form đọc thẳng dữ liệu server —
  // nhờ vậy không cần effect đồng bộ, và dữ liệu mới tải về không bị bản nháp rỗng che mất.
  const [draft, setDraft] = useState<CascadePolicyResponse | null>(null)

  const current = policies?.find(p => p.id === editingId) ?? policies?.[0] ?? null
  const form = draft ?? current

  const close = () => { setDraft(null); setEditingId(null); onClose() }

  if (!open) return null

  const patch = (next: Partial<CascadePolicyResponse>) =>
    setDraft(prev => {
      const base = prev ?? form
      return base ? { ...base, ...next } : base
    })

  const patchBand = (index: number, next: Partial<FactorBandRequest>) =>
    setDraft(prev => {
      const base = prev ?? form
      if (!base) return prev
      const bands = base.bands.slice()
      bands[index] = { ...bands[index]!, ...next }
      return { ...base, bands }
    })

  const addBand = (scope: BscFactorScope) =>
    setDraft(prev => {
      const base = prev ?? form
      return base ? { ...base, bands: [...base.bands, { ...emptyBand(scope), id: '' } as never] } : base
    })

  const removeBand = (index: number) =>
    setDraft(prev => {
      const base = prev ?? form
      return base ? { ...base, bands: base.bands.filter((_, i) => i !== index) } : base
    })

  const save = () => {
    if (!form || !organizationId) return
    const payload = {
      name: form.name,
      kpiCycleId: form.kpiCycleId || null,
      unitFactorMode: form.unitFactorMode,
      companyFactorMode: form.companyFactorMode,
      factorBasis: form.factorBasis,
      factorFloor: form.factorFloor,
      factorCap: form.factorCap,
      recognizedCapPercent: form.recognizedCapPercent,
      minBscLinkedWeight: form.minBscLinkedWeight,
      linkedWeightEnforce: form.linkedWeightEnforce,
      bands: form.bands.map((b, i) => ({
        scope: b.scope,
        fromPercent: b.fromPercent ?? null,
        toPercent: b.toPercent ?? null,
        factor: b.factor,
        label: b.label ?? null,
        color: b.color ?? null,
        displayOrder: i,
      })),
    }
    const targetId = editingId ?? current?.id
    if (targetId) updatePolicy.mutate({ policyId: targetId, data: payload }, { onSuccess: close })
    else createPolicy.mutate({ organizationId, data: payload }, { onSuccess: close })
  }

  const bandsOf = (scope: BscFactorScope) =>
    (form?.bands || []).map((b, i) => ({ band: b, index: i })).filter(x => x.band.scope === scope)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Chính sách hệ số cascade</h3>
              <p className="text-[11px] font-bold text-slate-400">
                Kết quả của phòng và công ty ảnh hưởng tới điểm cá nhân bao nhiêu
              </p>
            </div>
          </div>
          <button onClick={close} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}

          {!isLoading && (policies || []).length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {policies!.map(p => (
                <button key={p.id}
                  onClick={() => { setEditingId(p.id); setDraft(null) }}
                  className={cn('px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors',
                    form?.id === p.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400')}>
                  {p.name}{p.kpiCycleName ? ` · ${p.kpiCycleName}` : ' · mặc định'}
                </button>
              ))}
            </div>
          )}

          {form && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tên chính sách">
                  <input value={form.name} onChange={e => patch({ name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold outline-none" />
                </Field>
                <Field label="Kỳ áp dụng" hint="Bỏ trống = chính sách mặc định cho mọi kỳ">
                  <Select value={form.kpiCycleId || NO_CYCLE}
                    onValueChange={v => patch({ kpiCycleId: v === NO_CYCLE ? null : v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[1100]">
                      <SelectItem value={NO_CYCLE}>Mặc định toàn tổ chức</SelectItem>
                      {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Hệ số phòng ban">
                  <Select value={form.unitFactorMode} onValueChange={v => patch({ unitFactorMode: v as BscFactorMode })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[1100]">
                      {Object.entries(MODE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Hệ số công ty">
                  <Select value={form.companyFactorMode} onValueChange={v => patch({ companyFactorMode: v as BscFactorMode })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[1100]">
                      {Object.entries(MODE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {(form.unitFactorMode === BscFactorMode.DIRECT_RATIO
                || form.companyFactorMode === BscFactorMode.DIRECT_RATIO) && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  Nhân thẳng tỉ lệ phạt rất nặng: nhân viên 112 điểm ở phòng đạt 92% và công ty 97%
                  chỉ còn 99.96 điểm. Sàn hệ số bên dưới là thứ duy nhất chặn bớt mức phạt này.
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Sàn hệ số">
                  <NumberBox value={form.factorFloor} onChange={v => patch({ factorFloor: v })} step={0.01} />
                </Field>
                <Field label="Trần hệ số">
                  <NumberBox value={form.factorCap} onChange={v => patch({ factorCap: v })} step={0.01} />
                </Field>
                <Field label="Trần điểm gốc %">
                  <NumberBox value={form.recognizedCapPercent} onChange={v => patch({ recognizedCapPercent: v })} step={1} />
                </Field>
                <Field label="KPI liên kết BSC %">
                  <NumberBox value={form.minBscLinkedWeight} onChange={v => patch({ minBscLinkedWeight: v })} step={1} />
                </Field>
              </div>

              <Field label="Mức áp dụng ràng buộc KPI liên kết BSC"
                hint="WARN = cảnh báo lúc trình duyệt; BLOCK = chặn hẳn. Bật BLOCK ngay kỳ đầu sẽ làm kẹt hàng loạt nhân viên chưa kịp gắn KPI vào BSC.">
                <Select value={form.linkedWeightEnforce}
                  onValueChange={v => patch({ linkedWeightEnforce: v as BscLinkedWeightEnforce })}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[1100]">
                    <SelectItem value={BscLinkedWeightEnforce.WARN}>Chỉ cảnh báo</SelectItem>
                    <SelectItem value={BscLinkedWeightEnforce.BLOCK}>Chặn không cho trình</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {[BscFactorScope.UNIT, BscFactorScope.COMPANY].map(scope => (
                <div key={scope} className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 flex items-center">
                    <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Bảng dải — {scope === BscFactorScope.UNIT ? 'phòng ban' : 'công ty'}
                    </span>
                    <button onClick={() => addBand(scope)}
                      className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1 rounded-lg">
                      <Plus size={11} /> Thêm dải
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bandsOf(scope).map(({ band, index }) => (
                      <div key={index} className="flex items-center gap-2 px-3 py-2">
                        <input type="number" step="any" value={band.fromPercent ?? ''}
                          onChange={e => patchBand(index, { fromPercent: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="−∞"
                          className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[11px] font-bold text-right outline-none focus:placeholder:text-transparent" />
                        <span className="text-[10px] font-black text-slate-400">≤ x &lt;</span>
                        <input type="number" step="any" value={band.toPercent ?? ''}
                          onChange={e => patchBand(index, { toPercent: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="+∞"
                          className="w-16 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[11px] font-bold text-right outline-none focus:placeholder:text-transparent" />
                        <span className="text-[10px] font-black text-slate-400">→ ×</span>
                        <input type="number" step="0.01" value={band.factor}
                          onChange={e => patchBand(index, { factor: Number(e.target.value) })}
                          className="w-16 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] font-black text-right outline-none" />
                        <input value={band.label ?? ''} onChange={e => patchBand(index, { label: e.target.value })}
                          placeholder="Nhãn dải"
                          className="flex-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[11px] font-bold outline-none focus:placeholder:text-transparent" />
                        <button onClick={() => removeBand(index)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-[10px] font-medium text-slate-400">
                Dải là khoảng nửa mở [từ, đến): đúng 95% rơi vào dải 95–105 chứ không phải 80–95.
                Bỏ trống mốc dưới là âm vô cùng, bỏ trống mốc trên là dương vô cùng.
                Các dải cùng một cấp không được chồng lấn nhau.
              </p>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button onClick={close} className="px-4 py-2 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Huỷ
          </button>
          <button onClick={save} disabled={!form || createPolicy.isPending || updatePolicy.isPending}
            className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            {(createPolicy.isPending || updatePolicy.isPending) ? 'Đang lưu...' : 'Lưu chính sách'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] font-medium text-slate-400 ml-1">{hint}</p>}
    </div>
  )
}

function NumberBox({ value, onChange, step }: { value: number; onChange: (v: number) => void; step: number }) {
  return (
    <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-black text-right outline-none" />
  )
}
