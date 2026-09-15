import { useState } from 'react'
import { Plus, Pencil, Trash2, ImageOff, EyeOff, PackageCheck, Zap, Store } from 'lucide-react'
import DataTable from '@/components/common/DataTable'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { WorkspaceHeaderActions } from '@/components/common/WorkspaceTabs'
import GiftFormModal from './GiftFormModal'
import UrboxCatalogModal from './UrboxCatalogModal'
import { useGiftsManage } from '../hooks/useGifts'
import { useUrboxStatus } from '../hooks/useUrbox'
import { GiftItemStatus, type GiftItem } from '../types'
import { Button } from '@/components/ui/button'

export default function GiftsTab() {
  const [formOpen, setFormOpen] = useState(false)
  const [urboxOpen, setUrboxOpen] = useState(false)
  const [editing, setEditing] = useState<GiftItem | null>(null)
  const [deleting, setDeleting] = useState<GiftItem | null>(null)

  const { data, isLoading, deleteGift, isDeleting } = useGiftsManage()
  // Ẩn hẳn lối vào kho quà UrBox khi bản triển khai chưa kết nối — hiện một nút lúc nào
  // bấm cũng báo lỗi thì tệ hơn là không có nút.
  const { data: urbox } = useUrboxStatus()

  const StockCell = ({ row }: { row: GiftItem }) =>
    row.unlimitedStock ? (
      <span className="text-[var(--color-muted-foreground)]">Không giới hạn</span>
    ) : (
      // Hết hàng tô đỏ để người quản lý thấy ngay món nào cần nhập thêm — quà hết mà
      // vẫn nằm trong cửa hàng chỉ làm nhân viên thất vọng.
      <span className={(row.stockQuantity ?? 0) === 0 ? 'font-medium text-[var(--color-error)]' : ''}>
        {(row.stockQuantity ?? 0).toLocaleString('vi-VN')}
      </span>
    )

  return (
    <div id="tour-gifts-root">
      <div id="tour-gifts-actions" className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {(data ?? []).length > 0 && `${(data ?? []).length} món quà trong danh mục`}
        </span>
        <WorkspaceHeaderActions>
          {urbox?.enabled && (
            <Button variant="outline" onClick={() => setUrboxOpen(true)}>
              <Store aria-hidden="true" />
              Kho quà UrBox
            </Button>
          )}
          <Button onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}>
            <Plus aria-hidden="true" />
            Thêm quà
          </Button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title="Danh mục quà đang trống"
            description="Nhân viên tích được điểm nhưng chưa có gì để đổi. Thêm vài món quà để điểm thưởng có ý nghĩa."
            action={
              <Button onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}>
                <Plus aria-hidden="true" />
                Thêm quà đầu tiên
              </Button>
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
                  <img src={row.imageUrl} alt="" className="h-14 w-14 rounded-control object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-control bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
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
                <Button variant="outline" className="flex-1" onClick={() => {
                    setEditing(row)
                    setFormOpen(true)
                  }}>
                  Sửa
                </Button>
                <button
                  onClick={() => setDeleting(row)}
                  className="rounded-control border border-[var(--color-error-border)] px-3 py-2 text-[var(--color-error)]"
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
                      className="h-10 w-10 flex-shrink-0 rounded-control object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-control bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
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
                      {/* Quà UrBox tốn tiền thật mỗi lượt đổi, khác hẳn quà nội bộ —
                          người quản lý cần phân biệt được ngay trên danh sách. */}
                      {row.externalProvider && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                          <Store size={10} />
                          UrBox
                          {row.externalValue != null &&
                            ` · ${row.externalValue.toLocaleString('vi-VN')} ₫`}
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
                    <div className="mt-0.5 whitespace-nowrap text-xs text-[var(--color-warning)]">
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
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[var(--color-info-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-info)]">
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
                  <span className="inline-block rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
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
                    className="rounded-control p-1.5 hover:bg-[var(--color-accent)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={
                      row.pendingRedemptionCount
                        ? 'Đang có yêu cầu đổi chờ xử lý — không xoá được'
                        : 'Xoá'
                    } onClick={() => setDeleting(row)} disabled={!!row.pendingRedemptionCount} title={
                      row.pendingRedemptionCount
                        ? 'Đang có yêu cầu đổi chờ xử lý — không xoá được'
                        : 'Xoá'
                    }>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <GiftFormModal open={formOpen} onClose={() => setFormOpen(false)} editGift={editing} />

      <UrboxCatalogModal open={urboxOpen} onClose={() => setUrboxOpen(false)} />

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
