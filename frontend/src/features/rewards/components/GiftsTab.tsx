import { useState } from 'react'
import { Plus, Pencil, Trash2, ImageOff, EyeOff, PackageCheck, Zap } from 'lucide-react'
import DataTable from '@/components/common/DataTable'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import GiftFormModal from './GiftFormModal'
import { useGiftsManage } from '../hooks/useGifts'
import { GiftItemStatus, type GiftItem } from '../types'

export default function GiftsTab() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GiftItem | null>(null)
  const [deleting, setDeleting] = useState<GiftItem | null>(null)

  const { data, isLoading, deleteGift, isDeleting } = useGiftsManage()

  const StockCell = ({ row }: { row: GiftItem }) =>
    row.unlimitedStock ? (
      <span className="text-[var(--color-muted-foreground)]">Không giới hạn</span>
    ) : (
      // Hết hàng tô đỏ để người quản lý thấy ngay món nào cần nhập thêm — quà hết mà
      // vẫn nằm trong cửa hàng chỉ làm nhân viên thất vọng.
      <span className={(row.stockQuantity ?? 0) === 0 ? 'font-medium text-rose-600' : ''}>
        {(row.stockQuantity ?? 0).toLocaleString('vi-VN')}
      </span>
    )

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {(data ?? []).length > 0 && `${(data ?? []).length} món quà trong danh mục`}
        </span>
        <button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus size={16} />
          Thêm quà
        </button>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title="Danh mục quà đang trống"
            description="Nhân viên tích được điểm nhưng chưa có gì để đổi. Thêm vài món quà để điểm thưởng có ý nghĩa."
            action={
              <button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} />
                Thêm quà đầu tiên
              </button>
            }
          />
        </div>
      ) : (
        <DataTable<GiftItem>
          data={data ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage=""
          renderMobileCard={(row) => (
            <div className="space-y-3">
              <div className="flex gap-3">
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                    <ImageOff size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    {row.name}
                    {row.status === GiftItemStatus.INACTIVE && (
                      <EyeOff size={13} className="text-[var(--color-muted-foreground)]" />
                    )}
                  </div>
                  <div className="text-sm text-[var(--color-primary)]">
                    {row.pointCost.toLocaleString('vi-VN')} điểm
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    Tồn kho: {row.unlimitedStock ? 'không giới hạn' : (row.stockQuantity ?? 0)}
                    {' · '}
                    {row.requiresDelivery ? 'cần trao tay' : 'nhận ngay'}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 border-t border-[var(--color-border)] pt-2.5">
                <button
                  onClick={() => {
                    setEditing(row)
                    setFormOpen(true)
                  }}
                  className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-sm"
                >
                  Sửa
                </button>
                <button
                  onClick={() => setDeleting(row)}
                  className="rounded-lg border border-rose-500/40 px-3 py-2 text-rose-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )}
          columns={[
            {
              key: 'name',
              className: 'align-top',
              header: 'Quà',
              render: (row) => (
                <div className="flex items-center gap-3">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                      <ImageOff size={16} />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {row.name}
                      {row.status === GiftItemStatus.INACTIVE && (
                        <span
                          title="Đang ẩn khỏi cửa hàng"
                          className="text-[var(--color-muted-foreground)]"
                        >
                          <EyeOff size={13} />
                        </span>
                      )}
                    </div>
                    {row.description && (
                      <div className="line-clamp-1 text-xs text-[var(--color-muted-foreground)]">
                        {row.description}
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'pointCost',
              className: 'text-right align-top',
              header: 'Giá điểm',
              render: (row) => (
                <span className="font-semibold">{row.pointCost.toLocaleString('vi-VN')}</span>
              ),
            },
            {
              key: 'stock',
              className: 'text-right align-top',
              header: 'Tồn kho',
              render: (row) => (
                <div>
                  <StockCell row={row} />
                  {/* Nói trước lý do quà bị khoá sửa/xoá, thay vì để người dùng bấm
                      rồi mới nhận thông báo lỗi. */}
                  {!!row.pendingRedemptionCount && (
                    <div className="mt-0.5 whitespace-nowrap text-xs text-amber-700">
                      {row.pendingRedemptionCount} đang giữ chỗ
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'requiresDelivery',
              className: 'align-top',
              header: 'Cách nhận',
              render: (row) =>
                row.requiresDelivery ? (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-700">
                    <PackageCheck size={12} />
                    Cần trao tay
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                    <Zap size={12} />
                    Nhận ngay
                  </span>
                ),
            },
            {
              key: 'status',
              className: 'align-top',
              header: 'Trạng thái',
              render: (row) =>
                row.status === GiftItemStatus.ACTIVE ? (
                  <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Đang bày bán
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                    Đang ẩn
                  </span>
                ),
            },
            {
              key: 'actions',
              className: 'text-right align-top',
              header: '',
              render: (row) => (
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => {
                      setEditing(row)
                      setFormOpen(true)
                    }}
                    className="rounded-lg p-1.5 hover:bg-[var(--color-accent)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleting(row)}
                    disabled={!!row.pendingRedemptionCount}
                    title={
                      row.pendingRedemptionCount
                        ? 'Đang có yêu cầu đổi chờ xử lý — không xoá được'
                        : 'Xoá'
                    }
                    className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <GiftFormModal open={formOpen} onClose={() => setFormOpen(false)} editGift={editing} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteGift(deleting.id)
          setDeleting(null)
        }}
        title="Xoá quà tặng?"
        description={
          deleting
            ? `"${deleting.name}" sẽ bị xoá khỏi danh mục. Chỉ xoá được khi chưa có ai từng đổi món này — ` +
              'nếu đã có lượt đổi, hãy bỏ chọn "Đang bày bán" để ẩn khỏi cửa hàng thay vì xoá, ' +
              'để lịch sử của nhân viên không bị hỏng.'
            : ''
        }
        confirmLabel="Xoá"
        loading={isDeleting}
      />
    </div>
  )
}
