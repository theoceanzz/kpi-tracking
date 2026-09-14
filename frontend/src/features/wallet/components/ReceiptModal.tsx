import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { Loader2, Printer } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
  // Máy chủ đã escape mọi giá trị người dùng nhập, nhưng HTML này vẫn được nhét thẳng vào DOM
  // (và vào cửa sổ in) nên lọc thêm một lớp: chỉ giữ thẻ/thuộc tính trình bày, bỏ script, handler.
  const safeHtml = useMemo(
    () => (data ? DOMPurify.sanitize(data.html, { USE_PROFILES: { html: true } }) : ''),
    [data],
  )

  const print = () => {
    if (!data) return
    const w = window.open('', '_blank', 'width=820,height=1000')
    if (!w) return
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${data.number}</title>`
      + `<style>body{margin:24px;background:#fff;}</style></head><body>${safeHtml}</body></html>`,
    )
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Biên nhận thu tiền"
      description={data ? `Số ${data.number}` : undefined}
      headerExtra={data && (
        <Button variant="outline" size="sm" onClick={print}>
          <Printer aria-hidden="true" />
          In
        </Button>
      )}
    >
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 size={16} className="animate-spin" />
          Đang tải chứng từ…
        </div>
      )}

      {/* Biên nhận có thể không tồn tại: đơn nạp từ trước khi bật tính năng, hoặc tổ chức
          đã tắt gửi biên nhận. Nói rõ lý do thay vì để một khung trống. */}
      {error && (
        <p className="rounded-card bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
          {getApiErrorMessage(
            error,
            'Đơn nạp này chưa có biên nhận. Có thể tiền về trước khi đơn vị bật tính năng biên nhận, hoặc đơn vị đã tắt gửi chứng từ.',
          )}
        </p>
      )}

      {/* HTML do máy chủ dựng (đã escape ở TopupReceiptService) và lọc lại bằng DOMPurify ở trên. */}
      {data && <div dangerouslySetInnerHTML={{ __html: safeHtml }} />}
    </Dialog>
  )
}
