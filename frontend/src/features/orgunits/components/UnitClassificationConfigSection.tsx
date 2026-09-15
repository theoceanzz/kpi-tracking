import { useEffect, useMemo, useState } from 'react'
import { ratingColor } from '@/components/charts/chartPalette'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, Wand2,
  Star, Building2, ChevronRight, ChevronDown, Search, X, CalendarRange, HelpCircle, Scale, ListChecks, Loader2 } from 'lucide-react'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useOrgUnitTree } from '../hooks/useOrgUnitTree'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { usesPerformanceMatrix } from '@/lib/scoring'
import {
  unitClassificationSchema,
  type UnitClassificationFormData,
  type UnitClassProfileForm,
} from '../schemas/organizationSchema'
import BellCurveEditor from './BellCurveEditor'
import { bellCurveForLevels } from '../utils/bellCurve'
import { toastFirstError } from '@/lib/formErrors'
import { cn } from '@/lib/utils'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import {
  PRESET_UNIT_RULES_SCORE,
  type OrganizationResponse, type UnitClassRule, type UnitClassProfile, type UnitClassScope, type UnitClassOp,
  type UnitClassBellCurve,
} from '../api/organizationApi'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

const SCOPE_OPTS: { v: UnitClassScope; label: string }[] = [
  { v: 'this', label: 'đúng mức' },
  { v: 'orAbove', label: 'trở lên' },
  { v: 'orBelow', label: 'trở xuống' },
]
const OP_OPTS: { v: UnitClassOp; label: string }[] = [
  { v: 'gte', label: '≥' }, { v: 'lte', label: '≤' }, { v: 'gt', label: '>' }, { v: 'lt', label: '<' }, { v: 'eq', label: '=' },
]

/** Màu theo HẠNG ma trận (1 đỏ → 5 xanh) — khớp heatmap/phân bố ma trận. */

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

type EditProfile = UnitClassProfileForm

let _seq = 0
const newKey = () => `p${Date.now()}_${_seq++}`

/** Nạp danh sách hồ sơ ban đầu từ org (tương thích ngược hình dạng cũ {rules:[]}). */
function initialProfiles(org: OrganizationResponse): EditProfile[] {
  const levelNames = memberLevels(org).map(l => l.name)
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
        // Khung khai theo thang cũ bị bỏ (cùng luật với rule) — giữ lại thì hạn mức treo trên
        // những cái tên mức không còn tồn tại.
        bellCurve: bellCurveForLevels(p.bellCurve, levelNames),
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
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        danger && 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]',
        accent === 'indigo' && 'hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]',
      )}
    >
      {children}
    </Button>
  )
}

/** Phần giải thích dài — để sau nút "?" thay vì bày sẵn hai dòng chữ trên danh sách. */
function HelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" type="button" aria-label="Hồ sơ xếp loại đơn vị hoạt động thế nào" title="Cách hoạt động">
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] text-xs leading-relaxed text-[var(--color-muted-foreground)] space-y-2">
        <p>Mỗi <b>hồ sơ</b> là một cách xếp loại. Gán cho đơn vị nào thì <b>đơn vị con kế thừa</b>, trừ khi đơn vị con có hồ sơ riêng.</p>
        <p>Đơn vị không được gán dùng hồ sơ <b>mặc định</b>. Mỗi tổ chức có đúng một hồ sơ mặc định và nó luôn áp cho <b>mọi kỳ</b> — giới hạn nó theo kỳ sẽ làm các kỳ còn lại không có hồ sơ nào.</p>
        <p>Hồ sơ gắn <b>kỳ</b> chỉ có hiệu lực trong kỳ đó và <b>ghi đè</b> hồ sơ áp cho mọi kỳ.</p>
        <p>Trong một hồ sơ, đơn vị nhận <b>mức cao nhất</b> thoả <b>tất cả</b> điều kiện, xét từ trên xuống. Mức cuối không điều kiện là mặc định.</p>
        <p>Tab <b>Bell curve</b> là chuyện ngược lại: nó khống chế <b>tỷ lệ % người</b> mà đơn vị được chấm ở mỗi mức. Vượt trần thì hệ thống cảnh báo, hoặc chặn không cho chốt đánh giá.</p>
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

  const { handleSubmit, reset: resetForm, watch, setValue } = useForm<UnitClassificationFormData>({
    resolver: zodResolver(unitClassificationSchema),
    defaultValues: { profiles: initialProfiles(org) },
  })

  // Cả màn hình vẽ lại theo từng lần sửa luật, nên theo dõi thay vì đăng ký từng ô.
  const profiles = watch('profiles')
  const setProfiles = (fn: (prev: EditProfile[]) => EditProfile[]) =>
    setValue('profiles', fn(profiles), { shouldValidate: true })

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialProfiles(org)[0] ? [initialProfiles(org)[0]!._key] : []),
  )

  // Đổi THANG (bật/tắt ma trận, sửa mức/ma trận) → nạp lại hồ sơ cho đúng thang hiện tại.
  const levelsKey = levelNames.join('|')
  useEffect(() => {
    const next = initialProfiles(org)
    resetForm({ profiles: next })
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
    resetForm({ profiles: next })
    setExpanded(new Set(next[0] ? [next[0]._key] : []))
    toast.success('Đã đặt lại')
  }

  const save = handleSubmit((data) => {
    const payload: UnitClassProfile[] = data.profiles.map(p => ({
      name: p.name.trim(), isDefault: p.isDefault,
      // Hồ sơ mặc định là chỗ rơi về của phần chưa gán nên không mang theo đơn vị lẫn kỳ.
      orgUnitIds: p.isDefault ? [] : p.orgUnitIds,
      kpiCycleIds: p.isDefault ? [] : p.kpiCycleIds,
      rules: p.rules,
      // Khung đã tắt vẫn lưu (enabled=false): bật lại thì tỷ lệ đã kéo còn nguyên.
      bellCurve: p.bellCurve as UnitClassBellCurve | undefined,
    }))
    update.mutate({ unitClassificationRules: JSON.stringify({ profiles: payload }) }, {
      onSuccess: () => toast.success('Đã lưu luật xếp loại đơn vị'),
      onError: (error) => toast.error(getApiErrorMessage(error, 'Không thể lưu luật xếp loại đơn vị')),
    })
  }, toastFirstError)

  return (
    <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Đầu trang gọn một hàng. Phần giải thích dài chuyển vào nút "?" — trước đây nó
          chiếm hai dòng chữ nằm chắn ngay giữa nhan đề và danh sách hồ sơ. */}
      <div id="tour-unitclass-header" className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-section-title">Xếp loại đơn vị</h3>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
            {profiles.length} hồ sơ · gán theo đơn vị (đơn vị con kế thừa) và theo kỳ. Đơn vị không được gán dùng hồ sơ mặc định.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HelpPopover />
          <Button variant="outline" type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Đặt lại
          </Button>
          <Button type="button" onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Lưu
          </Button>
        </div>
      </div>

      {/* Chú thích thang mức: hàng mảnh riêng, dính ngay dưới nhan đề vì nó là bảng tra
          dùng suốt lúc soạn điều kiện bên dưới. */}
      <div id="tour-unitclass-levels" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-5 py-2">
        <span className="text-eyebrow">Thang mức</span>
        {levels.map(l => (
          <span key={l.name} className="inline-flex items-center gap-1 text-caption">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} aria-hidden="true" />{l.name}
          </span>
        ))}
      </div>

      <div className="space-y-3 p-5">
        <div id="tour-unitclass-profiles" className="space-y-2.5">
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

        <Button variant="outline" className="w-full border-dashed" id="tour-unitclass-add" type="button" onClick={addProfile}>
          <Plus aria-hidden="true" /> Thêm hồ sơ xếp loại
        </Button>
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
  // Hai thứ khác hẳn nhau nên tách tab thay vì xếp chồng: LUẬT quyết định đơn vị được xếp mức
  // nào, KHUNG giới hạn đơn vị được chấm bao nhiêu người ở mỗi mức.
  const [tab, setTab] = useState<'rules' | 'curve'>('rules')

  const fieldCls = 'h-9 px-3 rounded-control bg-[var(--color-muted)] text-sm font-medium border border-transparent outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]'

  return (
    <div className={cn(
      'rounded-card border transition-colors',
      isOpen ? 'border-[var(--color-border-strong)]' : 'border-[var(--color-border)]',
      p.isDefault && 'border-[var(--color-primary)]',
    )}>
      {/* ── Dòng tiêu đề: đóng thì là bản tóm tắt, mở thì là thanh công cụ của hồ sơ.
          Tên hồ sơ sửa ngay tại đây thay vì lặp lại thành một ô riêng bên dưới. ── */}
      <div className="flex items-center gap-2 p-2.5 max-sm:flex-wrap">
        <Button variant="secondary" className="shrink-0" type="button" onClick={onToggle} aria-expanded={isOpen} aria-label={isOpen ? `Thu gọn hồ sơ ${p.name}` : `Mở hồ sơ ${p.name}`}>
          {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </Button>

        {p.isDefault && (
          <Badge className="gap-1 shrink-0 whitespace-nowrap"><Star size={11} className="fill-white" aria-hidden="true" /> Mặc định</Badge>
        )}

        {isOpen ? (
          <input
            value={p.name}
            onChange={e => onPatch({ name: e.target.value })}
            placeholder="Tên hồ sơ"
            aria-label="Tên hồ sơ xếp loại"
            className={cn(fieldCls, 'flex-1 min-w-[140px] max-w-xs font-semibold')}
          />
        ) : (
          <button className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)] flex-1 min-w-0" type="button" onClick={onToggle}>
            <span className="font-semibold text-sm truncate">{p.name || 'Hồ sơ'}</span>
            <span className="ml-auto flex items-center gap-2 shrink-0 text-caption max-sm:hidden">
              <span className="max-w-[200px] truncate" title={assignedNames.join(', ')}>
                {p.isDefault
                  ? 'các đơn vị còn lại'
                  : assignedNames.length
                    ? `${assignedNames[0]}${assignedNames.length > 1 ? ` +${assignedNames.length - 1}` : ''}`
                    : <span className="text-[var(--color-warning)]">chưa gán đơn vị</span>}
              </span>
              <span className="text-[var(--color-subtle-foreground)]">·</span>
              <span className="max-w-[180px] truncate" title={cycleNames.join(', ')}>
                {p.isDefault
                  ? 'mọi kỳ chưa gán'
                  : p.kpiCycleIds.length === 0
                    ? 'mọi kỳ'
                    : `${cycleNames[0] ?? 'Kỳ'}${cycleNames.length > 1 ? ` +${cycleNames.length - 1}` : ''}`}
              </span>
              <span className="text-[var(--color-subtle-foreground)]">·</span>
              <span>{p.rules.length} mức</span>
              {p.bellCurve?.enabled && (
                <span
                  className="inline-flex items-center gap-1 text-[var(--color-primary)]"
                  title={`Khung bell curve đang bật (${p.bellCurve.mode === 'block' ? 'chặn khi vượt trần' : 'chỉ cảnh báo'})`}
                >
                  <Scale aria-hidden="true" /> bell curve
                </span>
              )}
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
        <div className="border-t border-[var(--color-border)]">
          {/* ── Một hàng phạm vi: đơn vị áp dụng + kỳ áp dụng ──
              Trước đây là hai khối xếp dọc, mỗi khối có nhãn, nền và dòng chú thích riêng. */}
          <div className="px-3 py-2.5 space-y-2 border-b border-[var(--color-border)]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-eyebrow inline-flex items-center gap-1 shrink-0">
                <Building2 size={12} aria-hidden="true" /> Đơn vị
              </span>
              {p.isDefault ? (
                <span className="text-caption">
                  Mọi đơn vị không được gán hồ sơ khác
                </span>
              ) : (
                <>
                  {p.orgUnitIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[180px]">
                      <span className="truncate">{unitNameById[id] ?? 'Đơn vị'}</span>
                      <Button variant="ghost" size="icon" className="shrink-0 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => onPatch({ orgUnitIds: p.orgUnitIds.filter(x => x !== id) })} aria-label={`Bỏ gán đơn vị ${unitNameById[id] ?? ''}`}>
                        <X aria-hidden="true" />
                      </Button>
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
                    <span className="text-xs font-medium text-[var(--color-warning)]">chưa gán đơn vị nào</span>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-eyebrow inline-flex items-center gap-1 shrink-0">
                <CalendarRange size={12} aria-hidden="true" /> Kỳ
              </span>
              {/* Hai lựa chọn hiện rõ thay vì một chữ "Mọi kỳ" đứng cạnh nút: nhìn vào
                  không phân biệt được đó là trạng thái hiện tại hay một tuỳ chọn chưa bấm.
                  Ở hồ sơ MẶC ĐỊNH cụm này bị khoá ở "Mọi kỳ" — cùng luật với bộ tiêu chí
                  hạnh kiểm: mặc định là chỗ phần chưa gán rơi về, giới hạn nó theo kỳ là
                  tự tạo ra những kỳ không còn hồ sơ nào. */}
              <div
                className={cn('inline-flex gap-0.5 p-0.5 rounded-control bg-[var(--color-muted)] shrink-0', p.isDefault && 'opacity-70')}
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
                    className={cn('px-2.5 h-6 rounded-control text-xs font-semibold transition-colors',
                      p.isDefault ? 'cursor-not-allowed' : 'cursor-pointer',
                      (p.isDefault ? mode === 'all' : cycleScope === mode)
                        ? 'bg-[var(--color-card)] text-[var(--color-primary)] shadow-sm'
                        : cn('text-[var(--color-muted-foreground)]', !p.isDefault && 'hover:text-[var(--color-foreground)]'))}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {p.isDefault && (
                <span className="text-caption">
                  Mọi kỳ chưa gán hồ sơ riêng
                </span>
              )}

              {!p.isDefault && cycleScope === 'some' && (
                <>
                  {p.kpiCycleIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[180px]">
                      <span className="truncate">{cycleNameById[id] ?? 'Kỳ'}</span>
                      <Button variant="ghost" size="icon" className="shrink-0 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => onPatch({ kpiCycleIds: p.kpiCycleIds.filter(x => x !== id) })} aria-label={`Bỏ gán kỳ ${cycleNameById[id] ?? ''}`}>
                        <X aria-hidden="true" />
                      </Button>
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
              <p className="text-xs font-medium text-[var(--color-warning)]">
                Chưa chọn kỳ nào — lưu bây giờ thì hồ sơ vẫn được hiểu là áp cho <b>mọi kỳ</b>.
              </p>
            )}
          </div>

          <div className="p-3 space-y-3">
            <div className="inline-flex gap-0.5 p-0.5 rounded-control bg-[var(--color-muted)]">
              {([
                ['rules', 'Luật xếp loại', <ListChecks key="i" size={13} aria-hidden="true" />],
                ['curve', 'Bell curve', <Scale key="i" size={13} aria-hidden="true" />],
              ] as const).map(([mode, label, icon]) => (
                <ChoiceChip selected={tab === mode} variant="segment" size="sm" key={mode} onClick={() => setTab(mode)} aria-pressed={tab === mode}>
                  {icon}{label}
                  {mode === 'curve' && p.bellCurve?.enabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />
                  )}
                </ChoiceChip>
              ))}
            </div>

            {tab === 'rules' ? (
              <RuleListEditor rules={p.rules} levels={levels} levelNames={levelNames} onChange={rules => onPatch({ rules })} />
            ) : (
              <BellCurveEditor
                value={p.bellCurve}
                levels={levels}
                onChange={bellCurve => onPatch({ bellCurve })}
              />
            )}
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
        <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-[var(--color-border-strong)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
          <Plus size={13} /> Chọn kỳ
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <div className="p-2 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm kỳ…"
              className="w-full h-8 pl-8 pr-2 rounded-control bg-[var(--color-muted)] text-xs border-none outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(c => (
            <label key={c.id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-control cursor-pointer hover:bg-[var(--color-muted)]">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => onToggle(c.id)} />
              <span className="truncate text-[13px] font-medium text-[var(--color-foreground)]">{c.name}</span>
            </label>
          )) : <p className="text-xs italic text-[var(--color-subtle-foreground)] p-2">Không tìm thấy kỳ.</p>}
        </div>
        <div className="px-3 py-2 border-t border-[var(--color-border)] text-caption">
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
        <div className="flex items-center rounded-control pr-1.5 hover:bg-[var(--color-muted)]" style={{ paddingLeft: depth * 14 }}>
          <Button variant="ghost" className="shrink-0" onClick={() => { if (hasKids) toggleNode(n.id) }} aria-label={hasKids ? 'Mở/thu nhánh' : undefined}>
            {hasKids ? (openNode ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />) : <span className="inline-block w-[14px]" />}
          </Button>
          <label className={cn('flex-1 min-w-0 flex items-center gap-2 py-1.5', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onToggle(n.id)} />
            <span className="truncate text-[13px] font-medium text-[var(--color-foreground)]">{n.name}</span>
            {owner && !checked && <span className="ml-auto shrink-0 text-xs font-medium text-[var(--color-warning)]">đã gán: {owner}</span>}
          </label>
        </div>
        {hasKids && openNode && <div>{n.children.map(c => renderNode(c, depth + 1))}</div>}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-[var(--color-border-strong)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
          <Plus size={13} /> Chọn đơn vị
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <div className="p-2 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm đơn vị…"
              className="w-full h-8 pl-8 pr-2 rounded-control bg-[var(--color-muted)] text-xs border-none outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(n => renderNode(n, 0)) : <p className="text-xs italic text-[var(--color-subtle-foreground)] p-2">Không tìm thấy đơn vị.</p>}
        </div>
        <div className="px-3 py-2 border-t border-[var(--color-border)] text-caption">
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
        <span className="text-eyebrow">Luật xếp loại</span>
        {/* Luật đọc từ trên xuống nên nhắc ngay tại đây, gọn một dòng — chi tiết nằm ở nút "?" đầu trang. */}
        <span className="text-caption truncate">mức <b>cao nhất</b> thoả <b>tất cả</b> điều kiện, xét từ trên xuống</span>
      </div>
      {rules.map((r, ri) => (
        <div key={ri} className="rounded-card border border-[var(--color-border)] p-2.5 bg-[var(--color-card)]">
          {/* Mobile: hàng 1 = nhãn ưu tiên + màu + nhóm nút (44px, tách rời), hàng 2 = select chiếm trọn bề ngang.
              Desktop (sm+): dồn lại một hàng như cũ nhờ order/width reset. */}
          <div className="flex flex-wrap items-center gap-2 max-sm:gap-y-3 mb-2">
            <span className="order-1 text-eyebrow">Ưu tiên {ri + 1}</span>
            <span className="order-2 w-6 h-6 rounded-control border border-[var(--color-border)] shrink-0" style={{ backgroundColor: r.color }} aria-hidden="true" />
            <Select value={r.levelName} onValueChange={v => patchRule(ri, { levelName: v, color: colorOf(v) })}>
              <SelectTrigger className="order-3 max-sm:order-4 flex-1 max-sm:w-full min-w-[140px] h-10 max-sm:h-12 rounded-control bg-[var(--color-muted)] border-none text-sm font-semibold" style={{ color: r.color }}>
                <SelectValue placeholder="Chọn loại xếp loại" />
              </SelectTrigger>
              <SelectContent>
                {levels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}
                {!levelNames.includes(r.levelName) && r.levelName && <SelectItem value={r.levelName}>{r.levelName}</SelectItem>}
              </SelectContent>
            </Select>
            <div className="order-4 max-sm:order-3 max-sm:ml-auto flex items-center gap-1 max-sm:gap-2">
              <Button variant="secondary" size="icon-sm" onClick={() => moveRule(ri, -1)} disabled={ri === 0} aria-label={`Đưa mức ${r.levelName} lên trên`} title="Lên"><ArrowUp aria-hidden="true" /></Button>
              <Button variant="secondary" size="icon-sm" onClick={() => moveRule(ri, 1)} disabled={ri === rules.length - 1} aria-label={`Đưa mức ${r.levelName} xuống dưới`} title="Xuống"><ArrowDown aria-hidden="true" /></Button>
              {/* Nút xoá tách xa hơn 2 nút di chuyển trên mobile để tránh bấm nhầm */}
              <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => removeRule(ri)} aria-label={`Xoá mức ${r.levelName}`} title="Xoá mức"><Trash2 aria-hidden="true" /></Button>
            </div>
          </div>

          <div className="space-y-2 max-sm:space-y-3">
            {r.conditions.length === 0 && (
              <p className="text-xs italic text-[var(--color-subtle-foreground)] pl-1">Không điều kiện → luôn đúng (mặc định).</p>
            )}
            {r.conditions.map((c, ci) => (
              /* Mobile: lưới 2 cột trong khung riêng — mỗi ô cao 44px, tách hẳn nút xoá xuống góc phải.
                 Desktop (sm+): trở lại một hàng flex gọn như cũ. */
              <div key={ci} className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:gap-2.5 max-sm:rounded-card max-sm:border max-sm:border-[var(--color-border)] max-sm: max-sm:p-2.5 text-sm">
                <span className="max-sm:col-span-2 text-caption">% người ở mức</span>
                <Select value={c.level} onValueChange={v => patchCond(ri, ci, { level: v })}>
                  <SelectTrigger className="max-sm:col-span-2 max-sm:w-full max-sm:h-11 h-8 w-auto min-w-[110px] max-sm:min-w-0 gap-1 rounded-control bg-[var(--color-muted)] border-none text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levelNames.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    {!levelNames.includes(c.level) && c.level && <SelectItem value={c.level}>{c.level}</SelectItem>}
                  </SelectContent>
                </Select>
                <Select value={c.scope} onValueChange={v => patchCond(ri, ci, { scope: v as UnitClassScope })}>
                  <SelectTrigger className="max-sm:w-full max-sm:h-11 h-8 w-auto min-w-[92px] max-sm:min-w-0 gap-1 rounded-control bg-[var(--color-muted)] border-none text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={c.op} onValueChange={v => patchCond(ri, ci, { op: v as UnitClassOp })}>
                  <SelectTrigger className="max-sm:w-full max-sm:h-11 h-8 w-[64px] gap-1 rounded-control bg-[var(--color-muted)] border-none text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OP_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <input type="number" min={0} max={100} value={c.percent}
                    onChange={e => patchCond(ri, ci, { percent: Number(e.target.value) })}
                    className="w-16 max-sm:w-full max-sm:h-11 px-2 py-1.5 rounded-control bg-[var(--color-muted)] text-xs font-medium border-none outline-none focus:ring-2 focus:ring-[var(--color-ring)]" />
                  <span className="text-caption">%</span>
                </div>
                {/* Nút xoá nằm hẳn góc phải dưới trên mobile, cách xa ô nhập % */}
                <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => removeCond(ri, ci)} aria-label={`Xoá điều kiện ${ci + 1} của mức ${r.levelName}`} title="Xoá điều kiện"><Trash2 aria-hidden="true" className="max-sm:w-4 max-sm:h-4" /></Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => addCond(ri)}>
              <Plus aria-hidden="true" className="max-sm:w-[15px] max-sm:h-[15px]" /> Thêm điều kiện
            </Button>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" className="w-full" onClick={addRule}>
        <Plus aria-hidden="true" /> Thêm mức xếp loại
      </Button>
    </div>
  )
}
