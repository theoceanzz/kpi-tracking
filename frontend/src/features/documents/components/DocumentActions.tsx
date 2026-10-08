import { createContext, useContext } from 'react'
import type { DocumentFolder, KbDocument } from '../types'

/** Tab của drawer chi tiết tài liệu. */
export type DrawerTab = 'info' | 'share' | 'versions' | 'ai'

/**
 * Các thao tác cần hộp thoại / drawer cấp trang. Trang Tài liệu cung cấp một lần; danh sách, lưới, thanh ghim
 * gọi qua context thay vì truyền callback qua nhiều tầng.
 */
export interface DocumentActions {
  open: (doc: KbDocument, tab?: DrawerTab) => void
  /** Xem trước tệp ngay trong trình duyệt (§16.1). */
  preview: (doc: KbDocument) => void
  move: (doc: KbDocument) => void
  remove: (doc: KbDocument) => void
  openFolder: (folder: DocumentFolder) => void
  renameFolder: (folder: DocumentFolder) => void
  deleteFolder: (folder: DocumentFolder) => void
}

const Ctx = createContext<DocumentActions | null>(null)

export const DocumentActionsProvider = Ctx.Provider

export function useDocumentActions(): DocumentActions {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDocumentActions must be used inside DocumentActionsProvider')
  return v
}
