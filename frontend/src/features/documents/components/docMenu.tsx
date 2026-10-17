import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bot, BotOff, Copy, Download, ExternalLink, FileSearch, FolderInput, Info, Link2, Mail, MoreHorizontal, PenLine, Pin, PinOff,
  Share2, Star, StarOff, Trash2,
} from 'lucide-react'
import { canPreview } from '@/lib/filePreview'
import { documentFileUrl } from '../api/documentApi'
import { useCopyDocument, useToggleDocumentAi, useToggleFavorite, useTogglePin } from '../hooks/useDocuments'
import type { DocumentFolder, KbDocument } from '../types'
import { documentPath, downloadUrl, editorPath, onlineFormat } from '../utils'
import { useDocumentActions } from './DocumentActions'
import type { RowMenuItem } from '@/components/common/RowMenu'

/** "Của tôi › Hợp đồng", "Phòng Kinh doanh", "Công ty", "Cá nhân của Nguyễn A" — cột Vị trí kiểu Lark. */
export function locationLabel(d: KbDocument, t: TFunction<'documents'>): string {
  const base = d.scope === 'PERSONAL'
    ? (d.sharedWithMe ? t('location.personalOf', { name: d.createdByName ?? '—' }) : t('location.mine'))
    : d.scope === 'UNIT' ? (d.orgUnitName ?? t('scope.UNIT')) : t('scope.COMPANY')
  return d.folderName ? `${base} › ${d.folderName}` : base
}

/** Sao chép link tuyệt đối của một đường dẫn trong ứng dụng rồi báo bằng toast. */
export function copyAppLink(path: string, done: string) {
  void navigator.clipboard?.writeText(`${window.location.origin}${path}`).then(() => toast.success(done))
}

/** Đường dẫn mở một thư mục (Drive của phạm vi, đúng thư mục). */
export function folderPath(f: DocumentFolder): string {
  const tab = f.scope === 'PERSONAL' ? 'mine' : f.scope === 'UNIT' ? 'unit' : 'company'
  return `/documents?tab=${tab}${f.orgUnitId ? `&unit=${f.orgUnitId}` : ''}&folder=${f.id}`
}

/**
 * Các mục menu ⋯ của một tài liệu theo đúng thứ tự Lark (docs/DOCUMENTS_LARK_REFERENCE.md §3): Mở trong tab mới — Chia sẻ,
 * Sao chép link (+ Gửi qua email của KeyGo) — Tạo bản sao, Di chuyển đến, Ghim, Yêu thích — Đổi tên — Xoá. Mục riêng của
 * KeyGo (xem trước, tải về, chi tiết, K.AI) gom vào menu con "Khác ›" trước "Xoá". Dùng chung cho bảng, lưới, thanh ghim.
 */
export function useDocMenu(): (d: KbDocument) => RowMenuItem[] {
  const { t } = useTranslation('documents')
  const actions = useDocumentActions()
  const favorite = useToggleFavorite()
  const pin = useTogglePin()
  const copy = useCopyDocument()
  const ai = useToggleDocumentAi()
  const navigate = useNavigate()
  return d => {
    const online = onlineFormat(d)
    const items: RowMenuItem[] = [
      { key: 'newTab', icon: <ExternalLink />, label: t('actions.openNewTab'), onSelect: () => window.open(documentPath(d), '_blank', 'noopener') },
    ]
    if (d.canEdit && !d.legacy) {
      items.push({ key: 'share', separated: true, icon: <Share2 />, label: t('actions.share'), onSelect: () => actions.open(d, 'share') })
    }
    items.push({ key: 'copyLink', separated: !(d.canEdit && !d.legacy), icon: <Link2 />, label: t('actions.copyLink'),
      onSelect: () => copyAppLink(documentPath(d), t('toast.linkCopied')) })
    if (d.canEdit && !d.legacy) items.push({ key: 'email', icon: <Mail />, label: t('actions.email'), onSelect: () => actions.email(d) })

    if (!d.legacy) {
      const group: RowMenuItem[] = []
      if (online === 'blocks' || online === 'sheet') {
        group.push({ key: 'copy', icon: <Copy />, label: t('actions.makeCopy'),
          onSelect: () => copy.mutate(d, { onSuccess: created => navigate(editorPath(created.id)) }) })
      }
      if (d.canEdit) group.push({ key: 'move', icon: <FolderInput />, label: t('actions.moveTo'), onSelect: () => actions.move(d) })
      group.push({
        key: 'pin', icon: d.pinned ? <PinOff /> : <Pin />, label: d.pinned ? t('actions.unpin') : t('actions.pin'),
        onSelect: () => pin.mutate({ id: d.id, value: !d.pinned }),
      })
      group.push({
        key: 'favorite', icon: d.favorite ? <StarOff /> : <Star />, label: d.favorite ? t('actions.unfavorite') : t('actions.favorite'),
        onSelect: () => favorite.mutate({ id: d.id, value: !d.favorite }),
      })
      group[0]!.separated = true
      items.push(...group)
    }

    if (d.canEdit && !d.legacy) items.push({ key: 'rename', separated: true, icon: <PenLine />, label: t('actions.rename'), onSelect: () => actions.rename(d) })

    // Riêng KeyGo: xem trước / tải tệp gốc, chi tiết (phiên bản, rà soát…), cho K.AI đọc.
    const extra: RowMenuItem[] = []
    if (!d.legacy && !online && canPreview(d.fileName, d.contentType)) {
      extra.push({ key: 'preview', icon: <FileSearch />, label: t('actions.preview'), onSelect: () => actions.preview(d) })
    }
    // Tài liệu / bảng tính trực tuyến là JSON nội bộ — tải về (Markdown, HTML, Excel, CSV) ngay trong trình soạn.
    if (!d.legacy && online !== 'blocks' && online !== 'sheet') {
      extra.push({ key: 'download', icon: <Download />, label: t('actions.download'), onSelect: () => downloadUrl(documentFileUrl(d.id)) })
    }
    if (online) extra.push({ key: 'details', icon: <Info />, label: t('actions.details'), onSelect: () => actions.open(d, 'info') })
    if (d.canEdit && !d.legacy) {
      extra.push({
        key: 'ai', icon: d.aiEnabled ? <BotOff /> : <Bot />, label: d.aiEnabled ? t('actions.aiOff') : t('actions.aiOn'),
        onSelect: () => ai.mutate({ id: d.id, aiEnabled: !d.aiEnabled }),
      })
    }
    // Lark không có các mục này ⇒ gom vào một menu con "Khác ›" cho menu chính ngắn, không phải cuộn.
    if (extra.length) items.push({ key: 'more', separated: true, icon: <MoreHorizontal />, label: t('actions.moreSub'), children: extra })

    if (d.canEdit) {
      items.push({ key: 'delete', separated: true, icon: <Trash2 />, label: t('actions.delete'), danger: true, onSelect: () => actions.remove(d) })
    }
    return items
  }
}
