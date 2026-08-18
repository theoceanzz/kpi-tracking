import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  ImageOff,
  Loader2,
  PackageX,
  Search,
  Store,
  X,
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useUrboxCatalog, useUrboxCategories, useUrboxImport, useUrboxStatus } from '../hooks/useUrbox'
import { htmlToText } from '../utils/html'
import type { UrboxGift } from '../types'

interface UrboxCatalogModalProps {
  open: boolean
  onClose: () => void
}

const PAGE_SIZE = 24

const fmtVnd = (value?: number | null) =>
  value == null ? '—' : `${value.toLocaleString('vi-VN')} ₫`

/**
 * Duyệt kho quà eVoucher UrBox và nhập món mình muốn vào danh mục của tổ chức.
 *
 * <p>Chọn tay từng món thay vì đồng bộ cả kho: giftset UrBox hơn một nghìn quà, đổ hết
 * vào cửa hàng sẽ chôn vùi mấy món quà nội bộ mà công ty thật sự muốn trao.
 */
export default function UrboxCatalogModal({ open, onClose }: UrboxCatalogModalProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [catId, setCatId] = useState<string>('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<UrboxGift | null>(null)
  const [pointCost, setPointCost] = useState<number | ''>('')
  const [limitStock, setLimitStock] = useState(false)
  const [stockQuantity, setStockQuantity] = useState<number | ''>('')

  const { data: status } = useUrboxStatus()
  const { data: categories } = useUrboxCategories(open)
  const { importGift, isImporting } = useUrboxImport()

  const params = useMemo(
    () => ({
      catId: catId || undefined,
      title: debouncedSearch || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [catId, debouncedSearch, page],
  )
  const { data, isLoading, isFetching, error, refetch } = useUrboxCatalog(params, open)

  // Gõ tới đâu gọi UrBox tới đó là cách chắc chắn nhất để chạm trần tần suất của họ.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(0)
    }, 450)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (open) return
    setSelected(null)
    setSearch('')
    setDebouncedSearch('')
    setCatId('')
    setPage(0)
  }, [open])

  // Giá gợi ý đi theo món đang chọn — quản trị viên sửa được, nhưng không phải tự tính
  // "voucher 100.000 đ thì bao nhiêu điểm" cho từng món.
  useEffect(() => {
    if (!selected) return
    setPointCost(selected.suggestedPointCost ?? '')
    setLimitStock(false)
    setStockQuantity('')
  }, [selected])

  if (!open) return null

  const handleImport = async () => {
    if (!selected || typeof pointCost !== 'number' || pointCost < 1) return
    await importGift({
      urboxGiftId: selected.urboxGiftId,
      pointCost,
      stockQuantity: limitStock ? (stockQuantity === '' ? 0 : (stockQuantity as number)) : null,
    })
    setSelected(null)
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Store size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">Kho quà UrBox</h2>
            {data?.totalResult && (
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {data.totalResult} món
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        {/* Nói thẳng đây là môi trường thử — nếu không, quản trị viên sẽ tưởng mình vừa
            mua voucher thật và đem mã đi dùng. */}
        {status?.sandbox && (
          <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              Đang kết nối <b>môi trường thử (sandbox)</b> của UrBox. Quà đổi ra là mã thử
              nghiệm, không dùng được ở cửa hàng thật.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-6 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên quà…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-transparent py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={catId}
            onChange={(e) => {
              setCatId(e.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Tất cả danh mục</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {isFetching && (
            <Loader2 size={16} className="animate-spin text-[var(--color-muted-foreground)]" />
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Màn hình hẹp không đủ chỗ cho hai cột: khi đã chọn quà thì nhường hẳn chỗ
              cho bảng nhập, nếu không nút "Thêm vào danh mục" sẽ nằm ngoài tầm nhìn. */}
          <div
            className={`min-w-0 flex-1 overflow-y-auto px-6 py-4 ${selected ? 'hidden lg:block' : ''}`}
          >
            {error ? (
              // Kho quà được giữ lại 10 phút nên đổi bộ lọc chưa chắc gọi lại UrBox —
              // không có nút này thì người dùng kẹt luôn cho tới khi đóng mở modal.
              <div className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                <p>
                  {(error as any)?.response?.data?.message ??
                    'Không đọc được kho quà UrBox. Kiểm tra lại cấu hình kết nối.'}
                </p>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  {isFetching && <Loader2 size={14} className="animate-spin" />}
                  Thử lại
                </button>
              </div>
            ) : isLoading ? (
              <LoadingSkeleton type="card" rows={3} />
            ) : (data?.items ?? []).length === 0 ? (
              <EmptyState
                title="Không có quà nào khớp"
                description="Thử bỏ bớt bộ lọc hoặc tìm bằng từ khoá khác."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(data?.items ?? []).map((gift) => {
                  const isSelected = selected?.urboxGiftId === gift.urboxGiftId
                  return (
                    <button
                      key={gift.urboxGiftId}
                      onClick={() => setSelected(gift)}
                      disabled={gift.imported}
                      className={`flex gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-accent)]'
                          : 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'
                      } ${gift.imported ? 'opacity-60' : ''}`}
                    >
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--color-muted)]">
                        {gift.imageUrl ? (
                          <img
                            src={gift.imageUrl}
                            alt=""
                            className={`h-full w-full object-cover ${gift.inStock ? '' : 'grayscale'}`}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[var(--color-muted-foreground)]">
                            <ImageOff size={18} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-medium">{gift.name}</div>
                        {gift.brandName && (
                          <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
                            {gift.brandName}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-semibold">{fmtVnd(gift.value)}</span>
                          {gift.suggestedPointCost != null && (
                            <span className="inline-flex items-center gap-1 text-[var(--color-primary)]">
                              <Coins size={11} />
                              {gift.suggestedPointCost.toLocaleString('vi-VN')} điểm
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {gift.imported && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              <Check size={10} />
                              Đã có trong danh mục
                            </span>
                          )}
                          {!gift.inStock && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                              <PackageX size={10} />
                              UrBox đang hết
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                  Trước
                </button>
                <span className="text-[var(--color-muted-foreground)]">
                  Trang {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 disabled:opacity-40"
                >
                  Sau
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Bảng nhập quà. Điều kiện sử dụng hiện ở đây vì người đặt giá điểm cần biết
              mình đang bán cái gì — và vì chính điều kiện này sẽ được chép sang cửa hàng
              cho nhân viên đọc trước khi đổi. */}
          {selected && (
            <aside className="flex w-full flex-shrink-0 flex-col border-l border-[var(--color-border)] lg:w-[340px]">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="font-semibold">{selected.name}</div>
                <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  {[selected.brandName, selected.categoryName].filter(Boolean).join(' · ') || '—'}
                </div>

                <dl className="mt-3 space-y-1.5 rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-muted-foreground)]">Mệnh giá</dt>
                    <dd className="font-semibold">{fmtVnd(selected.value)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-muted-foreground)]">Hạn sử dụng</dt>
                    <dd className="text-right">{selected.expireText || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-muted-foreground)]">Dạng mã</dt>
                    <dd className="text-right">{selected.codeDisplay || '—'}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium">Giá đổi (điểm)</label>
                  <input
                    type="number"
                    min={1}
                    value={pointCost}
                    onChange={(e) =>
                      setPointCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                  />
                  {selected.suggestedPointCost != null && (
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Gợi ý {selected.suggestedPointCost.toLocaleString('vi-VN')} điểm, tính theo tỉ
                      giá quy đổi của công ty.
                    </p>
                  )}
                </div>

                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={limitStock}
                    onChange={(e) => setLimitStock(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Giới hạn số lượt đổi
                    <span className="block text-xs text-[var(--color-muted-foreground)]">
                      Bỏ trống thì số lượng do kho UrBox quyết.
                    </span>
                  </span>
                </label>
                {limitStock && (
                  <input
                    type="number"
                    min={0}
                    value={stockQuantity}
                    onChange={(e) =>
                      setStockQuantity(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Số lượt tối đa"
                    className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                  />
                )}

                {/* Tồn kho UrBox báo về chỉ đúng một chiều: "hết" thì đúng là hết, còn
                    "còn hàng" thì vẫn có thể hết lúc đặt (đã gặp thật: món báo còn gần
                    100.000 mã nhưng đặt trả mã 225). Nói trước để người quản lý không
                    tưởng mình chọn nhầm khi nhân viên đổi hụt. */}
                <p className="mt-4 rounded-xl bg-[var(--color-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  Số lượng UrBox báo về chỉ mang tính tham khảo — quà đang hiện còn hàng
                  vẫn có thể hết đúng lúc nhân viên đổi. Khi đó điểm được hoàn lại ngay và
                  quà tự ẩn khỏi cửa hàng.
                </p>

                {selected.terms && (
                  <div className="mt-4">
                    <div className="mb-1 text-sm font-medium">Điều kiện sử dụng</div>
                    <p className="max-h-48 overflow-y-auto whitespace-pre-line rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                      {htmlToText(selected.terms)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      Nhân viên sẽ đọc đúng nội dung này trước khi bấm đổi.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-[var(--color-border)] px-5 py-4">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
                >
                  Bỏ chọn
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || typeof pointCost !== 'number' || pointCost < 1}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isImporting && <Loader2 size={15} className="animate-spin" />}
                  Thêm vào danh mục
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
