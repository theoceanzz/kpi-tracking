import { useCallback, useState, useEffect } from 'react'
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone'
import { Upload, X, FileIcon, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void
  files: File[]
  onRemove: (index: number) => void
  accept?: Accept
  maxFiles?: number
  /** Giới hạn dung lượng mỗi tệp, tính bằng byte. Không đặt thì không chặn. */
  maxSize?: number
  /** Dòng mô tả loại tệp nhận được. Không đặt thì dùng câu chung chung, không nhắc dung lượng. */
  hint?: string
  className?: string
}

/** Đổi mã lỗi của react-dropzone thành câu người dùng đọc được, có nêu cách sửa. */
function rejectionReason(rejection: FileRejection, maxSize?: number): string {
  const code = rejection.errors[0]?.code
  if (code === 'file-too-large') {
    const mb = maxSize ? (maxSize / 1024 / 1024).toFixed(0) : '?'
    const actual = (rejection.file.size / 1024 / 1024).toFixed(1)
    return i18n.t('shared:FileDropzone.isMbExceedingMb', { name: rejection.file.name, actual, mb })
  }
  if (code === 'file-invalid-type') {
    return i18n.t('shared:FileDropzone.isNotASupportedFormat', { name: rejection.file.name })
  }
  if (code === 'too-many-files') {
    return i18n.t('shared:FileDropzone.exceedsTheAllowedNumberOfFiles', { name: rejection.file.name })
  }
  return i18n.t('shared:FileDropzone.couldNotAccept', { name: rejection.file.name })
}

export default function FileDropzone({ onFilesSelected, files, onRemove, accept, maxFiles = 5, maxSize, hint, className }: FileDropzoneProps) {
  const { t } = useTranslation('shared')
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string, type: string } | null>(null)
  
  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    // Nói RÕ tệp nào hỏng và vì sao. Bản trước im lặng bỏ qua tệp bị từ chối, nên người dùng kéo
    // thả xong thấy thiếu tệp mà không hiểu tại sao.
    rejected.forEach(r => toast.error(rejectionReason(r, maxSize)))

    if (files.length + accepted.length > maxFiles) {
       toast.error(t('FileDropzone.atMostFilesCanBeUploaded', { maxFiles }));
       return;
    }
    if (accepted.length) onFilesSelected(accepted)
  }, [onFilesSelected, files, maxFiles, maxSize, t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: maxFiles - files.length,
    disabled: files.length >= maxFiles
  })

  return (
    <div className={cn("space-y-4", className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-card p-6 transition-all duration-500 group overflow-hidden',
          isDragActive
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] scale-[0.99] shadow-inner'
            : files.length >= maxFiles 
              ? 'border-[var(--color-border)] bg-[var(--color-muted)] cursor-not-allowed opacity-60'
              : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-muted)] cursor-pointer'
        )}
      >
        <input {...getInputProps()} />
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className={cn(
            "w-14 h-14 rounded-card flex items-center justify-center mb-4 transition-all duration-500",
            isDragActive ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rotate-12 scale-110" : "bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] group-hover:bg-[var(--color-primary-soft)] group-hover:text-[var(--color-primary)]"
          )}>
            <Upload size={24} />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              {isDragActive ? t('FileDropzone.dropToUpload') : files.length >= maxFiles ? t('FileDropzone.fileLimitReached') : t('FileDropzone.chooseEvidenceDocuments')}
            </p>
            <p className="text-eyebrow">
              {hint ?? t('FileDropzone.imagesPdfWordExcelMaxFiles', { maxFiles })}
            </p>
          </div>
        </div>
        
        {/* Decorative background element */}
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
    <div className="group flex items-center gap-3 p-3 bg-[var(--color-card)] rounded-card border border-[var(--color-border)] hover:border-[var(--color-border)] transition-all shadow-sm hover:shadow-md">
      <div className="w-10 h-10 rounded-card bg-[var(--color-muted)] flex items-center justify-center shrink-0 border border-[var(--color-border)] overflow-hidden">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <FileIcon size={18} className="text-[var(--color-primary)]" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--color-foreground)] truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-caption uppercase tracking-tighter">
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
            className="w-8 h-8 flex items-center justify-center rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-all"
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
          className="w-8 h-8 flex items-center justify-center rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
