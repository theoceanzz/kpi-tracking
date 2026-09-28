import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
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
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Radix không nhận value rỗng nên "tất cả" dùng giá trị canh gác rồi đổi về '' khi lọc. */
const ALL_CATEGORIES = '__all__'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useUrboxCatalog, useUrboxCategories, useUrboxImport, useUrboxStatus } from '../hooks/useUrbox'
import { htmlToText } from '../utils/html'
import type { UrboxGift } from '../types'
import { getApiErrorMessage } from '@/lib/apiError'
import { useTranslation } from 'react-i18next'

interface UrboxCatalogModalProps {
  open: boolean
  onClose: () => void
}

const PAGE_SIZE = 24

const fmtVnd = (value?: number | null) =>
  value == null ? '—' : `${value.toLocaleString(intlLocale())} ₫`

/**
 * Duyệt kho quà eVoucher UrBox và nhập món mình muốn vào danh mục của tổ chức.
 *
 * <p>Chọn tay từng món thay vì đồng bộ cả kho: giftset UrBox hơn một nghìn quà, đổ hết
 * vào cửa hàng sẽ chôn vùi mấy món quà nội bộ mà công ty thật sự muốn trao.
 */
export default function UrboxCatalogModal({ open, onClose }: UrboxCatalogModalProps) {
  const { t } = useTranslation('rewards')
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
    <Dialog
      open
      onClose={onClose}
      size="full"
      flush
      className="h-[calc(100dvh-2rem)]"
      title={t('UrboxCatalogModal.urboxGiftCatalog')}
      headerExtra={data?.totalResult ? <span className="text-sm text-[var(--color-muted-foreground)] tabular-nums">{data.totalResult} {t('UrboxCatalogModal.items')}</span> : undefined}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Nói thẳng đây là môi trường thử — nếu không, quản trị viên sẽ tưởng mình vừa
            mua voucher thật và đem mã đi dùng. */}
        {status?.sandbox && (
          <div className="flex items-start gap-2 border-b border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-6 py-2.5 text-sm text-[var(--color-warning)]">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              {t('UrboxCatalogModal.connectedTo')} <b>{t('UrboxCatalogModal.theTestSandboxEnvironment')}</b> {t('UrboxCatalogModal.ofUrboxRedeemedGiftsAreTest')}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('UrboxCatalogModal.searchByGiftName')}
              aria-label={t('UrboxCatalogModal.searchGifts')}
              className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            />
          </div>
          <Select
            value={catId || ALL_CATEGORIES}
            onValueChange={(v) => {
              setCatId(v === ALL_CATEGORIES ? '' : v)
              setPage(0)
            }}
          >
            <SelectTrigger className="w-auto min-w-[200px]" aria-label={t('UrboxCatalogModal.category')}><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1100]">
              <SelectItem value={ALL_CATEGORIES}>{t('UrboxCatalogModal.allCategories')}</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFetching && (
            <Loader2 size={16} className="animate-spin text-[var(--color-muted-foreground)]" aria-hidden="true" />
          )}
          {data?.totalResult != null && <span className="ml-auto text-caption tabular-nums">{data.totalResult} {t('UrboxCatalogModal.items')}</span>}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Màn hình hẹp không đủ chỗ cho hai cột: khi đã chọn quà thì nhường hẳn chỗ
              cho bảng nhập, nếu không nút "Thêm vào danh mục" sẽ nằm ngoài tầm nhìn. */}
          <div
            className={`min-w-0 flex-1 overflow-y-auto px-5 py-4 ${selected ? 'hidden lg:block' : ''}`}
          >
            {error ? (
              // Kho quà được giữ lại 10 phút nên đổi bộ lọc chưa chắc gọi lại UrBox —
              // không có nút này thì người dùng kẹt luôn cho tới khi đóng mở modal.
              <div className="space-y-3 rounded-card border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]">
                <p>
                  {getApiErrorMessage(error, t('UrboxCatalogModal.couldNotReadTheUrboxGift'))}
                </p>
                <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  {isFetching && <Loader2 aria-hidden="true" className="animate-spin" />}
                  {t('UrboxCatalogModal.tryAgain')}
                </Button>
              </div>
            ) : isLoading ? (
              <LoadingSkeleton type="card" rows={3} />
            ) : (data?.items ?? []).length === 0 ? (
              <div className="rounded-card border border-dashed border-[var(--color-border)]">
                <EmptyState
                  title={t('UrboxCatalogModal.noMatchingGifts')}
                  description={t('UrboxCatalogModal.tryRemovingSomeFiltersOrSearch')}
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(data?.items ?? []).map((gift) => {
                  const isSelected = selected?.urboxGiftId === gift.urboxGiftId
                  return (
                    <button
                      key={gift.urboxGiftId}
                      onClick={() => setSelected(gift)}
                      disabled={gift.imported}
                      type="button"
                      aria-pressed={isSelected}
                      className={`flex gap-3 rounded-card border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)]'
                      } ${gift.imported ? 'opacity-60' : ''}`}
                    >
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-control bg-[var(--color-muted)]">
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
                        <div className="line-clamp-2 text-sm font-medium text-[var(--color-foreground)]">{gift.name}</div>
                        {gift.brandName && (
                          <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
                            {gift.brandName}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-medium tabular-nums text-[var(--color-foreground)]">{fmtVnd(gift.value)}</span>
                          {gift.suggestedPointCost != null && (
                            <span className="inline-flex items-center gap-1 text-[var(--color-primary)]">
                              <Coins size={11} />
                              {gift.suggestedPointCost.toLocaleString(intlLocale())} {t('UrboxCatalogModal.points')}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {gift.imported && (
                            <Badge variant="success"><Check size={10} aria-hidden="true" /> {t('UrboxCatalogModal.alreadyInTheCatalog')}</Badge>
                          )}
                          {!gift.inStock && (
                            <Badge variant="secondary"><PackageX size={10} aria-hidden="true" /> {t('UrboxCatalogModal.outOfStockAtUrbox')}</Badge>
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
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft aria-hidden="true" />
                  {t('UrboxCatalogModal.previous')}
                </Button>
                <span className="text-[var(--color-muted-foreground)]">
                  {t('UrboxCatalogModal.pageOf', { page: page + 1, total: totalPages })}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  {t('UrboxCatalogModal.next')}
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>

          {/* Bảng nhập quà. Điều kiện sử dụng hiện ở đây vì người đặt giá điểm cần biết
              mình đang bán cái gì — và vì chính điều kiện này sẽ được chép sang cửa hàng
              cho nhân viên đọc trước khi đổi. */}
          {selected && (
            <aside className="flex w-full flex-shrink-0 flex-col border-l border-[var(--color-border)] lg:w-[340px]">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="text-eyebrow">{t('UrboxCatalogModal.addToCatalog')}</p>
                <div className="mt-1 text-sm font-medium text-[var(--color-foreground)]">{selected.name}</div>
                <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                  {[selected.brandName, selected.categoryName].filter(Boolean).join(' · ') || '—'}
                </div>

                <dl className="mt-3 space-y-1.5 rounded-card bg-[var(--color-muted)] px-4 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-muted-foreground)]">{t('UrboxCatalogModal.faceValue')}</dt>
                    <dd className="font-medium tabular-nums text-[var(--color-foreground)]">{fmtVnd(selected.value)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-muted-foreground)]">{t('UrboxCatalogModal.expiry')}</dt>
                    <dd className="text-right">{selected.expireText || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--color-muted-foreground)]">{t('UrboxCatalogModal.codeType')}</dt>
                    <dd className="text-right">{selected.codeDisplay || '—'}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <label className="text-label mb-1.5 block">{t('UrboxCatalogModal.redemptionPricePoints')}</label>
                  <LocaleNumberInput
                    type="number"
                    min={1}
                    value={pointCost}
                    onChange={(e) =>
                      setPointCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] tabular-nums"
                  />
                  {selected.suggestedPointCost != null && (
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      {t('UrboxCatalogModal.suggest')} {selected.suggestedPointCost.toLocaleString(intlLocale())} {t('UrboxCatalogModal.pointsBasedOnTheCompanysExchange')}
                    </p>
                  )}
                </div>

                <label className="text-label mt-4 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={limitStock}
                    onChange={(e) => setLimitStock(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    {t('UrboxCatalogModal.limitTheNumberOfRedemptions')}
                    <span className="block text-xs text-[var(--color-muted-foreground)]">
                      {t('UrboxCatalogModal.leaveEmptyAndTheQuantityIs')}
                    </span>
                  </span>
                </label>
                {limitStock && (
                  <LocaleNumberInput
                    type="number"
                    min={0}
                    value={stockQuantity}
                    onChange={(e) =>
                      setStockQuantity(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder={t('UrboxCatalogModal.maxRedemptions')}
                    className="mt-2 h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] tabular-nums"
                  />
                )}

                {/* Tồn kho UrBox báo về chỉ đúng một chiều: "hết" thì đúng là hết, còn
                    "còn hàng" thì vẫn có thể hết lúc đặt (đã gặp thật: món báo còn gần
                    100.000 mã nhưng đặt trả mã 225). Nói trước để người quản lý không
                    tưởng mình chọn nhầm khi nhân viên đổi hụt. */}
                <p className="mt-4 rounded-card bg-[var(--color-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  {t('UrboxCatalogModal.theQuantityReportedByUrboxIs')}
                </p>

                {selected.terms && (
                  <div className="mt-4">
                    <div className="mb-1 text-label">{t('UrboxCatalogModal.termsOfUse')}</div>
                    <p className="max-h-48 overflow-y-auto whitespace-pre-line rounded-card border border-[var(--color-border)] px-3 py-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                      {htmlToText(selected.terms)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      {t('UrboxCatalogModal.employeesWillReadExactlyThisContent')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-[var(--color-border)] px-5 py-4">
                <Button variant="outline" onClick={() => setSelected(null)}>{t('UrboxCatalogModal.deselect')}</Button>
                <Button className="flex-1" onClick={handleImport} disabled={isImporting || typeof pointCost !== 'number' || pointCost < 1}>
                  {isImporting && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {t('UrboxCatalogModal.addToCatalog')}
                </Button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </Dialog>
  )
}
