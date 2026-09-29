import { X, Download, Maximize2, Minimize2, Share2, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn, downloadFile } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
    toast.success(t('MediaPreviewModal.linkCopiedToTheClipboard'))
  }

  if (!isOpen) return null

  const isImage = contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName || url)
  const isPdf = contentType === 'application/pdf' || (fileName || '').toLowerCase().endsWith('.pdf') || url.toLowerCase().endsWith('.pdf')
  const isVideo = contentType?.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(fileName || url)
  const isAudio = contentType?.startsWith('audio/') || /\.(mp3|wav|m4a|aac)$/i.test(fileName || url)
  const isOfficeDoc = /\.(docx?|xlsx?|pptx?)$/i.test(fileName || url)
  const isLocalFile = url.startsWith('blob:')

  return (
    <div role="dialog" aria-modal="true" aria-label={t('MediaPreviewModal.preview', { fileName })} className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 animate-in fade-in duration-200 motion-reduce:animate-none">
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
          <button 
            type="button"
            onClick={handleShare}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={t('MediaPreviewModal.shareLink')} aria-label={t('MediaPreviewModal.shareLink')}
          >
            <Share2 size={18} />
          </button>
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
        ) : isPdf ? (
          <iframe
            src={`${url}#toolbar=0`}
            className="w-full max-w-5xl h-full bg-white rounded-control shadow-2xl"
            title={fileName}
          />
        ) : isVideo ? (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-control shadow-2xl"
          >
            {t('MediaPreviewModal.yourBrowserDoesNotSupportVideo')}
          </video>
        ) : isAudio ? (
          <div className="bg-white/5 p-12 rounded-widget border border-white/10 flex flex-col items-center text-center max-w-md w-full">
            <div className="w-20 h-20 rounded-card bg-white/10 flex items-center justify-center text-white/80 mb-6">
              <FileText size={40} />
            </div>
            <h4 className="text-white text-lg font-semibold mb-6 truncate max-w-full">{fileName}</h4>
            <audio src={url} controls autoPlay className="w-full">
              {t('MediaPreviewModal.yourBrowserDoesNotSupportAudio')}
            </audio>
          </div>
        ) : isOfficeDoc ? (
          isLocalFile ? (
            <div className="bg-white/5 p-12 rounded-widget border border-white/10 flex flex-col items-center text-center max-w-sm">
              <div className="w-20 h-20 rounded-card bg-[var(--color-warning-solid)] flex items-center justify-center text-white mb-6">
                <FileText size={40} />
              </div>
              <h4 className="text-white text-lg font-semibold mb-2">{t('MediaPreviewModal.cannotPreviewTheContentYet')}</h4>
              <p className="text-white/60 text-sm mb-8 leading-relaxed">
                {t('MediaPreviewModal.documentFilesWordExcelCanOnly')}
              </p>
              <div className="bg-white/10 p-4 rounded-card text-xs text-white/80 font-medium italic border border-white/5 w-full">
                {t('MediaPreviewModal.tipYouCanDownloadTheFile')}
              </div>
            </div>
          ) : (
            <iframe 
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} 
              className="w-full max-w-5xl h-full bg-white rounded-control shadow-2xl"
              title={fileName}
            />
          )
        ) : (
          <div className="bg-white/5 p-12 rounded-widget border border-white/10 flex flex-col items-center text-center max-w-sm">
            <div className="w-20 h-20 rounded-card bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-primary)] mb-6">
              <Download size={40} />
            </div>
            <h4 className="text-white text-lg font-semibold mb-2">{t('MediaPreviewModal.previewNotSupportedForThisFormat')}</h4>
            <p className="text-white/60 text-sm mb-8">{t('MediaPreviewModal.youCanDownloadThisFileTo')}</p>
            <Button variant="ghost" className="w-full" type="button" onClick={() => downloadFile(url, fileName)}>
              <Download aria-hidden="true" /> {t('MediaPreviewModal.downloadFile')}
            </Button>
          </div>
        )}
      </div>

      {/* Close backdrop on click if not zoomed */}
      {!isZoomed && <div className="absolute inset-0 -z-1" onClick={onClose} />}
    </div>
  )
}
