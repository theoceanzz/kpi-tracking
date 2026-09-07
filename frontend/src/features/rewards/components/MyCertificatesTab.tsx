import { useState } from 'react'
import { Award, Printer } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { useAuthStore } from '@/store/authStore'
import CertificateModal from './certificate/CertificateModal'
import { useMyAwards } from '../hooks/useCertificates'
import type { RewardGrant } from '../types'

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

/**
 * "Chứng nhận của tôi" — nhân viên tự in giấy khen của chính mình.
 *
 * <p>Đọc từ `/reward-grants/my-awards` chứ không phải danh sách đề nghị của tổ chức:
 * nhân viên thường không có quyền xem đợt thưởng của người khác, và backend đã cắt sẵn
 * mỗi bản ghi chỉ còn phần của người đang xem.
 */
export default function MyCertificatesTab() {
  const [page, setPage] = useState(0)
  const [printing, setPrinting] = useState<RewardGrant | null>(null)
  const size = 12

  const { user } = useAuthStore()
  const { data, isLoading } = useMyAwards(page, size)
  const awards = data?.content ?? []

  if (isLoading) return <LoadingSkeleton type="card" rows={3} />

  if (awards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
        <EmptyState
          title="Bạn chưa có chứng nhận nào"
          description="Chứng nhận chỉ có ở những lần thưởng được cấp trên kèm giấy khen — không phải lần thưởng điểm nào cũng có. Khi được trao, giấy khen sẽ hiện ở đây để bạn tải về hoặc in ra."
        />
      </div>
    )
  }

  return (
    <div>
      <div id="tour-my-certificates-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {awards.map((award) => {
          const mine = award.recipients[0]
          return (
            <div
              key={award.id}
              className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600">
                  <Award size={18} />
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-600">
                    +{(mine?.points ?? 0).toLocaleString('vi-VN')}
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">điểm</div>
                </div>
              </div>

              <p className="mt-3 line-clamp-3 flex-1 text-sm">{award.reason}</p>

              <div className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                {award.grantorName} trao · {fmtDate(award.approvedAt ?? award.createdAt)}
              </div>

              <button
                onClick={() => setPrinting(award)}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-accent)]"
              >
                <Printer size={15} />
                Xem & in chứng nhận
              </button>
            </div>
          )
        })}
      </div>

      {(data?.totalPages ?? 0) > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={data?.totalPages ?? 0}
            totalElements={data?.totalElements ?? 0}
            size={size}
            onPageChange={setPage}
            itemLabel="chứng nhận"
          />
        </div>
      )}

      {/* Khoá đúng người đang đăng nhập: kể cả khi backend có trả về nhiều người nhận,
          màn hình này cũng không được in giấy khen mang tên đồng nghiệp. */}
      <CertificateModal
        grant={printing}
        onClose={() => setPrinting(null)}
        lockedRecipientId={user?.id}
      />
    </div>
  )
}
