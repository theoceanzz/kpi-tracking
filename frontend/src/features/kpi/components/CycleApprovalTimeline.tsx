import { useState } from 'react'
import { cn, formatNumber, formatDateTime } from '@/lib/utils'
import TimelineStep from '@/components/common/TimelineStep'
import type { CycleApprovalStep } from '@/types/kpi'
import {
  Award, Star, Check, Lock, LockOpen, ChevronDown, ChevronUp, Users, MessageSquare, Hourglass,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Chuỗi duyệt đánh giá kỳ: Trưởng đơn vị chốt trước, rồi lần lượt lên các cấp trên
 * tới Giám đốc. `steps` từ server đã xếp từ DƯỚI lên (đơn vị đang xem trước),
 * đúng thứ tự duyệt thực tế nên render y nguyên từ trái sang phải.
 */
export default function CycleApprovalTimeline({
  steps, isLoading, getScoreColor, getScoreLabel, onSelectUnit,
}: {
  steps: CycleApprovalStep[]
  isLoading?: boolean
  getScoreColor: (s: number | null) => string
  getScoreLabel: (s: number | null) => string
  onSelectUnit?: (orgUnitId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-[var(--color-card)] p-5 rounded-card border border-[var(--color-border)] shadow-sm">
        <div className="h-16 rounded-card bg-[var(--color-muted)] animate-pulse" />
      </div>
    )
  }
  if (!steps.length) return null

  const doneCount = steps.filter(s => s.status === 'FINALIZED').length

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-eyebrow">
            Luồng duyệt theo cấp
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-control bg-[var(--color-muted)] text-caption border border-[var(--color-border)] whitespace-nowrap">
            {doneCount}/{steps.length} đã chốt
          </span>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
          {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          {expanded ? 'Thu gọn' : 'Chi tiết'}
        </Button>
      </div>

      {/* Stepper ngang — luôn hiện. Cuộn trong khung riêng để trang không cuộn ngang. */}
      <div className="overflow-x-auto px-5 pb-5">
        <div className="flex items-start min-w-max">
          {steps.map((step, idx) => {
            const done = step.status === 'FINALIZED'
            const { icon: Icon, dot, ring, text } = stepStyle(step, idx, steps.length)
            return (
              <div key={step.orgUnitId} className="flex items-start">
                <button
                  onClick={() => onSelectUnit?.(step.orgUnitId)}
                  title={step.blockedReason || undefined}
                  className={cn(
                    'group flex flex-col items-center gap-2 w-40 px-2 py-1 rounded-card transition-colors text-center',
                    onSelectUnit && 'hover:bg-[var(--color-muted)] cursor-pointer',
                  )}
                >
                  <span className="relative">
                    <span className={cn(
                      'w-11 h-9 rounded-card flex items-center justify-center shadow-sm transition-transform duration-300',
                      done ? dot : 'bg-[var(--color-muted)] border border-dashed border-[var(--color-border-strong)]',
                    )}>
                      {done
                        ? <Check size={18} className="text-white" />
                        : <Icon size={18} className="text-[var(--color-subtle-foreground)]" />}
                    </span>
                    {step.current && (
                      <span className={cn('absolute -inset-1 rounded-card border-2 animate-pulse', ring)} />
                    )}
                  </span>

                  <span className="space-y-0.5 min-w-0 w-full">
                    <span className="block text-xs font-medium text-[var(--color-foreground)] truncate">
                      {step.orgUnitName}
                    </span>
                    {step.managerRoleLabel && (
                      <span className="text-eyebrow block truncate">
                        {step.managerRoleLabel}
                      </span>
                    )}
                    {done ? (
                      <>
                        <span className={cn('block text-lg font-semibold tracking-tighter', getScoreColor(step.managerScore))}>
                          {step.managerScore != null ? formatNumber(step.managerScore) : '—'}
                        </span>
                        <span className="block text-caption truncate">
                          {step.finalizedByName || '—'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={cn('text-eyebrow block mt-1', text)}>
                          Chờ chốt
                        </span>
                        {step.childTotal > 0 && (
                          <span className="block text-caption">
                            {step.childFinalized}/{step.childTotal} đơn vị con
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </button>

                {idx < steps.length - 1 && (
                  <span className={cn(
                    'h-0.5 w-8 mt-[22px] rounded-full transition-colors duration-500',
                    done ? 'bg-[var(--color-success-solid)] dark:bg-[var(--color-success-solid)]' : 'bg-[var(--color-border)]',
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Panel dọc chi tiết */}
      {expanded && (
        <div className="px-5 pb-2 pt-5 border-t border-[var(--color-border)]">
          <h4 className="text-eyebrow mb-5">
            Dòng thời gian chốt kỳ
          </h4>
          {steps.map((step, idx) => {
            const done = step.status === 'FINALIZED'
            const { icon: Icon, iconBg, iconColor } = stepStyle(step, idx, steps.length)
            return (
              <TimelineStep
                key={step.orgUnitId}
                title={`${step.orgUnitName}${step.managerRoleLabel ? ` · ${step.managerRoleLabel}` : ''}`}
                icon={done ? Icon : Hourglass}
                iconBg={done ? iconBg : 'bg-[var(--color-muted)]'}
                iconColor={done ? iconColor : 'text-[var(--color-subtle-foreground)]'}
                timeLabel={step.finalizedAt ? formatDateTime(step.finalizedAt) : null}
                lineActive={done}
                isLast={idx === steps.length - 1}
                emptyLabel={step.blockedReason ? 'Chưa chốt' : 'Chờ chốt'}
              >
                {done ? (
                  <>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={cn('text-2xl sm:text-3xl font-semibold tracking-tighter', getScoreColor(step.managerScore))}>
                            {step.managerScore != null ? formatNumber(step.managerScore) : '—'}
                          </span>
                          <span className={cn('text-eyebrow whitespace-nowrap', getScoreColor(step.managerScore))}>
                            {getScoreLabel(step.managerScore)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {step.memberCount != null && (
                            <span className="text-eyebrow inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-muted)]">
                              <Users size={10} /> {step.memberCount} thành viên
                            </span>
                          )}
                          {step.matrixRating != null && (
                            <span className="text-eyebrow inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]">
                              Xếp loại ma trận: {step.matrixRating}/5
                            </span>
                          )}
                          {step.qualScore != null && (
                            <span className="text-eyebrow inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                              Định tính {step.qualScore}/5
                            </span>
                          )}
                        </div>
                      </div>

                      {step.finalizedByName && (
                        <div className="text-right shrink-0 ml-auto">
                          <p className="text-eyebrow">Chốt bởi</p>
                          <p className="text-caption">{step.finalizedByName}</p>
                          {step.finalizedByRoleName && (
                            <p className="text-caption">{step.finalizedByRoleName}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {step.comment && (
                      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                        <p className="text-sm text-[var(--color-muted-foreground)] italic leading-relaxed">"{step.comment}"</p>
                      </div>
                    )}

                    {step.events.length > 1 && <EventLog events={step.events} />}
                  </>
                ) : null}
              </TimelineStep>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Lịch sử chốt/mở khoá của một đơn vị (mới nhất xuống dưới cùng). */
function EventLog({ events }: { events: CycleApprovalStep['events'] }) {
  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-1.5">
      <p className="text-eyebrow">Lịch sử</p>
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-2 text-caption">
          {ev.action === 'FINALIZE'
            ? <Lock size={11} className="mt-0.5 shrink-0 text-[var(--color-success)]" />
            : <LockOpen size={11} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />}
          <span className="min-w-0">
            <b className="font-semibold text-[var(--color-muted-foreground)]">
              {ev.action === 'FINALIZE' ? 'Chốt' : 'Mở khoá'}
            </b>
            {ev.actorName && <> bởi {ev.actorName}</>}
            {ev.actorRoleName && <span className="opacity-60"> ({ev.actorRoleName})</span>}
            <span className="opacity-60"> · {formatDateTime(ev.createdAt)}</span>
            {ev.comment && (
              <span className="flex items-start gap-1 mt-0.5 italic opacity-80">
                <MessageSquare size={10} className="mt-0.5 shrink-0" /> {ev.comment}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Màu/icon theo vị trí trong chuỗi — bám theo bảng màu của timeline đánh giá đợt
 * để hai màn hình nhất quán: cấp cao nhất (cuối chuỗi) dùng Star/amber,
 * xuống dần là purple → blue → indigo → emerald.
 */
const PALETTE = [
  { icon: Award, dot: 'bg-[var(--color-success-solid)]', ring: 'border-[var(--color-success-border)]', text: 'text-[var(--color-success)]', iconBg: 'bg-[var(--color-success-bg)]', iconColor: 'text-[var(--color-success)]' },
  { icon: Award, dot: 'bg-[var(--color-primary)]', ring: 'border-[var(--color-primary)]', text: 'text-[var(--color-primary)]', iconBg: 'bg-[var(--color-primary-soft)]', iconColor: 'text-[var(--color-primary)]' },
  { icon: Award, dot: 'bg-[var(--color-info-solid)]', ring: 'border-[var(--color-info-border)]', text: 'text-[var(--color-info)]', iconBg: 'bg-[var(--color-info-bg)]', iconColor: 'text-[var(--color-info)]' },
  { icon: Award, dot: 'bg-[var(--color-primary)]', ring: 'border-[var(--color-primary)]', text: 'text-[var(--color-primary)]', iconBg: 'bg-[var(--color-primary-soft)]', iconColor: 'text-[var(--color-primary)]' },
  { icon: Star, dot: 'bg-[var(--color-warning-solid)]', ring: 'border-[var(--color-warning-border)]', text: 'text-[var(--color-warning)]', iconBg: 'bg-[var(--color-warning-bg)]', iconColor: 'text-[var(--color-warning)]' },
]

function stepStyle(_step: CycleApprovalStep, idx: number, total: number) {
  // Neo bước CUỐI (cấp cao nhất) vào cuối bảng màu, để chuỗi 2 cấp và 5 cấp
  // đều có màu "sếp lớn" ở cuối thay vì phụ thuộc độ dài chuỗi.
  const offset = Math.max(0, PALETTE.length - total)
  const i = Math.min(PALETTE.length - 1, Math.max(0, idx + offset))
  return PALETTE[i] ?? PALETTE[0]!
}
