import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Award, Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, Wand2,
  Star, Building2, ChevronRight, ChevronDown, Search, X,
} from 'lucide-react'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useOrgUnitTree } from '../hooks/useOrgUnitTree'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

/** Rule hợp lệ với thang hiện tại thì giữ, không thì nạp preset của thang. */
function rulesForScale(org: OrganizationResponse, rules: UnitClassRule[] | undefined): UnitClassRule[] {
  const valid = new Set(memberLevels(org).map(l => l.name))
  if (Array.isArray(rules) && rules.length && rules.some(r => valid.has(r?.levelName))) return rules
  return presetFor(org)
}

interface EditProfile { _key: string; name: string; isDefault: boolean; orgUnitIds: string[]; rules: UnitClassRule[] }

let _seq = 0
const newKey = () => `p${Date.now()}_${_seq++}`

/** Nạp danh sách hồ sơ ban đầu từ org (tương thích ngược hình dạng cũ {rules:[]}). */
function initialProfiles(org: OrganizationResponse): EditProfile[] {
  const fallback = (): EditProfile[] => [
    { _key: newKey(), name: 'Mặc định', isDefault: true, orgUnitIds: [], rules: presetFor(org) },
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
        rules: rulesForScale(org, p.rules),
      }))
      if (!profs.some(p => p.isDefault)) profs[0]!.isDefault = true // đảm bảo có 1 mặc định
      return profs
    }
    if (Array.isArray(parsed?.rules) && parsed.rules.length) {
      return [{ _key: newKey(), name: 'Mặc định', isDefault: true, orgUnitIds: [], rules: rulesForScale(org, parsed.rules) }]
    }
  } catch { /* fallthrough */ }
  return fallback()
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

/** Cấu hình NHIỀU HỒ SƠ luật xếp loại đơn vị, mỗi hồ sơ gán cho (các) đơn vị (đơn vị con kế thừa). */
export default function UnitClassificationConfigSection({ org }: { org: OrganizationResponse }) {
  const update = useUpdateOrganization(org.id)
  const { data: tree } = useOrgUnitTree()
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
    setExpanded(e => { const s = new Set(e); s.has(key) ? s.delete(key) : s.add(key); return s })

  const patchProfile = (key: string, patch: Partial<EditProfile>) =>
    setProfiles(ps => ps.map(p => p._key === key ? { ...p, ...patch } : p))

  const setDefault = (key: string) =>
    setProfiles(ps => ps.map(p => ({ ...p, isDefault: p._key === key })))

  const addProfile = () => {
    const key = newKey()
    setProfiles(ps => [...ps, { _key: key, name: `Hồ sơ ${ps.length + 1}`, isDefault: false, orgUnitIds: [], rules: presetFor(org) }])
    setExpanded(e => new Set([...e, key]))
  }

  const removeProfile = (key: string) =>
    setProfiles(ps => {
      const target = ps.find(p => p._key === key)
      const next = ps.filter(p => p._key !== key)
      if (next.length && target?.isDefault) next[0]!.isDefault = true // luôn còn 1 mặc định
      return next
    })

  // Map đơn vị → tên hồ sơ (khác) đang chiếm, để chặn gán trùng.
  const takenBy = (key: string): Record<string, string> => {
    const m: Record<string, string> = {}
    profiles.forEach(p => { if (p._key !== key && !p.isDefault) p.orgUnitIds.forEach(id => { m[id] = p.name }) })
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
    if (profiles.filter(p => p.isDefault).length !== 1) { toast.error('Cần đúng một hồ sơ mặc định'); return }
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
      orgUnitIds: p.isDefault ? [] : p.orgUnitIds, rules: p.rules,
    }))
    update.mutate({ unitClassificationRules: JSON.stringify({ profiles: payload }) }, {
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
            <p className="text-xs text-slate-500 font-medium">Nhiều hồ sơ luật — gán theo đơn vị (đơn vị con kế thừa)</p>
          </div>
        </div>
        {/* Mobile: 2 nút chia đều, cao 44px và cách nhau rộng để tránh bấm nhầm. Desktop: giữ nguyên hàng nút gọn.
            "Áp mẫu" giờ nằm trong từng hồ sơ (ProfileCard) nên không còn ở đây. */}
        <div className="flex items-center gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:gap-3">
          <button onClick={reset} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 max-sm:min-h-11 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300">
            <RotateCcw size={14} /> Đặt lại
          </button>
          <button onClick={save} disabled={update.isPending} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 max-sm:min-h-11 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
            <Save size={14} /> Lưu
          </button>
        </div>
      </div>

      <div className="p-6 max-sm:p-4 space-y-4 max-sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-xs text-slate-500">
            Mỗi <b>hồ sơ</b> là một cách xếp loại. Gán cho đơn vị nào thì <b>đơn vị con kế thừa</b> (trừ khi có hồ sơ riêng). Còn lại dùng hồ sơ <b>mặc định</b>.
          </p>
          {/* Chú thích thang mức thành viên */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Thang mức</span>
            {levels.map(l => (
              <span key={l.name} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.name}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {profiles.map(p => (
            <ProfileCard
              key={p._key}
              profile={p}
              levels={levels}
              levelNames={levelNames}
              tree={tree ?? []}
              unitNameById={unitNameById}
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

        <button onClick={addProfile} className="w-full py-2.5 max-sm:min-h-12 max-sm:mt-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 inline-flex items-center justify-center gap-1.5">
          <Plus size={14} /> Thêm hồ sơ xếp loại
        </button>
      </div>
    </section>
  )
}

// ── Thẻ 1 hồ sơ (accordion) ─────────────────────────────────────────────────
function ProfileCard({
  profile: p, levels, levelNames, tree, unitNameById, takenBy, canDelete, isOpen,
  onToggle, onPatch, onSetDefault, onApplyPreset, onRemove,
}: {
  profile: EditProfile
  levels: { name: string; color: string }[]
  levelNames: string[]
  tree: OrgUnitTreeResponse[]
  unitNameById: Record<string, string>
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

  return (
    <div className={cn('rounded-2xl border overflow-hidden', p.isDefault ? 'border-indigo-300 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-800')}>
      {/* Đầu thẻ — bấm để bung/thu */}
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
        {isOpen ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
        {p.isDefault && <Badge className="gap-1 shrink-0"><Star size={11} className="fill-white" /> Mặc định</Badge>}
        <span className="font-black text-sm truncate">{p.name || 'Hồ sơ'}</span>
        {!isOpen && (
          <span className="ml-auto flex items-center gap-1 min-w-0 text-[11px] text-slate-400">
            {p.isDefault ? (
              <span className="truncate">các đơn vị còn lại</span>
            ) : assignedNames.length ? (
              <span className="truncate">{assignedNames.slice(0, 2).join(', ')}{assignedNames.length > 2 ? ` +${assignedNames.length - 2}` : ''}</span>
            ) : (
              <span className="text-amber-500 font-bold shrink-0">chưa gán đơn vị</span>
            )}
            <span className="shrink-0">· {p.rules.length} mức</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-4 space-y-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={p.name}
              onChange={e => onPatch({ name: e.target.value })}
              placeholder="Tên hồ sơ"
              className="flex-1 min-w-[160px] h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-black border-none outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={onSetDefault}
              disabled={p.isDefault}
              className={cn('inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold',
                p.isDefault ? 'bg-indigo-600 text-white cursor-default' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200')}
              title="Hồ sơ áp cho đơn vị không được gán riêng"
            >
              <Star size={13} className={p.isDefault ? 'fill-white' : ''} /> {p.isDefault ? 'Mặc định' : 'Đặt mặc định'}
            </button>
            <button onClick={onApplyPreset} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300" title="Nạp mẫu luật gợi ý">
              <Wand2 size={13} /> Áp mẫu
            </button>
            {canDelete && (
              <button onClick={onRemove} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" title="Xoá hồ sơ"><Trash2 size={15} /></button>
            )}
          </div>

          {p.isDefault ? (
            <p className="text-[11px] italic text-slate-400 pl-0.5">Áp cho mọi đơn vị không được gán hồ sơ khác.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1"><Building2 size={13} /> Áp dụng cho đơn vị (đơn vị con kế thừa)</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {p.orgUnitIds.length === 0 && <span className="text-[11px] italic text-amber-500">Chưa gán đơn vị nào</span>}
                {p.orgUnitIds.map(id => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {unitNameById[id] ?? 'Đơn vị'}
                    <button onClick={() => onPatch({ orgUnitIds: p.orgUnitIds.filter(x => x !== id) })} className="hover:text-red-500" title="Bỏ gán"><X size={11} /></button>
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
              </div>
            </div>
          )}

          <RuleListEditor rules={p.rules} levels={levels} levelNames={levelNames} onChange={rules => onPatch({ rules })} />
        </div>
      )}
    </div>
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
    setExpanded(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })

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
    <div className="space-y-3">
      <div className="text-[11px] text-slate-500 pl-0.5">
        Đơn vị nhận <b>mức CAO NHẤT</b> thoả <b>TẤT CẢ</b> điều kiện (xét từ trên xuống). Mức cuối (không điều kiện) là mặc định.
      </div>
      {rules.map((r, ri) => (
        <div key={ri} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
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

      <button onClick={addRule} className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 inline-flex items-center justify-center gap-1.5">
        <Plus size={14} /> Thêm mức xếp loại
      </button>
    </div>
  )
}
