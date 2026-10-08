import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Paperclip, Send, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import UserAvatar from '@/components/common/UserAvatar'
import { useStateDraft } from '@/hooks/useFormDraft'
import { toastUploadError } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { discussionApi } from '../api/discussionApi'
import { COLLAB_ACCEPT, COLLAB_EXTENSIONS, COLLAB_MAX_FILES_PER_COMMENT, checkFiles, isImageName } from '../attachments'
import { PickFromLibraryButton } from '@/features/documents/components/DocumentPickerDialog'
import type { DiscussionTargetType, MentionCandidate } from '../types'

export interface ComposerSubmit {
  body: string
  mentionIds: string[]
  files: File[]
}

interface Props {
  targetType: DiscussionTargetType
  targetId: string
  /** Khoá nháp: tách bình luận gốc với từng ô trả lời / ô sửa. */
  draftKey: string
  initialText?: string
  initialMentions?: { id: string; fullName: string | null }[]
  allowFiles?: boolean
  autoFocus?: boolean
  compact?: boolean
  placeholder?: string
  submitting?: boolean
  onSubmit: (v: ComposerSubmit) => Promise<unknown>
  onCancel?: () => void
}

/** "@chuỗi" ngay trước con trỏ (không có khoảng trắng kép) — đang gõ tên để tag. */
function mentionQueryAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0 && !/\s/.test(before[at - 1] ?? '')) return null
  const query = before.slice(at + 1)
  if (query.length > 40 || /\n/.test(query) || /\s{2}/.test(query)) return null
  return { start: at, query }
}

/**
 * Ô soạn bình luận: Enter gửi, Shift+Enter xuống dòng; gõ "@" để tag người (chỉ gợi ý người xem được đối tượng —
 * backend lọc); đính kèm / dán ảnh. Nội dung chưa gửi giữ nháp theo người dùng.
 */
export default function CommentComposer({
  targetType, targetId, draftKey, initialText = '', initialMentions = [], allowFiles = true, autoFocus, compact,
  placeholder, submitting, onSubmit, onCancel,
}: Props) {
  const { t } = useTranslation('discussion')
  const [text, setText] = useState(initialText)
  const [files, setFiles] = useState<File[]>([])
  const [mentions, setMentions] = useState<{ id: string; fullName: string }[]>(
    initialMentions.filter((m) => m.fullName).map((m) => ({ id: m.id, fullName: m.fullName! })),
  )
  const [mentionAt, setMentionAt] = useState<{ start: number; query: string } | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [debounced, setDebounced] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const draft = useStateDraft(text, setText, { key: `discussion:${draftKey}`, enabled: !initialText })

  useEffect(() => {
    const h = setTimeout(() => setDebounced(mentionAt?.query ?? ''), 200)
    return () => clearTimeout(h)
  }, [mentionAt?.query])

  const { data: candidates = [] } = useQuery({
    queryKey: ['discussion-mentionable', targetType, targetId, debounced],
    queryFn: () => discussionApi.mentionable(targetType, targetId, debounced),
    enabled: mentionAt != null,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  // Tự giãn chiều cao theo nội dung (tối đa ~8 dòng).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: isImageName(f.name) ? URL.createObjectURL(f) : null })),
    [files],
  )
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews])

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return
    const problems = checkFiles(incoming)
    const firstProblem = problems[0]
    if (firstProblem) {
      toast.error(firstProblem.reason === 'size'
        ? t('composer.fileTooLarge', { name: firstProblem.file.name })
        : t('composer.fileNotSupported', { name: firstProblem.file.name }))
    }
    const ok = incoming.filter((f) => !problems.some((p) => p.file === f))
    setFiles((cur) => {
      const next = [...cur, ...ok]
      if (next.length > COLLAB_MAX_FILES_PER_COMMENT) {
        toast.error(t('composer.tooManyFiles', { max: COLLAB_MAX_FILES_PER_COMMENT }))
        return next.slice(0, COLLAB_MAX_FILES_PER_COMMENT)
      }
      return next
    })
  }

  const pick = (c: MentionCandidate) => {
    if (!mentionAt || !ref.current) return
    const caret = ref.current.selectionStart ?? text.length
    const insert = `@${c.fullName} `
    const next = text.slice(0, mentionAt.start) + insert + text.slice(caret)
    setText(next)
    setMentions((m) => (m.some((x) => x.id === c.id) ? m : [...m, { id: c.id, fullName: c.fullName }]))
    setMentionAt(null)
    requestAnimationFrame(() => {
      const pos = mentionAt.start + insert.length
      ref.current?.setSelectionRange(pos, pos)
      ref.current?.focus()
    })
  }

  const submit = async () => {
    const body = text.trim()
    if (!body && files.length === 0) return
    // Chỉ gửi những người còn được nhắc trong nội dung (người dùng có thể đã xoá "@Tên" sau khi chọn).
    const mentionIds = mentions.filter((m) => body.includes(`@${m.fullName}`)).map((m) => m.id)
    try {
      await onSubmit({ body, mentionIds, files })
      setText('')
      setFiles([])
      setMentions([])
      draft.clear()
    } catch (e) {
      // Nội dung + tệp vẫn còn trong ô soạn, nên Thử lại chỉ việc gửi lại.
      toastUploadError(e, files.length > 0 ? () => void submit() : undefined)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionAt && candidates.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % candidates.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => (i - 1 + candidates.length) % candidates.length); return }
      const chosen = candidates[Math.min(activeIdx, candidates.length - 1)]
      if ((e.key === 'Enter' || e.key === 'Tab') && chosen) { e.preventDefault(); pick(chosen); return }
    }
    if (e.key === 'Escape') {
      if (mentionAt) { setMentionAt(null); return }
      onCancel?.()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const m = mentionQueryAt(e.target.value, e.target.selectionStart ?? e.target.value.length)
    setMentionAt(m)
    setActiveIdx(0)
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!allowFiles) return
    const pasted = Array.from(e.clipboardData.files ?? [])
    if (pasted.length) {
      e.preventDefault()
      addFiles(pasted)
    }
  }

  const canSend = (text.trim().length > 0 || files.length > 0) && !submitting

  return (
    <div
      className={cn('relative rounded-card border border-[var(--color-border)] bg-[var(--color-card)]', compact ? 'p-2' : 'p-3')}
      onDragOver={(e) => allowFiles && e.preventDefault()}
      onDrop={(e) => {
        if (!allowFiles) return
        e.preventDefault()
        addFiles(Array.from(e.dataTransfer.files ?? []))
      }}
    >
      {mentionAt && candidates.length > 0 && (
        <div className="absolute bottom-full left-2 mb-1 w-72 max-h-60 overflow-y-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg z-[1100]">
          {candidates.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(c) }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-muted)]', i === activeIdx && 'bg-[var(--color-muted)]')}
            >
              <UserAvatar fullName={c.fullName} avatarUrl={c.avatarUrl} className="h-7 w-7 rounded-full text-[10px]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{c.fullName}</span>
                <span className="block truncate text-xs text-[var(--color-subtle-foreground)]">
                  {[c.title, c.unitName].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {previews.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-1 pr-6 text-xs">
              {p.url ? <img src={p.url} alt="" className="h-10 w-10 rounded object-cover" /> : <FileText size={16} className="mx-1" />}
              <span className="max-w-[140px] truncate">{p.file.name}</span>
              <button
                type="button"
                aria-label={t('composer.removeFile')}
                onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 rounded p-0.5 hover:bg-[var(--color-border)]"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Ô soạn chat — ngoại lệ có chủ đích của quy ước Input/Textarea (CLAUDE.md). */}
        <textarea
          ref={ref}
          value={text}
          rows={1}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => setTimeout(() => setMentionAt(null), 150)}
          placeholder={placeholder ?? t('composer.placeholder')}
          maxLength={5000}
          className="no-edit-hint min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
        />
        {allowFiles && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={COLLAB_ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            <Button type="button" variant="ghost" size="icon" aria-label={t('composer.attach')} onClick={() => fileRef.current?.click()}>
              <Paperclip size={16} />
            </Button>
            {/* Chọn từ thư viện tài liệu: tải tệp về rồi đính kèm như tệp từ máy (bản sao — người đọc bình luận không cần
                quyền xem tài liệu gốc). */}
            <PickFromLibraryButton iconOnly variant="ghost" size="icon" accept={COLLAB_EXTENSIONS}
              max={COLLAB_MAX_FILES_PER_COMMENT - files.length} onPicked={addFiles} />
          </>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t('composer.cancel')}</Button>
        )}
        <Button type="button" size={compact ? 'sm' : 'default'} disabled={!canSend} onClick={() => void submit()} aria-label={t('composer.send')}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
      {!compact && <p className="mt-1 px-1 text-[11px] text-[var(--color-subtle-foreground)]">{t('composer.hint')}</p>}
    </div>
  )
}
