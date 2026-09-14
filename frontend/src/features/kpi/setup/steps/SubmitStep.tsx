import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Loader2, Lock, Paperclip, Send } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useBulkCreateSubmissions } from '@/features/submissions/hooks/useBulkCreateSubmissions'
import { notSubmittableReason } from '@/features/submissions/utils/submittable'
import { useMyKpi } from '../../hooks/useMyKpi'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import type { CreateSubmissionRequest } from '@/types/submission'
import type { KpiCriteria } from '@/types/kpi'

/** Ô nhập của một dòng. Giữ giá trị dạng chuỗi để ô trống khác hẳn số 0. */
interface Row {
  actualValue: string
  qualitativeLevelId: string
  note: string
}

const EMPTY_ROW: Row = { actualValue: '', qualitativeLevelId: '', note: '' }

/**
 * Bước Nộp báo cáo — điền kết quả cho TẤT CẢ chỉ tiêu rồi nộp một lượt.
 *
 * Trước đây bước này chỉ là một nút dẫn sang `/my-kpi`, từ đó bấm tiếp vào từng chỉ tiêu để mở
 * `/submissions/new`. Người tự đặt chỉ tiêu cho mình thường có 4–5 chỉ tiêu trong một đợt, nghĩa
 * là 4–5 vòng rời trang rồi quay lại — trong khi mỗi lần chỉ điền đúng một con số.
 *
 * Ở đây gom hết vào một màn: mỗi chỉ tiêu một dòng, điền xong bấm nộp một lần. Phần đính kèm tệp
 * vẫn dẫn sang trang đầy đủ, vì backend chỉ nhận tệp SAU khi bản nộp đã tồn tại
 * (`POST /submissions/{id}/attachments`) — nhét vào đây sẽ thành hai lượt gọi mỗi dòng và một
 * trạng thái nửa vời khi tệp hỏng mà bản nộp đã tạo.
 */
export default function SubmitStep() {
  const { goNext, goBack, isLast, periodId } = useKpiSetupFlow()
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)

  const qualitativeLevels = useMemo(
    () => [...(org?.qualitativeLevels ?? [])].sort((a, b) => a.position - b.position),
    [org?.qualitativeLevels],
  )

  // Không có đợt trong URL (luồng Nộp báo cáo vào thẳng bước này) thì lấy hết rồi lọc sau.
  const { data, isLoading } = useMyKpi({ page: 0, size: 100, kpiPeriodId: periodId ?? undefined })

  /**
   * Tách làm hai: nộp được ngay, và chưa nộp được KÈM LÝ DO.
   *
   * Không vứt nhóm sau đi: người vừa tạo bốn chỉ tiêu ở bước trước mà sang đây thấy trang trống sẽ
   * tưởng mình mất việc, trong khi lý do thật có thể chỉ là "đợt chưa bắt đầu".
   */
  const { pending, blocked } = useMemo(() => {
    const pending: KpiCriteria[] = []
    const blocked: { kpi: KpiCriteria; reason: string }[] = []
    for (const kpi of data?.content ?? []) {
      const reason = notSubmittableReason(kpi, user?.id)
      if (reason) blocked.push({ kpi, reason })
      else pending.push(kpi)
    }
    return { pending, blocked }
  }, [data, user?.id])

  const [rows, setRows] = useState<Record<string, Row>>({})
  const rowOf = (id: string) => rows[id] ?? EMPTY_ROW
  const patchRow = (id: string, patch: Partial<Row>) =>
    setRows(prev => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_ROW), ...patch } }))

  /** Dòng đã điền đủ để nộp. Ghi chú một mình không tính — bản nộp phải có kết quả. */
  const isFilled = (kpi: KpiCriteria) => {
    const row = rowOf(kpi.id)
    return kpi.kpiType === 'QUALITATIVE' ? !!row.qualitativeLevelId : row.actualValue.trim() !== ''
  }
  const filled = pending.filter(isFilled)

  const bulkSubmit = useBulkCreateSubmissions()

  const submitAll = () => {
    const payloads: CreateSubmissionRequest[] = filled.map(kpi => {
      const row = rowOf(kpi.id)
      return {
        kpiCriteriaId: kpi.id,
        ...(kpi.kpiType === 'QUALITATIVE'
          ? { qualitativeLevelId: row.qualitativeLevelId }
          : { actualValue: Number(row.actualValue) }),
        ...(row.note.trim() ? { note: row.note.trim() } : {}),
        isDraft: false,
      }
    })

    bulkSubmit.mutate(payloads, {
      onSuccess: result => {
        // Giữ lại đúng những dòng trượt để người dùng sửa; dòng đã nộp thì tự rụng khỏi danh sách
        // sau khi truy vấn được làm mới (`submissionCount` tăng lên).
        const failedIds = new Set(result.failed.map(f => f.kpiCriteriaId))
        setRows(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => failedIds.has(id))))
        if (result.failed.length === 0 && result.ok > 0) goNext()
      },
    })
  }

  return (
    <StepShell
      title="Nộp báo cáo"
      description="Điền kết quả cho từng chỉ tiêu rồi nộp một lượt — không phải mở lần lượt từng cái."
      onBack={goBack}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goNext()}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            {isLast ? 'Xong, về màn chọn luồng' : 'Bỏ qua, đi tiếp'}
            <ArrowRight size={14} />
          </button>
          {pending.length > 0 && (
            <button
              type="button"
              disabled={filled.length === 0 || bulkSubmit.isPending}
              onClick={submitAll}
              title={filled.length === 0 ? 'Điền kết quả cho ít nhất một chỉ tiêu' : undefined}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {bulkSubmit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Nộp {filled.length} báo cáo
            </button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={24} />
        </div>
      ) : pending.length === 0 && blocked.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20">
            <CheckCircle2 size={30} />
          </div>
          <p className="max-w-md text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Không có chỉ tiêu nào được giao cho bạn trong đợt này.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(kpi => {
            const row = rowOf(kpi.id)
            const done = isFilled(kpi)
            return (
              <div
                key={kpi.id}
                className={cn(
                  'rounded-2xl border p-4 transition-colors',
                  done
                    ? 'border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-900/10'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                )}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-white">{kpi.name}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                      {kpi.targetValue != null
                        ? `Mục tiêu ${formatNumber(kpi.targetValue)}${kpi.unit ? ` ${kpi.unit}` : ''}`
                        : 'Chưa đặt mục tiêu'}
                      {' · '}
                      {formatNumber(kpi.weight ?? 0)}%
                      {kpi.expectedSubmissions > 1 && (
                        <> · lượt {kpi.submissionCount + 1}/{kpi.expectedSubmissions}</>
                      )}
                      {/* Không lọc theo đợt (luồng Nộp báo cáo vào thẳng đây) thì phải nói rõ mỗi
                          dòng thuộc đợt nào, không thì các đợt lẫn vào nhau. */}
                      {!periodId && kpi.kpiPeriod?.name && <> · {kpi.kpiPeriod.name}</>}
                    </p>
                  </div>
                  {/* Đính kèm tệp phải qua trang đầy đủ — xem ghi chú đầu file. */}
                  <Link
                    to={`/submissions/new?kpiId=${kpi.id}`}
                    title="Mở trang đầy đủ để đính kèm tệp minh chứng"
                    className="shrink-0 rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                  >
                    <Paperclip size={14} />
                  </Link>
                </div>

                {kpi.kpiType === 'QUALITATIVE' ? (
                  qualitativeLevels.length === 0 ? (
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      Tổ chức chưa cấu hình thang định tính nên chưa nộp được chỉ tiêu này.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {qualitativeLevels.map(level => {
                        const active = row.qualitativeLevelId === level.id
                        return (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => patchRow(kpi.id, { qualitativeLevelId: level.id })}
                            className={cn(
                              'rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all',
                              active
                                ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400'
                                : 'border-slate-200 text-slate-600 hover:border-teal-300 dark:border-slate-700 dark:text-slate-300',
                            )}
                          >
                            {level.name}
                            <span className="ml-1.5 font-black text-slate-400">{formatNumber(level.value)}đ</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={row.actualValue}
                      onChange={e => patchRow(kpi.id, { actualValue: e.target.value })}
                      placeholder="Kết quả đạt được"
                      className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    {kpi.unit && <span className="text-xs font-bold text-slate-400">{kpi.unit}</span>}
                  </div>
                )}

                <input
                  type="text"
                  value={row.note}
                  onChange={e => patchRow(kpi.id, { note: e.target.value })}
                  placeholder="Ghi chú (không bắt buộc)"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            )
          })}

          {blocked.length > 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Chưa nộp được ({blocked.length})
              </p>
              <ul className="space-y-2">
                {blocked.map(({ kpi, reason }) => (
                  <li key={kpi.id} className="flex items-center gap-3">
                    <Lock size={12} className="shrink-0 text-slate-300" />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                      {kpi.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-500 dark:bg-slate-800">
                      {reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </StepShell>
  )
}
