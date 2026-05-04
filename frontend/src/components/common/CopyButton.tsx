import { useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  targetRef: React.RefObject<any>;
  className?: string;
  label?: string;
}

export function CopyButton({ targetRef, className, label }: CopyButtonProps) {
  const [isCopying, setIsCopying] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering any parent click handlers
    if (!targetRef.current) return
    
    setIsCopying(true)
    try {
      // Small delay to ensure any hover effects or transitions settle
      await new Promise(r => setTimeout(r, 100))
      
      const blob = await toBlob(targetRef.current, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
        pixelRatio: 2, // High quality for better looking pastes
      })
      
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        toast.success('Đã sao chép ảnh vào Clipboard!')
      }
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Không thể sao chép ảnh. Vui lòng thử lại.')
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={isCopying}
      className={cn(
        "p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 border border-transparent hover:border-slate-200 dark:hover:border-slate-700",
        className
      )}
      title="Sao chép ảnh vào Clipboard"
    >
      {isCopying ? <Loader2 size={16} className="animate-spin text-indigo-600" /> : <Copy size={16} />}
      {label && <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>}
    </button>
  )
}
