export type DiscussionTargetType = 'KPI' | 'TASK'
export type DiscussionReactionType = 'LIKE' | 'AGREE' | 'LOVE' | 'CHECK' | 'QUESTION'

export interface DiscussionAuthor {
  id: string
  fullName: string | null
  avatarUrl: string | null
  title: string | null
  unitName: string | null
}

export interface DiscussionAttachment {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  contentType: string | null
  image: boolean
  /** Sao từ thư viện tài liệu — nhãn "Từ thư viện: …". */
  fromLibrary?: boolean
  sourceDocumentTitle?: string | null
  /** Chỉ có khi tài liệu gốc còn và mình xem được — link "Mở bản mới nhất". */
  sourceDocumentId?: string | null
}

export interface DiscussionReaction {
  type: DiscussionReactionType
  count: number
  mine: boolean
  userNames: string[]
}

export interface DiscussionComment {
  id: string
  targetType: DiscussionTargetType
  targetId: string
  parentId: string | null
  kind: 'USER' | 'SYSTEM'
  body: string | null
  /** Chữ của dòng hệ thống, đã dịch ở backend. */
  systemText: string | null
  systemMeta: Record<string, unknown> | null
  author: DiscussionAuthor | null
  createdAt: string
  editedAt: string | null
  deleted: boolean
  replyCount: number
  replies?: DiscussionComment[] | null
  attachments: DiscussionAttachment[]
  reactions: DiscussionReaction[]
  mentions: { id: string; fullName: string | null }[]
  canEdit: boolean
  canDelete: boolean
}

/** Trang bình luận gốc, MỚI NHẤT TRƯỚC. `nextCursor` lấy trang cũ hơn. */
export interface DiscussionPage {
  content: DiscussionComment[]
  nextCursor: string | null
  hasMore: boolean
  canComment: boolean
  canModerate: boolean
  targetTitle: string | null
  kpiId: string | null
}

export interface MentionCandidate {
  id: string
  fullName: string
  email: string | null
  avatarUrl: string | null
  title: string | null
  unitName: string | null
}

export interface DiscussionLocation {
  commentId: string
  rootId: string
  targetType: DiscussionTargetType
  targetId: string
  kpiId: string | null
}

/** Gói WebSocket trên /topic/discussion.{TYPE}.{id} — chỉ mang id, nội dung lấy lại qua REST. */
export interface DiscussionChange {
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'REACTED'
  targetType: DiscussionTargetType
  targetId: string
  commentId: string
  parentId: string | null
}
