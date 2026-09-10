import { useQuery } from '@tanstack/react-query'
import { Loader2, Printer, X } from 'lucide-react'
import { walletApi } from '../api/walletApi'
import { getApiErrorMessage } from '@/lib/apiError'

interface ReceiptModalProps {
  /** Đơn nạp cần xem biên nhận. */
  orderId: string
  onClose: () => void
}

/**
 * Xem biên nhận thu tiền của một đơn nạp.
 *
 * <p>Nội dung chứng từ do MÁY CHỦ dựng và về đây dưới dạng HTML — giao diện chỉ hiển thị, không
 * dựng lại từ các trường rời. Các nội dung bắt buộc theo Điều 10 Nghị định 123/2020/NĐ-CP phải
 * giống hệt nhau trên email và trên màn hình, và hai nơi cùng dựng là hai nơi có thể lệch.
 */
export default function ReceiptModal({ orderId, onClose }: ReceiptModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['topup-receipt', orderId],
    queryFn: () => walletApi.getTopupReceipt(orderId),
    // Chứng từ đã lập thì không đổi nữa — hỏi lại máy chủ mỗi lần mở là vô ích.
    staleTime: Infinity,
    retry: false,
  })

  /**
   * In ra một cửa sổ riêng chỉ chứa chứng từ.
   *
   * <p>Không dùng `window.print()` của cả trang: nó kéo theo thanh điều hướng, thanh bên và nền
   * tối của modal vào tờ giấy. Chứng từ đem đi đối chiếu thì phải là chứng từ, không phải ảnh
   * chụp màn hình ứng dụng.
   */
  const print = () => {
    if (!data) return
    const w = window.open('', '_blank', 'width=820,height=1000')
    if (!w) return
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${data.number}</title>`
      + `<style>body{margin:24px;background:#fff;}</style></head><body>${data.html}</body></html>`,
    )
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-[var(--color-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold">Biên nhận thu tiền</h3>
            {data && (
              <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                Số {data.number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button
                type="button"
                onClick={print}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition-colors hover:border-[var(--color-primary)]"
              >
                <Printer size={16} />
                In
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-muted-foreground)]">
              <Loader2 size={16} className="animate-spin" />
              Đang tải chứng từ…
            </div>
          )}

          {/* Biên nhận có thể không tồn tại: đơn nạp từ trước khi bật tính năng, hoặc tổ chức
              đã tắt gửi biên nhận. Nói rõ lý do thay vì để một khung trống. */}
          {error && (
            <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {getApiErrorMessage(
                error,
                'Đơn nạp này chưa có biên nhận. Có thể tiền về trước khi đơn vị bật tính năng biên nhận, hoặc đơn vị đã tắt gửi chứng từ.',
              )}
            </p>
          )}

          {/* HTML do máy chủ dựng, mọi giá trị người dùng nhập đã được thoát ở TopupReceiptService. */}
          {data && <div dangerouslySetInnerHTML={{ __html: data.html }} />}
        </div>
      </div>
    </div>
  )
}
