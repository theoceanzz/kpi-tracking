import { useCallback, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  targetRef: React.RefObject<any>;
  className?: string;
  label?: string;
}

/**
 * Chụp một vùng màn hình vào clipboard.
 *
 * <p>Tách khỏi nút bấm để menu của widget gọi được cùng một việc — trước đây logic nằm luôn trong
 * `CopyButton` nên chỗ nào muốn "sao chép ảnh" cũng buộc phải hiện đúng cái nút đó.
 *
 * <p>Phần tử gắn `data-copy-exclude` bị loại khỏi ảnh: nút kéo và nút menu nằm đè lên góc widget,
 * không lọc thì ảnh dán ra chỗ nào cũng dính hai cái nút.
 */
export function useCopyImage() {
  const [isCopying, setIsCopying] = useState(false)

  const copy = useCallback(async (node: HTMLElement | null) => {
    if (!node) return
    setIsCopying(true)
    try {
      // Chờ một nhịp cho hiệu ứng hover/chuyển cảnh lắng xuống, không thì ảnh dính trạng thái dở
      await new Promise(r => setTimeout(r, 100))

      const blob = await toBlob(node, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
        pixelRatio: 2,
        filter: n => !(n instanceof HTMLElement) || n.dataset.copyExclude === undefined,
      })

      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        toast.success('Đã sao chép ảnh vào Clipboard!')
      }
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Không thể sao chép ảnh. Vui lòng thử lại.')
    } finally {
      setIsCopying(false)
    }
  }, [])

  return { copy, isCopying }
}

export function CopyButton({ targetRef, className, label }: CopyButtonProps) {
  const { copy, isCopying } = useCopyImage()

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering any parent click handlers
    await copy(targetRef.current)
  }

  return (
    <button
      onClick={handleCopy}
      disabled={isCopying}
      className={cn(
        "p-2 hover:bg-[var(--color-muted)] rounded-card text-[var(--color-subtle-foreground)] transition-all disabled:opacity-50 flex items-center gap-2 border border-transparent hover:border-[var(--color-border)]",
        className
      )}
      title="Sao chép ảnh vào Clipboard"
    >
      {isCopying ? <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" /> : <Copy size={16} />}
      {label && <span className="text-xs font-semibold uppercase tracking-tight">{label}</span>}
    </button>
  )
}
