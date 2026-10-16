import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Loader2, Paperclip, Send, UserRound, X } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'
import { useDebounce } from '@/hooks/useDebounce'
import { useStateDraft } from '@/hooks/useFormDraft'
import { cn } from '@/lib/utils'
import { useSendDocumentEmail, useShareTargets } from '../hooks/useDocuments'
import type { KbDocument } from '../types'
import { formatBytes, onlineFormat } from '../utils'
import { FileTypeIcon } from './docUi'

// Trình soạn thân thư (BlockNote, chung với tài liệu trực tuyến) khá nặng — chỉ tải khi mở hộp soạn thư.
const MailBodyEditor = lazy(() => import('../editor/MailBodyEditor'))

/** Khớp `DocumentEmailService` phía máy chủ (máy chủ vẫn kiểm lại). */
const MAX_RECIPIENTS = 20
const MAX_MESSAGE = 5000
const EXPIRY_OPTIONS = [1, 7, 30, 90] as const
const DEFAULT_EXPIRY = 30
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/

interface FormState {
  to: string[]
  cc: string[]
  showCc: boolean
  subject: string
  /** Chữ thuần của thân thư — kiểm độ dài, biết thư có trống không. */
  message: string
  /** JSON của trình soạn (định dạng). */
  messageDoc: string | null
  expiresInDays: number
}

/**
 * Soạn email gửi tài liệu cho bất kỳ ai — kể cả người không dùng hệ thống. Thư là chính (tiêu đề, lời nhắn như một email
 * bình thường); tài liệu chỉ là "tệp đính kèm", đi dưới dạng link công khai có hạn dùng: người nhận bấm là mở, không cần
 * tài khoản. Mỗi lần gửi một link riêng, thu hồi được ở tab Chia sẻ. Thư đi từ hộp thư hệ thống, "Trả lời" về người gửi.
 */
export default function SendDocumentEmailDialog({ doc, onClose }: { doc: KbDocument; onClose: () => void }) {
  const { t } = useTranslation('documents')
  const send = useSendDocumentEmail()
  const [form, setForm] = useState<FormState>(() => ({
    to: [], cc: [], showCc: false, subject: doc.title, message: '', messageDoc: null, expiresInDays: DEFAULT_EXPIRY,
  }))
  const draft = useStateDraft(form, setForm, { key: `document-email:${doc.id}`, enabled: true })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))

  // Chữ đang gõ dở trong ô Đến / Cc (chưa thành chip) — bấm Gửi thì tính luôn, khỏi bắt người dùng nhấn Enter.
  const [pendingTo, setPendingTo] = useState('')
  const [pendingCc, setPendingCc] = useState('')
  const finalTo = mergeEmails(form.to, pendingTo)
  const finalCc = mergeEmails(form.cc, pendingCc)
  const invalid = [...finalTo, ...finalCc].filter(e => !EMAIL.test(e))
  const total = finalTo.length + finalCc.length
  const canSubmit = finalTo.length > 0 && invalid.length === 0 && total <= MAX_RECIPIENTS && form.message.length <= MAX_MESSAGE
    && !send.isPending

  const submit = () => {
    if (blockedByTour()) return
    if (!canSubmit) return
    send.mutate({
      id: doc.id,
      input: {
        to: finalTo, cc: finalCc, subject: form.subject.trim() || doc.title, message: form.message, messageDoc: form.messageDoc,
        expiresInDays: form.expiresInDays,
      },
    }, { onSuccess: onClose })
  }

  const online = onlineFormat(doc)
  const kind = online === 'blocks' ? t('email.kind.doc') : online === 'sheet' ? t('email.kind.sheet')
    : `${doc.fileName} · ${formatBytes(doc.fileSize)}`

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissible={!send.isPending}
      title={t('email.title')}
      description={t('email.description')}
      {...tourAnchor('docEmail.form')}
      footer={
        <DialogFooter
          note={invalid.length > 0
            ? <span className="text-[var(--color-error)]">{t('email.invalidAddress', { email: invalid[0] })}</span>
            : total > MAX_RECIPIENTS ? <span className="text-[var(--color-error)]">{t('email.tooMany', { max: MAX_RECIPIENTS })}</span>
              : undefined}
          secondary={<Button variant="outline" onClick={onClose} disabled={send.isPending}>{t('common.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('docEmail.form.submit')} onClick={submit} disabled={!canSubmit}>
              {send.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {t('email.send')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        {/* Khung soạn kiểu Gmail: Đến / Cc / Tiêu đề là các dòng liền nhau, thân thư ngay bên dưới. */}
        <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] focus-within:border-[var(--color-border-strong)]">
          <ComposeRow label={t('email.to')} htmlFor="doc-email-to" {...tourAnchor('docEmail.form.to')}
                      trailing={!form.showCc && (
                        <button type="button" onClick={() => set('showCc', true)}
                                className="rounded-control px-1.5 py-1 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                          {t('email.cc')}
                        </button>
                      )}>
            <RecipientField id="doc-email-to" value={form.to} onChange={v => set('to', v)} text={pendingTo} onText={setPendingTo}
                            placeholder={t('email.toPlaceholder')} autoFocus />
          </ComposeRow>
          {form.showCc && (
            <ComposeRow label={t('email.cc')} htmlFor="doc-email-cc"
                        trailing={
                          <button type="button" aria-label={t('email.removeCc')} title={t('email.removeCc')}
                                  onClick={() => { setForm(p => ({ ...p, cc: [], showCc: false })); setPendingCc('') }}
                                  className="flex h-7 w-7 items-center justify-center rounded-control text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                            <X size={14} aria-hidden="true" />
                          </button>
                        }>
              <RecipientField id="doc-email-cc" value={form.cc} onChange={v => set('cc', v)} text={pendingCc} onText={setPendingCc}
                              placeholder={t('email.toPlaceholder')} />
            </ComposeRow>
          )}
          <ComposeRow label={t('email.subject')} htmlFor="doc-email-subject">
            <Input id="doc-email-subject" value={form.subject} maxLength={200} onChange={e => set('subject', e.target.value)}
                   className="no-edit-hint h-8 border-0 bg-transparent px-1 shadow-none focus-visible:shadow-none" />
          </ComposeRow>
          <Suspense fallback={<div className="p-3"><LoadingSkeleton type="card" rows={3} /></div>}>
            <MailBodyEditor {...tourAnchor('docEmail.form.message')} value={form.messageDoc}
                            onChange={(json, text) => setForm(p => ({ ...p, messageDoc: json, message: text }))}
                            placeholder={t('email.messagePlaceholder')} />
          </Suspense>
        </div>
        {form.message.length > MAX_MESSAGE && (
          <p className="text-sm text-[var(--color-error)]">{t('email.messageTooLong', { max: MAX_MESSAGE })}</p>
        )}

        {/* Tài liệu như một tệp đính kèm của thư — không bỏ ra được (bỏ thì đã không mở hộp này). */}
        <div {...tourAnchor('docEmail.form.attachment')} className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <Paperclip size={12} aria-hidden="true" /> {t('email.attachment')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[var(--color-card)]">
              <FileTypeIcon doc={doc} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">{doc.title}</span>
              <span className="block truncate text-caption">{kind}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-caption">{t('email.expiry')}</span>
              <Select value={String(form.expiresInDays)} onValueChange={v => set('expiresInDays', Number(v))}>
                <SelectTrigger className="h-8 w-32" aria-label={t('email.expiry')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{t('email.expiryDays', { count: d })}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-caption">
            <Globe size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {t('email.publicNote')}
          </p>
        </div>
      </div>
    </Dialog>
  )
}

/** Một dòng của khung soạn thư: nhãn bên trái, ô nhập ở giữa, nút phụ (Cc / bỏ Cc) bên phải. */
function ComposeRow({ label, htmlFor, trailing, children, ...rest }: {
  label: string
  htmlFor: string
  trailing?: ReactNode
  children: ReactNode
  'data-tour'?: string
}) {
  return (
    <div {...rest} className="flex min-h-10 items-center gap-2 border-b border-[var(--color-border)] px-3 py-1">
      <label htmlFor={htmlFor} className="w-16 shrink-0 text-sm text-[var(--color-muted-foreground)]">{label}</label>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </div>
  )
}

/** Chip đã có + phần đang gõ (tách bằng dấu phẩy / chấm phẩy / khoảng trắng) — bỏ trùng, giữ thứ tự. */
function mergeEmails(chips: string[], text: string): string[] {
  const out = [...chips]
  for (const e of splitEmails(text)) if (!out.includes(e)) out.push(e)
  return out
}

function splitEmails(text: string): string[] {
  return text.split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
}

/**
 * Ô nhập nhiều email dạng chip: Enter / phẩy / Tab / rời ô biến chữ thành chip, dán cả danh sách được, Backspace ở ô
 * trống xoá chip cuối. Gõ tên thì gợi ý người trong tổ chức (cùng nguồn với chia sẻ), nhưng gõ email ngoài là chính.
 * Ô gõ bên trong là `<input>` thô — ngoại lệ có chủ đích của quy ước Input (CLAUDE.md): nằm trong một dòng của khung soạn
 * thư (`ComposeRow`), khung đó mang viền.
 */
function RecipientField({ id, value, onChange, text, onText, placeholder, autoFocus }: {
  id: string
  value: string[]
  onChange: (v: string[]) => void
  text: string
  onText: (v: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  const { t } = useTranslation('documents')
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const q = useDebounce(text.trim(), 250)
  // Gợi ý chỉ khi gõ chữ chưa giống email hoàn chỉnh — gõ xong một địa chỉ ngoài thì không che ô bằng danh sách.
  const lookup = q.length >= 2 && !EMAIL.test(q)
  const targets = useShareTargets(q, lookup)
  const suggestions = useMemo(
    () => (targets.data ?? [])
      .filter(o => o.type === 'USER' && o.detail && EMAIL.test(o.detail) && !value.includes(o.detail.toLowerCase()))
      .slice(0, 6),
    [targets.data, value],
  )
  const open = focused && lookup && suggestions.length > 0

  const commit = (raw: string) => {
    const next = mergeEmails(value, raw)
    if (next.length !== value.length) onChange(next)
    onText('')
    setActive(0)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + suggestions.length) % suggestions.length); return }
      const chosen = suggestions[Math.min(active, suggestions.length - 1)]
      if (e.key === 'Enter' && chosen?.detail) { e.preventDefault(); commit(chosen.detail); return }
    }
    if ((e.key === 'Enter' || e.key === ',' || e.key === ';' || (e.key === 'Tab' && text.trim())) && text.trim()) {
      e.preventDefault()
      commit(text)
      return
    }
    if (e.key === 'Enter') e.preventDefault()
    if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }

  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex min-h-8 w-full cursor-text flex-wrap items-center gap-1"
        >
          {value.map(e => {
            const bad = !EMAIL.test(e)
            return (
              <span key={e} className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                bad ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]'
                  : 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-foreground)]',
              )}>
                <span className="truncate">{e}</span>
                <button type="button" aria-label={t('email.removeRecipient', { email: e })}
                        onClick={ev => { ev.stopPropagation(); onChange(value.filter(x => x !== e)) }}
                        className="rounded-full p-0.5 hover:bg-[var(--color-border)]">
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            )
          })}
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="email"
            autoComplete="off"
            autoFocus={autoFocus}
            value={text}
            onChange={e => { onText(e.target.value); setActive(0) }}
            onKeyDown={onKeyDown}
            onPaste={e => {
              const pasted = e.clipboardData.getData('text')
              if (/[\s,;]/.test(pasted.trim())) { e.preventDefault(); commit(text + ' ' + pasted) }
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); if (text.trim()) commit(text) }}
            placeholder={value.length ? undefined : placeholder}
            className="no-edit-hint h-7 min-w-[160px] flex-1 bg-transparent px-0.5 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1"
                      onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}>
        <ul role="listbox" aria-label={t('email.suggestions')}>
          {suggestions.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={e => { e.preventDefault(); commit(o.detail!) }}
                      className={cn('flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]',
                        i === active && 'bg-[var(--color-muted)]')}>
                <UserRound size={14} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--color-foreground)]">{o.name}</span>
                  <span className="block truncate text-caption">{o.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
