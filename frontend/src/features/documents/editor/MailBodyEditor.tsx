import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartialBlock } from '@blocknote/core'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import './blocknote.css'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/lib/utils'
import { blockNoteDictionary, parseBlocks, plainText } from './blocks'
import DocToolbar from './DocToolbar'
import { docSchema } from './schema'
import { uploadEditorImage } from './uploadImage'

interface Props {
  /** Mảng khối BlockNote (chuỗi JSON) — gửi nguyên lên máy chủ, máy chủ tự dựng HTML theo danh sách trắng. */
  value: string | null
  onChange: (json: string, text: string) => void
  placeholder?: string
  className?: string
  'data-tour'?: string
}

/**
 * Thân thư kiểu Gmail / Outlook, CÙNG trình soạn (BlockNote) và CÙNG thanh công cụ với trang soạn tài liệu trực tuyến.
 * Có chèn ảnh (nút Ảnh, dán, kéo thả) và icon; bỏ những thứ không hợp với thư: menu Chèn (bảng, đường kẻ…), khối mã,
 * tay kéo khối và menu "/". Trả JSON, không trả HTML — phía máy chủ
 * (`MailDocRenderer`) dựng HTML nên không có đường chèn mã vào thư.
 */
export default function MailBodyEditor({ value, onChange, placeholder, className, 'data-tour': dataTour }: Props) {
  const { i18n } = useTranslation('documents')
  const isDark = useThemeStore(s => s.isDark)
  const dictionary = useMemo(() => {
    const base = blockNoteDictionary(i18n.language)
    return placeholder ? { ...base, placeholders: { ...base.placeholders, default: placeholder, emptyDocument: placeholder } } : base
  }, [i18n.language, placeholder])
  const lastEmitted = useRef<string | null>(value)
  const editor = useCreateBlockNote({
    schema: docSchema, initialContent: parseBlocks(value ?? ''), dictionary,
    // Dán / kéo thả ảnh vào thư là tự tải lên kho công khai — người nhận thư mới xem được ảnh.
    uploadFile: uploadEditorImage,
  }, [])

  // Nội dung đổi từ ngoài (khôi phục nháp sau khi đã mở) ⇒ nạp lại; thay đổi do chính mình gõ thì bỏ qua.
  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    const blocks = parseBlocks(value ?? '') ?? [{ type: 'paragraph' }]
    editor.replaceBlocks(editor.document, blocks as PartialBlock[])
  }, [editor, value])

  const emit = () => {
    const json = JSON.stringify(editor.document)
    lastEmitted.current = json
    onChange(json, plainText(editor.document).trim())
  }

  return (
    <div data-tour={dataTour} className={cn('flex flex-col', className)}>
      <DocToolbar editor={editor} className="rounded-none border-b border-[var(--color-border)]"
                  features={{ rich: true, insert: false, compact: true }} />
      <div className="max-h-[45vh] min-h-[220px] overflow-y-auto py-2">
        <BlockNoteView editor={editor} theme={isDark ? 'dark' : 'light'} onChange={emit}
                       formattingToolbar={false} sideMenu={false} slashMenu={false}
                       className="kg-doc-editor kg-mail-editor min-h-[200px]" />
      </div>
    </div>
  )
}
