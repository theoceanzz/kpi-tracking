import { useMemo, useState } from 'react'
import { X, Sliders, Loader2, Plus, Trash2, Info, Check, ChevronDown } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useCascadePolicies, useCascadePolicyMutations } from '../hooks/useBscCascade'
import { BscLinkedWeightEnforce, type CascadePolicyResponse } from '../types'

interface CascadePolicyModalProps {
  open: boolean
  onClose: () => void
  organizationId?: string
}

/** Ba phạm vi áp dụng, đúng bộ với bộ tiêu chí (chỉ thêm mức áp dụng cho toàn tổ chức). */
type Scope = 'DEFAULT' | 'CYCLE' | 'PERIOD'

const SCOPE_HINT: Record<Scope, string> = {
  DEFAULT: 'Áp dụng cho MỌI kỳ và đợt chưa có chính sách riêng. Mỗi tổ chức chỉ có một bản như vậy.',
  CYCLE: 'Chỉ áp dụng cho các đợt thuộc kỳ được chọn — trừ đợt nào có chính sách riêng của nó.',
  PERIOD: 'Chỉ áp dụng cho đúng những đợt được tick, không ảnh hưởng các đợt khác trong cùng kỳ.',
}

/** Bản nháp cho chính sách MỚI — trùng đúng hằng số mặc định của backend (120 / 60 / cảnh báo). */
const blankPolicy = (): CascadePolicyResponse => ({
  id: '',
  name: '',
  kpiCycleId: null,
  kpiCycleName: null,
  periods: [],
  recognizedCapPercent: 120,
  minBscLinkedWeight: 60,
  linkedWeightEnforce: BscLinkedWeightEnforce.WARN,
  status: 'ACTIVE',
  version: 1,
})

const scopeOf = (p: CascadePolicyResponse): Scope =>
  p.kpiCycleId ? 'CYCLE' : (p.periods?.length ? 'PERIOD' : 'DEFAULT')

/**
 * Chính sách điểm BSC — hai con số tác động tới điểm, cộng phạm vi áp dụng.
 *
 * <p>Phạm vi đi đúng bộ với bộ tiêu chí: gắn theo ĐỢT (tick nhiều), theo KỲ (mọi đợt trong kỳ),
 * hoặc để trống làm bản MẶC ĐỊNH của tổ chức. Lúc chấm, hệ thống tra từ hẹp tới rộng: đợt → kỳ →
 * mặc định → hằng số 120/60 trong BscCascadeService.
 *
 * <p>Vì vậy màn này phải cho TẠO THÊM chính sách chứ không chỉ sửa một bản: đổi phạm vi của bản
 * mặc định là mất luôn mức mặc định của cả tổ chức.
 */
export default function CascadePolicyModal({ open, onClose, organizationId }: CascadePolicyModalProps) {
  const { data: policies, isLoading } = useCascadePolicies(open ? organizationId : undefined)
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { data: periodsData } = useKpiPeriods({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { createPolicy, updatePolicy, deletePolicy } = useCascadePolicyMutations()

  const cycles = useMemo(() => cyclesData?.content || [], [cyclesData])
  const allPeriods = useMemo(() => periodsData?.content || [], [periodsData])

  /** Đợt gom theo kỳ mẹ — danh sách đợt phẳng thì không nhìn ra đợt nào thuộc kỳ nào. */
  const periodGroups = useMemo(() => {
    const groups = new Map<string, { label: string; items: typeof allPeriods }>()
    for (const p of allPeriods) {
      const key = p.cycleId || '__none__'
      if (!groups.has(key)) groups.set(key, { label: p.cycleName || 'Không thuộc kỳ nào', items: [] })
      groups.get(key)!.items.push(p)
    }
    return [...groups.entries()]
      .sort((a, b) => (a[0] === '__none__' ? 1 : b[0] === '__none__' ? -1 : 0))
      .map(([, g]) => g)
  }, [allPeriods])

  const [editingId, setEditingId] = useState<string | null>(null)
  /**
   * Phạm vi người dùng vừa bấm. PHẢI là state riêng chứ không suy từ dữ liệu: vừa bấm "Kỳ" thì
   * chưa có kỳ nào được chọn, suy từ dữ liệu sẽ vẫn ra "toàn tổ chức" ⇒ nút bấm không ăn gì và
   * ô chọn kỳ không bao giờ hiện ra.
   */
  const [scopeOverride, setScopeOverride] = useState<Scope | null>(null)
  // Đang soạn bản MỚI: tách hẳn khỏi editingId, nếu không thao tác lưu sẽ ghi đè bản đang chọn.
  const [isCreating, setIsCreating] = useState(false)
  // Bản nháp CHỈ tồn tại sau khi người dùng sửa thứ gì đó. Trước đó form đọc thẳng dữ liệu server —
  // nhờ vậy không cần effect đồng bộ, và dữ liệu mới tải về không bị bản nháp rỗng che mất.
  const [draft, setDraft] = useState<CascadePolicyResponse | null>(null)

  const list = policies || []
  const selected = isCreating ? null : (list.find(p => p.id === editingId) ?? list[0] ?? null)
  // Chưa có chính sách nào ⇒ mở thẳng form tạo mới, đừng để modal trống trơn.
  const form = draft ?? selected ?? (isLoading ? null : blankPolicy())
  const creating = isCreating || !selected
  const scope: Scope = scopeOverride ?? (form ? scopeOf(form) : 'DEFAULT')
  const periodIds = (form?.periods || []).map(p => p.id)

  const close = () => {
    setDraft(null); setEditingId(null); setIsCreating(false); setScopeOverride(null); onClose()
  }

  if (!open) return null

  const patch = (next: Partial<CascadePolicyResponse>) =>
    setDraft(prev => ({ ...(prev ?? form ?? blankPolicy()), ...next }))

  const pick = (id: string | null) => {
    setDraft(null)
    setScopeOverride(null)
    setIsCreating(id === null)
    setEditingId(id)
  }

  const setScope = (next: Scope) => {
    setScopeOverride(next)
    // Đổi phạm vi là xoá phạm vi cũ: gửi lên cả kỳ lẫn đợt sẽ bị backend từ chối.
    if (next === 'DEFAULT') patch({ kpiCycleId: null, kpiCycleName: null, periods: [] })
    if (next === 'CYCLE') patch({ periods: [] })
    if (next === 'PERIOD') patch({ kpiCycleId: null, kpiCycleName: null })
  }

  const togglePeriod = (id: string, name: string) => {
    const has = periodIds.includes(id)
    patch({
      periods: has
        ? (form?.periods || []).filter(p => p.id !== id)
        : [...(form?.periods || []), { id, name }],
      kpiCycleId: null,
      kpiCycleName: null,
    })
  }

  const save = () => {
    if (!form || !organizationId) return
    const payload = {
      name: form.name?.trim() || defaultName(form),
      kpiCycleId: scope === 'CYCLE' ? form.kpiCycleId || null : null,
      kpiPeriodIds: scope === 'PERIOD' ? periodIds : [],
      recognizedCapPercent: form.recognizedCapPercent,
      minBscLinkedWeight: form.minBscLinkedWeight,
      linkedWeightEnforce: form.linkedWeightEnforce,
    }
    if (creating) createPolicy.mutate({ organizationId, data: payload }, { onSuccess: close })
    else updatePolicy.mutate({ policyId: selected!.id, data: payload }, { onSuccess: close })
  }

  // Phạm vi đã có chính sách khác giữ thì khoá lại — backend cũng chặn, đây chỉ để người dùng
  // khỏi gõ xong mới ăn lỗi.
  const others = list.filter(p => p.id !== selected?.id)
  const takenCycleIds = new Set(others.filter(p => p.kpiCycleId).map(p => p.kpiCycleId as string))
  const takenPeriodIds = new Set(others.flatMap(p => (p.periods || []).map(x => x.id)))
  const defaultTaken = others.some(p => scopeOf(p) === 'DEFAULT')

  const periodTriggerLabel = periodIds.length === 0
    ? 'Chọn đợt áp dụng'
    : periodIds.length === 1
      ? (form?.periods?.[0]?.name || '1 đợt')
      : `Đã chọn ${periodIds.length} đợt`

  const canSave = !!form
    && (scope !== 'CYCLE' || !!form.kpiCycleId)
    && (scope !== 'PERIOD' || periodIds.length > 0)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Chính sách điểm BSC</h3>
              <p className="text-[11px] font-bold text-slate-400">
                Trần điểm công nhận và ràng buộc KPI phải liên kết BSC
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

          {/* ── Danh sách chính sách + tạo mới ───────────────────── */}
          {!isLoading && (
            <div className="flex flex-wrap items-center gap-1.5">
              {list.map(p => (
                <button key={p.id} onClick={() => pick(p.id)}
                  title={p.name}
                  className={cn('px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors max-w-[16rem] truncate',
                    !creating && selected?.id === p.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400')}>
                  {p.scopeLabel || p.name}
                </button>
              ))}
              <button onClick={() => pick(null)}
                className={cn('inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black transition-colors border border-dashed',
                  creating
                    ? 'border-indigo-400 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800')}>
                <Plus size={12} /> Chính sách mới
              </button>
            </div>
          )}

          {!isLoading && (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 flex items-start gap-2">
              <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Chấm điểm một đợt, hệ thống tra từ hẹp tới rộng: <b>chính sách gắn đúng đợt</b> →
                <b> chính sách của kỳ</b> chứa đợt đó → <b>chính sách mặc định</b> → nếu không có bản
                nào thì dùng mức có sẵn <b>120 / 60 / chỉ cảnh báo</b>.
              </p>
            </div>
          )}

          {form && !isLoading && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Tên chính sách">
                  <input value={form.name} onChange={e => patch({ name: e.target.value })}
                    placeholder={`VD: ${defaultName(form)}`}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold outline-none focus:placeholder:text-transparent" />
                </Field>

                <Field label="Áp dụng cho" hint={SCOPE_HINT[scope]}>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { key: 'DEFAULT' as const, label: 'Toàn tổ chức' },
                      { key: 'CYCLE' as const, label: 'Một kỳ' },
                      { key: 'PERIOD' as const, label: 'Một số đợt' },
                    ]).map(opt => (
                      <button key={opt.key} onClick={() => setScope(opt.key)}
                        disabled={opt.key === 'DEFAULT' && defaultTaken && scope !== 'DEFAULT'}
                        title={opt.key === 'DEFAULT' && defaultTaken
                          ? 'Tổ chức đã có một chính sách áp dụng cho toàn bộ — sửa bản đó thay vì tạo thêm'
                          : SCOPE_HINT[opt.key]}
                        className={cn('h-10 px-1 rounded-xl text-[11px] font-black transition-colors disabled:opacity-40',
                          scope === opt.key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700')}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {scope === 'CYCLE' && (
                <Field label="Kỳ áp dụng" hint="Mọi đợt thuộc kỳ này dùng chính sách, trừ đợt nào có bản riêng.">
                  <Select value={form.kpiCycleId || undefined}
                    onValueChange={v => patch({ kpiCycleId: v, periods: [] })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Chọn kỳ đánh giá" /></SelectTrigger>
                    <SelectContent className="z-[1100]">
                      {cycles.map(c => (
                        <SelectItem key={c.id} value={c.id} disabled={takenCycleIds.has(c.id)}>
                          {c.name}{takenCycleIds.has(c.id) ? ' (đã có chính sách)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {scope === 'PERIOD' && (
                <Field label="Đợt áp dụng (chọn nhiều)"
                  hint="Tick nhiều đợt để dùng chung một chính sách. Cần áp dụng cho cả kỳ thì chuyển sang &quot;Kỳ&quot;.">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button"
                        className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold flex items-center justify-between outline-none transition-all">
                        <span className={cn('truncate text-left', periodIds.length === 0 && 'text-slate-400')}>
                          {periodTriggerLabel}
                        </span>
                        <ChevronDown size={14} className="opacity-50 shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start"
                      className="p-2 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto custom-scrollbar z-[1100]">
                      {allPeriods.length === 0 && (
                        <p className="px-3 py-2 text-xs font-bold text-slate-400">Chưa có đợt KPI nào</p>
                      )}
                      {periodGroups.map(g => (
                        <div key={g.label} className="mb-1 last:mb-0">
                          <div className="px-3 py-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{g.label}</span>
                          </div>
                          <div className="space-y-1">
                            {g.items.map(p => {
                              const isSelected = periodIds.includes(p.id)
                              const taken = takenPeriodIds.has(p.id)
                              return (
                                <div key={p.id}
                                  onClick={() => { if (!taken) togglePeriod(p.id, p.name) }}
                                  title={taken ? 'Đợt này đã nằm trong một chính sách khác' : undefined}
                                  className={cn('flex items-center gap-3 px-3 py-2 rounded-xl transition-colors group',
                                    taken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                                    isSelected
                                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                      : !taken && 'hover:bg-slate-50 dark:hover:bg-slate-800')}>
                                  <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700')}>
                                    {isSelected && <Check size={10} strokeWidth={4} />}
                                  </div>
                                  <span className="text-xs font-bold truncate">{p.name}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                </Field>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Trần điểm gốc %"
                  hint="Điểm công nhận = MIN(điểm gốc, trần này). Chặn một cá nhân bay khỏi thang điểm khi chỉ tiêu đặt dễ.">
                  <NumberBox value={form.recognizedCapPercent} onChange={v => patch({ recognizedCapPercent: v })} step={1} />
                </Field>
                <Field label="KPI liên kết BSC %"
                  hint="Tối thiểu bao nhiêu % tổng trọng số KPI của một người phải gắn vào chỉ tiêu BSC của đơn vị.">
                  <NumberBox value={form.minBscLinkedWeight} onChange={v => patch({ minBscLinkedWeight: v })} step={1} />
                </Field>
              </div>

              <Field label="Mức áp dụng ràng buộc KPI liên kết BSC"
                hint="Chỉ cảnh báo = hiện cảnh báo ở màn diễn giải điểm. Chặn = KHÔNG chốt được đánh giá của người chưa đủ tỉ lệ này, và chỉ chặn khi bộ tiêu chí đã chuyển sang chấm chính thức. Bật Chặn ngay kỳ đầu sẽ làm kẹt hàng loạt nhân viên chưa kịp gắn KPI vào BSC.">
                <Select value={form.linkedWeightEnforce}
                  onValueChange={v => patch({ linkedWeightEnforce: v as BscLinkedWeightEnforce })}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[1100]">
                    <SelectItem value={BscLinkedWeightEnforce.WARN}>Chỉ cảnh báo</SelectItem>
                    <SelectItem value={BscLinkedWeightEnforce.BLOCK}>Chặn không cho chốt</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <p className="text-[10px] font-medium text-slate-400">
                Kết quả BSC của phòng ban và công ty KHÔNG nhân vào điểm của nhân viên — nhân viên
                được chấm theo đúng KPI của mình, chỉ bị chặn trần ở con số bên trên.
              </p>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          {!creating && selected && (
            <button onClick={() => deletePolicy.mutate(selected.id, { onSuccess: close })}
              disabled={deletePolicy.isPending}
              title="Xoá chính sách này — phạm vi của nó quay về dùng bản rộng hơn"
              className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40">
              <Trash2 size={14} /> Xoá
            </button>
          )}
          <button onClick={close} className="px-4 py-2 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Huỷ
          </button>
          <button onClick={save} disabled={!canSave || createPolicy.isPending || updatePolicy.isPending}
            className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            {(createPolicy.isPending || updatePolicy.isPending)
              ? 'Đang lưu...'
              : creating ? 'Tạo chính sách' : 'Lưu chính sách'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Tên gợi ý khi người dùng để trống — đủ để phân biệt các bản trong danh sách. */
function defaultName(p: CascadePolicyResponse): string {
  if (p.kpiCycleId) return `Chính sách ${p.kpiCycleName || 'theo kỳ'}`
  if (p.periods?.length) return `Chính sách ${p.periods.map(x => x.name).join(', ')}`
  return 'Chính sách chung toàn tổ chức'
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] font-medium text-slate-400 ml-1 leading-relaxed">{hint}</p>}
    </div>
  )
}

function NumberBox({ value, onChange, step }: {
  value?: number | null
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <input type="number" step={step ?? 1} value={value ?? ''}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-black text-right outline-none" />
  )
}
