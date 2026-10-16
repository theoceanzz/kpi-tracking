import { useTranslation } from 'react-i18next'
import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  SideMenu, useBlockNoteEditor, useComponentsContext, useExtension, useExtensionState,
} from '@blocknote/react'
import { GripVertical, X } from 'lucide-react'

/**
 * Cột nút bên trái mỗi khối của trang soạn tài liệu: [×] xoá khối · [⋮⋮] kéo thả.
 *
 * Thay cho mặc định của BlockNote ([+] thêm khối · [⋮⋮] bấm ra menu Xoá / Màu sắc):
 * - [+] trùng việc của menu "Chèn" và thanh kiểu đoạn trên thanh công cụ.
 * - Tay kéo mặc định vừa kéo vừa mở menu, nên định kéo thì hay bật menu ra; menu con màu thì cao tới mức bị cắt mép.
 *   Ở đây tay kéo CHỈ để kéo, xoá có nút riêng, màu nằm trên thanh công cụ.
 */
export default function DocSideMenu() {
  return (
    <SideMenu>
      <RemoveButton />
      <DragHandle />
    </SideMenu>
  )
}

function useHoveredBlock() {
  const editor = useBlockNoteEditor()
  return useExtensionState(SideMenuExtension, { editor, selector: state => state?.block })
}

function RemoveButton() {
  const { t } = useTranslation('shared')
  const Components = useComponentsContext()!
  const editor = useBlockNoteEditor()
  const block = useHoveredBlock()
  if (block === undefined) return null
  return (
    <Components.SideMenu.Button
      label={t('EditorToolbar.deleteBlock')}
      className="bn-button kg-side-remove"
      onClick={() => editor.removeBlocks([block])}
      icon={<X size={16} strokeWidth={2.25} aria-hidden="true" />}
    />
  )
}

function DragHandle() {
  const Components = useComponentsContext()!
  const { t } = useTranslation('shared')
  const sideMenu = useExtension(SideMenuExtension)
  const block = useHoveredBlock()
  if (block === undefined) return null
  return (
    <Components.SideMenu.Button
      label={t('EditorToolbar.dragBlock')}
      className="bn-button kg-side-drag"
      draggable
      onDragStart={e => sideMenu.blockDragStart(e, block)}
      onDragEnd={() => sideMenu.blockDragEnd()}
      icon={<GripVertical size={18} aria-hidden="true" />}
    />
  )
}
