import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Link2, List, ListOrdered } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  /** JSON của tiptap (cột description_doc); null ⇒ dựng từ bản chữ thuần cũ. */
  doc: string | null
  plain: string | null
  editable: boolean
  /** Tự lưu: gọi sau khi người dùng ngừng gõ {@link SAVE_DELAY_MS}. */
  onSave: (doc: string, plain: string) => void
}

const SAVE_DELAY_MS = 1500

function parseDoc(doc: string | null, plain: string | null) {
  if (doc) {
    try {
      return JSON.parse(doc)
    } catch {
      // rơi xuống bản chữ thuần
    }
  }
  if (!plain) return ''
  return {
    type: 'doc',
    content: plain.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })),
  }
}

/**
 * Mô tả có định dạng (đậm, nghiêng, danh sách, link), tự lưu. Lưu JSON của tiptap — không lưu HTML nên không có XSS
 * khi hiển thị; kèm bản chữ thuần để tìm kiếm và trích vào thông báo.
 */
/** Chèn / sửa / bỏ link: popover có ô nhập (đồng bộ giao diện, thay cho hộp nhập của trình duyệt). */
function LinkPopover({ active, current, className, onApply }: {
  active: boolean; current: string; className: string; onApply: (url: string) => void
}) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const apply = () => { onApply(url.trim()); setOpen(false) }
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setUrl(current) }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t('detail.link')} className={className}><Link2 size={14} /></button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 p-3" align="start">
        <Input size="sm" autoFocus value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply() } }} />
        <div className="flex justify-end gap-2">
          {active && <Button size="sm" variant="ghost" onClick={() => { onApply(''); setOpen(false) }}>{t('detail.removeLink')}</Button>}
          <Button size="sm" disabled={!url.trim()} onClick={apply}>{t('detail.applyLink')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function TaskDescriptionEditor({ doc, plain, editable, onSave }: Props) {
  const { t } = useTranslation('tasks')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<string | null>(doc)
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, codeBlock: false, link: { openOnClick: true, autolink: true } })],
    content: parseDoc(doc, plain),
    editable,
    editorProps: {
      attributes: {
        class: 'prose-sm min-h-[80px] max-w-none px-3 py-2 text-sm text-[var(--color-foreground)] outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[var(--color-primary)] [&_a]:underline',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const json = JSON.stringify(ed.getJSON())
        if (json === lastSaved.current) return
        lastSaved.current = json
        onSaveRef.current(json, ed.getText({ blockSeparator: '\n' }))
      }, SAVE_DELAY_MS)
    },
  })

  // Bản trên máy chủ đổi (người khác sửa / tải lại) và mình không đang gõ ⇒ nạp lại.
  useEffect(() => {
    if (!editor || editor.isFocused) return
    if (doc !== lastSaved.current) {
      lastSaved.current = doc
      editor.commands.setContent(parseDoc(doc, plain), { emitUpdate: false })
    }
  }, [doc, plain, editor])

  useEffect(() => { editor?.setEditable(editable) }, [editor, editable])

  // Rời bảng chi tiết khi còn thay đổi chưa lưu ⇒ lưu ngay.
  useEffect(() => () => {
    if (timer.current && editor) {
      clearTimeout(timer.current)
      const json = JSON.stringify(editor.getJSON())
      if (json !== lastSaved.current) onSaveRef.current(json, editor.getText({ blockSeparator: '\n' }))
    }
  }, [editor])

  if (!editor) return null
  const btn = (active: boolean) => cn('rounded p-1 hover:bg-[var(--color-muted)]', active && 'bg-[var(--color-muted)] text-[var(--color-primary)]')

  return (
    <div className="rounded-card border border-[var(--color-border)] focus-within:border-[var(--color-border-strong)]">
      {editable && (
        <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] px-1.5 py-1 text-[var(--color-muted-foreground)]">
          <button type="button" aria-label={t('detail.bold')} className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></button>
          <button type="button" aria-label={t('detail.italic')} className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></button>
          <button type="button" aria-label={t('detail.bulletList')} className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></button>
          <button type="button" aria-label={t('detail.orderedList')} className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></button>
          <LinkPopover
            active={editor.isActive('link')}
            current={(editor.getAttributes('link').href as string | undefined) ?? ''}
            className={btn(editor.isActive('link'))}
            onApply={(url) => {
              if (!url) editor.chain().focus().extendMarkRange('link').unsetLink().run()
              else editor.chain().focus().extendMarkRange('link').setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run()
            }}
          />
        </div>
      )}
      <EditorContent editor={editor} placeholder={t('detail.descriptionPlaceholder')} />
    </div>
  )
}
