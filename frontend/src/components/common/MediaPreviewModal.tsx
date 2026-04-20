import { X, Download, Maximize2, Minimize2, Share2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn, downloadFile } from '@/lib/utils'
import { toast } from 'sonner'

interface MediaPreviewModalProps {
  url: string
  fileName: string
  contentType?: string
  isOpen: boolean
  onClose: () => void
}

export default function MediaPreviewModal({ url, fileName, contentType, isOpen, onClose }: MediaPreviewModalProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  
  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleShare = () => {
    navigator.clipboard.writeText(url)
    toast.success('Đã sao chép liên kết vào bộ nhớ tạm')
  }

  if (!isOpen) return null

  const isImage = contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url)
  const isPdf = contentType === 'application/pdf' || url.toLowerCase().endsWith('.pdf')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Header / Toolbar */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex flex-col">
          <h3 className="text-white font-bold text-sm truncate max-w-[200px] md:max-w-md">{fileName}</h3>
          <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Xem trước minh chứng</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => downloadFile(url, fileName)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Tải về"
          >
            <Download size={18} />
          </button>
          <button 
            type="button"
            onClick={handleShare}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Chia sẻ liên kết"
          >
            <Share2 size={18} />
          </button>
          {isImage && (
            <button 
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={isZoomed ? "Thu nhỏ" : "Phóng to"}
            >
              {isZoomed ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          <button 
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-red-500 text-white transition-colors ml-2"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={cn(
        "w-full h-full p-4 md:p-12 flex items-center justify-center overflow-auto",
        isZoomed ? "cursor-zoom-out" : "cursor-default"
      )} onClick={isZoomed ? () => setIsZoomed(false) : undefined}>
        
        {isImage ? (
          <img 
            src={url} 
            alt={fileName} 
            className={cn(
              "transition-all duration-300 shadow-2xl rounded-lg",
              isZoomed ? "max-w-none scale-100" : "max-w-full max-h-full object-contain"
            )}
            onClick={(e) => {
              if (!isZoomed) {
                e.stopPropagation()
                setIsZoomed(true)
              }
            }}
          />
        ) : isPdf ? (
          <iframe 
            src={`${url}#toolbar=0`} 
            className="w-full max-w-5xl h-full bg-white rounded-lg shadow-2xl"
            title={fileName}
          />
        ) : (
          <div className="bg-white/5 backdrop-blur-md p-12 rounded-3xl border border-white/10 flex flex-col items-center text-center max-w-sm">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
              <Download size={40} />
            </div>
            <h4 className="text-white text-lg font-bold mb-2">Định dạng không hỗ trợ xem trước</h4>
            <p className="text-white/60 text-sm mb-8">Bạn có thể tải tệp này về máy để xem nội dung chi tiết.</p>
            <button 
              type="button"
              onClick={() => downloadFile(url, fileName)}
              className="w-full py-4 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={18} /> Tải tệp về máy
            </button>
          </div>
        )}
      </div>

      {/* Close backdrop on click if not zoomed */}
      {!isZoomed && <div className="absolute inset-0 -z-1" onClick={onClose} />}
    </div>
  )
}
