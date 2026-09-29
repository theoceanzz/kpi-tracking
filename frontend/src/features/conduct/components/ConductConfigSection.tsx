import { LocaleNumberInput } from '@/components/ui/number-input'
import { useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, Save, RotateCcw, Star, ChevronRight, ChevronDown,
  Search, X, CalendarRange, Loader2, Copy, HelpCircle, Scale, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useConductConfig, useConductSets } from '../hooks/useConduct'
import { CONDUCT_MIN_SCORE } from '../hooks/useConductDraft'
import type { ConductSet } from '../api/conductApi'
import type { OrganizationResponse } from '@/features/orgunits/api/organizationApi'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

/**
 * Các BỘ tiêu chí hạnh kiểm của tổ chức — cùng khuôn với hồ sơ luật của "xếp loại đơn vị":
 * nhiều bộ, mỗi bộ gán cho một số KỲ, kỳ không được gán thì dùng bộ MẶC ĐỊNH.
 *
 * Mỗi bộ giữ riêng thang điểm và danh sách tiêu chí kèm trọng số; ràng buộc duy nhất là
 * TỔNG trọng số = 100% — vì điểm tổng là Σ(điểm × trọng số), lệch 100% thì điểm không bao
 * giờ chạm được thang tối đa.
 *
 * Bố cục: thẻ đóng là MỘT dòng tóm tắt đủ để so sánh các bộ với nhau; mở ra mới thấy phần
 * soạn thảo. Tên bộ nằm ngay trên dòng tiêu đề chứ không lặp lại thành một ô riêng bên
 * trong, và phần "biểu hiện cụ thể" của mỗi tiêu chí gập lại — bốn ô văn bản dài mở sẵn
 * đẩy nút Lưu xuống dưới màn hình, đúng thứ người dùng cần bấm nhất.
 *
 * Khác "xếp loại đơn vị" ở một chỗ: bên đó cả cấu hình là một chuỗi JSON nên lưu một lần
 * là xong, còn ở đây mỗi bộ là một tài nguyên riêng trên server, nên nút Lưu nằm trong
 * từng thẻ — sửa bộ của kỳ này không được đụng bộ mà kỳ khác đang chấm dở.
 */

interface DraftCriteria {
  name: string
  description: string
  weight: string
}

interface DraftSet {
  id: string
  name: string
  isDefault: boolean
  maxScore: string
  kpiCycleIds: string[]
  criteria: DraftCriteria[]
}

const toDraft = (s: ConductSet): DraftSet => ({
  id: s.id,
  name: s.name,
  isDefault: s.isDefault,
  maxScore: String(s.maxScore ?? 5),
  kpiCycleIds: [...(s.kpiCycleIds ?? [])],
  criteria: (s.criteria ?? []).map(c => ({
    name: c.name,
    description: c.description ?? '',
    weight: String(c.weight),
  })),
})

const round2 = (n: number) => Math.round(n * 100) / 100
const totalWeight = (rows: DraftCriteria[]) => round2(rows.reduce((s, c) => s + (Number(c.weight) || 0), 0))

/** Nút biểu tượng dùng lại ở nhiều chỗ — luôn có tên đọc được cho trình đọc màn hình. */
function IconButton({
  label, onClick, danger, children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'w-8 h-8 inline-flex items-center justify-center rounded-control transition-colors cursor-pointer',
        danger
          ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] dark:hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]'
          : 'text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-muted-foreground)]',
      )}
    >
      {children}
    </button>
  )
}

export default function ConductConfigSection({ org }: { org: OrganizationResponse }) {
  const { t } = useTranslation('conduct')
  const orgId = org?.id
  const { data: config, isLoading } = useConductConfig(orgId)
  const {
    createSet, isCreating, updateSet, isUpdating,
    deleteSet, markDefaultSet, resetSet,
  } = useConductSets(orgId)

  const { data: cyclesData } = useKpiCycles({
    organizationId: orgId, size: 100, sortBy: 'startDate', direction: 'desc',
  })
  const cycles = useMemo(
    () => (cyclesData?.content ?? []).map(c => ({ id: c.id as string, name: c.name as string })),
    [cyclesData],
  )
  const cycleNameById = useMemo(() => {
    const m: Record<string, string> = {}
    cycles.forEach(c => { m[c.id] = c.name })
    return m
  }, [cycles])

  // Server là nguồn sự thật: mọi mutation trả về nguyên cấu hình nên nạp lại bản nháp theo
  // nó, khỏi phải tự đồng bộ từng thẻ sau mỗi lần lưu/xoá/đổi mặc định.
  const [drafts, setDrafts] = useState<DraftSet[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const sets = useMemo(() => config?.sets ?? [], [config])
  // Nạp lại bản nháp NGAY TRONG RENDER khi server trả về cấu hình khác, không qua effect:
  // effect chạy sau khi đã vẽ nên người dùng thấy một nhịp số cũ rồi mới nhảy sang số mới.
  const syncedSets = useRef<typeof sets | null>(null)
  if (syncedSets.current !== sets) {
    syncedSets.current = sets
    setDrafts(sets.map(toDraft))
    // Chỉ dọn id đã biến mất và mở sẵn thẻ đầu khi chưa có thẻ nào mở. KHÔNG tự mở thẻ
    // "mới thấy": mỗi lần cấu hình được tải lại, mọi thẻ đang thu sẽ bung ra hết.
    setExpanded(prev => {
      const live = new Set(sets.map(s => s.id))
      const next = new Set([...prev].filter(id => live.has(id)))
      if (next.size === 0 && sets[0]) next.add(sets[0].id)
      return next
    })
  }

  const toggleExpanded = (id: string) =>
    setExpanded(e => {
      const s = new Set(e)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })

  const patch = (id: string, p: Partial<DraftSet>) =>
    setDrafts(ds => ds.map(d => (d.id === id ? { ...d, ...p } : d)))

  // Kỳ đang bị bộ KHÁC giữ — hiện ngay trong ô chọn thay vì để người dùng gán rồi mới thấy
  // kỳ lặng lẽ biến mất khỏi bộ cũ.
  const cycleOwner = (selfId: string): Record<string, string> => {
    const m: Record<string, string> = {}
    drafts.forEach(d => {
      if (d.id === selfId) return
      d.kpiCycleIds.forEach(cid => { m[cid] = d.name })
    })
    return m
  }

  /** Tạo bộ mới rồi mở sẵn thẻ của nó — bước tiếp theo luôn là gán kỳ cho bộ vừa tạo. */
  const addSet = (name: string, copyFromSetId: string | null) => {
    const before = new Set(drafts.map(d => d.id))
    createSet({ name, copyFromSetId }, {
      onSuccess: cfg => {
        const created = (cfg?.sets ?? []).find(s => !before.has(s.id))
        if (created) setExpanded(e => new Set([...e, created.id]))
      },
    })
  }

  const handleAdd = () => {
    const base = drafts.find(d => d.isDefault) ?? drafts[0]
    addSet(t('ConductConfigSection.criteriaSet', { value: drafts.length + 1 }), base?.id ?? null)
  }

  const handleSave = (draft: DraftSet) => {
    if (!draft.name.trim()) { toast.error(t('ConductConfigSection.theCriteriaSetNameCannotBe')); return }
    if (!draft.criteria.length) { toast.error(t('ConductConfigSection.setNeedsAtLeast1Criterion', { name: draft.name })); return }
    if (draft.criteria.some(c => !c.name.trim())) { toast.error(t('ConductConfigSection.theCriterionNameCannotBeEmpty')); return }
    if (draft.criteria.some(c => !(Number(c.weight) > 0))) {
      toast.error(t('ConductConfigSection.eachCriterionsWeightMustBeGreater')); return
    }
    const total = totalWeight(draft.criteria)
    if (Math.abs(total - 100) > 0.01) {
      toast.error(t('ConductConfigSection.theTotalWeightMustEqual100', { total })); return
    }
    const max = Number(draft.maxScore)
    if (!(max > CONDUCT_MIN_SCORE)) { toast.error(t('ConductConfigSection.theScaleMustBeGreaterThan', { CONDUCT_MIN_SCORE })); return }

    setSavingId(draft.id)
    updateSet({
      setId: draft.id,
      data: {
        name: draft.name.trim(),
        maxScore: max,
        // Bộ mặc định áp cho mọi kỳ chưa gán nên không mang danh sách kỳ nào.
        kpiCycleIds: draft.isDefault ? [] : draft.kpiCycleIds,
        criteria: draft.criteria.map(c => ({
          name: c.name.trim(),
          description: c.description.trim() || null,
          weight: Number(c.weight),
        })),
      },
    }, { onSettled: () => setSavingId(null) })
  }

  if (isLoading) return <LoadingSkeleton rows={6} />

  const unassignedCount = cycles.filter(c => !drafts.some(d => d.kpiCycleIds.includes(c.id))).length
  const hasDefault = drafts.some(d => d.isDefault)

  return (
    // Đầu mục PHẢI là `WorkspaceHeader`: đó cũng là nơi vẽ hàng tab Định lượng/Định tính/
    // Hạnh kiểm của mục Thang điểm. Tự dựng một đầu card khác ở đây là hàng tab biến mất.
    <div className="space-y-4">
      <WorkspaceHeader
        description={t('ConductConfigSection.criteriaSetsAssignedByCycleUnassigned', { count: drafts.length })}
        actions={
          <>
            <HelpPopover />
            <Button variant="outline" type="button" onClick={() => resetSet(undefined)} title={t('ConductConfigSection.resetTheDefaultSetTo4')}>
              <RotateCcw aria-hidden="true" /> {t('ConductConfigSection.resetTheDefaultSet')}
            </Button>
          </>
        }
      />

      {!hasDefault && (
        <p className="flex items-start gap-2 rounded-card bg-[var(--color-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--color-warning)]">
          <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
          {t('ConductConfigSection.noDefaultSetYetCyclesWithout')}
        </p>
      )}

      {/* Không bọc thêm một card ngoài: mỗi bộ đã là một card có viền, lồng card trong
          card chỉ thêm một tầng khung mà không nhóm thêm được thông tin gì. */}
      <div id="tour-conduct-sets" className="space-y-2.5">
        {drafts.map(d => (
          <SetCard
            key={d.id}
            draft={d}
            cycles={cycles}
            cycleNameById={cycleNameById}
            cycleOwner={cycleOwner(d.id)}
            unassignedCount={unassignedCount}
            canDelete={drafts.length > 1 && !d.isDefault}
            isOpen={expanded.has(d.id)}
            isSaving={savingId === d.id && isUpdating}
            onToggle={() => toggleExpanded(d.id)}
            onPatch={p => patch(d.id, p)}
            onSave={() => handleSave(d)}
            onSetDefault={() => markDefaultSet(d.id)}
            onDuplicate={() => addSet(t('ConductConfigSection.copy', { name: d.name }), d.id)}
            onReset={() => resetSet(d.id)}
            onRemove={() => deleteSet(d.id)}
          />
        ))}
      </div>

      <Button variant="outline" className="w-full" id="tour-conduct-add-set" type="button" onClick={handleAdd} disabled={isCreating}>
        {isCreating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}
        {t('ConductConfigSection.addCriteriaSet')}
      </Button>
    </div>
  )
}

/** Phần giải thích dài — để sau nút "?" thay vì bày sẵn hai dòng chữ trên danh sách. */
function HelpPopover() {
  const { t } = useTranslation('conduct')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" type="button" aria-label={t('ConductConfigSection.howConductCriteriaSetsWork')}>
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] text-xs leading-relaxed text-[var(--color-muted-foreground)] space-y-2">
        <p>{t('ConductConfigSection.each')} <b>{t('ConductConfigSection.set')}</b> {t('ConductConfigSection.isOneWayOfScoringConduct')} <b>{t('ConductConfigSection.cycle')}</b> {t('ConductConfigSection.andEveryPeriodInThatCycle')}</p>
        <p>{t('ConductConfigSection.unassignedCyclesUseTheSet')} <b>{t('ConductConfigSection.default')}</b>{t('ConductConfigSection.aCycleBelongsToOnlyOne')}</p>
        <p>{t('ConductConfigSection.totalScoreScoreWeightSo')} <b>{t('ConductConfigSection.theTotalWeightMustEqual1002')}</b>.</p>
      </PopoverContent>
    </Popover>
  )
}

// ── Thẻ 1 bộ (accordion) ────────────────────────────────────────────────────
function SetCard({
  draft: d, cycles, cycleNameById, cycleOwner, unassignedCount,
  canDelete, isOpen, isSaving,
  onToggle, onPatch, onSave, onSetDefault, onDuplicate, onReset, onRemove,
}: {
  draft: DraftSet
  cycles: { id: string; name: string }[]
  cycleNameById: Record<string, string>
  cycleOwner: Record<string, string>
  /** Bao nhiêu kỳ đang rơi về bộ mặc định — chỉ hiện trên chính thẻ mặc định. */
  unassignedCount: number
  canDelete: boolean
  isOpen: boolean
  isSaving: boolean
  onToggle: () => void
  onPatch: (patch: Partial<DraftSet>) => void
  onSave: () => void
  onSetDefault: () => void
  onDuplicate: () => void
  onReset: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation('conduct')
  // Ô "biểu hiện cụ thể" gập theo từng tiêu chí: mở sẵn cả bốn thì thẻ dài gấp bốn lần và
  // nút Lưu bị đẩy khỏi màn hình.
  const [openDesc, setOpenDesc] = useState<Set<number>>(new Set())
  const toggleDesc = (i: number) =>
    setOpenDesc(s => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const total = totalWeight(d.criteria)
  const totalOff = Math.abs(total - 100) > 0.01

  const setCriteria = (idx: number, p: Partial<DraftCriteria>) =>
    onPatch({ criteria: d.criteria.map((c, i) => (i === idx ? { ...c, ...p } : c)) })

  /** Chia đều 100% cho các tiêu chí — cách thoát nhanh nhất khi tổng bị lệch. */
  const splitEvenly = () => {
    const n = d.criteria.length
    if (!n) return
    const each = Math.floor((100 / n) * 100) / 100
    // Dồn phần lẻ vào tiêu chí cuối để tổng chạm đúng 100, không phải 99.99.
    const rest = round2(100 - each * (n - 1))
    onPatch({ criteria: d.criteria.map((c, i) => ({ ...c, weight: String(i === n - 1 ? rest : each) })) })
  }

  const fieldCls = 'h-9 px-3 rounded-control bg-[var(--color-muted)] text-sm font-medium border border-transparent outline-none focus:border-[var(--color-info-border)] focus:ring-2 focus:ring-[var(--color-info-solid)]'

  return (
    <div className={cn(
      'rounded-card border transition-colors',
      isOpen ? 'border-[var(--color-border-strong)]' : 'border-[var(--color-border)]',
      d.isDefault && 'border-[var(--color-info-border)]',
    )}>
      {/* ── Dòng tiêu đề: đóng thì là bản tóm tắt, mở thì là thanh công cụ của bộ ── */}
      <div className="flex items-center gap-2 p-2.5 max-sm:flex-wrap">
        <Button variant="ghost" size="icon-sm" className="shrink-0" type="button" onClick={onToggle} aria-expanded={isOpen} aria-label={isOpen ? t('ConductConfigSection.collapseSet', { name: d.name }) : t('ConductConfigSection.openSet', { name: d.name })}>
          {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </Button>

        {d.isDefault && (
          <Badge className="gap-1 shrink-0 whitespace-nowrap"><Star size={11} className="fill-white" aria-hidden="true" /> {t('ConductConfigSection.default2')}</Badge>
        )}

        {isOpen ? (
          // Tên bộ sửa ngay tại đây, không lặp lại thành một ô riêng bên dưới. Rộng vừa
          // phải: ô kéo hết bề ngang cho một cái tên tám chữ trông như lỗi bố cục.
          <input
            value={d.name}
            onChange={e => onPatch({ name: e.target.value })}
            placeholder={t('ConductConfigSection.criteriaSetName')}
            aria-label={t('ConductConfigSection.criteriaSetName')}
            className={cn(fieldCls, 'flex-1 min-w-[140px] max-w-xs font-semibold')}
          />
        ) : (
          <button className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)] flex-1 min-w-0" type="button" onClick={onToggle}>
            <span className="font-semibold text-sm truncate">{d.name || t('ConductConfigSection.criteriaSet2')}</span>
            <span className="ml-auto flex items-center gap-2 shrink-0 text-caption max-sm:hidden">
              <span>{d.criteria.length} {t('ConductConfigSection.criteria')}</span>
              <span className="text-[var(--color-subtle-foreground)]">·</span>
              <span>{t('ConductConfigSection.scaleRange', { min: CONDUCT_MIN_SCORE, max: d.maxScore })}</span>
              <span className="text-[var(--color-subtle-foreground)]">·</span>
              <span className={totalOff ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}>{total}%</span>
              <span className="text-[var(--color-subtle-foreground)]">·</span>
              <CycleSummary aria-hidden="true" draft={d} cycleNameById={cycleNameById} />
            </span>
          </button>
        )}

        {isOpen && (
          <div className="flex items-center gap-0.5 shrink-0 max-sm:w-full max-sm:justify-end">
            {!d.isDefault && (
              <IconButton label={t('ConductConfigSection.makeDefaultSet')} onClick={onSetDefault}><Star size={15} /></IconButton>
            )}
            <IconButton label={t('ConductConfigSection.duplicateThisSet')} onClick={onDuplicate}><Copy size={15} /></IconButton>
            <IconButton label={t('ConductConfigSection.resetThisSetToThe4')} onClick={onReset}><RotateCcw size={15} /></IconButton>
            {canDelete && <IconButton label={t('ConductConfigSection.deleteThisSet')} onClick={onRemove} danger><Trash2 size={15} /></IconButton>}
            <Button size="sm" className="ml-1.5" type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />} {t('ConductConfigSection.save')}
            </Button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="border-t border-[var(--color-border)]">
          {/* ── Một hàng thuộc tính: kỳ áp dụng + thang điểm + tổng trọng số ──
              Trước đây là ba khối xếp dọc, mỗi khối có nền và chú thích riêng — cao gần
              200px cho ba con số. */}
          <div className="px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-eyebrow inline-flex items-center gap-1 shrink-0">
                <CalendarRange size={12} aria-hidden="true" /> {t('ConductConfigSection.applicableCycles')}
              </span>
              {d.isDefault ? (
                <span
                  className="text-caption"
                  title={t('ConductConfigSection.theDefaultSetAlwaysAppliesTo')}
                >
                  {t('ConductConfigSection.everyCycleWithoutItsOwnSet')}
                  {unassignedCount > 0 && (
                    <span className="text-[var(--color-subtle-foreground)]"> ({unassignedCount} {t('ConductConfigSection.cycles')}</span>
                  )}
                </span>
              ) : (
                <>
                  {d.kpiCycleIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[180px]">
                      <span className="truncate">{cycleNameById[id] ?? t('ConductConfigSection.aCycle')}</span>
                      <Button variant="ghost" size="icon" className="shrink-0 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={() => onPatch({ kpiCycleIds: d.kpiCycleIds.filter(x => x !== id) })} aria-label={t('ConductConfigSection.unassignCycle', { value: cycleNameById[id] ?? '' })}>
                        <X aria-hidden="true" />
                      </Button>
                    </Badge>
                  ))}
                  <CyclePickerPopover
                    cycles={cycles}
                    selected={d.kpiCycleIds}
                    ownedBy={cycleOwner}
                    onToggle={id => onPatch({
                      kpiCycleIds: d.kpiCycleIds.includes(id) ? d.kpiCycleIds.filter(x => x !== id) : [...d.kpiCycleIds, id],
                    })}
                  />
                  {d.kpiCycleIds.length === 0 && (
                    <span className="text-xs font-medium text-[var(--color-warning)]">{t('ConductConfigSection.noCyclesAssigned')}</span>
                  )}
                </>
              )}
            </div>

            {/* Thang điểm phải trùng trần trục hành vi của ma trận xếp loại (mặc định 5): điểm
                hạnh kiểm chính là thứ lấp trục đó khi tổ chức không chấm KPI định tính. Để thang
                thấp hơn thì chấm kịch khung vẫn không bao giờ chạm được mức cao nhất của ma trận. */}
            <label className="flex items-center gap-2 shrink-0" title={t('ConductConfigSection.theScaleForEachCriterionKeep')}>
              <span className="text-eyebrow inline-flex items-center gap-1">
                <Scale size={12} aria-hidden="true" /> {t('ConductConfigSection.scoringScales')}
              </span>
              <span className="text-caption tabular-nums">{CONDUCT_MIN_SCORE} –</span>
              <LocaleNumberInput
                type="number"
                min={CONDUCT_MIN_SCORE + 1}
                step={1}
                value={d.maxScore}
                onChange={e => onPatch({ maxScore: e.target.value })}
                onWheel={e => e.currentTarget.blur()}
                className={cn(fieldCls, 'w-16 text-center')}
              />
              {Number(d.maxScore) !== 5 && (
                <span className="text-xs font-medium text-[var(--color-warning)]" title={t('ConductConfigSection.theRatingMatrixRuns15')}>
                  {t('ConductConfigSection.n15Matrix')}
                </span>
              )}
            </label>

            <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
              <span className="text-eyebrow">{t('ConductConfigSection.totalWeight')}</span>
              <span className={cn('text-base font-semibold tabular-nums', totalOff ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]')}>
                {total}%
              </span>
              {totalOff && (
                <Button variant="ghost" size="sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={splitEvenly} title={t('ConductConfigSection.split100EvenlyAcrossCriteria')}>
                  {t('ConductConfigSection.splitEvenly')}
                </Button>
              )}
            </div>
          </div>

          {/* ── Danh sách tiêu chí ── */}
          <div className="p-3 space-y-1.5">
            {d.criteria.map((row, idx) => {
              const lines = row.description.split('\n').map(l => l.trim()).filter(Boolean)
              const descOpen = openDesc.has(idx)
              return (
                <div key={idx} className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
                  <div className="flex items-center gap-2 p-2 max-sm:flex-wrap">
                    <span className="w-6 h-6 shrink-0 rounded-control bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center text-caption tabular-nums">
                      {idx + 1}
                    </span>
                    <input
                      value={row.name}
                      onChange={e => setCriteria(idx, { name: e.target.value })}
                      placeholder={t('ConductConfigSection.criterionName')}
                      aria-label={t('ConductConfigSection.criterionName2', { value: idx + 1 })}
                      className={cn(fieldCls, 'flex-1 min-w-[120px] bg-[var(--color-card)]')}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <LocaleNumberInput
                        type="number"
                        min={0}
                        step={1}
                        value={row.weight}
                        onChange={e => setCriteria(idx, { weight: e.target.value })}
                        onWheel={e => e.currentTarget.blur()}
                        aria-label={t('ConductConfigSection.criterionWeight', { value: idx + 1 })}
                        className={cn(fieldCls, 'w-16 text-center bg-[var(--color-card)] tabular-nums')}
                      />
                      <span className="text-xs font-semibold text-[var(--color-subtle-foreground)]">%</span>
                    </div>
                    {/* Gập "biểu hiện" nhưng vẫn nói rõ đang có bao nhiêu dòng, để không ai
                        tưởng tiêu chí này chưa được mô tả. */}
                    <button
                      type="button"
                      onClick={() => toggleDesc(idx)}
                      aria-expanded={descOpen}
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1 px-2 h-9 rounded-control text-xs font-medium cursor-pointer transition-colors',
                        lines.length
                          ? 'bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:text-[var(--color-info)] border border-[var(--color-border)]'
                          : 'text-[var(--color-subtle-foreground)] hover:text-[var(--color-info)]',
                      )}
                    >
                      {descOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                      {lines.length ? t('ConductConfigSection.indicators', { count: lines.length }) : t('ConductConfigSection.addIndicator')}
                    </button>
                    <IconButton
                      label={t('ConductConfigSection.deleteCriterion', { value: row.name || idx + 1 })}
                      onClick={() => onPatch({ criteria: d.criteria.filter((_, i) => i !== idx) })}
                      danger
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>

                  {descOpen && (
                    <div className="px-2 pb-2 pl-10 max-sm:pl-2">
                      <textarea
                        value={row.description}
                        onChange={e => setCriteria(idx, { description: e.target.value })}
                        placeholder={t('ConductConfigSection.specificIndicatorsOnePerLine')}
                        aria-label={t('ConductConfigSection.specificIndicatorsOfCriterion', { value: idx + 1 })}
                        rows={4}
                        className="w-full px-3 py-2 rounded-control bg-[var(--color-card)] border border-[var(--color-border)] text-xs font-medium leading-relaxed outline-none focus:border-[var(--color-info-border)] focus:ring-2 focus:ring-[var(--color-info-solid)] resize-y"
                      />
                    </div>
                  )}
                </div>
              )
            })}

            <Button variant="outline" className="w-full" type="button" onClick={() => onPatch({ criteria: [...d.criteria, { name: '', description: '', weight: '0' }] })}>
              <Plus aria-hidden="true" /> {t('ConductConfigSection.addCriterion')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Tóm tắt kỳ trên thẻ đã thu — giữ nhãn nguyên vẹn, phần dư gộp thành "+n". */
function CycleSummary({
  draft: d, cycleNameById,
}: {
  draft: DraftSet
  cycleNameById: Record<string, string>
}) {
  const { t } = useTranslation('conduct')
  if (d.isDefault) return <span>{t('ConductConfigSection.everyUnassignedCycle')}</span>
  if (d.kpiCycleIds.length === 0) return <span className="text-[var(--color-warning)]">{t('ConductConfigSection.noCycleAssigned')}</span>
  const names = d.kpiCycleIds.map(id => cycleNameById[id] ?? t('ConductConfigSection.aCycle'))
  return (
    <span className="max-w-[220px] truncate" title={names.join(', ')}>
      {names[0]}{names.length > 1 ? ` +${names.length - 1}` : ''}
    </span>
  )
}

// ── Popover chọn KỲ: danh sách phẳng có ô tìm ───────────────────────────────
function CyclePickerPopover({
  cycles, selected, ownedBy, onToggle,
}: {
  cycles: { id: string; name: string }[]
  selected: string[]
  /** cycleId → tên bộ khác đang giữ kỳ đó. */
  ownedBy: Record<string, string>
  onToggle: (id: string) => void
}) {
  const { t } = useTranslation('conduct')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cycles.filter(c => c.name.toLowerCase().includes(q)) : cycles
  }, [cycles, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-medium border border-dashed border-[var(--color-border-strong)] text-[var(--color-muted-foreground)] hover:border-[var(--color-info-border)] hover:text-[var(--color-info)] cursor-pointer"
        >
          <Plus size={13} aria-hidden="true" /> {t('ConductConfigSection.chooseCycle')}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <div className="p-2 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('ConductConfigSection.searchCycles')}
              aria-label={t('ConductConfigSection.searchEvaluationCycles')}
              className="w-full h-8 pl-8 pr-2 rounded-control bg-[var(--color-muted)] text-xs border-none outline-none focus:ring-2 focus:ring-[var(--color-info-solid)]"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(c => (
            <label key={c.id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-control cursor-pointer hover:bg-[var(--color-muted)]">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => onToggle(c.id)} />
              <span className="truncate text-[13px] font-medium text-[var(--color-foreground)]">{c.name}</span>
              {ownedBy[c.id] && !selected.includes(c.id) && (
                <span className="ml-auto shrink-0 text-xs font-medium text-[var(--color-warning)] truncate max-w-[90px]" title={t('ConductConfigSection.belongsToSet', { value: ownedBy[c.id] })}>
                  {ownedBy[c.id]}
                </span>
              )}
            </label>
          )) : <p className="text-xs italic text-[var(--color-subtle-foreground)] p-2">{t('ConductConfigSection.noCycleFound')}</p>}
        </div>
        <div className="px-3 py-2 border-t border-[var(--color-border)] text-caption">
          {t('ConductConfigSection.aCycleBelongsToOnlyOne2')}
        </div>
      </PopoverContent>
    </Popover>
  )
}
