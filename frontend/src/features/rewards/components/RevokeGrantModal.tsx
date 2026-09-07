import { useQuery } from '@tanstack/react-query'
import { Loader2, X, Undo2, AlertTriangle } from 'lucide-react'
import { rewardApi } from '../api/rewardApi'
import { useRewardGrants } from '../hooks/useRewards'
import type { RewardGrant } from '../types'

interface RevokeGrantModalProps {
  /** null = đóng. */
  grant: RewardGrant | null
  onClose: () => void
}

/**
 * Xác nhận thu hồi, kèm hậu quả CỤ THỂ của từng người nhận.
 *
 * <p>Không dùng ConfirmDialog chung: thu hồi ghi thẳng vào sổ cái, không hoàn tác được,
 * và có thể đẩy số dư nhân viên xuống âm. Một câu cảnh báo chung chung buộc người quản
 * trị phải đoán xem ai bị ảnh hưởng — trong khi hệ thống biết chính xác.
 */
export default function RevokeGrantModal({ grant, onClose }: RevokeGrantModalProps) {
  const { revokeGrant, isRevoking } = useRewardGrants({ size: 1 })

  const { data: preview, isLoading } = useQuery({
    queryKey: ['revokePreview', grant?.id],
    queryFn: () => rewardApi.previewRevoke(grant!.id),
    enabled: !!grant,
  })

  if (!grant) return null

  const handleConfirm = async () => {
    // force = true là sự đồng ý CÓ HIỂU BIẾT: người dùng vừa nhìn thấy danh sách ai âm
    // bao nhiêu. Không phải cờ bỏ qua kiểm tra.
    await revokeGrant({ id: grant.id, data: { force: true } })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Undo2 size={20} className="text-rose-600" />
            <h2 className="text-lg font-semibold">Thu hồi điểm thưởng</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="text-sm">
            Thu hồi <b>{grant.totalPoints.toLocaleString('vi-VN')} điểm</b> đã thưởng cho{' '}
            <b>{grant.recipients.length} nhân viên</b> với lý do “{grant.reason}”.
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-muted-foreground)]">
              <Loader2 size={15} className="animate-spin" />
              Đang tính ảnh hưởng...
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-muted)] text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      <th className="px-3 py-2 text-left font-semibold">Nhân viên</th>
                      <th className="px-3 py-2 text-right font-semibold">Trừ</th>
                      <th className="px-3 py-2 text-right font-semibold">Số dư sau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {preview?.items.map((it) => (
                      <tr key={it.userId}>
                        <td className="px-3 py-2">{it.fullName}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                          −{it.points.toLocaleString('vi-VN')}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium tabular-nums ${it.goesNegative ? 'text-rose-600' : ''}`}
                        >
                          {it.balanceAfter.toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview?.anyGoesNegative ? (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-rose-600" />
                  <span>
                    Một số nhân viên <b>đã tiêu số điểm này</b> nên số dư của họ sẽ xuống âm. Điểm
                    thưởng họ nhận sau đó sẽ bù vào phần âm trước. Quà đã đổi không bị thu lại.
                  </span>
                </div>
              ) : (
                <div className="rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
                  Tất cả nhân viên còn đủ điểm — không ai bị âm số dư sau khi thu hồi.
                </div>
              )}

              <p className="text-xs text-[var(--color-muted-foreground)]">
                Thao tác này ghi một giao dịch bù trừ vào sổ cái và không hoàn tác được. Muốn trả
                lại điểm, bạn phải tạo một lần thưởng mới.
              </p>
            </>
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
            onClick={handleConfirm}
            disabled={isLoading || isRevoking}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isRevoking && <Loader2 size={15} className="animate-spin" />}
            Xác nhận thu hồi
          </button>
        </div>
      </div>
    </div>
  )
}
