import type { ReactNode } from 'react'
import { Check, FolderLock, Loader2, Lock, LockOpen, SlidersHorizontal } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CycleApprovalStep, CycleUnitEvaluation } from '@/types/kpi'
import type { CalibrationPlan } from '../api/kpiCycleEvaluationApi'
import { Button } from '@/components/ui/button'

/**
 * Dải điều khiển DUY NHẤT của luồng đánh giá kỳ: bốn ô bước, mỗi ô tự mang trạng thái và nút
 * hành động của chính nó.
 *
 * Bản đầu có ba hàng riêng — hàng nút, dải bước, dòng huy hiệu trạng thái — cùng nói một
 * chuyện bằng ba cách, mà nút "Khoá kết quả" đứng cách ô "④ Khoá kết quả" cả một hàng.
 * Gộp lại thì người dùng đọc từ trái sang phải là biết đã xong gì, đang ở đâu, bấm gì tiếp.
 */
export default function CycleFlowBar({
  summary, plan, chainStep, canFinalize,
  onCalibrate, isCalibrating,
  onReopen, isReopening,
  onFinalize,
  onGoUnitScore, onGoCalibration,
}: {
  summary: CycleUnitEvaluation
  plan?: CalibrationPlan
  chainStep?: CycleApprovalStep
  canFinalize: boolean
  onCalibrate: () => void
  isCalibrating: boolean
  onReopen: (cascade: boolean) => void
  isReopening: boolean
  onFinalize: () => void
  onGoUnitScore: () => void
  onGoCalibration: () => void
}) {
  const status = summary.status
  const draft = status === 'DRAFT'
  const calibrating = status === 'CALIBRATING'
  const finalized = status === 'FINALIZED'

  const when = (iso?: string | null) => (iso ? format(parseISO(iso), 'HH:mm dd/MM') : null)
  const blockedFinalize = !!chainStep && !chainStep.canFinalize
  const childLocked = chainStep?.childFinalized ?? 0
  const childTotal = chainStep?.childTotal ?? 0

  // ③: tóm tắt tình trạng khung trong một cụm từ.
  const frame = !plan || draft ? null
    : !plan.configured ? { text: 'Không áp khung', tone: 'muted' as const }
    : plan.blocked ? { text: `Vượt trần · ${plan.suggestions.filter(s => s.required).length} đề xuất`, tone: 'error' as const }
    : plan.withinFrame ? { text: 'Trong khung', tone: 'success' as const }
    : { text: `Lệch khung · ${plan.suggestions.length} đề xuất`, tone: 'warning' as const }

  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Các bước đánh giá kỳ">
      {/* ① Chốt dữ liệu kỳ */}
      <Tile
        n={1} state={draft ? 'current' : 'done'} label="Chốt dữ liệu kỳ"
        status={draft
          ? 'Đóng đợt & hạnh kiểm, chụp điểm nền'
          : [summary.calibratedByName, when(summary.calibratedAt)].filter(Boolean).join(' · ') || 'Đã chốt'}
        action={canFinalize && (
          draft ? (
            <Button
              size="sm" onClick={onCalibrate}
              disabled={isCalibrating || !summary.members?.length || blockedFinalize}
              title={blockedFinalize ? chainStep?.blockedReason || undefined : undefined}
            >
              {isCalibrating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <SlidersHorizontal aria-hidden="true" />}
              Chốt dữ liệu
            </Button>
          ) : calibrating ? (
            <Button variant="ghost" size="sm" onClick={() => onReopen(false)} disabled={isReopening} title="Quay về nháp: mở lại đánh giá đợt và hạnh kiểm">
              <LockOpen aria-hidden="true" /> Mở lại
            </Button>
          ) : null
        )}
      />

      {/* ② Chấm điểm phòng */}
      <Tile
        n={2} state={draft ? 'todo' : calibrating ? 'current' : 'done'} label="Chấm điểm phòng"
        status={draft
          ? 'Sau khi chốt dữ liệu'
          : summary.overrideScore != null
            ? `${summary.overrideScore} · chấm tay (TB ${summary.autoScore ?? '—'})`
            : `${summary.autoScore ?? '—'} · TB ${summary.memberCount} thành viên`}
        action={calibrating && canFinalize && (
          <Button variant="outline" size="sm" onClick={onGoUnitScore}>Chấm</Button>
        )}
      />

      {/* ③ Hiệu chỉnh theo khung */}
      <Tile
        n={3} state={draft ? 'todo' : calibrating ? 'current' : 'done'} label="Hiệu chỉnh theo khung"
        status={frame ? frame.text : 'Bell curve → nắn điểm cá nhân'}
        statusTone={frame?.tone}
        action={!draft && (
          <Button variant={plan?.suggestions.length && calibrating ? 'default' : 'outline'} size="sm" onClick={onGoCalibration}>
            {plan?.suggestions.length ? `Hiệu chỉnh (${plan.suggestions.length})` : 'Xem'}
          </Button>
        )}
      />

      {/* ④ Khoá kết quả */}
      <Tile
        n={4} state={finalized ? 'done' : calibrating ? 'next' : 'todo'} label="Khoá kết quả"
        status={finalized
          ? [summary.finalizedByName, when(summary.finalizedAt)].filter(Boolean).join(' · ') || 'Đã khoá'
          : childTotal > 0 ? `${childLocked}/${childTotal} phòng con đã khoá` : 'Chụp snapshot, duyệt lên trên'}
        action={canFinalize && (
          finalized ? (
            <div className="flex items-center gap-1">
              {childTotal > 0 && (
                <Button variant="ghost" size="sm" onClick={() => onReopen(true)} disabled={isReopening || !chainStep?.canReopen} title="Mở khoá đơn vị này và mọi phòng con">
                  <FolderLock aria-hidden="true" /> Cả cây
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onReopen(false)} disabled={isReopening || !chainStep?.canReopen} title={chainStep?.canReopen === false ? chainStep.blockedReason || undefined : undefined}>
                <LockOpen aria-hidden="true" /> Mở khoá
              </Button>
            </div>
          ) : calibrating ? (
            <div className="flex items-center gap-1">
              {childLocked > 0 && (
                <Button variant="ghost" size="sm" onClick={() => onReopen(true)} disabled={isReopening} title={`Mở khoá ${childLocked} phòng con đang khoá kết quả`}>
                  <FolderLock aria-hidden="true" /> Mở {childLocked} phòng con
                </Button>
              )}
              <Button
                size="sm" onClick={onFinalize}
                disabled={blockedFinalize || !!plan?.blocked}
                title={blockedFinalize ? chainStep?.blockedReason || undefined : plan?.blocked ? 'Còn mức vượt trần — hiệu chỉnh trước' : undefined}
              >
                <Lock aria-hidden="true" /> Khoá
              </Button>
            </div>
          ) : childLocked > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => onReopen(true)} disabled={isReopening} title={`Mở khoá ${childLocked} phòng con đang khoá kết quả`}>
              <FolderLock aria-hidden="true" /> Mở {childLocked} phòng con
            </Button>
          ) : null
        )}
      />
    </ol>
  )
}

type State = 'done' | 'current' | 'next' | 'todo'

function Tile({ n, state, label, status, statusTone, action }: {
  n: number
  state: State
  label: string
  status: string
  statusTone?: 'success' | 'warning' | 'error' | 'muted'
  action?: ReactNode
}) {
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      className={cn(
        'flex min-h-[64px] items-center gap-3 rounded-card border px-3 py-2',
        state === 'current' && 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]',
        state === 'done' && 'border-[var(--color-success-border)] bg-[var(--color-success-bg)]',
        state === 'next' && 'border-[var(--color-border)] bg-[var(--color-card)]',
        state === 'todo' && 'border-[var(--color-border)] bg-[var(--color-card)] opacity-60',
      )}
    >
      <span className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        state === 'current' && 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
        state === 'done' && 'bg-[var(--color-success-solid)] text-white',
        (state === 'next' || state === 'todo') && 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
      )}>
        {state === 'done' ? <Check size={13} aria-hidden="true" /> : n}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn(
          'block truncate text-sm font-semibold',
          state === 'current' ? 'text-[var(--color-primary)]' : state === 'done' ? 'text-[var(--color-success)]' : 'text-[var(--color-foreground)]',
        )}>
          {label}
        </span>
        <span className={cn(
          'block truncate text-xs',
          statusTone === 'success' ? 'font-semibold text-[var(--color-success)]'
            : statusTone === 'warning' ? 'font-semibold text-[var(--color-warning)]'
            : statusTone === 'error' ? 'font-semibold text-[var(--color-error)]'
            : 'text-[var(--color-muted-foreground)]',
        )} title={status}>
          {status}
        </span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </li>
  )
}
