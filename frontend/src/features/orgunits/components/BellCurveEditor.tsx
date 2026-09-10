import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, Bar, Line, Cell,
} from 'recharts'
import { AlertTriangle, CheckCircle2, Scale, Users, Wand2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { BellCurveMode, UnitBellTarget, UnitClassBellCurve } from '../api/organizationApi'
import {
  bellTargets, defaultBellCurve, maxQuota, minQuota, r1, roundTo100, sumTargets,
} from '../utils/bellCurve'

const MODE_OPTS: { v: BellCurveMode; label: string }[] = [
  { v: 'warn', label: 'Chỉ cảnh báo' },
  { v: 'block', label: 'Chặn không cho chốt' },
]

const PRESETS: { label: string; hint: string; shift: number; spread: number }[] = [
  { label: 'Chuẩn', hint: 'Chuông cân, đỉnh ở mức giữa', shift: 0, spread: 4 },
  { label: 'Siết', hint: 'Đỉnh lệch xuống, ít người mức cao', shift: -0.6, spread: 4 },
  { label: 'Nới', hint: 'Đỉnh lệch lên, nhiều người mức cao', shift: 0.6, spread: 4 },
  { label: 'Dàn đều', hint: 'Chuông bè, các mức gần bằng nhau', shift: 0, spread: 1.6 },
]

type ChartRow = {
  level: string
  color: string
  percent: number
  min: number
  max: number
  band: [number, number]
  minPeople: number
  maxPeople: number
}

/** Tooltip: đọc thẳng ra số người, vì đó mới là thứ người chấm đụng phải. */
function CurveTooltip({ active, payload, headcount }: {
  active?: boolean
  payload?: { payload: ChartRow }[]
  headcount: number
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl shadow-lg text-xs">
      <p className="font-black text-slate-900 dark:text-white mb-1.5 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.level}
      </p>
      <p className="font-bold text-slate-600 dark:text-slate-300">Mốc: {d.percent}%</p>
      <p className="text-slate-500">Cho phép {d.min}%–{d.max}%</p>
      <p className="text-slate-500">≈ {d.minPeople}–{d.maxPeople} người / {headcount}</p>
    </div>
  )
}

/**
 * Cấu hình khung bell curve (forced distribution) của MỘT hồ sơ xếp loại: hạn mức % mỗi mức mà
 * đơn vị được phép chấm cho nhân sự, kèm biểu đồ vẽ lại ngay theo từng lần kéo.
 *
 * Biểu đồ xếp trục X từ mức THẤP → CAO (ngược thứ tự thang) để hình chuông đọc trái sang phải
 * đúng như tên gọi; bảng thang mức phía trên vẫn liệt kê cao → thấp như cũ.
 */
export default function BellCurveEditor({
  value, levels, onChange,
}: {
  value: UnitClassBellCurve | undefined
  /** Mức thành viên, CAO → THẤP. */
  levels: { name: string; color: string }[]
  onChange: (next: UnitClassBellCurve | undefined) => void
}) {
  const levelNames = useMemo(() => levels.map(l => l.name), [levels])
  // Quy mô giả định để quy % ra số người — chỉ phục vụ xem trước, không lưu vào cấu hình.
  const [headcount, setHeadcount] = useState(20)

  const bc = value
  const enabled = !!bc?.enabled
  const colorOf = (name: string) => levels.find(l => l.name === name)?.color ?? '#64748b'

  const targets = useMemo<UnitBellTarget[]>(() => {
    const byLevel = new Map((bc?.targets ?? []).map(t => [t.level, Number(t.percent) || 0]))
    return levelNames.map(level => ({ level, percent: byLevel.get(level) ?? 0 }))
  }, [bc?.targets, levelNames])

  const total = sumTargets(targets)
  const balanced = Math.abs(total - 100) < 0.5
  const tolerance = bc?.tolerance ?? 5

  const patch = (p: Partial<UnitClassBellCurve>) =>
    onChange({ ...(bc ?? defaultBellCurve(levelNames)), ...p })

  const setPercent = (level: string, percent: number) =>
    patch({ targets: targets.map(t => t.level === level ? { ...t, percent: Math.min(100, Math.max(0, percent)) } : t) })

  /** Chuẩn hoá về đúng 100% theo tỷ lệ hiện có — giữ nguyên hình dạng người dùng đã kéo. */
  const normalize = () => {
    if (total <= 0) return patch({ targets: bellTargets(levelNames) })
    patch({ targets: roundTo100(levelNames, targets.map(t => (t.percent * 100) / total)) })
  }

  const data = useMemo<ChartRow[]>(() => [...targets].reverse().map(t => {
    const min = Math.max(0, t.percent - tolerance)
    const max = Math.min(100, t.percent + tolerance)
    return {
      level: t.level,
      color: colorOf(t.level),
      percent: r1(t.percent),
      min: r1(min),
      max: r1(max),
      band: [r1(min), r1(max)],
      minPeople: minQuota(min, headcount),
      maxPeople: maxQuota(max, headcount),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [targets, tolerance, headcount, levels])

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <Scale size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            <b className="text-slate-700 dark:text-slate-200">Bell curve</b> khống chế tỷ lệ khi chấm
            nhân sự: mỗi mức có một hạn mức % số người của đơn vị. Chấm vượt trần thì hệ thống
            cảnh báo — hoặc chặn không cho chốt đánh giá, tuỳ chế độ.
            <br />Khác với <b>luật xếp loại</b> ở tab bên: luật quyết định ĐƠN VỊ được xếp mức nào,
            còn khung này giới hạn ĐƠN VỊ được chấm bao nhiêu người ở mỗi mức.
          </p>
        </div>
        <button
          type="button"
          // Khung đã tắt vẫn còn trong form → bật lại là dùng tiếp tỷ lệ cũ, không nạp lại mẫu.
          onClick={() => onChange(bc ? { ...bc, enabled: true } : defaultBellCurve(levelNames))}
          className="w-full h-10 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Scale size={14} aria-hidden="true" /> Bật khung bell curve
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Khung bell curve</span>
        <span className="text-[11px] text-slate-400 truncate">hạn mức % mỗi mức khi chấm nhân sự</span>
        <button
          type="button"
          onClick={() => patch({ enabled: false })}
          className="ml-auto px-2.5 h-7 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 cursor-pointer"
        >
          Tắt khung
        </button>
      </div>

      {/* ── Biểu đồ: vẽ lại ngay theo từng lần kéo thanh trượt ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20 p-3">
        <div className="h-[220px] max-sm:h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" vertical={false} />
              <XAxis
                dataKey="level" tickLine={false} axisLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} interval={0}
                // Tên mức dài ("TRUNG BÌNH") ở 5 mức là chồng lên nhau — cắt bớt, tên đầy đủ
                // vẫn đọc được ở tooltip và ở danh sách thanh trượt ngay bên dưới.
                tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)}
              />
              <YAxis
                tickLine={false} axisLine={false} width={44} unit="%"
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              />
              <Tooltip content={<CurveTooltip headcount={headcount} />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              {/* Dải dung sai vẽ TRƯỚC để nằm dưới cột và đường cong. */}
              <Area dataKey="band" stroke="none" fill="#6366f1" fillOpacity={0.12} isAnimationActive={false} />
              <Bar dataKey="percent" barSize={26} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map(d => <Cell key={d.level} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
              <Line
                type="monotone" dataKey="percent" stroke="#4f46e5" strokeWidth={2.5}
                dot={{ r: 3, fill: '#4f46e5' }} isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Quy mô giả định: % chỉ có nghĩa khi thấy nó ra bao nhiêu người. */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <Users size={12} aria-hidden="true" /> Xem thử với
          </span>
          <input
            type="number" min={1} max={2000} value={headcount}
            onChange={e => setHeadcount(Math.min(2000, Math.max(1, Number(e.target.value) || 1)))}
            aria-label="Số nhân sự giả định để xem thử hạn mức"
            className="w-16 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 text-xs font-bold border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-[11px] font-bold text-slate-500">nhân sự</span>
          <span className="text-[11px] text-slate-400 max-sm:hidden">— số suất mỗi mức tính đúng như lúc hệ thống chặn</span>
        </div>
      </div>

      {/* ── Mẫu hình dạng ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <Wand2 size={12} aria-hidden="true" /> Mẫu
        </span>
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            title={p.hint}
            onClick={() => patch({ targets: bellTargets(levelNames, p.shift, p.spread) })}
            className="px-2.5 h-7 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Tỷ lệ từng mức: thanh trượt + ô số, cả hai cùng sửa một giá trị ── */}
      <div className="space-y-1.5">
        {targets.map(t => {
          const min = Math.max(0, t.percent - tolerance)
          const max = Math.min(100, t.percent + tolerance)
          return (
            <div
              key={t.level}
              className="flex flex-wrap items-center gap-2 max-sm:gap-y-1.5 rounded-xl border border-slate-100 dark:border-slate-800 px-2.5 py-2"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(t.level) }} aria-hidden="true" />
              <span className="min-w-[92px] max-sm:min-w-0 max-sm:flex-1 text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">
                {t.level}
              </span>
              <input
                type="range" min={0} max={100} step={1} value={t.percent}
                onChange={e => setPercent(t.level, Number(e.target.value))}
                aria-label={`Tỷ lệ mục tiêu mức ${t.level}`}
                className="flex-1 min-w-[120px] max-sm:order-last max-sm:w-full max-sm:min-w-0 h-8 accent-indigo-600 cursor-pointer"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0} max={100} value={t.percent}
                  onChange={e => setPercent(t.level, Number(e.target.value))}
                  aria-label={`Tỷ lệ mục tiêu mức ${t.level} (%)`}
                  className="w-14 h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] font-bold text-slate-400">%</span>
              </div>
              <span className="w-[132px] max-sm:w-auto text-right text-[11px] font-bold text-slate-400 tabular-nums">
                {minQuota(min, headcount)}–{maxQuota(max, headcount)} người ({r1(min)}–{r1(max)}%)
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Tổng: khung chỉ có nghĩa khi các mức phủ đúng 100% nhân sự ── */}
      <div className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold',
        balanced
          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
      )}>
        {balanced
          ? <><CheckCircle2 size={13} aria-hidden="true" /> Tổng 100% — khung hợp lệ</>
          : <><AlertTriangle size={13} aria-hidden="true" /> Tổng đang {total}% — phải bằng 100% mới lưu được</>}
        {!balanced && (
          <button
            type="button"
            onClick={normalize}
            className="ml-auto px-2.5 h-7 rounded-lg bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
          >
            Chuẩn hoá về 100%
          </button>
        )}
      </div>

      {/* ── Tham số áp dụng ── */}
      <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dung sai ±</span>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} max={50} value={tolerance}
              onChange={e => patch({ tolerance: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })}
              className="w-full h-9 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-bold text-slate-400">%</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bỏ qua đơn vị dưới</span>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} max={500} value={bc?.minMembers ?? 5}
              onChange={e => patch({ minMembers: Math.min(500, Math.max(0, Number(e.target.value) || 0)) })}
              className="w-full h-9 px-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-bold text-slate-400">người</span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Khi vượt trần</span>
          <Select value={bc?.mode ?? 'warn'} onValueChange={v => patch({ mode: v as BellCurveMode })}>
            <SelectTrigger className="h-9 rounded-lg bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Hạn mức tính trên <b>tổng nhân sự</b> của đơn vị (gồm đơn vị con), không phải số người đã
        chấm — nếu không thì người đầu tiên được chấm luôn chiếm 100%. Chế độ <b>chặn</b> chỉ chặn
        đúng mức vừa chấm khi mức đó đã kín suất; thiếu người ở mức nào thì chỉ nhắc, vì giữa kỳ
        chấm chưa xong không thể ép.
      </p>
    </div>
  )
}
