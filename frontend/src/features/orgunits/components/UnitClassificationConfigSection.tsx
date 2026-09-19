import { useEffect, useMemo, useState } from 'react'
import { ratingColor } from '@/components/charts/chartPalette'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, Wand2,
  Star, Building2, ChevronRight, ChevronDown, Search, X, CalendarRange, HelpCircle, Scale, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Switch } from '@/components/ui/switch'
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
import { bellCurveForLevels, bellTargets, defaultBellCurve } from '../utils/bellCurve'
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

  const { handleSubmit, reset: resetForm, watch, setValue, formState } = useForm<UnitClassificationFormData>({
    resolver: zodResolver(unitClassificationSchema),
    defaultValues: { profiles: initialProfiles(org) },
  })

  // Cả màn hình vẽ lại theo từng lần sửa luật, nên theo dõi thay vì đăng ký từng ô.
  const profiles = watch('profiles')
  const setProfiles = (fn: (prev: EditProfile[]) => EditProfile[]) =>
    setValue('profiles', fn(profiles), { shouldValidate: true, shouldDirty: true })

  // Hai cột: danh sách hồ sơ bên trái, bộ soạn của hồ sơ ĐANG CHỌN bên phải. Trước đây là
  // accordion xếp dọc — mở hai hồ sơ là màn hình dài ba trang, không so được với nhau.
  const [selectedKey, setSelectedKey] = useState<string>(() => initialProfiles(org)[0]?._key ?? '')
  const selected = profiles.find(p => p._key === selectedKey) ?? profiles[0]

  // Đổi THANG (bật/tắt ma trận, sửa mức/ma trận) → nạp lại hồ sơ cho đúng thang hiện tại.
  const levelsKey = levelNames.join('|')
  useEffect(() => {
    const next = initialProfiles(org)
    resetForm({ profiles: next })
    setSelectedKey(next[0]?._key ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsKey])

  const patchProfile = (key: string, patch: Partial<EditProfile>) =>
    setProfiles(ps => ps.map(p => p._key === key ? { ...p, ...patch } : p))

  // Đúng MỘT hồ sơ mặc định cho cả tổ chức, và nó áp cho mọi kỳ: hồ sơ cũ mất vai trò,
  // hồ sơ mới bị gỡ hết kỳ và đơn vị đã gán (mặc định là chỗ rơi về của phần chưa gán).
  const setDefault = (key: string) =>
    setProfiles(ps => ps.map(p => p._key === key
      ? { ...p, isDefault: true, kpiCycleIds: [], orgUnitIds: [] }
      : { ...p, isDefault: false }))

  // Hồ sơ mới sinh ra là để gán cho đơn vị (mặc định đã có một) — tên gợi ý và cờ `pickUnits`
  // để bộ soạn mở sẵn hộp chọn đơn vị, người dùng không phải tự tìm nút "Chọn đơn vị".
  const [pickUnitsFor, setPickUnitsFor] = useState<string | null>(null)
  const addProfile = () => {
    const key = newKey()
    setProfiles(ps => [...ps, { _key: key, name: `Hồ sơ đơn vị ${ps.length}`, isDefault: false, orgUnitIds: [], kpiCycleIds: [], rules: presetFor(org) }])
    setSelectedKey(key)
    setPickUnitsFor(key)
  }

  const removeProfile = (key: string) =>
    setProfiles(ps => {
      const next = ps.filter(p => p._key !== key)
      if (selectedKey === key) setSelectedKey(next[0]?._key ?? '')
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
    setSelectedKey(next[0]?._key ?? '')
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
      onSuccess: () => { toast.success('Đã lưu luật xếp loại đơn vị'); resetForm(data) },
      onError: (error) => toast.error(getApiErrorMessage(error, 'Không thể lưu luật xếp loại đơn vị')),
    })
  }, toastFirstError)

  const dirty = formState.isDirty

  return (
    <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div id="tour-unitclass-header" className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-section-title">Xếp loại đơn vị</h3>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
            Mỗi <b>hồ sơ</b> = một bộ luật xếp loại + một khung bell curve. Gán hồ sơ cho <b>từng đơn vị</b> (đơn vị con kế thừa) và/hoặc <b>từng kỳ</b> để mỗi phòng ban có luật riêng; đơn vị chưa gán dùng hồ sơ mặc định.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && <span className="text-caption text-[var(--color-warning)]">Có thay đổi chưa lưu</span>}
          <HelpPopover />
          <Button variant="outline" type="button" onClick={reset} disabled={!dirty}>
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
        <span className="text-eyebrow">Thang mức (cao → thấp)</span>
        {levels.map(l => (
          <span key={l.name} className="inline-flex items-center gap-1 text-caption">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} aria-hidden="true" />{l.name}
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ── Cột trái: danh sách hồ sơ ─────────────────────────────── */}
        <div className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 p-3 lg:border-b-0 lg:border-r">
          <p className="px-2 pb-2 text-eyebrow">Hồ sơ ({profiles.length})</p>
          <ul id="tour-unitclass-profiles" className="space-y-1">
            {profiles.map(p => {
              const active = p._key === selected?._key
              const assigned = p.orgUnitIds.map(id => unitNameById[id]).filter(Boolean) as string[]
              const scope = p.isDefault
                ? 'Đơn vị chưa gán · mọi kỳ'
                : `${assigned.length ? `${assigned.length} đơn vị` : 'Chưa gán đơn vị'} · ${p.kpiCycleIds.length ? `${p.kpiCycleIds.length} kỳ` : 'mọi kỳ'}`
              return (
                <li key={p._key}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(p._key)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col items-start rounded-card border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                      active
                        ? 'border-[var(--color-primary)] bg-[var(--color-card)] shadow-sm'
                        : 'border-transparent hover:bg-[var(--color-card)]',
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-foreground)]">{p.name || 'Hồ sơ'}</span>
                      {p.isDefault && <Star size={12} className="ml-auto shrink-0 fill-current text-[var(--color-primary)]" aria-label="Mặc định" />}
                    </span>
                    <span className={cn('mt-0.5 text-caption', !p.isDefault && p.orgUnitIds.length === 0 && 'text-[var(--color-warning)]')}>
                      {scope}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-caption">
                      <span>{p.rules.length} mức</span>
                      {p.bellCurve?.enabled && <span className="inline-flex items-center gap-1 text-[var(--color-primary)]"><Scale size={10} aria-hidden="true" /> bell curve</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <Button variant="outline" className="mt-2 w-full border-dashed" id="tour-unitclass-add" type="button" onClick={addProfile}>
            <Plus aria-hidden="true" /> Thêm hồ sơ cho đơn vị
          </Button>
          <ProfileCoverage profiles={profiles} tree={tree ?? []} cycleNameById={cycleNameById} />
        </div>

        {/* ── Cột phải: bộ soạn hồ sơ đang chọn ─────────────────────── */}
        <div className="min-w-0">
          {selected && (
            <ProfileEditor
              key={selected._key}
              profile={selected}
              levels={levels}
              levelNames={levelNames}
              tree={tree ?? []}
              unitNameById={unitNameById}
              cycles={cycles}
              cycleNameById={cycleNameById}
              takenBy={takenBy(selected._key)}
              canDelete={profiles.length > 1}
              autoPickUnits={pickUnitsFor === selected._key}
              onAutoPickDone={() => setPickUnitsFor(null)}
              onAddUnitProfile={addProfile}
              onPatch={patch => patchProfile(selected._key, patch)}
              onSetDefault={() => setDefault(selected._key)}
              onApplyPreset={() => applyPreset(selected._key)}
              onRemove={() => removeProfile(selected._key)}
            />
          )}
        </div>
      </div>
    </section>
  )
}

/** Khối con có tiêu đề + mô tả một dòng, dùng cho ba phần của bộ soạn. */
function Block({ title, description, action, children, id }: {
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; id?: string
}) {
  return (
    <div id={id} className="border-b border-[var(--color-border)] px-5 py-4 last:border-b-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h4>
          {description && <p className="mt-0.5 text-caption">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ── Bộ soạn MỘT hồ sơ ───────────────────────────────────────────────────────
function ProfileEditor({
  profile: p, levels, levelNames, tree, unitNameById, cycles, cycleNameById,
  takenBy, canDelete, autoPickUnits, onAutoPickDone, onAddUnitProfile, onPatch, onSetDefault, onApplyPreset, onRemove,
}: {
  profile: EditProfile
  /** Vừa tạo từ "Thêm hồ sơ cho đơn vị": mở sẵn hộp chọn đơn vị. */
  autoPickUnits?: boolean
  onAutoPickDone?: () => void
  onAddUnitProfile: () => void
  levels: { name: string; color: string }[]
  levelNames: string[]
  tree: OrgUnitTreeResponse[]
  unitNameById: Record<string, string>
  cycles: { id: string; name: string }[]
  cycleNameById: Record<string, string>
  takenBy: Record<string, string>
  canDelete: boolean
  onPatch: (patch: Partial<EditProfile>) => void
  onSetDefault: () => void
  onApplyPreset: () => void
  onRemove: () => void
}) {
  // Giữ riêng ý định "chỉ một số kỳ" — nếu suy từ độ dài mảng thì vừa bấm sang chế độ đó
  // (chưa kịp chọn kỳ nào) là giao diện lập tức nhảy ngược về "Mọi kỳ".
  const [cycleScope, setCycleScope] = useState<'all' | 'some'>(p.kpiCycleIds.length ? 'some' : 'all')
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div>
      {/* Tên + thao tác của hồ sơ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
        <input
          value={p.name}
          onChange={e => onPatch({ name: e.target.value })}
          placeholder="Tên hồ sơ"
          aria-label="Tên hồ sơ xếp loại"
          className="h-9 min-w-[160px] flex-1 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm font-medium text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)] sm:max-w-sm"
        />
        {p.isDefault ? (
          <Badge className="gap-1 shrink-0"><Star size={11} className="fill-current" aria-hidden="true" /> Hồ sơ mặc định</Badge>
        ) : (
          <Button variant="outline" size="sm" type="button" onClick={onSetDefault}>
            <Star aria-hidden="true" /> Đặt làm mặc định
          </Button>
        )}
        <Button variant="outline" size="sm" type="button" onClick={onApplyPreset} title="Thay toàn bộ luật bằng mẫu gợi ý của thang hiện tại">
          <Wand2 aria-hidden="true" /> Nạp mẫu
        </Button>
        {canDelete && (
          <Button variant="ghost" size="icon-sm" type="button" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => setConfirmRemove(true)} aria-label="Xoá hồ sơ này" title="Xoá hồ sơ">
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => { setConfirmRemove(false); onRemove() }}
        title={`Xoá hồ sơ "${p.name || 'Hồ sơ'}"?`}
        description="Đơn vị đang gán hồ sơ này sẽ dùng hồ sơ mặc định. Thay đổi chỉ có hiệu lực sau khi bấm Lưu."
        confirmLabel="Xoá hồ sơ"
      />

      {/* ── Áp dụng cho ────────────────────────────────────────────── */}
      <Block
        title="Áp dụng cho"
        description={p.isDefault
          ? 'Hồ sơ mặc định áp cho mọi đơn vị chưa gán hồ sơ khác, trong mọi kỳ.'
          : 'Chọn đơn vị (đơn vị con kế thừa). Gắn kỳ nếu chỉ muốn luật này hiệu lực trong một số kỳ.'}
        action={p.isDefault ? (
          <Button variant="outline" size="sm" type="button" onClick={onAddUnitProfile}>
            <Plus aria-hidden="true" /> Tạo hồ sơ riêng cho một đơn vị
          </Button>
        ) : undefined}
      >
        {p.isDefault && (
          <p className="text-caption">
            Phòng ban nào cần luật hoặc bell curve khác thì tạo hồ sơ riêng và gán đơn vị đó; các đơn vị còn lại vẫn theo hồ sơ này.
          </p>
        )}
        {!p.isDefault && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-label"><Building2 size={14} aria-hidden="true" /> Đơn vị</span>
              {p.orgUnitIds.map(id => (
                <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[220px]">
                  <span className="truncate">{unitNameById[id] ?? 'Đơn vị'}</span>
                  <button type="button" className="rounded-sm p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => onPatch({ orgUnitIds: p.orgUnitIds.filter(x => x !== id) })} aria-label={`Bỏ gán đơn vị ${unitNameById[id] ?? ''}`}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </Badge>
              ))}
              <UnitPickerPopover
                nodes={tree}
                selected={p.orgUnitIds}
                takenBy={takenBy}
                defaultOpen={autoPickUnits}
                onOpened={onAutoPickDone}
                onToggle={id => onPatch({
                  orgUnitIds: p.orgUnitIds.includes(id) ? p.orgUnitIds.filter(x => x !== id) : [...p.orgUnitIds, id],
                })}
              />
              {p.orgUnitIds.length === 0 && (
                <span className="text-xs font-medium text-[var(--color-warning)]">Chưa gán đơn vị nào — hồ sơ này chưa có tác dụng.</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-label"><CalendarRange size={14} aria-hidden="true" /> Kỳ</span>
              <div className="inline-flex gap-0.5 rounded-control bg-[var(--color-muted)] p-0.5" role="group" aria-label="Phạm vi kỳ">
                {([['all', 'Mọi kỳ'], ['some', 'Một số kỳ']] as const).map(([mode, label]) => (
                  <ChoiceChip key={mode} variant="segment" size="sm" selected={cycleScope === mode} onClick={() => { setCycleScope(mode); if (mode === 'all') onPatch({ kpiCycleIds: [] }) }}>
                    {label}
                  </ChoiceChip>
                ))}
              </div>
              {cycleScope === 'some' && (
                <>
                  {p.kpiCycleIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[220px]">
                      <span className="truncate">{cycleNameById[id] ?? 'Kỳ'}</span>
                      <button type="button" className="rounded-sm p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => onPatch({ kpiCycleIds: p.kpiCycleIds.filter(x => x !== id) })} aria-label={`Bỏ gán kỳ ${cycleNameById[id] ?? ''}`}>
                        <X size={12} aria-hidden="true" />
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
                  {p.kpiCycleIds.length === 0 && (
                    <span className="text-xs font-medium text-[var(--color-warning)]">Chưa chọn kỳ — lưu bây giờ thì vẫn hiểu là mọi kỳ.</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Block>

      {/* ── Luật xếp loại + thử nhanh ───────────────────────────────── */}
      <Block
        title="Luật xếp loại"
        description="Xét từ trên xuống, đơn vị nhận mức đầu tiên thoả tất cả điều kiện. Mức cuối không cần điều kiện."
      >
        <RuleLadder rules={p.rules} levels={levels} levelNames={levelNames} onChange={rules => onPatch({ rules })} />
      </Block>

      {/* ── Bell curve ─────────────────────────────────────────────── */}
      <Block
        title="Khung bell curve"
        description="Giới hạn tỷ lệ % nhân sự mà đơn vị được chấm ở mỗi mức. Khác luật xếp loại ở trên: luật xếp loại ĐƠN VỊ, khung này giới hạn cách chấm NHÂN SỰ."
        action={
          <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]">
            <Switch
              checked={!!p.bellCurve?.enabled}
              onCheckedChange={(on: boolean) => onPatch({ bellCurve: on ? { ...(p.bellCurve ?? defaultBellCurve(levelNames)), enabled: true } : p.bellCurve ? { ...p.bellCurve, enabled: false } : undefined })}
              aria-label="Bật khung bell curve"
            />
            {p.bellCurve?.enabled ? 'Đang bật' : 'Đang tắt'}
          </label>
        }
      >
        {p.bellCurve?.enabled
          ? <BellCurveEditor value={p.bellCurve} levels={levels} onChange={bellCurve => onPatch({ bellCurve })} />
          : <p className="text-caption">Bật để đặt hạn mức cho từng mức. Tắt thì đơn vị chấm bao nhiêu người ở mức nào cũng được.</p>}
      </Block>
    </div>
  )
}

// ── Luật dạng bậc thang + thử nhanh ─────────────────────────────────────────
type Counts = Record<string, number>

/** Bản sao thuật toán backend (UnitClassificationService.classify) để thử tại chỗ. */
function classifyLocal(rules: UnitClassRule[], counts: Counts, order: string[]): { index: number; level: string } | null {
  const total = order.reduce((a, l) => a + (counts[l] ?? 0), 0)
  const pct = (level: string, scope: UnitClassScope) => {
    if (total <= 0) return 0
    const idx = order.indexOf(level)
    let sum = 0
    if (idx < 0) sum = counts[level] ?? 0
    else if (scope === 'orAbove') for (let i = 0; i <= idx; i++) sum += counts[order[i]!] ?? 0
    else if (scope === 'orBelow') for (let i = idx; i < order.length; i++) sum += counts[order[i]!] ?? 0
    else sum = counts[level] ?? 0
    return (sum * 100) / total
  }
  const cmp = (a: number, op: UnitClassOp, t: number) =>
    op === 'lte' ? a <= t + 1e-6 : op === 'gt' ? a > t : op === 'lt' ? a < t : op === 'eq' ? Math.abs(a - t) < 1e-6 : a >= t - 1e-6
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i]!
    if (r.conditions.every(c => cmp(pct(c.level, c.scope), c.op, c.percent))) return { index: i, level: r.levelName }
  }
  const low = order[order.length - 1]
  return low ? { index: -1, level: low } : null
}

function RuleLadder({
  rules, levels, levelNames, onChange,
}: {
  rules: UnitClassRule[]
  levels: { name: string; color: string }[]
  levelNames: string[]
  onChange: (rules: UnitClassRule[]) => void
}) {
  const colorOf = (name: string) => levels.find(l => l.name === name)?.color ?? '#64748b'

  // Thử nhanh: gõ số người mỗi mức, thấy ngay đơn vị rơi vào mức nào — luật viết bằng % cộng
  // dồn rất khó hình dung nếu không có một ví dụ cụ thể ngay bên cạnh.
  const [counts, setCounts] = useState<Counts>(() => {
    const seed = bellTargets(levelNames)
    const out: Counts = {}
    seed.forEach(t => { out[t.level] = Math.round((t.percent * 20) / 100) })
    return out
  })
  const total = levelNames.reduce((a, l) => a + (counts[l] ?? 0), 0)
  const result = useMemo(() => classifyLocal(rules, counts, levelNames), [rules, counts, levelNames])

  const patchRule = (i: number, patch: Partial<UnitClassRule>) =>
    onChange(rules.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const patchCond = (ri: number, ci: number, patch: Partial<UnitClassRule['conditions'][number]>) =>
    onChange(rules.map((r, idx) => idx !== ri ? r : { ...r, conditions: r.conditions.map((c, j) => j === ci ? { ...c, ...patch } : c) }))
  const addCond = (ri: number) =>
    onChange(rules.map((r, idx) => idx !== ri ? r : { ...r, conditions: [...r.conditions, { level: r.levelName || levelNames[0] || '', scope: 'orAbove', op: 'gte', percent: 50 }] }))
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

  const miniSelect = 'h-8 w-auto min-w-0 gap-1 rounded-control border-none bg-[var(--color-muted)] px-2 text-xs font-medium'

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <ol className="space-y-2">
        {rules.map((r, ri) => {
          const hit = result?.index === ri
          return (
            <li
              key={ri}
              className={cn(
                'rounded-card border bg-[var(--color-card)] p-3 transition-colors',
                hit ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-soft)]' : 'border-[var(--color-border)]',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-semibold tabular-nums text-[var(--color-muted-foreground)]" aria-label={`Ưu tiên ${ri + 1}`}>{ri + 1}</span>
                <span className="text-sm text-[var(--color-muted-foreground)]">Đơn vị được xếp</span>
                <Select value={r.levelName} onValueChange={v => patchRule(ri, { levelName: v, color: colorOf(v) })}>
                  <SelectTrigger className="h-8 w-auto min-w-[8rem] rounded-control border-none bg-[var(--color-muted)] px-2 text-sm font-semibold" style={{ color: r.color }} aria-label="Mức xếp loại">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden="true" />
                    <SelectValue placeholder="Chọn mức" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(l => <SelectItem key={l.name} value={l.name}>{l.name}</SelectItem>)}
                    {!levelNames.includes(r.levelName) && r.levelName && <SelectItem value={r.levelName}>{r.levelName}</SelectItem>}
                  </SelectContent>
                </Select>
                <span className="text-sm text-[var(--color-muted-foreground)]">{r.conditions.length ? 'khi' : '— luôn đúng (mức rơi về)'}</span>
                {hit && <Badge className="ml-1">Khớp với ví dụ</Badge>}
                <div className="ml-auto flex items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => moveRule(ri, -1)} disabled={ri === 0} aria-label={`Đưa mức ${r.levelName} lên trên`} title="Lên"><ArrowUp aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon-sm" type="button" onClick={() => moveRule(ri, 1)} disabled={ri === rules.length - 1} aria-label={`Đưa mức ${r.levelName} xuống dưới`} title="Xuống"><ArrowDown aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon-sm" type="button" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => removeRule(ri)} aria-label={`Xoá mức ${r.levelName}`} title="Xoá mức"><Trash2 aria-hidden="true" /></Button>
                </div>
              </div>

              {r.conditions.length > 0 && (
                <ul className="mt-2 space-y-1.5 pl-8">
                  {r.conditions.map((c, ci) => (
                    <li key={ci} className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
                      <span className="w-6 text-xs">{ci === 0 ? '' : 'và'}</span>
                      <Select value={c.op} onValueChange={v => patchCond(ri, ci, { op: v as UnitClassOp })}>
                        <SelectTrigger className={miniSelect} aria-label="Phép so sánh"><SelectValue /></SelectTrigger>
                        <SelectContent>{OP_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number" min={0} max={100} value={c.percent}
                          onChange={e => patchCond(ri, ci, { percent: Number(e.target.value) })}
                          aria-label="Tỷ lệ phần trăm"
                          className="h-8 w-14 rounded-control border-none bg-[var(--color-muted)] px-2 text-xs font-medium tabular-nums text-[var(--color-foreground)] outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                        />
                        <span>%</span>
                      </span>
                      <span>nhân sự đạt</span>
                      <Select value={c.level} onValueChange={v => patchCond(ri, ci, { level: v })}>
                        <SelectTrigger className={miniSelect} aria-label="Mức của nhân sự"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {levelNames.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          {!levelNames.includes(c.level) && c.level && <SelectItem value={c.level}>{c.level}</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Select value={c.scope} onValueChange={v => patchCond(ri, ci, { scope: v as UnitClassScope })}>
                        <SelectTrigger className={miniSelect} aria-label="Phạm vi mức"><SelectValue /></SelectTrigger>
                        <SelectContent>{SCOPE_OPTS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon-sm" type="button" className="text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]" onClick={() => removeCond(ri, ci)} aria-label={`Xoá điều kiện ${ci + 1} của mức ${r.levelName}`} title="Xoá điều kiện"><X aria-hidden="true" /></Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="ghost" size="sm" type="button" className="mt-1.5 ml-6 text-[var(--color-primary)]" onClick={() => addCond(ri)}>
                <Plus aria-hidden="true" /> {r.conditions.length ? 'Thêm điều kiện' : 'Thêm điều kiện cho mức này'}
              </Button>
            </li>
          )
        })}
        <li>
          <Button variant="outline" size="sm" className="w-full border-dashed" type="button" onClick={addRule}>
            <Plus aria-hidden="true" /> Thêm mức xếp loại
          </Button>
        </li>
      </ol>

      {/* Thử nhanh */}
      <aside className="h-fit rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3 xl:sticky xl:top-4">
        <p className="text-label">Thử nhanh</p>
        <p className="mt-0.5 text-caption">Gõ số người ở mỗi mức của một đơn vị giả định, luật khớp sẽ được đánh dấu.</p>
        <div className="mt-3 space-y-1.5">
          {levels.map(l => (
            <label key={l.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-foreground)]">{l.name}</span>
              <input
                type="number" min={0} max={9999} value={counts[l.name] ?? 0}
                onChange={e => setCounts(prev => ({ ...prev, [l.name]: Math.max(0, Number(e.target.value) || 0) }))}
                aria-label={`Số người ở mức ${l.name}`}
                className="h-8 w-16 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-2 text-right text-sm tabular-nums text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
              <span className="w-10 text-right text-caption tabular-nums">{total ? Math.round(((counts[l.name] ?? 0) * 100) / total) : 0}%</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <span className="text-caption">{total} người</span>
          {result && (
            <span className="inline-flex items-center gap-1.5 rounded-control bg-[var(--color-card)] px-2.5 py-1 text-sm font-semibold" style={{ color: colorOf(result.level) }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(result.level) }} aria-hidden="true" />
              {result.level}
            </span>
          )}
        </div>
        {result && result.index === -1 && (
          <p className="mt-2 text-caption">Không luật nào khớp → về mức thấp nhất của thang.</p>
        )}
      </aside>
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
  nodes, selected, takenBy, onToggle, defaultOpen, onOpened,
}: {
  nodes: OrgUnitTreeResponse[]
  selected: string[]
  takenBy: Record<string, string>
  onToggle: (id: string) => void
  defaultOpen?: boolean
  onOpened?: () => void
}) {
  // Mở sẵn theo cờ từ cha (hồ sơ vừa tạo, component mount mới nên chỉ cần trạng thái khởi tạo);
  // báo lại cho cha để cờ không dính sang lần render sau.
  const [open, setOpen] = useState(!!defaultOpen)
  useEffect(() => { if (defaultOpen) onOpened?.() }, [defaultOpen, onOpened])
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
          <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={() => { if (hasKids) toggleNode(n.id) }} aria-label={hasKids ? 'Mở/thu nhánh' : undefined}>
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

// ── Đơn vị nào đang dùng hồ sơ nào ─────────────────────────────────────────
/**
 * Cùng phép tra như backend (UnitClassificationService.resolveProfile) cho phạm vi "mọi kỳ": hồ sơ
 * gán cho đơn vị gần nhất trong nhánh thắng, không có thì về mặc định. Hồ sơ gắn kỳ ghi chú riêng.
 */
function ProfileCoverage({ profiles, tree, cycleNameById }: {
  profiles: EditProfile[]
  tree: OrgUnitTreeResponse[]
  cycleNameById: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => {
    const out: { id: string; name: string; depth: number; profile: EditProfile | undefined; inherited: boolean }[] = []
    const byUnit = new Map<string, EditProfile>()
    profiles.forEach(p => { if (!p.isDefault && p.kpiCycleIds.length === 0) p.orgUnitIds.forEach(id => byUnit.set(id, p)) })
    const fallback = profiles.find(p => p.isDefault)
    const walk = (nodes: OrgUnitTreeResponse[], depth: number, inheritedFrom: EditProfile | undefined) =>
      nodes.forEach(n => {
        const own = byUnit.get(n.id)
        const eff = own ?? inheritedFrom
        out.push({ id: n.id, name: n.name, depth, profile: eff ?? fallback, inherited: !own && !!inheritedFrom })
        walk(n.children ?? [], depth + 1, eff)
      })
    walk(tree, 0, undefined)
    return out
  }, [profiles, tree])
  const cycleScoped = profiles.filter(p => !p.isDefault && p.kpiCycleIds.length > 0)

  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center gap-1.5 px-2 text-left text-caption hover:text-[var(--color-foreground)]">
        {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        Đơn vị nào đang dùng hồ sơ nào
      </button>
      {open && (
        <div className="custom-scrollbar mt-2 max-h-72 overflow-y-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <ul className="divide-y divide-[var(--color-border)]">
            {rows.map(r => (
              <li key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs" style={{ paddingLeft: 10 + r.depth * 12 }}>
                <span className="min-w-0 flex-1 truncate text-[var(--color-foreground)]">{r.name}</span>
                <span className={cn('shrink-0 truncate max-w-[9rem]', r.profile?.isDefault ? 'text-[var(--color-muted-foreground)]' : 'font-medium text-[var(--color-primary)]')} title={r.inherited ? 'Kế thừa từ đơn vị cha' : undefined}>
                  {r.profile?.name ?? '—'}{r.inherited ? ' ↑' : ''}
                </span>
              </li>
            ))}
          </ul>
          {cycleScoped.length > 0 && (
            <p className="border-t border-[var(--color-border)] px-2.5 py-1.5 text-caption">
              Riêng theo kỳ: {cycleScoped.map(p => `${p.name} (${p.kpiCycleIds.map(id => cycleNameById[id] ?? 'kỳ').join(', ')})`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
