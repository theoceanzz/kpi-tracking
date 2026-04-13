import type { Attachment } from '@/types/submission'
import { FileIcon, Download } from 'lucide-react'

interface AttachmentListProps { attachments: Attachment[] }

export default function AttachmentList({ attachments }: AttachmentListProps) {
  if (attachments.length === 0) return <p className="text-sm text-[var(--color-muted-foreground)]">Không có tệp đính kèm</p>

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-muted)] hover:bg-[var(--color-accent)] transition">
          <FileIcon size={16} className="text-[var(--color-muted-foreground)]" />
          <span className="flex-1 text-sm truncate">{a.fileName}</span>
          <Download size={14} className="text-[var(--color-muted-foreground)]" />
        </a>
      ))}
    </div>
  )
}
