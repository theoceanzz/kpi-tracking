import { intlDateLocale, intlLocale } from '@/i18n/format'
import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useProgramRunActions, useProgramRuns } from '../hooks/usePrograms'
import { RewardRunStatus, type RewardProgram, type RewardProgramRun } from '../types'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface ProgramRunsModalProps {
  program: RewardProgram | null
  onClose: () => void
}

const STATUS_STYLE = perLanguage((): Record<RewardRunStatus, { label: string; className: string }> => ({
  [RewardRunStatus.PREVIEW]: {
    label: i18n.t('rewards:ProgramRunsModal.preview'),
    className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  [RewardRunStatus.ISSUED]: {
    label: i18n.t('rewards:ProgramRunsModal.awarded'),
    className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  },
  [RewardRunStatus.REVERTED]: {
    label: i18n.t('rewards:ProgramRunsModal.revoked'),
    className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
  },
}))

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(intlDateLocale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'

export default function ProgramRunsModal({ program, onClose }: ProgramRunsModalProps) {
  const { t: tr } = useTranslation('rewards')
  const [reverting, setReverting] = useState<RewardProgramRun | null>(null)

  const { data: runs, isLoading } = useProgramRuns(program?.id)
  const { revert, isReverting } = useProgramRunActions()

  if (!program) return null

  return (
    <>
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={tr('ProgramRunsModal.awardHistory')}
      description={program.name}
      footer={<DialogFooter secondary={<Button variant="outline" onClick={onClose}>{tr('ProgramRunsModal.close')}</Button>} />}
    >
      {isLoading ? (
        <LoadingSkeleton type="table" rows={3} />
      ) : (runs ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {tr('ProgramRunsModal.thisProgramHasNeverRun')}
        </p>
      ) : (
        <div className="space-y-2">
          {(runs ?? []).map((run) => (
            <div
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--color-border)] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{run.targetName ?? '—'}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE()[run.status].className}`}
                  >
                    {STATUS_STYLE()[run.status].label}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {run.status === RewardRunStatus.ISSUED && (
                    <>
                      {tr('ProgramRunsModal.awarded2')} {fmtDate(run.executedAt)}
                      {run.executedByName && tr('ProgramRunsModal.by', { executedByName: run.executedByName })} ·{' '}
                    </>
                  )}
                  {run.status === RewardRunStatus.REVERTED && (
                    <>{tr('ProgramRunsModal.revoke')} {fmtDate(run.revertedAt)} · </>
                  )}
                  {run.recipientCount} {tr('ProgramRunsModal.people')} {run.totalPoints.toLocaleString(intlLocale())} {tr('ProgramRunsModal.points')}
                </div>
                {/* Bậc thưởng ĐÃ DÙNG của lần chạy đó, không phải bậc hiện tại của
                    chương trình — người xem lại lịch sử cần biết luật lúc ấy là gì. */}
                {run.tiers?.length > 0 && (
                  <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                    {run.tiers
                      .map((t) =>
                        t.fromRank === t.toRank
                          ? tr('ProgramRunsModal.rank', { fromRank: t.fromRank, points: t.points })
                          : tr('ProgramRunsModal.rank2', { fromRank: t.fromRank, toRank: t.toRank, points: t.points }),
                      )
                      .join(' · ')}
                  </div>
                )}
              </div>

              {run.status === RewardRunStatus.ISSUED && (
                <Button variant="outline" size="sm" onClick={() => setReverting(run)}>
                  <Undo2 aria-hidden="true" />
                  {tr('ProgramRunsModal.revoke')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Dialog>

      <ConfirmDialog
        open={!!reverting}
        onClose={() => setReverting(null)}
        onConfirm={async () => {
          if (reverting) await revert(reverting.id)
          setReverting(null)
        }}
        title={tr('ProgramRunsModal.revokeThisWholeRun')}
        description={
          reverting
            ? tr('ProgramRunsModal.pointsWillBeDeductedFromEmployees', { value: reverting.totalPoints.toLocaleString(intlLocale()), count: reverting.recipientCount }) +
              tr('ProgramRunsModal.anyoneWhoHasSpentThosePoints')
            : ''
        }
        confirmLabel={isReverting ? tr('ProgramRunsModal.revoking') : tr('ProgramRunsModal.revoke')}
        loading={isReverting}
      />
    </>
  )
}
