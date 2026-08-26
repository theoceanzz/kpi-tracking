import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Award, Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, Wand2,
  Star, Building2, ChevronRight, ChevronDown, Search, X, CalendarRange, HelpCircle,
} from 'lucide-react'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useOrgUnitTree } from '../hooks/useOrgUnitTree'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { usesPerformanceMatrix } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import {
  PRESET_UNIT_RULES_SCORE,
  type OrganizationResponse, type UnitClassRule, type UnitClassProfile, type UnitClassScope, type UnitClassOp,
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
  if (usesPerformanceMatrix(org)) {
    return matrixGrades(org).map(n => ({ name: `Loại ${n}`, color: ratingColor(n) }))
  }
  return [...(org.evaluationLevels ?? [])].sort((a, b) => b.threshold - a.threshold)
    .map(l => ({ name: l.name, color: l.color ?? '#64748b' }))
}

function presetFor(org: OrganizationResponse): UnitClassRule[] {
  if (usesPerformanceMatrix(org)) {
    // Preset matrix (động theo bộ hạng): đơn vị nhận Loại G nếu ≥50% người ở Loại G trở lên; hạng thấp nhất mặc định.
    const lv = memberLevels(org)
    return lv.map((l, i): UnitClassRule => ({
      levelName: l.name, color: l.color,
      conditions: i === lv.length - 1 ? [] : [{ level: l.name, scope: 'orAbove', op: 'gte', percent: 50 }],
    }))
  }
  return JSON.parse(JSON.stringify(PRESET_UNIT_RULES_SCORE.rules))
}

/** Rule hợp lệ với thang hiện tại thì giữ, không thì nạp preset của thang. */
function rulesForScale(org: OrganizationResponse, rules: UnitClassRule[] | undefined): UnitClassRule[] {
  const valid = new Set(memberLevels(org).map(l => l.name))
  if (Array.isArray(rules) && rules.length && rules.some(r => valid.has(r?.levelName))) return rules
  return presetFor(org)
}

interface EditProfile {
  _key: string
  name: string
  isDefault: boolean
  orgUnitIds: string[]
  /** Kỳ áp dụng — rỗng = áp cho mọi kỳ. */
  kpiCycleIds: string[]
  rules: UnitClassRule[]
}

let _seq = 0
const newKey = () => `p${Date.now()}_${_seq++}`

/** Nạp danh sách hồ sơ ban đầu từ org (tương thích ngược hình dạng cũ {rules:[]}). */
function initialProfiles(org: OrganizationResponse): EditProfile[] {
  const fallback = (): EditProfile[] => [
    { _key: newKey(), name: 'Mặc định', isDefault: true, orgUnitIds: [], kpiCycleIds: [], rules: presetFor(org) },
  ]
  if (!org.unitClassificationRules) return fallback()
  try {
    const parsed = JSON.parse(org.unitClassificationRules)
    if (Array.isArray(parsed?.profiles) && parsed.profiles.length) {
      const profs: EditProfile[] = parsed.profiles.map((p: UnitClassProfile) => ({
        _key: newKey(),
        name: p.name || 'Hồ sơ',
        isDefault: !!p.isDefault,
        orgUnitIds: Array.isArray(p.orgUnitIds) ? p.orgUnitIds : [],
        // Hồ sơ lưu trước khi có tính năng gắn kỳ → không có trường này → áp cho mọi kỳ.
        kpiCycleIds: Array.isArray(p.kpiCycleIds) ? p.kpiCycleIds : [],
        rules: rulesForScale(org, p.rules),
      }))
      return normalizeDefaults(profs)
    }
    if (Array.isArray(parsed?.rules) && parsed.rules.length) {
      return [{ _key: newKey(), name: 'Mặc định', isDefault: true, orgUnitIds: [], kpiCycleIds: [], rules: rulesForScale(org, parsed.rules) }]
    }
  } catch { /* fallthrough */ }
  return fallback()
}

/**
 * Đưa danh sách về đúng MỘT hồ sơ mặc định, và hồ sơ đó áp cho MỌI KỲ.
 *
 * Cùng luật với bộ tiêu chí hạnh kiểm: mặc định là chỗ mọi thứ chưa được gán rơi về, nên
 * giới hạn nó theo kỳ là tự tay tạo ra những kỳ không có hồ sơ nào.
 *
 * Cấu hình cũ có thể có nhiều mặc định (một cho mọi kỳ + vài bản riêng theo kỳ). Bản riêng
 * bị HẠ xuống hồ sơ thường chứ không xoá — nó vẫn giữ nguyên luật và kỳ, chỉ mất vai trò
 * "chỗ rơi về", và sẽ hiện cảnh báo "chưa gán đơn vị" để người dùng quyết định giữ hay bỏ.
 */
function normalizeDefaults(profs: EditProfile[]): EditProfile[] {
  if (!profs.length) return profs
  // Ưu tiên giữ mặc định đang áp cho mọi kỳ — đó là cái phủ rộng nhất, hạ nó xuống thì
  // phần lớn đơn vị mất hồ sơ.
  const keep = profs.find(p => p.isDefault && p.kpiCycleIds.length === 0)
    ?? profs.find(p => p.isDefault)
    ?? profs[0]!
  return profs.map(p => p._key === keep._key
    ? { ...p, isDefault: true, kpiCycleIds: [], orgUnitIds: [] }
    : { ...p, isDefault: false })
}

/**
 * Hai hồ sơ có "đụng nhau" về kỳ không? Rỗng = mọi kỳ nên đụng mọi hồ sơ khác… trừ hồ sơ
 * gắn kỳ cụ thể: đó chính là cách ghi đè luật cho riêng một kỳ, không phải xung đột.
 */
function cycleScopesClash(a: string[], b: string[]): boolean {
  if (a.length === 0 && b.length === 0) return true
  if (a.length === 0 || b.length === 0) return false
  return a.some(id => b.includes(id))
}

// ── Cây đơn vị: phẳng hoá (id→name) + lọc theo từ khoá ──────────────────────
function flattenTree(nodes: OrgUnitTreeResponse[]): { id: string; name: string }[] {
  return nodes.flatMap(n => [{ id: n.id, name: n.name }, ...flattenTree(n.children ?? [])])
}
function filterTree(nodes: OrgUnitTreeResponse[], low: string): OrgUnitTreeResponse[] {
  return nodes.reduce<OrgUnitTreeResponse[]>((out, n) => {
    const kids = filterTree(n.children ?? [], low)
    if (n.name.toLowerCase().includes(low) || kids.length) out.push({ ...n, children: kids })
    return out
  }, [])
}

/** Nút biểu tượng — luôn có tên đọc được cho trình đọc màn hình, không chỉ `title`. */
function IconButton({
  label, onClick, danger, accent, disabled, children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  accent?: 'indigo'
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed',
        danger
          ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
          : accent === 'indigo'
            ? 'text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600'
            : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200',
      )}
    >
      {children}
    </button>
  )
}

/** Phần giải thích dài — để sau nút "?" thay vì bày sẵn hai dòng chữ trên danh sách. */
function HelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Hồ sơ xếp loại đơn vị hoạt động thế nào"
          className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 cursor-pointer"
        >
          <HelpCircle size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] text-xs leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">
        <p>Mỗi <b>hồ sơ</b> là một cách xếp loại. Gán cho đơn vị nào thì <b>đơn vị con kế thừa</b>, trừ khi đơn vị con có hồ sơ riêng.</p>
        <p>Đơn vị không được gán dùng hồ sơ <b>mặc định</b>. Mỗi tổ chức có đúng một hồ sơ mặc định và nó luôn áp cho <b>mọi kỳ</b> — giới hạn nó theo kỳ sẽ làm các kỳ còn lại không có hồ sơ nào.</p>
        <p>Hồ sơ gắn <b>kỳ</b> chỉ có hiệu lực trong kỳ đó và <b>ghi đè</b> hồ sơ áp cho mọi kỳ.</p>
        <p>Trong một hồ sơ, đơn vị nhận <b>mức cao nhất</b> thoả <b>tất cả</b> điều kiện, xét từ trên xuống. Mức cuối không điều kiện là mặc định.</p>
      </PopoverContent>
    </Popover>
  )
}

/** Cấu hình NHIỀU HỒ SƠ luật xếp loại đơn vị, mỗi hồ sơ gán cho (các) đơn vị (đơn vị con kế thừa). */
export default function UnitClassificationConfigSection({ org }: { org: OrganizationResponse }) {
  const update = useUpdateOrganization(org.id)
  const { data: tree } = useOrgUnitTree()
  const { data: cyclesData } = useKpiCycles({ organizationId: org.id, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = useMemo(
    () => (cyclesData?.content ?? []).map(c => ({ id: c.id as string, name: c.name as string })),
    [cyclesData],
  )
  const cycleNameById = useMemo(() => {
    const m: Record<string, string> = {}
    cycles.forEach(c => { m[c.id] = c.name })
    return m
  }, [cycles])
  const levels = useMemo(() => memberLevels(org), [org])
  const levelNames = useMemo(() => levels.map(l => l.name), [levels])
  const unitNameById = useMemo(() => {
    const m: Record<string, string> = {}
    flattenTree(tree ?? []).forEach(u => { m[u.id] = u.name })
    return m
  }, [tree])

  const [profiles, setProfiles] = useState<EditProfile[]>(() => initialProfiles(org))
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(profiles[0] ? [profiles[0]._key] : []))

  // Đổi THANG (bật/tắt ma trận, sửa mức/ma trận) → nạp lại hồ sơ cho đúng thang hiện tại.
  const levelsKey = levelNames.join('|')
  useEffect(() => {
    const next = initialProfiles(org)
    setProfiles(next)
    setExpanded(new Set(next[0] ? [next[0]._key] : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey])

  const toggleExpanded = (key: string) =>
    setExpanded(e => {
      const s = new Set(e)
      if (s.has(key)) s.delete(key)
      else s.add(key)
      return s
    })

  const patchProfile = (key: string, patch: Partial<EditProfile>) =>
    setProfiles(ps => ps.map(p => p._key === key ? { ...p, ...patch } : p))

  // Đúng MỘT hồ sơ mặc định cho cả tổ chức, và nó áp cho mọi kỳ: hồ sơ cũ mất vai trò,
  // hồ sơ mới bị gỡ hết kỳ và đơn vị đã gán (mặc định là chỗ rơi về của phần chưa gán).
  const setDefault = (key: string) =>
    setProfiles(ps => ps.map(p => p._key === key
      ? { ...p, isDefault: true, kpiCycleIds: [], orgUnitIds: [] }
      : { ...p, isDefault: false }))

  const addProfile = () => {
    const key = newKey()
    setProfiles(ps => [...ps, { _key: key, name: `Hồ sơ ${ps.length + 1}`, isDefault: false, orgUnitIds: [], kpiCycleIds: [], rules: presetFor(org) }])
    setExpanded(e => new Set([...e, key]))
  }

  const removeProfile = (key: string) =>
    setProfiles(ps => {
      const next = ps.filter(p => p._key !== key)
      // Xoá mất hồ sơ mặc định thì mọi đơn vị chưa gán sẽ rơi về luật mẫu — chỉ định lại
      // một cái thay vì để cấu hình rỗng hoàn toàn.
      if (next.length && !next.some(p => p.isDefault)) return normalizeDefaults(next)
      return next
    })

  // Map đơn vị → tên hồ sơ (khác) đang chiếm, để chặn gán trùng. Chỉ tính hồ sơ có phạm vi
  // KỲ đụng nhau — cùng đơn vị nhưng khác kỳ là cách ghi đè luật cho riêng kỳ đó.
  const takenBy = (key: string): Record<string, string> => {
    const self = profiles.find(p => p._key === key)
    const m: Record<string, string> = {}
    profiles.forEach(p => {
      if (p._key === key || p.isDefault) return
      if (self && !cycleScopesClash(p.kpiCycleIds, self.kpiCycleIds)) return
      p.orgUnitIds.forEach(id => { m[id] = p.name })
    })
    return m
  }

  const applyPreset = (key: string) => { patchProfile(key, { rules: presetFor(org) }); toast.success('Đã nạp mẫu gợi ý') }
  const reset = () => {
    const next = initialProfiles(org)
    setProfiles(next)
    setExpanded(new Set(next[0] ? [next[0]._key] : []))
    toast.success('Đã đặt lại')
  }

  const save = () => {
    if (!profiles.length) { toast.error('Cần ít nhất một hồ sơ'); return }
    // Đúng MỘT hồ sơ mặc định, áp cho mọi kỳ — cùng luật với bộ tiêu chí hạnh kiểm. Giao
    // diện đã giữ bất biến này, kiểm lại ở đây chỉ để dữ liệu cũ không lọt qua.
    const defaults = profiles.filter(p => p.isDefault)
    if (defaults.length !== 1) {
      toast.error(defaults.length ? 'Chỉ được một hồ sơ mặc định' : 'Cần một hồ sơ mặc định')
      return
    }
    const names = profiles.map(p => p.name.trim())
    if (names.some(n => !n)) { toast.error('Tên hồ sơ không được để trống'); return }
    if (new Set(names).size !== names.length) { toast.error('Tên hồ sơ bị trùng'); return }
    for (const p of profiles) {
      if (!p.isDefault && p.orgUnitIds.length === 0) { toast.error(`Hồ sơ "${p.name}" chưa gán đơn vị nào`); return }
      if (!p.rules.length) { toast.error(`Hồ sơ "${p.name}" cần ít nhất một mức xếp loại`); return }
      if (p.rules.some(r => !r.levelName.trim())) { toast.error(`Hồ sơ "${p.name}": tên mức không được để trống`); return }
      if (p.rules.some(r => r.conditions.some(c => !c.level || c.percent < 0 || c.percent > 100))) {
        toast.error(`Hồ sơ "${p.name}": điều kiện chưa hợp lệ (% phải 0–100 và chọn mức)`); return
      }
    }
    const payload: UnitClassProfile[] = profiles.map(p => ({
      name: p.name.trim(), isDefault: p.isDefault,
      // Hồ sơ mặc định là chỗ rơi về của phần chưa gán nên không mang theo đơn vị lẫn kỳ.
      orgUnitIds: p.isDefault ? [] : p.orgUnitIds,
      kpiCycleIds: p.isDefault ? [] : p.kpiCycleIds,
      rules: p.rules,
    }))
    update.mutate({ unitClassificationRules: JSON.stringify({ profiles: payload }) }, {
      onSuccess: () => toast.success('Đã lưu luật xếp loại đơn vị'),
      onError: () => toast.error('Không thể lưu luật xếp loại đơn vị'),
    })
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Đầu trang gọn một hàng. Phần giải thích dài chuyển vào nút "?" — trước đây nó
          chiếm hai dòng chữ nằm chắn ngay giữa nhan đề và danh sách hồ sơ. */}
      <div className="px-5 py-4 max-sm:px-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Award size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-slate-900 dark:text-white leading-tight">XẾP LOẠI ĐƠN VỊ</h3>
          <p className="text-xs text-slate-500 font-medium truncate">
            {profiles.length} hồ sơ · gán theo đơn vị (đơn vị con kế thừa) và theo kỳ
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 max-sm:w-full">
          <HelpPopover />
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-1.5 px-3 h-9 max-sm:flex-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            <RotateCcw size={14} aria-hidden="true" /> Đặt lại
          </button>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-9 max-sm:flex-1 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} aria-hidden="true" /> Lưu
          </button>
        </div>
      </div>

      {/* Chú thích thang mức: hàng mảnh riêng, dính ngay dưới nhan đề vì nó là bảng tra
          dùng suốt lúc soạn điều kiện bên dưới. */}
      <div className="px-5 max-sm:px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/20 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Thang mức</span>
        {levels.map(l => (
          <span key={l.name} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} aria-hidden="true" />{l.name}
          </span>
        ))}
      </div>

      <div className="p-5 max-sm:p-4 space-y-2.5">
        <div className="space-y-2.5">
          {profiles.map(p => (
            <ProfileCard
              key={p._key}
              profile={p}
              levels={levels}
              levelNames={levelNames}
              tree={tree ?? []}
              unitNameById={unitNameById}
              cycles={cycles}
              cycleNameById={cycleNameById}
              takenBy={takenBy(p._key)}
              canDelete={profiles.length > 1}
              isOpen={expanded.has(p._key)}
              onToggle={() => toggleExpanded(p._key)}
              onPatch={patch => patchProfile(p._key, patch)}
              onSetDefault={() => setDefault(p._key)}
              onApplyPreset={() => applyPreset(p._key)}
              onRemove={() => removeProfile(p._key)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addProfile}
          className="w-full h-10 max-sm:h-12 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} aria-hidden="true" /> Thêm hồ sơ xếp loại
        </button>
      </div>
    </section>
  )
}

// ── Thẻ 1 hồ sơ (accordion) ─────────────────────────────────────────────────
function ProfileCard({
  profile: p, levels, levelNames, tree, unitNameById, cycles, cycleNameById,
  takenBy, canDelete, isOpen,
  onToggle, onPatch, onSetDefault, onApplyPreset, onRemove,
}: {
  profile: EditProfile
  levels: { name: string; color: string }[]
  levelNames: string[]
  tree: OrgUnitTreeResponse[]
  unitNameById: Record<string, string>
  cycles: { id: string; name: string }[]
  cycleNameById: Record<string, string>
  takenBy: Record<string, string>
  canDelete: boolean
  isOpen: boolean
  onToggle: () => void
  onPatch: (patch: Partial<EditProfile>) => void
  onSetDefault: () => void
  onApplyPreset: () => void
  onRemove: () => void
}) {
  const assignedNames = p.orgUnitIds.map(id => unitNameById[id]).filter(Boolean) as string[]
  const cycleNames = p.kpiCycleIds.map(id => cycleNameById[id]).filter(Boolean) as string[]
  // Giữ riêng ý định "chỉ một số kỳ" — nếu suy từ độ dài mảng thì vừa bấm sang chế độ đó
  // (chưa kịp chọn kỳ nào) là giao diện lập tức nhảy ngược về "Mọi kỳ".
  const [cycleScope, setCycleScope] = useState<'all' | 'some'>(p.kpiCycleIds.length ? 'some' : 'all')

  const fieldCls = 'h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-bold border border-transparent outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'

  return (
    <div className={cn(
      'rounded-2xl border transition-colors',
      isOpen ? 'border-slate-300 dark:border-slate-700' : 'border-slate-200 dark:border-slate-800',
      p.isDefault && 'border-indigo-300 dark:border-indigo-800',
    )}>
      {/* ── Dòng tiêu đề: đóng thì là bản tóm tắt, mở thì là thanh công cụ của hồ sơ.
          Tên hồ sơ sửa ngay tại đây thay vì lặp lại thành một ô riêng bên dưới. ── */}
      <div className="flex items-center gap-2 p-2.5 max-sm:flex-wrap">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Thu gọn hồ sơ ${p.name}` : `Mở hồ sơ ${p.name}`}
          className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>

        {p.isDefault && (
          <Badge className="gap-1 shrink-0 whitespace-nowrap"><Star size={11} className="fill-white" aria-hidden="true" /> Mặc định</Badge>
        )}

        {isOpen ? (
          <input
            value={p.name}
            onChange={e => onPatch({ name: e.target.value })}
            placeholder="Tên hồ sơ"
            aria-label="Tên hồ sơ xếp loại"
            className={cn(fieldCls, 'flex-1 min-w-[140px] max-w-xs font-black')}
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
          >
            <span className="font-black text-sm truncate">{p.name || 'Hồ sơ'}</span>
            <span className="ml-auto flex items-center gap-2 shrink-0 text-[11px] font-bold text-slate-400 max-sm:hidden">
              <span className="max-w-[200px] truncate" title={assignedNames.join(', ')}>
                {p.isDefault
                  ? 'các đơn vị còn lại'
                  : assignedNames.length
                    ? `${assignedNames[0]}${assignedNames.length > 1 ? ` +${assignedNames.length - 1}` : ''}`
                    : <span className="text-amber-500">chưa gán đơn vị</span>}
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="max-w-[180px] truncate" title={cycleNames.join(', ')}>
                {p.isDefault
                  ? 'mọi kỳ chưa gán'
                  : p.kpiCycleIds.length === 0
                    ? 'mọi kỳ'
                    : `${cycleNames[0] ?? 'Kỳ'}${cycleNames.length > 1 ? ` +${cycleNames.length - 1}` : ''}`}
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{p.rules.length} mức</span>
            </span>
          </button>
        )}

        {isOpen && (
          <div className="flex items-center gap-0.5 shrink-0 max-sm:w-full max-sm:justify-end">
            {!p.isDefault && (
              <IconButton label="Đặt làm hồ sơ mặc định" onClick={onSetDefault} accent="indigo"><Star size={15} /></IconButton>
            )}
            <IconButton label="Nạp mẫu luật gợi ý" onClick={onApplyPreset} accent="indigo"><Wand2 size={15} /></IconButton>
            {canDelete && <IconButton label="Xoá hồ sơ này" onClick={onRemove} danger><Trash2 size={15} /></IconButton>}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {/* ── Một hàng phạm vi: đơn vị áp dụng + kỳ áp dụng ──
              Trước đây là hai khối xếp dọc, mỗi khối có nhãn, nền và dòng chú thích riêng. */}
          <div className="px-3 py-2.5 space-y-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                <Building2 size={12} aria-hidden="true" /> Đơn vị
              </span>
              {p.isDefault ? (
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Mọi đơn vị không được gán hồ sơ khác
                </span>
              ) : (
                <>
                  {p.orgUnitIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[180px]">
                      <span className="truncate">{unitNameById[id] ?? 'Đơn vị'}</span>
                      <button
                        type="button"
                        onClick={() => onPatch({ orgUnitIds: p.orgUnitIds.filter(x => x !== id) })}
                        className="shrink-0 hover:text-red-500 cursor-pointer"
                        aria-label={`Bỏ gán đơn vị ${unitNameById[id] ?? ''}`}
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                  <UnitPickerPopover
                    nodes={tree}
                    selected={p.orgUnitIds}
                    takenBy={takenBy}
                    onToggle={id => onPatch({
                      orgUnitIds: p.orgUnitIds.includes(id) ? p.orgUnitIds.filter(x => x !== id) : [...p.orgUnitIds, id],
                    })}
                  />
                  {p.orgUnitIds.length === 0 && (
                    <span className="text-[11px] font-bold text-amber-500">chưa gán đơn vị nào</span>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                <CalendarRange size={12} aria-hidden="true" /> Kỳ
              </span>
              {/* Hai lựa chọn hiện rõ thay vì một chữ "Mọi kỳ" đứng cạnh nút: nhìn vào
                  không phân biệt được đó là trạng thái hiện tại hay một tuỳ chọn chưa bấm.
                  Ở hồ sơ MẶC ĐỊNH cụm này bị khoá ở "Mọi kỳ" — cùng luật với bộ tiêu chí
                  hạnh kiểm: mặc định là chỗ phần chưa gán rơi về, giới hạn nó theo kỳ là
                  tự tạo ra những kỳ không còn hồ sơ nào. */}
              <div
                className={cn('inline-flex gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0', p.isDefault && 'opacity-70')}
                title={p.isDefault ? 'Hồ sơ mặc định luôn áp cho mọi kỳ — giới hạn nó theo kỳ sẽ làm các kỳ còn lại không có hồ sơ' : undefined}
              >
                {([['all', 'Mọi kỳ'], ['some', 'Một số kỳ']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={p.isDefault}
                    onClick={() => {
                      setCycleScope(mode)
                      if (mode === 'all') onPatch({ kpiCycleIds: [] })
                    }}
                    aria-pressed={p.isDefault ? mode === 'all' : cycleScope === mode}
                    className={cn('px-2.5 h-6 rounded-md text-[11px] font-black transition-colors',
                      p.isDefault ? 'cursor-not-allowed' : 'cursor-pointer',
                      (p.isDefault ? mode === 'all' : cycleScope === mode)
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                        : cn('text-slate-500', !p.isDefault && 'hover:text-slate-700 dark:hover:text-slate-300'))}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {p.isDefault && (
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Mọi kỳ chưa gán hồ sơ riêng
                </span>
              )}

              {!p.isDefault && cycleScope === 'some' && (
                <>
                  {p.kpiCycleIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[180px]">
                      <span className="truncate">{cycleNameById[id] ?? 'Kỳ'}</span>
                      <button
                        type="button"
                        onClick={() => onPatch({ kpiCycleIds: p.kpiCycleIds.filter(x => x !== id) })}
                        className="shrink-0 hover:text-red-500 cursor-pointer"
                        aria-label={`Bỏ gán kỳ ${cycleNameById[id] ?? ''}`}
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                  <CyclePickerPopover
                    cycles={cycles}
                    selected={p.kpiCycleIds}
                    onToggle={id => onPatch({
                      kpiCycleIds: p.kpiCycleIds.includes(id) ? p.kpiCycleIds.filter(x => x !== id) : [...p.kpiCycleIds, id],
                    })}
                  />
                </>
              )}
            </div>

            {/* Chỉ nói khi có chuyện cần cảnh báo — trạng thái bình thường không cần chú thích. */}
            {!p.isDefault && cycleScope === 'some' && p.kpiCycleIds.length === 0 && (
              <p className="text-[11px] font-bold text-amber-500">
                Chưa chọn kỳ nào — lưu bây giờ thì hồ sơ vẫn được hiểu là áp cho <b>mọi kỳ</b>.
              </p>
            )}
          </div>

          <div className="p-3">
            <RuleListEditor rules={p.rules} levels={levels} levelNames={levelNames} onChange={rules => onPatch({ rules })} />
          </div>
        </div>
      )}
    </div>
  )
}
// ── Popover chọn KỲ: danh sách phẳng có ô tìm ───────────────────────────────
function CyclePickerPopover({
  cycles, selected, onToggle,
}: {
  cycles: { id: string; name: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cycles.filter(c => c.name.toLowerCase().includes(q)) : cycles
  }, [cycles, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
          <Plus size={13} /> Chọn kỳ
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm kỳ…"
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs border-none outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(c => (
            <label key={c.id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => onToggle(c.id)} />
              <span className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{c.name}</span>
            </label>
          )) : <p className="text-[11px] italic text-slate-400 p-2">Không tìm thấy kỳ.</p>}
        </div>
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
          Không chọn kỳ nào = áp cho mọi kỳ.
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Popover chọn đơn vị: ô tìm + cây checkbox (expand/collapse) ──────────────
function UnitPickerPopover({
  nodes, selected, takenBy, onToggle,
}: {
  nodes: OrgUnitTreeResponse[]
  selected: string[]
  takenBy: Record<string, string>
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const searching = query.trim().length > 0
  const shown = useMemo(() => (searching ? filterTree(nodes, query.trim().toLowerCase()) : nodes), [nodes, query, searching])
  const toggleNode = (id: string) =>
    setExpanded(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })

  const renderNode = (n: OrgUnitTreeResponse, depth: number): React.ReactNode => {
    const hasKids = (n.children?.length ?? 0) > 0
    const openNode = searching || expanded.has(n.id)
    const owner = takenBy[n.id]
    const checked = selected.includes(n.id)
    const disabled = !!owner && !checked
    return (
      <div key={n.id}>
        <div className="flex items-center rounded-lg pr-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60" style={{ paddingLeft: depth * 14 }}>
          <button onClick={() => { if (hasKids) toggleNode(n.id) }} className="p-1 shrink-0 text-slate-400 hover:text-slate-600" aria-label={hasKids ? 'Mở/thu nhánh' : undefined}>
            {hasKids ? (openNode ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="inline-block w-[14px]" />}
          </button>
          <label className={cn('flex-1 min-w-0 flex items-center gap-2 py-1.5', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onToggle(n.id)} />
            <span className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{n.name}</span>
            {owner && !checked && <span className="ml-auto shrink-0 text-[10px] font-bold text-amber-500">đã gán: {owner}</span>}
          </label>
        </div>
        {hasKids && openNode && <div>{n.children.map(c => renderNode(c, depth + 1))}</div>}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
          <Plus size={13} /> Chọn đơn vị
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm đơn vị…"
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs border-none outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(n => renderNode(n, 0)) : <p className="text-[11px] italic text-slate-400 p-2">Không tìm thấy đơn vị.</p>}
        </div>
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
          Chọn đơn vị cha sẽ áp cho cả đơn vị con.
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Bộ soạn LUẬT (mức + điều kiện) của một hồ sơ ────────────────────────────
function RuleListEditor({
  rules, levels, levelNames, onChange,
}: {
  rules: UnitClassRule[]
  levels: { name: string; color: string }[]
  levelNames: string[]
  onChange: (rules: UnitClassRule[]) => void
}) {
  const colorOf = (name: string) => levels.find(l => l.name === name)?.color ?? '#64748b'

  const patchRule = (i: number, patch: Partial<UnitClassRule>) =>
    onChange(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const patchCond = (ri: number, ci: number, patch: Partial<UnitClassRule['conditions'][number]>) =>
    onChange(rules.map((r, idx) => idx !== ri ? r : { ...r, conditions: r.conditions.map((c, j) => j === ci ? { ...c, ...patch } : c) }))
  const addCond = (ri: number) =>
    onChange(rules.map((r, idx) => idx !== ri ? r : { ...r, conditions: [...r.conditions, { level: levelNames[0] ?? '', scope: 'this', op: 'gte', percent: 50 }] }))
  const removeCond = (ri: number, ci: number) =>
    onChange(rules.map((r, idx) => idx !== ri ? r : { ...r, conditions: r.conditions.filter((_, j) => j !== ci) }))
  const moveRule = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rules.length) return
    const next = [...rules]
    const a = next[i]!, b = next[j]!
    next[i] = b; next[j] = a
    onChange(next)
  }
  const addRule = () => {
    const used = new Set(rules.map(r => r.levelName))
    const pick = levelNames.find(n => !used.has(n)) ?? levelNames[0] ?? 'Mức mới'
    onChange([...rules, { levelName: pick, color: colorOf(pick), conditions: [] }])
  }
  const removeRule = (i: number) => onChange(rules.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Luật xếp loại</span>
        {/* Luật đọc từ trên xuống nên nhắc ngay tại đây, gọn một dòng — chi tiết nằm ở nút "?" đầu trang. */}
        <span className="text-[11px] text-slate-400 truncate">mức <b>cao nhất</b> thoả <b>tất cả</b> điều kiện, xét từ trên xuống</span>
      </div>
      {rules.map((r, ri) => (
        <div key={ri} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-white dark:bg-slate-900">
          {/* Mobile: hàng 1 = nhãn ưu tiên + màu + nhóm nút (44px, tách rời), hàng 2 = select chiếm trọn bề ngang.
              Desktop (sm+): dồn lại một hàng như cũ nhờ order/width reset. */}
          <div className="flex flex-wrap items-center gap-2 max-sm:gap-y-3 mb-2">
            <span className="order-1 text-[10px] font-black text-slate-400 uppercase">Ưu tiên {ri + 1}</span>
            <span className="order-2 w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0" style={{ backgroundColor: r.color }} aria-hidden="true" />
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
              <button onClick={() => moveRule(ri, -1)} disabled={ri === 0} className="p-1.5 max-sm:w-11 max-sm:h-11 max-sm:bg-slate-50 max-sm:dark:bg-slate-800/60 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label={`Đưa mức ${r.levelName} lên trên`} title="Lên"><ArrowUp size={15} /></button>
              <button onClick={() => moveRule(ri, 1)} disabled={ri === rules.length - 1} className="p-1.5 max-sm:w-11 max-sm:h-11 max-sm:bg-slate-50 max-sm:dark:bg-slate-800/60 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-30" aria-label={`Đưa mức ${r.levelName} xuống dưới`} title="Xuống"><ArrowDown size={15} /></button>
              {/* Nút xoá tách xa hơn 2 nút di chuyển trên mobile để tránh bấm nhầm */}
              <button onClick={() => removeRule(ri)} className="p-1.5 max-sm:w-11 max-sm:h-11 max-sm:ml-2 max-sm:bg-red-50/70 max-sm:dark:bg-red-900/20 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" aria-label={`Xoá mức ${r.levelName}`} title="Xoá mức"><Trash2 size={15} /></button>
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
                <button onClick={() => removeCond(ri, ci)} className="p-1 max-sm:w-11 max-sm:h-11 max-sm:justify-self-end max-sm:bg-red-50/70 max-sm:dark:bg-red-900/20 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" aria-label={`Xoá điều kiện ${ci + 1} của mức ${r.levelName}`} title="Xoá điều kiện"><Trash2 size={13} className="max-sm:w-4 max-sm:h-4" /></button>
              </div>
            ))}
            <button onClick={() => addCond(ri)} className="inline-flex items-center gap-1 max-sm:gap-1.5 max-sm:min-h-11 max-sm:text-xs text-[11px] font-bold text-indigo-600 hover:text-indigo-700 pl-1 pr-2">
              <Plus size={13} className="max-sm:w-[15px] max-sm:h-[15px]" /> Thêm điều kiện
            </button>
          </div>
        </div>
      ))}

      <button onClick={addRule} className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 inline-flex items-center justify-center gap-1.5">
        <Plus size={14} /> Thêm mức xếp loại
      </button>
    </div>
  )
}
