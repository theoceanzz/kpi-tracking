import { useState } from 'react'
import type { Attachment } from '@/types/submission'
import { FileIcon, Download, Eye, ExternalLink, FileVideo, FileAudio } from 'lucide-react'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { downloadFile } from '@/lib/utils'

interface AttachmentListProps { attachments: Attachment[] }

export default function AttachmentList({ attachments }: AttachmentListProps) {
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null)

  if (attachments.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-[var(--color-border)] rounded-card text-center">
        <p className="text-sm text-[var(--color-subtle-foreground)] font-medium italic">Không có tài liệu minh chứng đính kèm</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {attachments.map((a) => {
          const isImage = a.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(a.fileName)
          const isPdf = a.contentType === 'application/pdf' || a.fileName.toLowerCase().endsWith('.pdf')
          const isVideo = a.contentType?.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(a.fileName)
          const isAudio = a.contentType?.startsWith('audio/') || /\.(mp3|wav|m4a|aac)$/i.test(a.fileName)
          const isOffice = /\.(docx?|xlsx?|pptx?)$/i.test(a.fileName)
          const canPreview = isImage || isPdf || isOffice || isVideo || isAudio

          return (
            <div 
              key={a.id} 
              className="group relative bg-[var(--color-card)] border border-[var(--color-border)] rounded-card overflow-hidden hover:border-[var(--color-border)] transition-all duration-300"
            >
              {/* Card visual */}
              <div className="h-32 bg-[var(--color-muted)] relative flex items-center justify-center overflow-hidden border-b border-[var(--color-border)]">
                {isImage ? (
                  <img src={a.fileUrl} alt={a.fileName} className="w-full h-full object-cover transition-transform duration-500"/>
                ) : isVideo ? (
                  <video src={a.fileUrl} className="w-full h-full object-cover" preload="metadata" muted />
                ) : (
                  <div className="text-[var(--color-subtle-foreground)]">
                    {isAudio ? <FileAudio size={48} strokeWidth={1.5} /> : <FileIcon size={48} strokeWidth={1.5} />}
                  </div>
                )}
                
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-[var(--color-primary-soft)] group-hover:bg-[var(--color-primary-soft)] transition-all duration-300 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                  {canPreview && (
                    <button 
                      type="button"
                      onClick={() => setPreviewFile(a)}
                      className="w-10 h-10 rounded-full bg-white text-[var(--color-primary)] flex items-center justify-center hover:bg-[var(--color-primary-soft)] transition-colors"
                      title="Xem trước"
                    >
                      <Eye size={18} />
                    </button>
                  )}
                  <a 
                    href={a.fileUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-10 h-10 rounded-full bg-white text-[var(--color-foreground)] flex items-center justify-center hover:bg-[var(--color-muted)] transition-colors"
                    title="Mở trong tab mới"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <button 
                    type="button"
                    onClick={() => downloadFile(a.fileUrl, a.fileName)}
                    className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] flex items-center justify-center hover:bg-[var(--color-primary-hover)] transition-colors"
                    title="Tải về"
                  >
                    <Download size={18} />
                  </button>
                </div>

                {isPdf && (
                   <div className="text-eyebrow absolute top-2 right-2 px-2 py-0.5 rounded-control bg-[var(--color-error-solid)] text-white shadow-sm">
                      PDF
                   </div>
                )}
                {isVideo && (
                   <div className="text-eyebrow absolute top-2 right-2 px-2 py-0.5 rounded-control bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm flex items-center gap-1">
                      <FileVideo size={10} /> Video
                   </div>
                )}
                {isAudio && (
                   <div className="text-eyebrow absolute top-2 right-2 px-2 py-0.5 rounded-control bg-[var(--color-primary)] text-[var(--color-primary-foreground)] flex items-center gap-1">
                      <FileAudio size={10} /> Audio
                   </div>
                )}
              </div>

              {/* File Info */}
              <div className="p-4">
                <h5 className="text-xs font-semibold text-[var(--color-foreground)] truncate mb-1" title={a.fileName}>
                  {a.fileName}
                </h5>
                <div className="flex items-center justify-between text-eyebrow tracking-tight">
                  <span>
                    {isImage ? 'Ảnh' :
                     isPdf ? 'PDF' :
                     isVideo ? 'Video' :
                     isAudio ? 'Audio' :
                     a.fileName.toLowerCase().endsWith('.docx') || a.fileName.toLowerCase().endsWith('.doc') ? 'Word' :
                     a.fileName.toLowerCase().endsWith('.xlsx') || a.fileName.toLowerCase().endsWith('.xls') ? 'Excel' :
                     a.fileName.toLowerCase().endsWith('.pptx') || a.fileName.toLowerCase().endsWith('.ppt') ? 'PowerPoint' :
                     'Tài liệu'}
                  </span>
                  <span>{(a.fileSize / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <MediaPreviewModal 
          isOpen={!!previewFile} 
          onClose={() => setPreviewFile(null)} 
          url={previewFile.fileUrl}
          fileName={previewFile.fileName}
          contentType={previewFile.contentType}
        />
      )}
    </>
  )
}
