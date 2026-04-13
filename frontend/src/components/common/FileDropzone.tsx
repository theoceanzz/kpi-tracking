import { useCallback } from 'react'
import { useDropzone, type Accept } from 'react-dropzone'
import { Upload, X, FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void
  files: File[]
  onRemove: (index: number) => void
  accept?: Accept
  maxFiles?: number
  className?: string
}

export default function FileDropzone({ onFilesSelected, files, onRemove, accept, maxFiles = 5, className }: FileDropzoneProps) {
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
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-2 text-[var(--color-muted-foreground)]" size={24} />
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {isDragActive ? 'Thả file vào đây...' : 'Kéo thả file hoặc bấm để chọn'}
        </p>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-2 text-sm bg-[var(--color-muted)] rounded-lg px-3 py-2">
              <FileIcon size={16} className="text-[var(--color-muted-foreground)]" />
              <span className="flex-1 truncate">{file.name}</span>
              <button onClick={() => onRemove(i)} className="text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
