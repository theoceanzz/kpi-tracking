import { useState } from 'react'
import { cn, formatNumber, formatDateTime } from '@/lib/utils'
import TimelineStep from '@/components/common/TimelineStep'
import type { CycleApprovalStep } from '@/types/kpi'
import {
  Award, Star, Check, Lock, LockOpen, ChevronDown, ChevronUp, Users, MessageSquare, Hourglass,
} from 'lucide-react'

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
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    )
  }
  if (!steps.length) return null

  const doneCount = steps.filter(s => s.status === 'FINALIZED').length

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Luồng duyệt theo cấp
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-500 border border-slate-100 dark:border-slate-700 whitespace-nowrap">
            {doneCount}/{steps.length} đã chốt
          </span>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Thu gọn' : 'Chi tiết'}
        </button>
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
                    'group flex flex-col items-center gap-2 w-40 px-2 py-1 rounded-2xl transition-colors text-center',
                    onSelectUnit && 'hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer',
                  )}
                >
                  <span className="relative">
                    <span className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110',
                      done ? dot : 'bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700',
                    )}>
                      {done
                        ? <Check size={18} className="text-white" />
                        : <Icon size={18} className="text-slate-400" />}
                    </span>
                    {step.current && (
                      <span className={cn('absolute -inset-1 rounded-2xl border-2 animate-pulse', ring)} />
                    )}
                  </span>

                  <span className="space-y-0.5 min-w-0 w-full">
                    <span className="block text-[11px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-200 truncate">
                      {step.orgUnitName}
                    </span>
                    {step.managerRoleLabel && (
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 truncate">
                        {step.managerRoleLabel}
                      </span>
                    )}
                    {done ? (
                      <>
                        <span className={cn('block text-lg font-black tracking-tighter', getScoreColor(step.managerScore))}>
                          {step.managerScore != null ? formatNumber(step.managerScore) : '—'}
                        </span>
                        <span className="block text-[9px] font-bold text-slate-400 truncate">
                          {step.finalizedByName || '—'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={cn('block text-[10px] font-black uppercase tracking-widest mt-1', text)}>
                          Chờ chốt
                        </span>
                        {step.childTotal > 0 && (
                          <span className="block text-[9px] font-bold text-slate-400">
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
                    done ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700',
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Panel dọc chi tiết */}
      {expanded && (
        <div className="px-5 pb-2 pt-5 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5">
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
                iconBg={done ? iconBg : 'bg-slate-50 dark:bg-slate-800'}
                iconColor={done ? iconColor : 'text-slate-400'}
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
                          <span className={cn('text-2xl sm:text-3xl font-black tracking-tighter', getScoreColor(step.managerScore))}>
                            {step.managerScore != null ? formatNumber(step.managerScore) : '—'}
                          </span>
                          <span className={cn('text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap', getScoreColor(step.managerScore))}>
                            {getScoreLabel(step.managerScore)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {step.memberCount != null && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 dark:bg-slate-800">
                              <Users size={10} /> {step.memberCount} thành viên
                            </span>
                          )}
                          {step.matrixRating != null && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-teal-50 text-teal-600 dark:bg-teal-900/20">
                              Xếp loại ma trận: {step.matrixRating}/5
                            </span>
                          )}
                          {step.qualScore != null && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20">
                              Định tính {step.qualScore}/5
                            </span>
                          )}
                        </div>
                      </div>

                      {step.finalizedByName && (
                        <div className="text-right shrink-0 ml-auto">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chốt bởi</p>
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{step.finalizedByName}</p>
                          {step.finalizedByRoleName && (
                            <p className="text-[10px] font-bold text-slate-400">{step.finalizedByRoleName}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {step.comment && (
                      <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic leading-relaxed">"{step.comment}"</p>
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
    <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50 space-y-1.5">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lịch sử</p>
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          {ev.action === 'FINALIZE'
            ? <Lock size={11} className="mt-0.5 shrink-0 text-emerald-500" />
            : <LockOpen size={11} className="mt-0.5 shrink-0 text-amber-500" />}
          <span className="min-w-0">
            <b className="font-bold text-slate-600 dark:text-slate-300">
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
  { icon: Award, dot: 'bg-emerald-500', ring: 'border-emerald-500/30', text: 'text-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600' },
  { icon: Award, dot: 'bg-indigo-500', ring: 'border-indigo-500/30', text: 'text-indigo-500', iconBg: 'bg-indigo-50 dark:bg-indigo-900/20', iconColor: 'text-indigo-600' },
  { icon: Award, dot: 'bg-blue-500', ring: 'border-blue-500/30', text: 'text-blue-500', iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600' },
  { icon: Award, dot: 'bg-purple-500', ring: 'border-purple-500/30', text: 'text-purple-500', iconBg: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600' },
  { icon: Star, dot: 'bg-amber-500', ring: 'border-amber-500/30', text: 'text-amber-500', iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-600' },
]

function stepStyle(_step: CycleApprovalStep, idx: number, total: number) {
  // Neo bước CUỐI (cấp cao nhất) vào cuối bảng màu, để chuỗi 2 cấp và 5 cấp
  // đều có màu "sếp lớn" ở cuối thay vì phụ thuộc độ dài chuỗi.
  const offset = Math.max(0, PALETTE.length - total)
  const i = Math.min(PALETTE.length - 1, Math.max(0, idx + offset))
  return PALETTE[i] ?? PALETTE[0]!
}
