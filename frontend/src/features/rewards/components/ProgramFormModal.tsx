import { useEffect, useMemo, useState } from 'react'
import { Loader2, X, Trophy, Info } from 'lucide-react'
import TierEditor, { maxTierCost, tierError } from './TierEditor'
import { useQuery } from '@tanstack/react-query'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usesPerformanceMatrix } from '@/lib/scoring'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { kpiCycleApi } from '@/features/kpi/api/kpiCycleApi'
import { kpiPeriodApi } from '@/features/kpi/api/kpiPeriodApi'
import { useAuthStore } from '@/store/authStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRewardPrograms } from '../hooks/usePrograms'
import {
  RewardProgramScope,
  RewardRankingMetric,
  RewardTiePolicy,
  type RewardProgram,
  type RewardTier,
} from '../types'

interface ProgramFormModalProps {
  open: boolean
  onClose: () => void
  editProgram?: RewardProgram | null
}

/**
 * Chỉ số phù hợp với từng phạm vi. Backend cũng chặn, nhưng để người dùng chọn được một
 * cặp không hợp lệ rồi mới báo lỗi là thiết kế tồi — lọc luôn ở đây.
 *
 * <p>{@code MATRIX_RATING} còn phụ thuộc tổ chức có bật KPI định tính hay không, nên
 * được lọc thêm một lượt nữa lúc chạy — xem `availableMetrics`.
 */
const METRICS_BY_SCOPE: Record<RewardProgramScope, { value: RewardRankingMetric; label: string }[]> = {
  [RewardProgramScope.CYCLE]: [
    { value: RewardRankingMetric.FINAL_SCORE, label: 'Điểm chốt kỳ' },
    { value: RewardRankingMetric.MATRIX_RATING, label: 'Xếp loại (ma trận)' },
  ],
  [RewardProgramScope.PERIOD]: [
    { value: RewardRankingMetric.PERFORMANCE, label: 'Điểm hiệu suất đợt' },
    { value: RewardRankingMetric.MATRIX_RATING, label: 'Xếp loại (ma trận)' },
  ],
}

export default function ProgramFormModal({ open, onClose, editProgram }: ProgramFormModalProps) {
  const isEdit = !!editProgram
  const hasIssued = (editProgram?.issuedRunCount ?? 0) > 0

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<RewardProgramScope>(RewardProgramScope.CYCLE)
  const [orgUnitId, setOrgUnitId] = useState('')
  /** Rỗng = dùng cho mọi kỳ/đợt. */
  const [fixedTargetId, setFixedTargetId] = useState('')
  const [metric, setMetric] = useState<RewardRankingMetric>(RewardRankingMetric.FINAL_SCORE)
  const [tiePolicy, setTiePolicy] = useState<RewardTiePolicy>(RewardTiePolicy.SHARE_ALL)
  const [minMetricValue, setMinMetricValue] = useState<number | ''>('')
  const [maxPointsPerRun, setMaxPointsPerRun] = useState<number | ''>('')
  const [includeUnitHeads, setIncludeUnitHeads] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [autoTrigger, setAutoTrigger] = useState(false)
  const [tiers, setTiers] = useState<RewardTier[]>([
    { fromRank: 1, toRank: 1, points: 500 },
    { fromRank: 2, toRank: 3, points: 300 },
  ])

  const { data: treeData } = useOrgUnitTree()
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: organization } = useOrganization(orgId ?? '')
  const { createProgram, updateProgram, isCreating, isUpdating } = useRewardPrograms()

  // Xếp loại ma trận chỉ có dữ liệu khi tổ chức ra được xếp loại (KPI định tính hoặc chấm
  // hạnh kiểm). Hiện nó lúc tắt cả hai sẽ dẫn tới chương trình luôn xếp hạng ra danh sách rỗng.
  const isCycle = scope === RewardProgramScope.CYCLE
  const scopeWord = isCycle ? 'kỳ' : 'đợt'

  const { data: cycles } = useQuery({
    queryKey: ['kpiCycles', 'programForm', orgId],
    queryFn: () => kpiCycleApi.getAll({ page: 0, size: 100, organizationId: orgId }),
    enabled: open && isCycle && !!orgId,
  })
  const { data: periods } = useQuery({
    queryKey: ['kpiPeriods', 'programForm', orgId],
    queryFn: () =>
      kpiPeriodApi.getAll({
        page: 0,
        size: 100,
        sortBy: 'startDate',
        direction: 'desc',
        organizationId: orgId,
      }),
    enabled: open && !isCycle && !!orgId,
  })
  const targetOptions = ((isCycle ? cycles?.content : periods?.content) ?? []) as any[]

  // Xếp hạng theo ma trận chỉ có nghĩa khi org thực sự ra được xếp loại ma trận — KPI
  // định tính hoặc chấm hạnh kiểm (điểm hạnh kiểm lấp trục còn trống của ma trận).
  const hasMatrix = usesPerformanceMatrix(organization)
  const availableMetrics = useMemo(
    () =>
      METRICS_BY_SCOPE[scope].filter(
        (m) => m.value !== RewardRankingMetric.MATRIX_RATING || hasMatrix,
      ),
    [scope, hasMatrix],
  )

  const flatUnits = useMemo(() => {
    const flatten = (nodes: any[], level = 0): { id: string; label: string }[] => {
      let out: { id: string; label: string }[] = []
      nodes?.forEach((n) => {
        out.push({ id: n.id, label: '—'.repeat(level) + (level > 0 ? ' ' : '') + n.name })
        if (n.children?.length) out = out.concat(flatten(n.children, level + 1))
      })
      return out
    }
    return treeData ? flatten(treeData as any[]) : []
  }, [treeData])

  useEffect(() => {
    if (!open) return
    setName(editProgram?.name ?? '')
    setDescription(editProgram?.description ?? '')
    setScope(editProgram?.scope ?? RewardProgramScope.CYCLE)
    // Chương trình cũ lưu null = toàn tổ chức; effect bên dưới sẽ tự chọn đơn vị gốc,
    // vốn bao trọn cây con nên cùng phạm vi.
    setOrgUnitId(editProgram?.orgUnitId ?? '')
    setFixedTargetId(editProgram?.fixedTargetId ?? '')
    setMetric(editProgram?.metric ?? RewardRankingMetric.FINAL_SCORE)
    setTiePolicy(editProgram?.tiePolicy ?? RewardTiePolicy.SHARE_ALL)
    setMinMetricValue(editProgram?.minMetricValue ?? '')
    setMaxPointsPerRun(editProgram?.maxPointsPerRun ?? '')
    setIncludeUnitHeads(editProgram?.includeUnitHeads ?? true)
    setEnabled(editProgram?.enabled ?? true)
    setAutoTrigger(editProgram?.autoTrigger ?? false)
    setTiers(
      editProgram?.tiers?.length
        ? [...editProgram.tiers]
        : [
            { fromRank: 1, toRank: 1, points: 500 },
            { fromRank: 2, toRank: 3, points: 300 },
          ],
    )
  }, [open, editProgram])

  // Đổi phạm vi có thể làm chỉ số hiện tại thành không hợp lệ — tự chuyển sang chỉ số
  // đầu tiên của phạm vi mới thay vì để người dùng gửi đi rồi nhận lỗi.
  useEffect(() => {
    const allowed = availableMetrics.map((m) => m.value)
    const fallback = allowed[0]
    if (fallback && !allowed.includes(metric)) setMetric(fallback)
  }, [availableMetrics, metric])

  // Mặc định là đơn vị gốc — nó bao trọn cây con nên tương đương toàn tổ chức, nhưng
  // hiện tên cụ thể để người dùng biết chương trình đang xếp hạng trong phạm vi nào.
  useEffect(() => {
    const root = flatUnits[0]
    if (!orgUnitId && root) setOrgUnitId(root.id)
  }, [flatUnits, orgUnitId])

  if (!open) return null

  const tierMsg = tierError(tiers)
  const canSubmit = name.trim().length > 0 && !tierMsg

  const handleSubmit = async () => {
    if (!canSubmit) return
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      scope,
      orgUnitId: orgUnitId || null,
      fixedTargetId: fixedTargetId || null,
      metric,
      tiePolicy,
      minMetricValue: minMetricValue === '' ? null : (minMetricValue as number),
      maxPointsPerRun: maxPointsPerRun === '' ? null : (maxPointsPerRun as number),
      includeUnitHeads,
      enabled,
      autoTrigger,
      tiers: [...tiers].sort((a, b) => a.fromRank - b.fromRank),
    }
    if (isEdit && editProgram) {
      await updateProgram({ id: editProgram.id, data: payload })
    } else {
      await createProgram(payload)
    }
    onClose()
  }

  const inputCls =
    'w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm'
  const totalIfFull = maxTierCost(tiers)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">
              {isEdit ? 'Sửa chương trình thưởng' : 'Tạo chương trình thưởng tự động'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Tên chương trình</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Vinh danh Top 3 mỗi quý"
              className={inputCls}
            />
          </div>

          {/* Quyết định NGAY TỪ ĐẦU: luật thường trực hay chỉ cho một kỳ. Trước đây phải
              vào màn hình chạy mới tuỳ biến được, người dùng phải hiểu hai khái niệm rời
              nhau mới dùng nổi. */}
          <div>
            <label className="mb-2 block text-sm font-medium">Áp dụng cho</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFixedTargetId('')}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  !fixedTargetId
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="font-medium">Mọi {scopeWord}</div>
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  Luật thường trực. Mỗi lần chạy bạn chọn {scopeWord} muốn phát.
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = targetOptions[0]
                  if (first) setFixedTargetId(first.id)
                }}
                disabled={targetOptions.length === 0}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-40 ${
                  fixedTargetId
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="font-medium">Một {scopeWord} cụ thể</div>
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  Dùng cho đợt thưởng riêng, ví dụ tổng kết cuối năm.
                </div>
              </button>
            </div>

            {fixedTargetId && (
              <div className="mt-2">
                <Select value={fixedTargetId} onValueChange={setFixedTargetId}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder={`Chọn ${scopeWord}`} />
                  </SelectTrigger>
                  <SelectContent className="z-[1100]">
                    {targetOptions.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Xếp hạng theo</label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as RewardProgramScope)}
                disabled={hasIssued}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  <SelectItem value={RewardProgramScope.CYCLE}>Kỳ đánh giá</SelectItem>
                  <SelectItem value={RewardProgramScope.PERIOD}>Đợt đánh giá</SelectItem>
                </SelectContent>
              </Select>
              {hasIssued && (
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Đã phát thưởng nên không đổi được phạm vi.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Chỉ số xếp hạng</label>
              <Select value={metric} onValueChange={(v) => setMetric(v as RewardRankingMetric)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  {availableMetrics.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasMatrix && (
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Bật KPI định tính hoặc Chấm hạnh kiểm ở Thiết lập công cụ để xếp hạng theo Xếp loại (ma trận).
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Phạm vi đơn vị</label>
            <Select value={orgUnitId} onValueChange={setOrgUnitId}>
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              {/* Không có "Toàn tổ chức": đơn vị gốc đã bao trọn cây con nên hai lựa
                  chọn cho ra cùng một tập người. */}
              <SelectContent className="z-[1100]">
                {flatUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Bậc thưởng ── */}
          <div>
            <label className="mb-2 block text-sm font-medium">Bậc thưởng mặc định</label>
            <TierEditor tiers={tiers} onChange={setTiers} />

            {tierMsg ? (
              <p className="mt-2 text-xs text-rose-600">{tierMsg}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                Nếu đủ người ở mọi hạng, một lần phát tốn tối đa{' '}
                <b>{totalIfFull.toLocaleString('vi-VN')} điểm</b>. Bậc này chỉ là mặc định —
                mỗi lần chạy bạn vẫn sửa được cho riêng kỳ/đợt đó.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Điểm sàn <span className="font-normal text-[var(--color-muted-foreground)]">(tuỳ chọn)</span>
              </label>
              <input
                type="number"
                value={minMetricValue}
                onChange={(e) =>
                  setMinMetricValue(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Không yêu cầu"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Dưới mức này thì không thưởng, dù xếp hạng cao.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Trần điểm mỗi lần phát{' '}
                <span className="font-normal text-[var(--color-muted-foreground)]">(tuỳ chọn)</span>
              </label>
              <input
                type="number"
                min={1}
                value={maxPointsPerRun}
                onChange={(e) =>
                  setMaxPointsPerRun(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Không giới hạn"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Chặn cấu hình sai làm phát ra lượng điểm khổng lồ.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Khi có người đồng hạng</label>
            <Select value={tiePolicy} onValueChange={(v) => setTiePolicy(v as RewardTiePolicy)}>
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                <SelectItem value={RewardTiePolicy.SHARE_ALL}>
                  Cùng hạng cùng nhận (Top 3 có thể trả cho 4 người)
                </SelectItem>
                <SelectItem value={RewardTiePolicy.STRICT}>
                  Trả đúng số người (phá hoà theo thứ tự cố định)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeUnitHeads}
              onChange={(e) => setIncludeUnitHeads(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            Tính cả trưởng/phó đơn vị vào bảng xếp hạng
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            Đang bật
          </label>

          <div className="rounded-xl border border-[var(--color-border)] px-4 py-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoTrigger}
                onChange={(e) => setAutoTrigger(e.target.checked)}
                className="mt-0.5 rounded border-[var(--color-border)]"
              />
              <span>
                <span className="font-medium">Tự động phát khi {scopeWord} kết thúc</span>
                <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                  Hệ thống kiểm mỗi ngày; qua ngày kết thúc của {scopeWord} là phát luôn, không
                  cần ai bấm. Bạn vẫn phát tay sớm hơn được — phát rồi thì tự động sẽ bỏ qua.
                </span>
              </span>
            </label>

            {/* Tự động nghĩa là điểm vào ví mà không ai soát lại. Nói thẳng rủi ro và
                chỉ ra cái van an toàn, thay vì để người dùng phát hiện khi đã muộn. */}
            {autoTrigger && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs">
                <Info size={13} className="mt-0.5 flex-shrink-0 text-amber-600" />
                <span>
                  Điểm sẽ vào ví mà không ai soát trước. Nếu điểm đánh giá còn có thể thay đổi
                  sau ngày kết thúc, nên đặt <b>trần điểm mỗi lần phát</b> ở trên để giới hạn
                  thiệt hại khi cấu hình sai.
                </span>
              </div>
            )}
          </div>

          {!autoTrigger && (
            <div className="flex items-start gap-2 rounded-xl bg-[var(--color-muted)]/50 px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Chương trình không tự chạy. Bạn chủ động bấm <b>Xem trước</b> cho một {scopeWord},
                kiểm tra danh sách rồi mới <b>Phát thưởng</b>.
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isCreating || isUpdating}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {(isCreating || isUpdating) && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Lưu' : 'Tạo chương trình'}
          </button>
        </div>
      </div>
    </div>
  )
}
