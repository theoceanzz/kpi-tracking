import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X, Trophy, AlertTriangle, UserX, Play } from 'lucide-react'
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">{program.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium">
                {isCycle ? 'Kỳ' : 'Đợt'} được xếp hạng
              </label>
              {isFixed ? (
                // Chương trình gắn cứng thì không cho chọn: mục tiêu đã quyết lúc tạo.
                <div className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm">
                  {program.fixedTargetName}
                  <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                    (chương trình này chỉ dành cho {isCycle ? 'kỳ' : 'đợt'} đó)
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
                  <SelectTrigger className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm">
                    <SelectValue placeholder={`Chọn ${isCycle ? 'kỳ' : 'đợt'} đánh giá`} />
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
            <button
              onClick={handlePreview}
              disabled={(!targetId && !isFixed) || isPreviewing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isPreviewing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              Xem trước
            </button>
          </div>

          {/* Nói thẳng đây là quy trình hai bước. Không nói thì người dùng bấm "Xem trước"
              xong tưởng đã xong việc. */}
          {!run && (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              <b>Bước 1:</b> xem trước để tính bảng xếp hạng · <b>Bước 2:</b> soát danh sách rồi
              bấm Phát thưởng ở dưới. Chưa có điểm nào được phát cho tới bước 2.
            </p>
          )}

          {/* CHỈ HIỂN THỊ, không sửa được. Bậc thưởng có đúng một nơi để sửa là cấu hình
              chương trình — muốn kỳ này khác kỳ kia thì tạo chương trình gắn cứng cho kỳ
              đó. Cho sửa ở cả hai chỗ là hai đường làm cùng một việc, và người dùng sẽ
              không biết cái nào mới là luật thật. */}
          <div className="rounded-xl border border-[var(--color-border)] px-4 py-3">
            <div className="text-sm font-medium">Bậc thưởng áp dụng</div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {(program.tiers ?? [])
                .map((t) =>
                  t.fromRank === t.toRank
                    ? `Hạng ${t.fromRank}: ${t.points}`
                    : `Hạng ${t.fromRank}–${t.toRank}: ${t.points}`,
                )
                .join(' · ')}
            </p>
          </div>

          {run && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[var(--color-muted)] px-4 py-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">Số người nhận</div>
                  <div className="text-xl font-bold">{run.items.length}</div>
                </div>
                <div className="rounded-xl bg-[var(--color-muted)] px-4 py-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">Tổng điểm phát</div>
                  <div className="text-xl font-bold">
                    {run.totalPoints.toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--color-muted)] px-4 py-3">
                  <div className="text-xs text-[var(--color-muted-foreground)]">Bị loại</div>
                  <div className="text-xl font-bold">{run.skipped.length}</div>
                </div>
              </div>

              {run.items.length === 0 ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                  Không có ai đủ điều kiện nhận thưởng. Kiểm tra lại bậc thưởng, điểm sàn, hoặc xem
                  danh sách bị loại bên dưới.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--color-muted)] text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                        <th className="px-3 py-2 text-left font-semibold">Hạng</th>
                        <th className="px-3 py-2 text-left font-semibold">Nhân viên</th>
                        <th className="px-3 py-2 text-right font-semibold">Điểm số</th>
                        <th className="px-3 py-2 text-right font-semibold">Thưởng</th>
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
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600">
                            +{it.points.toLocaleString('vi-VN')}
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
                <details className="rounded-xl border border-[var(--color-border)]">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                    <UserX size={14} className="mr-1.5 inline" />
                    {run.skipped.length} người không vào bảng xếp hạng
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
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
                  Đã phát thưởng xong. Điểm đã vào ví của {run.recipientCount} nhân viên.
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                  <span>
                    Phát thưởng ghi thẳng vào sổ cái của {run.items.length} nhân viên và chỉ hoàn tác
                    được bằng cách thu hồi cả lần phát. Hãy soát lại danh sách trên trước khi bấm.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Đóng
          </button>
          {/* Luôn hiện nút phát, kể cả khi chưa xem trước — có vậy người dùng mới biết
              màn hình này còn một bước nữa. Chỉ có nút "Đóng" thì nó trông như màn hình
              chỉ để xem. */}
          {run?.status !== 'ISSUED' && (
            <button
              onClick={handleIssue}
              disabled={!canIssue || isIssuing}
              title={
                !run
                  ? 'Bấm "Xem trước" để tính bảng xếp hạng trước đã'
                  : run.items.length === 0
                    ? 'Không có ai đủ điều kiện nhận thưởng'
                    : undefined
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isIssuing && <Loader2 size={15} className="animate-spin" />}
              {canIssue
                ? `Phát ${run!.totalPoints.toLocaleString('vi-VN')} điểm`
                : 'Phát thưởng'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
