import { LocaleNumberInput } from '@/components/ui/number-input'
import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, Bar, Line, Cell,
} from 'recharts'
import { AlertTriangle, Users, Wand2 } from 'lucide-react'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BellCurveMode, UnitBellTarget, UnitClassBellCurve } from '../api/organizationApi'
import {
  bellTargets, defaultBellCurve, maxQuota, minQuota, r1, roundTo100, sumTargets,
} from '../utils/bellCurve'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const MODE_OPTS = perLanguage((): { v: BellCurveMode; label: string }[] => ([
  { v: 'warn', label: i18n.t('orgunits:BellCurveEditor.warningOnly') },
  { v: 'block', label: i18n.t('orgunits:BellCurveEditor.blockFinalization') },
]))

const PRESETS = perLanguage((): { label: string; hint: string; shift: number; spread: number }[] => ([
  { label: i18n.t('orgunits:BellCurveEditor.standard'), hint: i18n.t('orgunits:BellCurveEditor.balancedBellPeakAtTheMiddle'), shift: 0, spread: 4 },
  { label: i18n.t('orgunits:BellCurveEditor.strict'), hint: i18n.t('orgunits:BellCurveEditor.peakSkewedDownFewPeopleAt'), shift: -0.6, spread: 4 },
  { label: i18n.t('orgunits:BellCurveEditor.lenient'), hint: i18n.t('orgunits:BellCurveEditor.peakSkewedUpManyPeopleAt'), shift: 0.6, spread: 4 },
  { label: i18n.t('orgunits:BellCurveEditor.even'), hint: i18n.t('orgunits:BellCurveEditor.flatBellLevelsNearlyEqual'), shift: 0, spread: 1.6 },
]))

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
  const { t } = useTranslation('orgunits')
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-2 rounded-card text-xs">
      <p className="font-semibold text-[var(--color-foreground)] mb-1.5 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.level}
      </p>
      <p className="font-semibold text-[var(--color-muted-foreground)]">{t('BellCurveEditor.points')} {d.percent}%</p>
      <p className="text-[var(--color-muted-foreground)]">{t('BellCurveEditor.allow')} {d.min}%–{d.max}%</p>
      <p className="text-[var(--color-muted-foreground)]">≈ {d.minPeople}–{d.maxPeople} {t('BellCurveEditor.people')} {headcount}</p>
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
  const { t: tr } = useTranslation('orgunits')
  const levelNames = useMemo(() => levels.map(l => l.name), [levels])
  // Quy mô giả định để quy % ra số người — chỉ phục vụ xem trước, không lưu vào cấu hình.
  const [headcount, setHeadcount] = useState(20)

  const bc = value
  const colorOf = (name: string) => levels.find(l => l.name === name)?.color ?? '#64748b'

  const targets = useMemo<UnitBellTarget[]>(() => {
    const byLevel = new Map((bc?.targets ?? []).map(t => [t.level, Number(t.percent) || 0]))
    return levelNames.map(level => ({ level, percent: byLevel.get(level) ?? 0 }))
  }, [bc?.targets, levelNames])

  const total = sumTargets(targets)
  const activePreset = PRESETS().find(p =>
    bellTargets(levelNames, p.shift, p.spread).every(st => Math.abs((targets.find(t => t.level === st.level)?.percent ?? -1) - st.percent) < 0.01))
  const balanced = Math.abs(total - 100) < 0.5
  const tolerance = bc?.tolerance ?? 5

  const patch = (p: Partial<UnitClassBellCurve>) =>
    onChange({ ...(bc ?? defaultBellCurve(levelNames)), ...p })

  /**
   * Kéo một mức thì các mức còn lại tự co giãn theo tỷ lệ đang có để tổng luôn đúng 100%.
   * Trước đây mỗi thanh độc lập, người dùng phải tự cộng nhẩm rồi bấm "Chuẩn hoá" — bước đó
   * chính là chỗ khó dùng nhất của màn hình này.
   */
  const setPercent = (level: string, raw: number) => {
    const percent = Math.min(100, Math.max(0, raw))
    const others = targets.filter(t => t.level !== level)
    const rest = 100 - percent
    const sumOthers = others.reduce((a, t) => a + t.percent, 0)
    const scaled = targets.map(t => {
      if (t.level === level) return percent
      if (sumOthers <= 0) return others.length ? rest / others.length : 0
      return (t.percent * rest) / sumOthers
    })
    const rounded = roundTo100(levelNames, scaled)
    // roundTo100 có thể dồn phần lẻ vào chính mức vừa kéo; ép lại đúng số người dùng chọn.
    const fixed = rounded.map(t => t.level === level ? { ...t, percent } : t)
    const drift = 100 - sumTargets(fixed)
    if (Math.abs(drift) >= 0.5) {
      const idx = fixed.findIndex(t => t.level !== level && t.percent + drift >= 0)
      if (idx >= 0) fixed[idx] = { ...fixed[idx]!, percent: fixed[idx]!.percent + drift }
    }
    patch({ targets: fixed })
  }

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

  return (
    <div className="space-y-3">
      {/* Mẫu phân bố đặt TRƯỚC biểu đồ: đa số chỉ cần chọn một mẫu rồi chỉnh nhẹ. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 text-label"><Wand2 size={14} aria-hidden="true" /> {tr('BellCurveEditor.distributionTemplate')}</span>
        {PRESETS().map(p => (
          <ChoiceChip key={p.label} selected={activePreset?.label === p.label} title={p.hint} onClick={() => patch({ targets: bellTargets(levelNames, p.shift, p.spread) })}>
            {p.label}
          </ChoiceChip>
        ))}
        <span className="text-caption">{activePreset?.hint ?? tr('BellCurveEditor.customDragEachLevelBelowThe')}</span>
      </div>

      {/* ── Biểu đồ: vẽ lại ngay theo từng lần kéo thanh trượt ── */}
      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
        <div className="h-[220px] max-sm:h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border)]">
          <span className="text-eyebrow inline-flex items-center gap-1">
            <Users size={12} aria-hidden="true" /> {tr('BellCurveEditor.previewWith')}
          </span>
          <LocaleNumberInput
            type="number" min={1} max={2000} value={headcount}
            onChange={e => setHeadcount(Math.min(2000, Math.max(1, Number(e.target.value) || 1)))}
            aria-label={tr('BellCurveEditor.assumedHeadcountToPreviewTheQuota')}
            className="w-16 h-8 px-2 rounded-control bg-[var(--color-card)] text-xs font-medium border border-[var(--color-border)] outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <span className="text-caption">{tr('BellCurveEditor.people2')}</span>
          <span className="text-caption max-sm:hidden">{tr('BellCurveEditor.slotsPerLevelAreComputedExactly')}</span>
        </div>
      </div>

      {/* ── Tỷ lệ từng mức: thanh trượt + ô số, cả hai cùng sửa một giá trị ── */}
      <div className="space-y-1.5">
        {targets.map(t => {
          const min = Math.max(0, t.percent - tolerance)
          const max = Math.min(100, t.percent + tolerance)
          return (
            <div
              key={t.level}
              className="flex flex-wrap items-center gap-2 max-sm:gap-y-1.5 rounded-card border border-[var(--color-border)] px-2.5 py-2"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(t.level) }} aria-hidden="true" />
              <span className="min-w-[92px] max-sm:min-w-0 max-sm:flex-1 truncate text-sm font-medium text-[var(--color-foreground)]">
                {t.level}
              </span>
              <input
                type="range" min={0} max={100} step={1} value={t.percent}
                onChange={e => setPercent(t.level, Number(e.target.value))}
                aria-label={tr('BellCurveEditor.targetShareForLevel', { level: t.level })}
                className="flex-1 min-w-[120px] max-sm:order-last max-sm:w-full max-sm:min-w-0 h-8 cursor-pointer"
              />
              <div className="flex items-center gap-1">
                <LocaleNumberInput
                  type="number" min={0} max={100} value={t.percent}
                  onChange={e => setPercent(t.level, Number(e.target.value))}
                  aria-label={tr('BellCurveEditor.targetShareForLevel2', { level: t.level })}
                  className="h-8 w-14 rounded-control border-none bg-[var(--color-muted)] px-2 text-sm font-medium tabular-nums text-[var(--color-foreground)] outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
                <span className="text-caption">%</span>
              </div>
              <span className="w-[150px] max-sm:w-auto text-right text-caption tabular-nums" title={tr('BellCurveEditor.allowedPeople', { min: r1(min), max: r1(max), min2: minQuota(min, headcount), max2: maxQuota(max, headcount) })}>
                {tr('BellCurveEditor.max')} <b className="text-[var(--color-foreground)]">{maxQuota(max, headcount)}</b> / {headcount} {tr('BellCurveEditor.people3')}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Tổng: khung chỉ có nghĩa khi các mức phủ đúng 100% nhân sự ── */}
      {!balanced && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--color-warning)]">
          <AlertTriangle size={13} aria-hidden="true" /> {tr('BellCurveEditor.totalIs')} {total}{tr('BellCurveEditor.itMustEqual100ToSave')}
          <Button variant="outline" size="sm" className="ml-auto" type="button" onClick={normalize}>
            {tr('BellCurveEditor.normalizeTo100')}
          </Button>
        </div>
      )}

      {/* ── Tham số áp dụng ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-label">{tr('BellCurveEditor.tolerancePoints')}</span>
          <div className="flex items-center gap-1">
            <LocaleNumberInput
              type="number" min={0} max={50} value={tolerance}
              onChange={e => patch({ tolerance: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })}
              className="w-full h-9 px-2 rounded-control bg-[var(--color-muted)] text-sm font-medium border-none outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
            <span className="text-caption">%</span>
          </div>
          <span className="text-caption">{tr('BellCurveEditor.eachLevelMayBeScoredWithin')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label">{tr('BellCurveEditor.ignoreUnitsUnderPeople')}</span>
          <div className="flex items-center gap-1">
            <LocaleNumberInput
              type="number" min={0} max={500} value={bc?.minMembers ?? 5}
              onChange={e => patch({ minMembers: Math.min(500, Math.max(0, Number(e.target.value) || 0)) })}
              className="w-full h-9 px-2 rounded-control bg-[var(--color-muted)] text-sm font-medium border-none outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
            <span className="text-caption">{tr('BellCurveEditor.people3')}</span>
          </div>
          <span className="text-caption">{tr('BellCurveEditor.sharesAreMeaninglessForGroupsThat')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label">{tr('BellCurveEditor.whenScoringAboveTheCeiling')}</span>
          <Select value={bc?.mode ?? 'warn'} onValueChange={v => patch({ mode: v as BellCurveMode })}>
            <SelectTrigger className="h-9 rounded-control bg-[var(--color-muted)] border-none text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTS().map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-subtle-foreground)]">
        {tr('BellCurveEditor.theQuotaIsComputedOnThe')} <b>{tr('BellCurveEditor.totalHeadcount')}</b> {tr('BellCurveEditor.ofTheUnitIncludingChildUnits')} <b>{tr('BellCurveEditor.block')}</b> {tr('BellCurveEditor.modeOnlyBlocksTheLevelJust')}
      </p>
    </div>
  )
}
