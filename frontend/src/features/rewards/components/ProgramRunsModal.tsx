import { useState } from 'react'
import { X, History, Undo2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useProgramRunActions, useProgramRuns } from '../hooks/usePrograms'
import { RewardRunStatus, type RewardProgram, type RewardProgramRun } from '../types'

interface ProgramRunsModalProps {
  program: RewardProgram | null
  onClose: () => void
}

const STATUS_STYLE: Record<RewardRunStatus, { label: string; className: string }> = {
  [RewardRunStatus.PREVIEW]: {
    label: 'Bản xem trước',
    className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  },
  [RewardRunStatus.ISSUED]: {
    label: 'Đã phát',
    className: 'bg-emerald-500/15 text-emerald-700',
  },
  [RewardRunStatus.REVERTED]: {
    label: 'Đã thu hồi',
    className: 'bg-rose-500/15 text-rose-700',
  },
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'

export default function ProgramRunsModal({ program, onClose }: ProgramRunsModalProps) {
  const [reverting, setReverting] = useState<RewardProgramRun | null>(null)

  const { data: runs, isLoading } = useProgramRuns(program?.id)
  const { revert, isReverting } = useProgramRunActions()

  if (!program) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <History size={20} className="text-[var(--color-muted-foreground)]" />
            <h2 className="text-lg font-semibold">Lịch sử phát thưởng</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">{program.name}</p>

          {isLoading ? (
            <LoadingSkeleton type="table" rows={3} />
          ) : (runs ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              Chương trình này chưa chạy lần nào.
            </p>
          ) : (
            <div className="space-y-2">
              {(runs ?? []).map((run) => (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{run.targetName ?? '—'}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[run.status].className}`}
                      >
                        {STATUS_STYLE[run.status].label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                      {run.status === RewardRunStatus.ISSUED && (
                        <>
                          Phát {fmtDate(run.executedAt)}
                          {run.executedByName && ` bởi ${run.executedByName}`} ·{' '}
                        </>
                      )}
                      {run.status === RewardRunStatus.REVERTED && (
                        <>Thu hồi {fmtDate(run.revertedAt)} · </>
                      )}
                      {run.recipientCount} người · {run.totalPoints.toLocaleString('vi-VN')} điểm
                    </div>
                    {/* Bậc thưởng ĐÃ DÙNG của lần chạy đó, không phải bậc hiện tại của
                        chương trình — người xem lại lịch sử cần biết luật lúc ấy là gì. */}
                    {run.tiers?.length > 0 && (
                      <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                        {run.tiers
                          .map((t) =>
                            t.fromRank === t.toRank
                              ? `Hạng ${t.fromRank}: ${t.points}`
                              : `Hạng ${t.fromRank}–${t.toRank}: ${t.points}`,
                          )
                          .join(' · ')}
                      </div>
                    )}
                  </div>

                  {run.status === RewardRunStatus.ISSUED && (
                    <button
                      onClick={() => setReverting(run)}
                      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    >
                      <Undo2 size={14} />
                      Thu hồi
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Đóng
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!reverting}
        onClose={() => setReverting(null)}
        onConfirm={async () => {
          if (reverting) await revert(reverting.id)
          setReverting(null)
        }}
        title="Thu hồi cả lần phát này?"
        description={
          reverting
            ? `Sẽ trừ lại ${reverting.totalPoints.toLocaleString('vi-VN')} điểm từ ${reverting.recipientCount} nhân viên. ` +
              'Ai đã tiêu số điểm đó thì số dư sẽ xuống âm. Sau khi thu hồi, chương trình có thể phát lại cho cùng đợt/kỳ này.'
            : ''
        }
        confirmLabel={isReverting ? 'Đang thu hồi...' : 'Thu hồi'}
        loading={isReverting}
      />
    </div>
  )
}
