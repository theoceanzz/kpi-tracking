import { useState } from 'react'
import type { Attachment } from '@/types/submission'
import { FileIcon, Download, Eye, ExternalLink } from 'lucide-react'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { downloadFile } from '@/lib/utils'

interface AttachmentListProps { attachments: Attachment[] }

export default function AttachmentList({ attachments }: AttachmentListProps) {
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null)

  if (attachments.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center">
        <p className="text-sm text-slate-400 font-medium italic">Không có tài liệu minh chứng đính kèm</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {attachments.map((a) => {
          const isImage = a.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(a.fileName)
          const isPdf = a.contentType === 'application/pdf' || a.fileName.toLowerCase().endsWith('.pdf')
          const canPreview = isImage || isPdf

          return (
            <div 
              key={a.id} 
              className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all duration-300"
            >
              {/* Card visual */}
              <div className="h-32 bg-slate-50 dark:bg-slate-800/50 relative flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800">
                {isImage ? (
                  <img src={a.fileUrl} alt={a.fileName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="text-slate-300 dark:text-slate-600">
                    <FileIcon size={48} strokeWidth={1.5} />
                  </div>
                )}
                
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/60 backdrop-blur-0 group-hover:backdrop-blur-sm transition-all duration-300 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                  {canPreview && (
                    <button 
                      type="button"
                      onClick={() => setPreviewFile(a)}
                      className="w-10 h-10 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-lg hover:bg-indigo-50 transition-colors"
                      title="Xem trước"
                    >
                      <Eye size={18} />
                    </button>
                  )}
                  <a 
                    href={a.fileUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg hover:bg-slate-50 transition-colors"
                    title="Mở trong tab mới"
                  >
                    <ExternalLink size={18} />
                  </a>
                  <button 
                    type="button"
                    onClick={() => downloadFile(a.fileUrl, a.fileName)}
                    className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-colors"
                    title="Tải về"
                  >
                    <Download size={18} />
                  </button>
                </div>

                {isPdf && (
                   <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">
                      PDF
                   </div>
                )}
              </div>

              {/* File Info */}
              <div className="p-4">
                <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate mb-1" title={a.fileName}>
                  {a.fileName}
                </h5>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  <span>{a.contentType?.split('/')[1] || 'FILE'}</span>
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
