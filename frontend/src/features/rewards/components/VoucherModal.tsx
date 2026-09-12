import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { htmlToText } from '../utils/html'
import type { Redemption } from '../types'

interface VoucherModalProps {
  /** null = đóng. */
  redemption: Redemption | null
  onClose: () => void
}

/**
 * Màn hình mã quà sau khi đổi.
 *
 * <p>UrBox quy định sau khi đổi phải hiển thị: nguồn quà, tên quà kèm ảnh, mã code kèm
 * ảnh mã, PIN/serial nếu có, hạn sử dụng và điều kiện sử dụng. Bỏ bớt bất kỳ mục nào là
 * vi phạm quy định hiển thị đã ký với UrBox, và thực tế là đẩy nhân viên tới quầy với
 * một mã không kích hoạt được.
 */
export default function VoucherModal({ redemption, onClose }: VoucherModalProps) {
  const [copied, setCopied] = useState<string | null>(null)

  if (!redemption) return null
  const vouchers = redemption.vouchers ?? []

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Trình duyệt chặn clipboard (thường vì không chạy trên HTTPS). Mã vẫn đang hiện
      // rõ trên màn hình nên người dùng chép tay được — không cần báo lỗi doạ người.
      toast.info('Trình duyệt không cho chép tự động, bạn hãy chọn và chép mã thủ công.')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title="Mã quà của bạn"
      footer={<DialogFooter primary={<Button onClick={onClose}>Xong</Button>} />}
    >
      <div className="space-y-5">
        <div className="flex gap-3">
          {redemption.giftImageUrl && (
            <img
              src={redemption.giftImageUrl}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded-card object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="font-semibold">{redemption.giftNameSnapshot}</div>
            <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              {/* Nguồn quà phải nói rõ: khi cần hỗ trợ, nhân viên gọi hotline UrBox
                  chứ không phải phòng nhân sự. */}
              Quà do UrBox cung cấp
              {redemption.quantity > 1 && ` · ${redemption.quantity} mã`}
            </div>
          </div>
        </div>

        {vouchers.length === 0 ? (
          <p className="rounded-card bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
            Chưa có mã nào được lưu cho lần đổi này.
          </p>
        ) : (
          vouchers.map((voucher, index) => (
            <div
              key={`${voucher.code}-${index}`}
              className="space-y-3 rounded-card border border-[var(--color-border)] p-4"
            >
              {voucher.codeImage && (
                // Dùng ảnh mã do UrBox sinh sẵn thay vì tự vẽ QR: mã hoá nội dung theo
                // đúng quy cách máy quét ở cửa hàng đang chờ.
                <img
                  src={voucher.codeImage}
                  alt={`Mã quà ${voucher.code}`}
                  className="mx-auto max-h-40 object-contain"
                />
              )}

              <div>
                <div className="mb-1 text-xs text-[var(--color-muted-foreground)]">
                  Mã sử dụng{voucher.codeDisplay ? ` (${voucher.codeDisplay})` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all rounded-control bg-[var(--color-muted)] px-3 py-2 text-center text-lg font-semibold tracking-wider">
                    {voucher.code}
                  </code>
                  <Button variant="outline" onClick={() => copy(voucher.code)} title="Chép mã">
                    {copied === voucher.code ? (
                      <Check aria-hidden="true" className="text-[var(--color-success)]" />
                    ) : (
                      <Copy aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>

              {/* PIN và serial chỉ hiện khi có giá trị — UrBox quy định có thì BẮT BUỘC
                  hiện kèm mã, vì thiếu chúng là không kích hoạt được. */}
              {(voucher.pin || voucher.serial) && (
                <div className="flex flex-wrap gap-4 text-sm">
                  {voucher.pin && (
                    <div>
                      <span className="text-[var(--color-muted-foreground)]">PIN: </span>
                      <span className="select-all font-semibold">{voucher.pin}</span>
                    </div>
                  )}
                  {voucher.serial && (
                    <div>
                      <span className="text-[var(--color-muted-foreground)]">Serial: </span>
                      <span className="select-all font-semibold">{voucher.serial}</span>
                    </div>
                  )}
                </div>
              )}

              {voucher.expired && (
                <div className="text-sm">
                  <span className="text-[var(--color-muted-foreground)]">Hạn sử dụng: </span>
                  <span className="font-medium">{voucher.expired}</span>
                </div>
              )}

              {voucher.link && (
                <a
                  href={voucher.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline"
                >
                  Mở trang quà trên UrBox
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ))
        )}

        {redemption.giftTerms && (
          <details className="rounded-card border border-[var(--color-border)]">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
              Điều kiện sử dụng
            </summary>
            <p className="max-h-56 overflow-y-auto whitespace-pre-line border-t border-[var(--color-border)] px-4 py-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              {htmlToText(redemption.giftTerms)}
            </p>
          </details>
        )}

        <p className="text-xs text-[var(--color-muted-foreground)]">
          Mã này luôn xem lại được trong mục “Quà đã đổi”. Cần hỗ trợ về quà, liên hệ hotline
          UrBox 1900 299 232.
        </p>
      </div>
    </Dialog>
  )
}
