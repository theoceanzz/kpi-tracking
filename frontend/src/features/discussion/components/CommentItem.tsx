import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  ArrowRightLeft, CheckCircle2, SlidersHorizontal, CornerDownRight, FileText, MoreHorizontal, Pencil, Reply, Send, SmilePlus, Trash2,
  Undo2, XCircle,
} from 'lucide-react'
import UserAvatar from '@/components/common/UserAvatar'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import MediaPreviewModal from '@/components/common/MediaPreviewModal'
import LibrarySourceNote from '@/features/documents/components/LibrarySourceNote'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDateTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { discussionApi } from '../api/discussionApi'
import type { DiscussionComment, DiscussionReactionType } from '../types'
import { REACTIONS, timeAgo } from '../utils'
import CommentComposer, { type ComposerSubmit } from './CommentComposer'

/** Tô đậm "@Tên" của những người thực sự được nhắc trong bình luận. */
function CommentBody({ text, mentions }: { text: string; mentions: { fullName: string | null }[] }) {
  const names = mentions.map((m) => m.fullName).filter((n): n is string => !!n).sort((a, b) => b.length - a.length)
  if (!names.length) return <>{text}</>
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'))
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('@') && names.includes(p.slice(1))
          ? <span key={i} className="font-medium text-[var(--color-primary)]">{p}</span>
          : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  )
}

interface Handlers {
  onReply: (c: DiscussionComment) => void
  onEdit: (c: DiscussionComment, v: ComposerSubmit) => Promise<unknown>
  onDelete: (c: DiscussionComment) => void
  onReact: (c: DiscussionComment, r: DiscussionReactionType) => void
}

interface ItemProps extends Handlers {
  comment: DiscussionComment
  isReply?: boolean
  highlighted?: string | null
  canComment: boolean
}

/** Một bình luận người dùng (gốc hoặc trả lời). */
export function UserComment({ comment: c, isReply, highlighted, canComment, onReply, onEdit, onDelete, onReact }: ItemProps) {
  const { t } = useTranslation('discussion')
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string; type: string | null } | null>(null)

  if (c.deleted) {
    return (
      <div id={`comment-${c.id}`} className="py-2 pl-11 text-sm italic text-[var(--color-subtle-foreground)]">
        {t('item.deleted')}
      </div>
    )
  }
  const images = c.attachments.filter((a) => a.image)
  const others = c.attachments.filter((a) => !a.image)

  return (
    <div
      id={`comment-${c.id}`}
      className={cn('group flex gap-3 rounded-card px-2 py-2 transition-colors', highlighted === c.id && 'bg-[var(--color-primary-soft)]')}
    >
      <UserAvatar
        fullName={c.author?.fullName}
        avatarUrl={c.author?.avatarUrl}
        className={cn('rounded-full text-xs', isReply ? 'h-7 w-7' : 'h-9 w-9')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">{c.author?.fullName}</span>
          {(c.author?.title || c.author?.unitName) && (
            <span className="text-xs text-[var(--color-subtle-foreground)]">
              {[c.author?.title, c.author?.unitName].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className="text-xs text-[var(--color-subtle-foreground)]" title={formatDateTime(c.createdAt)}>
            {timeAgo(c.createdAt)}
          </span>
          {c.editedAt && <span className="text-xs text-[var(--color-subtle-foreground)]">{t('item.edited')}</span>}
        </div>

        {editing ? (
          <div className="mt-1">
            <CommentComposer
              targetType={c.targetType}
              targetId={c.targetId}
              draftKey={`edit:${c.id}`}
              initialText={c.body ?? ''}
              initialMentions={c.mentions}
              allowFiles={false}
              compact
              autoFocus
              onSubmit={async (v) => {
                await onEdit(c, v)
                setEditing(false)
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          c.body && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--color-foreground)]">
              <CommentBody text={c.body} mentions={c.mentions} />
            </p>
          )
        )}

        {images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((a) => (
              <div key={a.id} className="flex max-w-[220px] flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setPreview({ url: a.fileUrl, name: a.fileName, type: a.contentType })}
                  className="w-fit overflow-hidden rounded-md border border-[var(--color-border)]"
                >
                  <img src={a.fileUrl} alt={a.fileName} className="h-28 max-w-[220px] object-cover" loading="lazy" />
                </button>
                <LibrarySourceNote source={a} />
              </div>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {others.map((a) => (
              <div key={a.id} className="flex min-w-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setPreview({ url: a.fileUrl, name: a.fileName, type: a.contentType })}
                  className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1 text-xs text-[var(--color-foreground)] hover:border-[var(--color-border-strong)]"
                >
                  <FileText size={14} /> {a.fileName}
                </button>
                <LibrarySourceNote source={a} className="pl-0.5" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {c.reactions.map((r) => (
            <button
              key={r.type}
              type="button"
              disabled={!canComment}
              title={r.userNames.join(', ')}
              onClick={() => onReact(c, r.type)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                r.mine
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
              )}
            >
              {REACTIONS.find((x) => x.type === r.type)?.emoji} {r.count}
            </button>
          ))}
          {canComment && (
            <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label={t('item.react')} className="rounded p-1 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)]">
                    <SmilePlus size={14} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1" align="start">
                  <div className="flex gap-1">
                    {REACTIONS.map((r) => (
                      <button
                        key={r.type}
                        type="button"
                        title={t(`reaction.${r.type}`)}
                        onClick={() => onReact(c, r.type)}
                        className="rounded p-1.5 text-lg hover:bg-[var(--color-muted)]"
                      >
                        {r.emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {!isReply && (
                <button type="button" onClick={() => onReply(c)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)]">
                  <Reply size={13} /> {t('item.reply')}
                </button>
              )}
              {(c.canEdit || c.canDelete) && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label={t('item.more')} className="rounded p-1 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)]">
                      <MoreHorizontal size={14} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 p-1" align="start">
                    {c.canEdit && (
                      <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-muted)]">
                        <Pencil size={14} /> {t('item.edit')}
                      </button>
                    )}
                    {c.canDelete && (
                      <button type="button" onClick={() => setConfirm(true)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--color-error)] hover:bg-[var(--color-muted)]">
                        <Trash2 size={14} /> {t('item.delete')}
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          onDelete(c)
        }}
        title={t('item.deleteTitle')}
        description={c.replyCount > 0 ? t('item.deleteWithReplies') : t('item.deleteDescription')}
        confirmLabel={t('item.delete')}
      />
      {preview && (
        <MediaPreviewModal isOpen url={preview.url} fileName={preview.name} contentType={preview.type ?? undefined} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}

const SYSTEM_ICON: Record<string, { icon: typeof Send; className: string }> = {
  SUBMITTED: { icon: Send, className: 'text-[var(--color-info)]' },
  APPROVED_FORWARD: { icon: CheckCircle2, className: 'text-[var(--color-info)]' },
  APPROVED_FINAL: { icon: CheckCircle2, className: 'text-[var(--color-success)]' },
  SELF_APPROVED_TOP: { icon: CheckCircle2, className: 'text-[var(--color-success)]' },
  REJECTED: { icon: XCircle, className: 'text-[var(--color-error)]' },
  REVERTED: { icon: Undo2, className: 'text-[var(--color-warning)]' },
  REPLACED_BY: { icon: ArrowRightLeft, className: 'text-[var(--color-warning)]' },
  REPLACES: { icon: ArrowRightLeft, className: 'text-[var(--color-info)]' },
  // Chuỗi duyệt yêu cầu điều chỉnh — biểu tượng riêng để không lẫn với duyệt / từ chối chính KPI.
  ADJ_SUBMITTED: { icon: SlidersHorizontal, className: 'text-[var(--color-info)]' },
  ADJ_APPROVED_FORWARD: { icon: SlidersHorizontal, className: 'text-[var(--color-info)]' },
  ADJ_APPROVED_FINAL: { icon: SlidersHorizontal, className: 'text-[var(--color-success)]' },
  ADJ_REJECTED: { icon: SlidersHorizontal, className: 'text-[var(--color-warning)]' },
}

/** Dòng hoạt động hệ thống (duyệt, từ chối, thay thế…) — khác kiểu hẳn với bình luận người dùng. */
export function SystemLine({ comment: c, highlighted }: { comment: DiscussionComment; highlighted?: string | null }) {
  const { t } = useTranslation('discussion')
  const action = String(c.systemMeta?.action ?? '')
  const linked = c.systemMeta?.linkedKpiId as string | undefined
  const cfg = SYSTEM_ICON[action] ?? { icon: CheckCircle2, className: 'text-[var(--color-subtle-foreground)]' }
  const Icon = cfg.icon
  return (
    <div
      id={`comment-${c.id}`}
      className={cn(
        'mx-auto my-1 flex max-w-[90%] items-start gap-2 rounded-full px-3 py-1 text-xs text-[var(--color-muted-foreground)]',
        action === 'REJECTED' ? 'bg-[var(--color-error-bg)]' : 'bg-[var(--color-muted)]',
        highlighted === c.id && 'ring-2 ring-[var(--color-primary)]',
      )}
    >
      <Icon size={14} className={cn('mt-px shrink-0', cfg.className)} />
      <span className="min-w-0">
        {c.systemText}
        {linked && (
          <>
            {' '}
            <Link to={`/kpi/${linked}?tab=discussion`} className="font-medium text-[var(--color-primary)] hover:underline">
              {t('system.openLinked')}
            </Link>
          </>
        )}
        <span className="ml-2 text-[var(--color-subtle-foreground)]" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
      </span>
    </div>
  )
}

/** Bình luận gốc + các trả lời (một cấp) + ô trả lời. */
export function CommentThread({
  comment, highlighted, canComment, replyingTo, setReplyingTo, onReplySubmit, submitting, ...handlers
}: Handlers & {
  comment: DiscussionComment
  highlighted?: string | null
  canComment: boolean
  replyingTo: string | null
  setReplyingTo: (id: string | null) => void
  onReplySubmit: (parent: DiscussionComment, v: ComposerSubmit) => Promise<unknown>
  submitting: boolean
}) {
  const { t } = useTranslation('discussion')
  const [older, setOlder] = useState<DiscussionComment[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const inline = comment.replies ?? []
  const shown = [...older.filter((o) => !inline.some((i) => i.id === o.id)), ...inline]
  const hidden = Math.max(0, comment.replyCount - shown.length)

  const loadOlder = async () => {
    setLoadingOlder(true)
    try {
      const oldest = shown[0]
      const page = await discussionApi.replies(comment.id, cursor ?? (oldest ? `${oldest.createdAt}_${oldest.id}` : null), 20)
      setOlder((cur) => [...[...page.content].reverse(), ...cur])
      setCursor(page.nextCursor)
    } finally {
      setLoadingOlder(false)
    }
  }

  if (comment.kind === 'SYSTEM') {
    return (
      <div>
        <SystemLine comment={comment} highlighted={highlighted} />
        {shown.length > 0 && (
          <div className="ml-8 border-l border-[var(--color-border)] pl-3">
            {shown.map((r) => (
              <UserComment key={r.id} comment={r} isReply highlighted={highlighted} canComment={canComment} {...handlers} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <UserComment comment={comment} highlighted={highlighted} canComment={canComment} {...handlers} />
      {(shown.length > 0 || replyingTo === comment.id) && (
        <div className="ml-11 border-l border-[var(--color-border)] pl-3">
          {hidden > 0 && (
            <button
              type="button"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
              className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
            >
              <CornerDownRight size={12} /> {t('thread.moreReplies', { count: hidden })}
            </button>
          )}
          {shown.map((r) => (
            <UserComment key={r.id} comment={r} isReply highlighted={highlighted} canComment={canComment} {...handlers} />
          ))}
          {replyingTo === comment.id && canComment && (
            <div className="py-1">
              <CommentComposer
                targetType={comment.targetType}
                targetId={comment.targetId}
                draftKey={`reply:${comment.id}`}
                compact
                autoFocus
                submitting={submitting}
                placeholder={t('thread.replyTo', { name: comment.author?.fullName ?? '' })}
                onSubmit={(v) => onReplySubmit(comment, v)}
                onCancel={() => setReplyingTo(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
