import { useCallback, useState, useEffect } from 'react'
import { useDropzone, type Accept } from 'react-dropzone'
import { Upload, X, FileIcon, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void
  files: File[]
  onRemove: (index: number) => void
  accept?: Accept
  maxFiles?: number
  className?: string
}

export default function FileDropzone({ onFilesSelected, files, onRemove, accept, maxFiles = 5, className }: FileDropzoneProps) {
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string, type: string } | null>(null)
  
  const onDrop = useCallback((accepted: File[]) => {
    onFilesSelected(accepted)
  }, [onFilesSelected])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
  })

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 group',
          isDragActive
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
            : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:text-indigo-500 transition-all">
          <Upload size={24} />
        </div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
          {isDragActive ? 'Thả file vào đây...' : 'Kéo thả hoặc nhấn để chọn tài liệu'}
        </p>
        <p className="text-xs text-slate-500 font-medium">
          Hỗ trợ JPG, PNG, PDF, DOCX (Tối đa {maxFiles} tệp)
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((file, i) => (
            <FileItem 
              key={i} 
              file={file} 
              onRemove={() => onRemove(i)} 
              onPreview={(url) => setPreviewFile({ url, name: file.name, type: file.type })}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <MediaPreviewModal 
          isOpen={!!previewFile} 
          onClose={() => setPreviewFile(null)} 
          url={previewFile.url}
          fileName={previewFile.name}
          contentType={previewFile.type}
        />
      )}
    </div>
  )
}

function FileItem({ file, onRemove, onPreview }: { file: File, onRemove: () => void, onPreview: (url: string) => void }) {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  const isOfficeDoc = /\.(docx?|xlsx?|pptx?)$/i.test(file.name)
  const canPreview = isImage || isPdf || isOfficeDoc
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="group relative flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <FileIcon size={20} className="text-slate-400" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">
          {(file.size / 1024).toFixed(1)} KB
        </p>
      </div>

      <div className="flex items-center gap-1">
        {canPreview && previewUrl && (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPreview(previewUrl)
            }} 
            className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
            title="Xem trước"
          >
            <Eye size={16} />
          </button>
        )}
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }} 
          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          title="Xóa"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
