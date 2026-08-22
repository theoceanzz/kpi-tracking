import { useRef } from 'react'
import { Paperclip, X, CheckCircle2, Pin, CornerDownRight, FileText, ImageIcon, Sheet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatBytes, screenEvidence } from '@/lib/attachmentPolicy'
import { useFormAssistStore, type FormFileSink } from '@/store/formAssistStore'
import { usePinnedFilesStore, attachPinnedTo } from '@/store/pinnedFilesStore'

interface EvidenceAttachBarProps {
  /** Chỗ nhận tệp của form đang mở. Chỉ dùng cho câu gợi ý — GHIM thì không cần form nào cả. */
  sink?: FormFileSink
  disabled?: boolean
}

/** Biểu tượng theo đuôi tệp. */
function iconFor(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ImageIcon
  if (['xls', 'xlsx'].includes(ext)) return Sheet
  return FileText
}

/**
 * Nút kẹp tệp cho ô nhập của trợ lý.
 *
 * <p>Kẹp = <b>GHIM</b>, không phải đính. Đúng nếp mọi ứng dụng chat: cái kẹp giấy ghim tệp vào tin
 * nhắn sắp gửi, chứ không tự ý làm gì với nó. Bản trước cho tệp vào thẳng biểu mẫu ngay lúc chọn,
 * và người dùng thấy tệp đã nằm trong form trong khi mình chưa bảo gì cả.
 *
 * <p>Tệp ghim vào biểu mẫu khi người dùng BẢO trợ lý đính, hoặc bấm nút ở {@link PinnedChips}.
 */
export default function EvidenceAttachBar({ sink, disabled }: EvidenceAttachBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pin = usePinnedFilesStore(s => s.pin)
  const pinned = usePinnedFilesStore(s => s.files)

  const handlePick = (picked: FileList | null) => {
    if (!picked?.length) return
    // Lọc NGAY lúc ghim chứ không đợi tới lúc đính: biết sớm vẫn hơn, và người dùng không phải phát
    // hiện tệp hỏng sau khi đã gõ hẳn một câu nhờ đính.
    const { accepted, rejected } = screenEvidence(Array.from(picked), pinned)
    rejected.forEach(r => toast.error(r.reason))
    if (accepted.length) pin(accepted)
    // Xoá giá trị input để chọn lại ĐÚNG tệp vừa bỏ ghim vẫn kích hoạt được onChange.
    if (inputRef.current) inputRef.current.value = ''
  }

  const title = sink
    ? `Ghim tệp để đính vào mục ${sink.label} — ${sink.hint}`
    : 'Ghim tệp. Mở biểu mẫu có mục đính kèm (ví dụ Gửi báo cáo KPI) rồi bảo trợ lý đính.'

  // Fragment chứ không phải div bọc: nút phải là con TRỰC TIẾP của hàng flex chứa ô nhập, nếu không
  // nó tự thành một cột riêng và lệch khỏi ô nhập.
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => handlePick(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title={title}
        aria-label="Ghim tệp"
        className={cn(
          'shrink-0 p-1.5 rounded-lg transition-colors',
          'text-slate-400 hover:text-[var(--color-ai)] hover:bg-[var(--color-ai-soft)]',
          'disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed',
        )}
      >
        <Paperclip size={16} />
      </button>
    </>
  )
}

/**
 * Hàng thẻ tệp ĐANG GHIM — chưa vào biểu mẫu nào.
 *
 * <p>Tông tím của khu vực AI để phân biệt rõ với hàng thẻ XANH bên dưới (đã đính). Người dùng thấy
 * tệp đi từ tím sang xanh đúng lúc việc đính xảy ra.
 *
 * <p>Nút "Đính vào biểu mẫu" là đường thoát TẤT ĐỊNH: trong dự án này đã đo được vài lần model
 * trượt lời gọi tool, và không có nút thì người dùng gõ lại câu khác mà không hiểu vì sao chưa vào.
 */
export function PinnedChips({ sink }: { sink?: FormFileSink }) {
  const files = usePinnedFilesStore(s => s.files)
  const unpin = usePinnedFilesStore(s => s.unpin)
  if (!files.length) return null

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-ai)]">
        <Pin size={12} />
        Đang ghim
      </span>
      {files.map((file, i) => {
        const Icon = iconFor(file)
        return (
          <span
            key={`${file.name}-${i}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--color-ai-line)] bg-[var(--color-ai-soft)] py-1 pl-2 pr-1 text-[11px] font-bold text-[var(--color-ai)]"
          >
            <Icon size={12} className="shrink-0" />
            <span className="max-w-[140px] truncate">{file.name}</span>
            <span className="shrink-0 tabular-nums opacity-60">{formatBytes(file.size)}</span>
            <button
              type="button"
              onClick={() => unpin(file)}
              aria-label={`Bỏ ghim ${file.name}`}
              className="shrink-0 rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X size={11} />
            </button>
          </span>
        )
      })}
      <button
        type="button"
        onClick={() => attachPinnedTo(sink)}
        disabled={!sink}
        title={sink
          ? `Đính ${files.length} tệp vào mục ${sink.label}`
          : 'Mở biểu mẫu có mục đính kèm (ví dụ Gửi báo cáo KPI) trước'}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors',
          'bg-[var(--color-ai)] text-white hover:brightness-110',
          'disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700',
        )}
      >
        <CornerDownRight size={11} />
        Đính vào biểu mẫu
      </button>
    </div>
  )
}

/**
 * Hàng thẻ tệp ĐÃ ĐÍNH vào biểu mẫu.
 *
 * <p>Vẽ từ ảnh chụp trong store chứ không từ `sink.current()`: hàm đó đọc qua ref nên không phản
 * ứng, và thẻ sẽ đứng hình sai khi người dùng gỡ tệp ngay trên form.
 */
export function AttachedChips({ sink }: { sink?: FormFileSink }) {
  const files = useFormAssistStore(s => s.attachedFiles)
  if (!sink || !files.length) return null

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={12} />
        Đã đính kèm vào {sink.label}
      </span>
      {files.map((file, i) => {
        const Icon = iconFor(file)
        return (
          <span
            key={`${file.name}-${i}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-1 pl-2 pr-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <Icon size={12} className="shrink-0" />
            <span className="max-w-[140px] truncate">{file.name}</span>
            <span className="shrink-0 tabular-nums opacity-60">{formatBytes(file.size)}</span>
            <button
              type="button"
              onClick={() => sink.remove(file)}
              aria-label={`Bỏ ${file.name}`}
              className="shrink-0 rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X size={11} />
            </button>
          </span>
        )
      })}
    </div>
  )
}
