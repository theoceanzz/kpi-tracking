import { intlLocale } from '@/i18n/format'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertTriangle, UserX, Play } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { useProgramRunActions } from '../hooks/usePrograms'
import { RewardProgramScope, type RewardProgram, type RewardProgramRun } from '../types'
import { useTranslation } from 'react-i18next'

interface RunPreviewModalProps {
  /** null = đóng. */
  program: RewardProgram | null
  onClose: () => void
}

/**
 * Chạy chương trình: chọn đợt/kỳ → xem trước → phát.
 *
 * <p>Bắt buộc phải nhìn bảng xếp hạng trước khi phát. Phát thưởng hàng loạt ghi thẳng
 * vào sổ cái của rất nhiều người cùng lúc; sai thì phải thu hồi thủ công và số dư của
 * họ có thể xuống âm.
 */
export default function RunPreviewModal({ program, onClose }: RunPreviewModalProps) {
  const { t: tr } = useTranslation('rewards')
  const [targetId, setTargetId] = useState('')
  const [run, setRun] = useState<RewardProgramRun | null>(null)

  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { preview, isPreviewing, issue, isIssuing } = useProgramRunActions()

  const isCycle = program?.scope === RewardProgramScope.CYCLE
  const isFixed = !!program?.fixedTargetId

  const { data: cycles } = useQuery({
    queryKey: ['kpiCycles', 'runPicker', orgId],
    queryFn: () => kpiCycleApi.getAll({ page: 0, size: 100, organizationId: orgId }),
    enabled: !!program && isCycle && !!orgId,
  })

  const { data: periods } = useQuery({
    queryKey: ['kpiPeriods', 'runPicker', orgId],
    queryFn: () =>
      kpiPeriodApi.getAll({
        page: 0,
        size: 100,
        sortBy: 'startDate',
        direction: 'desc',
        organizationId: orgId,
      }),
    enabled: !!program && !isCycle && !!orgId,
  })

  useEffect(() => {
    if (!program) return
    setTargetId('')
    setRun(null)
  }, [program])

  if (!program) return null

  const options = (isCycle ? cycles?.content : periods?.content) ?? []
  const canIssue = !!run && run.status === 'PREVIEW' && run.items.length > 0

  const handlePreview = async () => {
    // Chương trình gắn cứng: backend tự lấy mục tiêu từ cấu hình, gửi gì cũng bỏ qua.
    const target = isFixed ? (program.fixedTargetId as string) : targetId
    if (!target) return
    // Không truyền tiers: bậc lấy từ cấu hình chương trình, một nguồn duy nhất.
    setRun(await preview({ programId: program.id, targetId: target }))
  }

  const handleIssue = async () => {
    if (!run) return
    const issued = await issue(run.id)
    setRun(issued)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      dismissible={!isIssuing}
      title={program.name}
      description={tr('RunPreviewModal.previewTheRankingAndThenAward')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isIssuing}>{tr('RunPreviewModal.close')}</Button>}
          primary={
            /* Luôn hiện nút phát, kể cả khi chưa xem trước — có vậy người dùng mới biết
               màn hình này còn một bước nữa. Chỉ có nút "Đóng" thì nó trông như màn hình
               chỉ để xem. */
            run?.status !== 'ISSUED' && (
              <Button
                onClick={handleIssue}
                disabled={!canIssue || isIssuing}
                title={
                  !run
                    ? tr('RunPreviewModal.clickPreviewToComputeTheRanking')
                    : run.items.length === 0
                      ? tr('RunPreviewModal.noOneIsEligibleForA')
                      : undefined
                }
              >
                {isIssuing && <Loader2 className="animate-spin" aria-hidden="true" />}
                {canIssue
                  ? tr('RunPreviewModal.awardPoints', { value: run!.totalPoints.toLocaleString(intlLocale()) })
                  : tr('RunPreviewModal.award')}
              </Button>
            )
          }
        />
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-label mb-1.5 block font-medium">
              {isCycle ? tr('RunPreviewModal.aCycle') : tr('RunPreviewModal.aPeriod')} {tr('RunPreviewModal.ranked')}
            </label>
            {isFixed ? (
              // Chương trình gắn cứng thì không cho chọn: mục tiêu đã quyết lúc tạo.
              <div className="rounded-control bg-[var(--color-muted)] px-3 py-2 text-sm">
                {program.fixedTargetName}
                <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                  {tr('RunPreviewModal.thisProgramIsOnlyForThat')} {isCycle ? tr('RunPreviewModal.cycle') : tr('RunPreviewModal.periods')} {tr('RunPreviewModal.text')}
                </span>
              </div>
            ) : (
              <Select
                value={targetId}
                onValueChange={(v) => {
                  setTargetId(v)
                  setRun(null) // đổi mục tiêu thì bảng cũ không còn đúng
                }}
              >
                <SelectTrigger className="w-full rounded-control border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm">
                  <SelectValue placeholder={tr('RunPreviewModal.chooseEvaluation', { value: isCycle ? tr('RunPreviewModal.cycle2') : tr('RunPreviewModal.period') })} />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  {options.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button variant="outline" onClick={handlePreview} disabled={(!targetId && !isFixed) || isPreviewing}>
            {isPreviewing ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
            {tr('RunPreviewModal.preview')}
          </Button>
        </div>

        {/* Nói thẳng đây là quy trình hai bước. Không nói thì người dùng bấm "Xem trước"
            xong tưởng đã xong việc. */}
        {!run && (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            <b>{tr('RunPreviewModal.step1')}</b> {tr('RunPreviewModal.previewToComputeTheRanking')} <b>{tr('RunPreviewModal.step2')}</b> {tr('RunPreviewModal.checkTheListAndThenClick')}
          </p>
        )}

        {/* CHỈ HIỂN THỊ, không sửa được. Bậc thưởng có đúng một nơi để sửa là cấu hình
            chương trình — muốn kỳ này khác kỳ kia thì tạo chương trình gắn cứng cho kỳ
            đó. Cho sửa ở cả hai chỗ là hai đường làm cùng một việc, và người dùng sẽ
            không biết cái nào mới là luật thật. */}
        <div className="rounded-card border border-[var(--color-border)] px-4 py-3">
          <div className="text-sm font-medium">{tr('RunPreviewModal.appliedRewardTiers')}</div>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {(program.tiers ?? [])
              .map((t) =>
                t.fromRank === t.toRank
                  ? tr('RunPreviewModal.rank', { fromRank: t.fromRank, points: t.points })
                  : tr('RunPreviewModal.rank2', { fromRank: t.fromRank, toRank: t.toRank, points: t.points }),
              )
              .join(' · ')}
          </p>
        </div>

        {run && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-card bg-[var(--color-muted)] px-4 py-3">
                <div className="text-xs text-[var(--color-muted-foreground)]">{tr('RunPreviewModal.recipients')}</div>
                <div className="text-xl font-semibold">{run.items.length}</div>
              </div>
              <div className="rounded-card bg-[var(--color-muted)] px-4 py-3">
                <div className="text-xs text-[var(--color-muted-foreground)]">{tr('RunPreviewModal.totalPointsAwarded')}</div>
                <div className="text-xl font-semibold">
                  {run.totalPoints.toLocaleString(intlLocale())}
                </div>
              </div>
              <div className="rounded-card bg-[var(--color-muted)] px-4 py-3">
                <div className="text-xs text-[var(--color-muted-foreground)]">{tr('RunPreviewModal.excluded')}</div>
                <div className="text-xl font-semibold">{run.skipped.length}</div>
              </div>
            </div>

            {run.items.length === 0 ? (
              <div className="rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
                {tr('RunPreviewModal.noOneIsEligibleForA2')}
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
                      <th className="px-3 py-2 text-left font-medium">{tr('RunPreviewModal.rank3')}</th>
                      <th className="px-3 py-2 text-left font-medium">{tr('RunPreviewModal.employee')}</th>
                      <th className="px-3 py-2 text-right font-medium">{tr('RunPreviewModal.score')}</th>
                      <th className="px-3 py-2 text-right font-medium">{tr('RunPreviewModal.reward')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {run.items.map((it) => (
                      <tr key={it.userId}>
                        <td className="px-3 py-2 font-semibold tabular-nums">{it.rank}</td>
                        <td className="px-3 py-2">
                          {it.fullName}
                          {it.orgUnitName && (
                            <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                              {it.orgUnitName}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--color-muted-foreground)]">
                          {it.metricValue ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--color-success)]">
                          +{it.points.toLocaleString(intlLocale())}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Người bị loại phải hiện ra kèm LÝ DO — nếu không, quản trị viên chỉ
                thấy ai đó vắng mặt và tưởng hệ thống bỏ sót. */}
            {run.skipped.length > 0 && (
              <details className="rounded-card border border-[var(--color-border)]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                  <UserX size={14} className="mr-1.5 inline" />
                  {run.skipped.length} {tr('RunPreviewModal.peopleNotInTheRanking')}
                </summary>
                <div className="max-h-40 overflow-y-auto border-t border-[var(--color-border)] px-4 py-2">
                  {run.skipped.map((s) => (
                    <div key={s.userId} className="flex justify-between gap-3 py-1 text-sm">
                      <span>{s.fullName}</span>
                      <span className="text-right text-xs text-[var(--color-muted-foreground)]">
                        {s.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {run.status === 'ISSUED' ? (
              <div className="rounded-card border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm">
                {tr('RunPreviewModal.awardingDoneThePointsAreNow')} {run.recipientCount} {tr('RunPreviewModal.employees')}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
                <span>
                  {tr('RunPreviewModal.awardingWritesDirectlyIntoTheLedger')} {run.items.length} {tr('RunPreviewModal.employeesAndCanOnlyBeUndone')}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  )
}
