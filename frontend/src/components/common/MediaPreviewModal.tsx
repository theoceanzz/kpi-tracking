import { X, Download, Maximize2, Minimize2, Share2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn, downloadFile } from '@/lib/utils'
import { toast } from 'sonner'
import FilePreview from '@/components/common/FilePreview'
import { previewKind } from '@/lib/filePreview'
import { useTranslation } from 'react-i18next'

interface MediaPreviewModalProps {
  url: string
  fileName: string
  contentType?: string
  isOpen: boolean
  onClose: () => void
}

export default function MediaPreviewModal({ url, fileName, contentType, isOpen, onClose }: MediaPreviewModalProps) {
  const { t } = useTranslation('shared')
  const [isZoomed, setIsZoomed] = useState(false)
  
  // Esc chỉ đóng khung xem, KHÔNG đóng hộp thoại / drawer đang mở bên dưới: bắt ở pha capture trên window (chạy trước
  // listener của Dialog/Drawer gắn trên document) rồi chặn lan tiếp.
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [isOpen, onClose])

  const handleShare = () => {
    navigator.clipboard.writeText(url)
    toast.success(t('MediaPreviewModal.linkCopiedToTheClipboard'))
  }

  if (!isOpen) return null

  const isImage = previewKind(fileName || url, contentType) === 'image'
  // Link công khai mới chia sẻ được: tệp trên máy (blob:) và tệp riêng tư đi qua backend thì người khác không mở được.
  const shareable = /^https?:\/\//i.test(url) && !url.includes('/api/')

  // Portal ra <body> và z-[1100]: khung xem hay được mở TỪ TRONG Dialog/Drawer (z-[1000], cũng portal ra body) — nằm
  // trong cây DOM của trang thì bị chúng đè lên dù cùng z-index.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t('MediaPreviewModal.preview', { fileName })} className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 animate-in fade-in duration-200 motion-reduce:animate-none">
      {/* Header / Toolbar */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 bg-black/60 z-20">
        <div className="flex flex-col">
          <h3 className="text-section-title text-white truncate max-w-[200px] md:max-w-md">{fileName}</h3>
          <span className="text-eyebrow text-white/60">{t('MediaPreviewModal.evidencePreview')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => downloadFile(url, fileName)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={t('MediaPreviewModal.download')} aria-label={t('MediaPreviewModal.download')}
          >
            <Download size={18} />
          </button>
          {shareable && <button 
            type="button"
            onClick={handleShare}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={t('MediaPreviewModal.shareLink')} aria-label={t('MediaPreviewModal.shareLink')}
          >
            <Share2 size={18} />
          </button>}
          {isImage && (
            <button 
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={isZoomed ? t('MediaPreviewModal.minimize') : t('MediaPreviewModal.zoomIn')}
            >
              {isZoomed ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          <button 
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-[var(--color-error-solid)] text-white transition-colors ml-2"
            title={t('MediaPreviewModal.close')} aria-label={t('MediaPreviewModal.close')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={cn(
        "w-full h-full p-4 md:p-12 flex items-center justify-center overflow-auto z-10",
        isZoomed ? "cursor-zoom-out" : "cursor-default"
      )} onClick={isZoomed ? () => setIsZoomed(false) : undefined}>
        
        {isImage ? (
          <img 
            src={url} 
            alt={fileName} 
            className={cn(
              "transition-all duration-300 shadow-2xl rounded-control",
              isZoomed ? "max-w-none scale-100" : "max-w-full max-h-full object-contain"
            )}
            onClick={(e) => {
              if (!isZoomed) {
                e.stopPropagation()
                setIsZoomed(true)
              }
            }}
          />
        ) : (
          <div className="flex h-full w-full max-w-5xl items-center justify-center" onClick={e => e.stopPropagation()}>
            <FilePreview url={url} fileName={fileName} contentType={contentType} tone="dark" />
          </div>
        )}
      </div>

      {/* Close backdrop on click if not zoomed */}
      {!isZoomed && <div className="absolute inset-0 -z-1" onClick={onClose} />}
    </div>,
    document.body,
  )
}
