import { createElement } from 'react'
import { BlockNoteSchema, defaultStyleSpecs } from '@blocknote/core'
import { createReactStyleSpec } from '@blocknote/react'
import { FONT_FAMILIES, FONT_SIZE_VALUE } from '@/components/common/editor-toolbar/formatting'

const FAMILY_VALUES = new Set(FONT_FAMILIES.map(f => f.value))

/** Cỡ chữ ("18px"). Giá trị lạ (dán từ nơi khác, sửa tay JSON) thì bỏ qua, chữ giữ cỡ mặc định. */
const fontSize = createReactStyleSpec(
  { type: 'fontSize', propSchema: 'string' },
  {
    render: ({ value, contentRef }) =>
      createElement('span', { ref: contentRef, style: value && FONT_SIZE_VALUE.test(value) ? { fontSize: value } : undefined }),
  },
)

/** Phông chữ — chỉ nhận phông trong `FONT_FAMILIES`. */
const fontFamily = createReactStyleSpec(
  { type: 'fontFamily', propSchema: 'string' },
  {
    render: ({ value, contentRef }) =>
      createElement('span', { ref: contentRef, style: value && FAMILY_VALUES.has(value) ? { fontFamily: value } : undefined }),
  },
)

/**
 * Schema chung của tài liệu trực tuyến và thư: khối mặc định của BlockNote + hai kiểu chữ thêm (phông, cỡ). Tài liệu cũ
 * không có hai kiểu này vẫn mở y nguyên. Mọi trình soạn / trình xem `.kgdoc` phải dùng schema này, nếu không chữ đã đổi
 * phông / cỡ sẽ mất định dạng khi mở.
 */
export const docSchema = BlockNoteSchema.create({
  styleSpecs: { ...defaultStyleSpecs, fontSize, fontFamily },
})
