import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Paperclip, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { FormFileSink } from '@/store/formAssistStore'
import { usePinnedFilesStore } from '@/store/pinnedFilesStore'
import { screenEvidence } from '@/lib/attachmentPolicy'

interface EvidenceDropCardProps {
  /** Chỗ nhận tệp của form đang mở. Vắng = chưa mở form nào nhận tệp. */
  sink?: FormFileSink
  disabled?: boolean
}

/**
 * Vùng thả tệp, hiện NGAY TRONG bong bóng trả lời khi trợ lý mời gửi tài liệu.
 *
 * <p>Tệp thả vào đi THẲNG vào form qua {@link FormFileSink} — không qua kho trung gian, không chờ
 * người dùng gõ thêm câu nào. Giới hạn và tên mục lấy từ chính sink, nên thẻ này không biết gì về
 * form báo cáo và dùng lại được cho mọi form biết đính kèm.
 *
 * <p>Chưa mở form nào nhận tệp thì thẻ chuyển sang trạng thái giải thích thay vì mời thả — thả vào
 * cũng chẳng có chỗ nào để đi.
 */
export default function EvidenceDropCard({ sink, disabled }: EvidenceDropCardProps) {
  const pin = usePinnedFilesStore(s => s.pin)
  const pinned = usePinnedFilesStore(s => s.files)
  // Trần tính CẢ tệp đang ghim lẫn tệp đã đính trên form — hai nguồn cùng chảy về một mục.
  const full = !!sink && pinned.length + sink.current().length >= sink.maxFiles

  const onDrop = useCallback(
    (dropped: File[]) => {
      if (!dropped.length) return
      // GHIM, không đính. Một luật duy nhất cho cả hai lối kẹp — hai affordance mà hai hành vi là
      // đúng thứ làm người dùng thấy sượng ở bản trước.
      const { accepted, rejected } = screenEvidence(dropped, pinned)
      rejected.forEach(r => toast.error(r.reason))
      if (accepted.length) pin(accepted)
    },
    [pin, pinned],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: sink?.accept,
    maxSize: sink?.maxSize,
    disabled: disabled || full,
    // Vẫn cho bấm để chọn: kéo-thả không dùng được trên điện thoại.
    multiple: true,
  })

  // Không có chỗ nhận thì nói thẳng, đừng vẽ một vùng thả không dẫn đi đâu — đúng loại hứa suông
  // vừa phải đi sửa ở lượt trước.
  if (!sink) {
    return (
      <div className="mt-3 rounded-2xl border border-[var(--color-border)] px-4 py-4 text-center">
        <FolderOpen size={18} className="mx-auto mb-2 text-slate-400" />
        <p className="text-sm font-bold text-slate-500">Chưa mở biểu mẫu nào nhận tệp</p>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Ghim tệp vẫn được, nhưng phải mở màn hình Gửi báo cáo KPI thì mới đính vào đâu đó được.
        </p>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'mt-3 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-all duration-300',
        full
          ? 'border-[var(--color-border)] opacity-60 cursor-not-allowed'
          : 'cursor-pointer border-[var(--color-ai-line)] hover:bg-[var(--color-ai-soft)]',
        isDragActive && 'bg-[var(--color-ai-soft)] scale-[0.99]',
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          'mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300',
          isDragActive
            ? 'bg-[var(--color-ai)] text-white rotate-6 scale-110'
            : 'bg-[var(--color-ai-soft)] text-[var(--color-ai)]',
        )}
      >
        {isDragActive ? <Upload size={18} /> : <Paperclip size={18} />}
      </div>
      <p className="text-sm font-bold text-[var(--color-ai)]">
        {full
          ? `Đã đủ ${sink?.maxFiles} tệp`
          : isDragActive
            ? 'Thả tệp vào đây'
            : 'Kéo thả tệp vào đây để ghim'}
      </p>
      {!full && (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {sink?.hint ?? 'Ảnh, PDF, Word, Excel'}
        </p>
      )}
    </div>
  )
}
