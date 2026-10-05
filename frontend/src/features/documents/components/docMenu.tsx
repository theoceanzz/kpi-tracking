import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from 'react-router-dom'
import { Download, Eye, FilePen, FileSearch, FolderInput, Info, Pin, PinOff, Share2, Star, StarOff, Trash2 } from 'lucide-react'
import { canPreview } from '@/lib/filePreview'
import { documentFileUrl } from '../api/documentApi'
import { useToggleFavorite, useTogglePin } from '../hooks/useDocuments'
import type { KbDocument } from '../types'
import { downloadUrl, editorPath, onlineFormat } from '../utils'
import { useDocumentActions } from './DocumentActions'
import type { RowMenuItem } from './RowMenu'

/** "Của tôi › Hợp đồng", "Phòng Kinh doanh", "Công ty", "Cá nhân của Nguyễn A" — cột Vị trí kiểu Lark. */
export function locationLabel(d: KbDocument, t: TFunction<'documents'>): string {
  const base = d.scope === 'PERSONAL'
    ? (d.sharedWithMe ? t('location.personalOf', { name: d.createdByName ?? '—' }) : t('location.mine'))
    : d.scope === 'UNIT' ? (d.orgUnitName ?? t('scope.UNIT')) : t('scope.COMPANY')
  return d.folderName ? `${base} › ${d.folderName}` : base
}

/** Các mục menu ⋯ của một tài liệu — dùng chung cho bảng, lưới, thanh ghim. */
export function useDocMenu(): (d: KbDocument) => RowMenuItem[] {
  const { t } = useTranslation('documents')
  const actions = useDocumentActions()
  const favorite = useToggleFavorite()
  const pin = useTogglePin()
  const navigate = useNavigate()
  return d => {
    const online = onlineFormat(d)
    const items: RowMenuItem[] = online
      ? [
          {
            key: 'open', icon: d.canEditContent ? <FilePen /> : <Eye />,
            label: d.canEditContent ? t('actions.editOnline') : t('actions.readOnline'),
            onSelect: () => navigate(editorPath(d.id)),
          },
          { key: 'details', icon: <Info />, label: t('actions.details'), onSelect: () => actions.open(d, 'info') },
        ]
      : [{ key: 'open', icon: <Eye />, label: t('actions.open'), onSelect: () => actions.open(d) }]
    if (!d.legacy && !online && canPreview(d.fileName, d.contentType)) {
      items.push({ key: 'preview', icon: <FileSearch />, label: t('actions.preview'), onSelect: () => actions.preview(d) })
    }
    if (!d.legacy) {
      // Tài liệu / bảng tính trực tuyến là JSON nội bộ — tải về (Markdown, HTML, Excel, CSV) ngay trong trình soạn.
      if (online !== 'blocks' && online !== 'sheet') {
        items.push({ key: 'download', icon: <Download />, label: t('actions.download'), onSelect: () => downloadUrl(documentFileUrl(d.id)) })
      }
      items.push({
        key: 'favorite', separated: true,
        icon: d.favorite ? <StarOff /> : <Star />,
        label: d.favorite ? t('actions.unfavorite') : t('actions.favorite'),
        onSelect: () => favorite.mutate({ id: d.id, value: !d.favorite }),
      })
      items.push({
        key: 'pin',
        icon: d.pinned ? <PinOff /> : <Pin />,
        label: d.pinned ? t('actions.unpin') : t('actions.pin'),
        onSelect: () => pin.mutate({ id: d.id, value: !d.pinned }),
      })
    }
    if (d.canEdit && !d.legacy) {
      items.push({ key: 'share', separated: true, icon: <Share2 />, label: t('actions.share'), onSelect: () => actions.open(d, 'share') })
      items.push({ key: 'move', icon: <FolderInput />, label: t('actions.move'), onSelect: () => actions.move(d) })
    }
    if (d.canEdit) {
      items.push({ key: 'delete', separated: true, icon: <Trash2 />, label: t('actions.delete'), danger: true, onSelect: () => actions.remove(d) })
    }
    return items
  }
}
