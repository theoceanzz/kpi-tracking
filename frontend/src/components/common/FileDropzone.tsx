import { useCallback, useState, useEffect } from 'react'
import { useDropzone, type Accept } from 'react-dropzone'
import { Upload, X, FileIcon, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
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
    if (files.length + accepted.length > maxFiles) {
       toast.error(`Chỉ được phép tải lên tối đa ${maxFiles} tệp`);
       return;
    }
    onFilesSelected(accepted)
  }, [onFilesSelected, files, maxFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: maxFiles - files.length,
    disabled: files.length >= maxFiles
  })

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-[28px] p-6 transition-all duration-500 group overflow-hidden',
          isDragActive
            ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-500/5 scale-[0.99] shadow-inner'
            : files.length >= maxFiles 
              ? 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 cursor-not-allowed opacity-60'
              : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 cursor-pointer'
        )}
      >
        <input {...getInputProps()} />
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500",
            isDragActive ? "bg-indigo-500 text-white rotate-12 scale-110" : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 group-hover:-translate-y-1"
          )}>
            <Upload size={24} />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {isDragActive ? 'Thả để tải lên' : files.length >= maxFiles ? 'Đã đạt giới hạn tệp' : 'Chọn tài liệu minh chứng'}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              JPG, PNG, PDF (Tối đa {maxFiles} tệp)
            </p>
          </div>
        </div>
        
        {/* Decorative background element */}
        <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
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
    <div className="group flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all shadow-sm hover:shadow-md">
      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 overflow-hidden">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <FileIcon size={18} className="text-indigo-500" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-slate-900 dark:text-white truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all"
          >
            <Eye size={14} />
          </button>
        )}
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }} 
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
