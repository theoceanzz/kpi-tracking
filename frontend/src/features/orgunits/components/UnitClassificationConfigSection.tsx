import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Award, Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, Wand2 } from 'lucide-react'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  PRESET_UNIT_RULES_SCORE,
  type OrganizationResponse, type UnitClassRule, type UnitClassScope, type UnitClassOp,
} from '../api/organizationApi'

const SCOPE_OPTS: { v: UnitClassScope; label: string }[] = [
  { v: 'this', label: 'đúng mức' },
  { v: 'orAbove', label: 'trở lên' },
  { v: 'orBelow', label: 'trở xuống' },
]
const OP_OPTS: { v: UnitClassOp; label: string }[] = [
  { v: 'gte', label: '≥' }, { v: 'lte', label: '≤' }, { v: 'gt', label: '>' }, { v: 'lt', label: '<' }, { v: 'eq', label: '=' },
]

/** Màu theo HẠNG ma trận (1 đỏ → 5 xanh) — khớp heatmap/phân bố ma trận. */
const RATING_COLORS: Record<number, string> = { 1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#84cc16', 5: '#10b981' }
const ratingColor = (n: number) => RATING_COLORS[n] ?? '#8b5cf6'

/** Các HẠNG đầu ra phân biệt của ma trận (giá trị ô), cao → thấp. Fallback về 5..1 (ma trận mặc định) khi chưa lưu. */
function matrixGrades(org: OrganizationResponse): number[] {
  try {
    const m = org.performanceMatrix ? JSON.parse(org.performanceMatrix) : null
    const cells: number[][] = m?.cells ?? []
    const set = new Set<number>()
    cells.forEach(row => row.forEach(v => set.add(Number(v))))
    const grades = [...set].sort((a, b) => b - a)
    if (grades.length) return grades
  } catch { /* fallthrough */ }
  return [5, 4, 3, 2, 1]
}

/**
 * Các mức (cao → thấp) theo chế độ org:
 * - Matrix: các HẠNG đầu ra của ma trận ("Loại N" = matrix_rating), KHÔNG phải thang hành vi.
 * - Không matrix: evaluationLevels (thang điểm).
 */
function memberLevels(org: OrganizationResponse): { name: string; color: string }[] {
  if (org.enableQualitative) {
    return matrixGrades(org).map(n => ({ name: `Loại ${n}`, color: ratingColor(n) }))
  }
  return [...(org.evaluationLevels ?? [])].sort((a, b) => b.threshold - a.threshold)
    .map(l => ({ name: l.name, color: l.color ?? '#64748b' }))
}

function presetFor(org: OrganizationResponse): UnitClassRule[] {
  if (org.enableQualitative) {
    // Preset matrix (động theo bộ hạng): đơn vị nhận Loại G nếu ≥50% người ở Loại G trở lên; hạng thấp nhất mặc định.
    const lv = memberLevels(org)
    return lv.map((l, i): UnitClassRule => ({
      levelName: l.name, color: l.color,
      conditions: i === lv.length - 1 ? [] : [{ level: l.name, scope: 'orAbove', op: 'gte', percent: 50 }],
    }))
  }
  return JSON.parse(JSON.stringify(PRESET_UNIT_RULES_SCORE.rules))
}

function initialRules(org: OrganizationResponse): UnitClassRule[] {
  const valid = new Set(memberLevels(org).map(l => l.name))
  if (org.unitClassificationRules) {
    try {
      const parsed = JSON.parse(org.unitClassificationRules)
      // Chỉ dùng rule đã lưu nếu nó thuộc ĐÚNG thang hiện tại (matrix "Loại N" vs thang điểm). Nếu là của
      // thang khác (vd vừa bật ma trận nhưng rule cũ theo Xuất sắc/Tốt) → nạp preset của thang hiện tại.
      if (Array.isArray(parsed?.rules) && parsed.rules.length
          && parsed.rules.some((r: any) => valid.has(r?.levelName))) {
        return parsed.rules
      }
    } catch { /* fallthrough */ }
  }
  return presetFor(org)
}

/** Cấu hình LUẬT xếp loại đơn vị theo phân bố % xếp loại thành viên. */
export default function UnitClassificationConfigSection({ org }: { org: OrganizationResponse }) {
  const update = useUpdateOrganization(org.id)
  const levels = useMemo(() => memberLevels(org), [org])
  const levelNames = useMemo(() => levels.map(l => l.name), [levels])
  const colorOf = (name: string) => levels.find(l => l.name === name)?.color ?? '#64748b'
  const [rules, setRules] = useState<UnitClassRule[]>(() => initialRules(org))

  // Khi đổi THANG (bật/tắt ma trận, sửa mức/ma trận) → nạp lại rule cho đúng thang hiện tại
  // (tránh giữ rule của thang cũ, vd vừa bật ma trận nhưng rule vẫn theo Xuất sắc/Tốt).
  const levelsKey = levelNames.join('|')
  useEffect(() => {
    setRules(initialRules(org))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey])

  const patchRule = (i: number, patch: Partial<UnitClassRule>) =>
    setRules(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const patchCond = (ri: number, ci: number, patch: Partial<UnitClassRule['conditions'][number]>) =>
    setRules(rs => rs.map((r, idx) => idx !== ri ? r : {
      ...r, conditions: r.conditions.map((c, j) => j === ci ? { ...c, ...patch } : c),
    }))

  const addCond = (ri: number) =>
    setRules(rs => rs.map((r, idx) => idx !== ri ? r : {
      ...r, conditions: [...r.conditions, { level: levelNames[0] ?? '', scope: 'this', op: 'gte', percent: 50 }],
    }))

  const removeCond = (ri: number, ci: number) =>
    setRules(rs => rs.map((r, idx) => idx !== ri ? r : { ...r, conditions: r.conditions.filter((_, j) => j !== ci) }))

  const moveRule = (i: number, dir: -1 | 1) =>
    setRules(rs => {
      const j = i + dir
      if (j < 0 || j >= rs.length) return rs
      const next = [...rs]
      const a = next[i]!, b = next[j]!
      next[i] = b; next[j] = a
      return next
    })

  const addRule = () =>
    setRules(rs => {
      const used = new Set(rs.map(r => r.levelName))
      const pick = levelNames.find(n => !used.has(n)) ?? levelNames[0] ?? 'Mức mới'
      return [...rs, { levelName: pick, color: colorOf(pick), conditions: [] }]
    })

  const removeRule = (i: number) => setRules(rs => rs.filter((_, idx) => idx !== i))

  const applyPreset = () => { setRules(presetFor(org)); toast.success('Đã nạp mẫu gợi ý') }
  const reset = () => setRules(initialRules(org))

  const save = () => {
    if (!rules.length) { toast.error('Cần ít nhất một mức xếp loại'); return }
    if (rules.some(r => !r.levelName.trim())) { toast.error('Tên mức không được để trống'); return }
    const bad = rules.some(r => r.conditions.some(c => !c.level || c.percent < 0 || c.percent > 100))
    if (bad) { toast.error('Điều kiện chưa hợp lệ (% phải 0–100 và chọn mức)'); return }
    update.mutate({ unitClassificationRules: JSON.stringify({ rules }) }, {
      onSuccess: () => toast.success('Đã lưu luật xếp loại đơn vị'),
      onError: () => toast.error('Không thể lưu luật xếp loại đơn vị'),
    })
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 max-sm:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Award size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white">XẾP LOẠI ĐƠN VỊ</h3>
            <p className="text-xs text-slate-500 font-medium">Theo phân bố % xếp loại của thành viên</p>
          </div>
        </div>
        {/* Mobile: 3 nút chia đều, cao 44px và cách nhau rộng để tránh bấm nhầm. Desktop: giữ nguyên hàng nút gọn. */}
        <div className="flex items-center gap-2 max-sm:grid max-sm:grid-cols-3 max-sm:gap-3">
          <button onClick={applyPreset} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 max-sm:min-h-11 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300">
            <Wand2 size={14} /> Áp mẫu
          </button>
          <button onClick={reset} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 max-sm:min-h-11 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300">
            <RotateCcw size={14} /> Đặt lại
          </button>
          <button onClick={save} disabled={update.isPending} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 max-sm:min-h-11 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
            <Save size={14} /> Lưu
          </button>
        </div>
      </div>

      <div className="p-6 max-sm:p-4 space-y-4 max-sm:space-y-5">
        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
          Đơn vị được xếp vào <b>mức CAO NHẤT</b> mà thoả <b>TẤT CẢ</b> điều kiện của mức đó (xét từ trên xuống). Mức cuối (không điều kiện) là mặc định.
        </div>

        {rules.map((r, ri) => (
          <div key={ri} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            {/* Mobile: hàng 1 = nhãn ưu tiên + màu + nhóm nút (44px, tách rời), hàng 2 = select chiếm trọn bề ngang.
                Desktop (sm+): dồn lại một hàng như cũ nhờ order/width reset. */}
            <div className="flex flex-wrap items-center gap-2 max-sm:gap-y-3 mb-3">
              <span className="order-1 text-[10px] font-black text-slate-400 uppercase">Ưu tiên {ri + 1}</span>
              <span className="order-2 w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0" style={{ backgroundColor: r.color }} title="Màu theo loại" />
              <Select value={r.levelName} onValueChange={v => patchRule(ri, { levelName: v, color: colorOf(v) })}>
                <SelectTrigger className="order-3 max-sm:order-4 flex-1 max-sm:w-full min-w-[140px] h-10 max-sm:h-12 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-sm font-black" style={{ color: r.color }}>
                  <SelectValue placeholder="Chọn loại xếp loại" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}
                  {!levelNames.includes(r.levelName) && r.levelName && <SelectItem value={r.levelName}>{r.levelName}</SelectItem>}
                </SelectContent>
              </Select>
              <div className="order-4 max-sm:order-3 max-sm:ml-auto flex items-center gap-1 max-sm:gap-2">
                <button onClick={() => moveRule(ri, -1)} disabled={ri === 0} className="p-1.5 max-sm:w-11 max-sm:h-11 max-sm:bg-slate-50 max-sm:dark:bg-slate-800/60 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30" title="Lên"><ArrowUp size={15} /></button>
                <button onClick={() => moveRule(ri, 1)} disabled={ri === rules.length - 1} className="p-1.5 max-sm:w-11 max-sm:h-11 max-sm:bg-slate-50 max-sm:dark:bg-slate-800/60 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30" title="Xuống"><ArrowDown size={15} /></button>
                {/* Nút xoá tách xa hơn 2 nút di chuyển trên mobile để tránh bấm nhầm */}
                <button onClick={() => removeRule(ri)} className="p-1.5 max-sm:w-11 max-sm:h-11 max-sm:ml-2 max-sm:bg-red-50/70 max-sm:dark:bg-red-900/20 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" title="Xoá mức"><Trash2 size={15} /></button>
              </div>
            </div>

            <div className="space-y-2 max-sm:space-y-3">
              {r.conditions.length === 0 && (
                <p className="text-[11px] italic text-slate-400 pl-1">Không điều kiện → luôn đúng (mặc định).</p>
              )}
              {r.conditions.map((c, ci) => (
                /* Mobile: lưới 2 cột trong khung riêng — mỗi ô cao 44px, tách hẳn nút xoá xuống góc phải.
                   Desktop (sm+): trở lại một hàng flex gọn như cũ. */
                <div key={ci} className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:gap-2.5 max-sm:rounded-xl max-sm:border max-sm:border-slate-100 max-sm:dark:border-slate-800 max-sm:p-2.5 text-sm">
                  <span className="max-sm:col-span-2 text-[11px] font-bold text-slate-400">% người ở mức</span>
                  <Select value={c.level} onValueChange={v => patchCond(ri, ci, { level: v })}>
                    <SelectTrigger className="max-sm:col-span-2 max-sm:w-full max-sm:h-11 h-8 w-auto min-w-[110px] max-sm:min-w-0 gap-1 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levelNames.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      {!levelNames.includes(c.level) && c.level && <SelectItem value={c.level}>{c.level}</SelectItem>}
                    </SelectContent>
                  </Select>
                  <Select value={c.scope} onValueChange={v => patchCond(ri, ci, { scope: v as UnitClassScope })}>
                    <SelectTrigger className="max-sm:w-full max-sm:h-11 h-8 w-auto min-w-[92px] max-sm:min-w-0 gap-1 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOPE_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={c.op} onValueChange={v => patchCond(ri, ci, { op: v as UnitClassOp })}>
                    <SelectTrigger className="max-sm:w-full max-sm:h-11 h-8 w-[64px] gap-1 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-xs font-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OP_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <input type="number" min={0} max={100} value={c.percent}
                      onChange={e => patchCond(ri, ci, { percent: Number(e.target.value) })}
                      className="w-16 max-sm:w-full max-sm:h-11 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="text-[11px] font-bold text-slate-400">%</span>
                  </div>
                  {/* Nút xoá nằm hẳn góc phải dưới trên mobile, cách xa ô nhập % */}
                  <button onClick={() => removeCond(ri, ci)} className="p-1 max-sm:w-11 max-sm:h-11 max-sm:justify-self-end max-sm:bg-red-50/70 max-sm:dark:bg-red-900/20 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" title="Xoá điều kiện"><Trash2 size={13} className="max-sm:w-4 max-sm:h-4" /></button>
                </div>
              ))}
              <button onClick={() => addCond(ri)} className="inline-flex items-center gap-1 max-sm:gap-1.5 max-sm:min-h-11 max-sm:text-xs text-[11px] font-bold text-indigo-600 hover:text-indigo-700 pl-1 pr-2">
                <Plus size={13} className="max-sm:w-[15px] max-sm:h-[15px]" /> Thêm điều kiện
              </button>
            </div>
          </div>
        ))}

        <button onClick={addRule} className="w-full py-2.5 max-sm:min-h-12 max-sm:mt-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 inline-flex items-center justify-center gap-1.5">
          <Plus size={14} /> Thêm mức xếp loại
        </button>
      </div>
    </section>
  )
}
