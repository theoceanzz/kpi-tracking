import { useEffect } from 'react'
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import TextAlign from '@tiptap/extension-text-align'
import DragHandle from '@tiptap/extension-drag-handle-react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle, AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Braces, GripVertical, Heading2, Heading3,
  Highlighter, Italic, KeyRound, List, ListOrdered, ListTree, Minus, MousePointerClick, Pilcrow, Plus, Redo2, RemoveFormatting,
  Strikethrough, Underline, Undo2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  ColorButton, EmojiButton, ImageButton, LinkButton, Menu, MenuItem, OverflowToolbar, SizeMenu, StyleMenu, Tool,
  type ToolGroup,
} from '@/components/common/editor-toolbar/ToolbarKit'
import { BG_COLORS, DEFAULT_FONT_SIZE, TEXT_COLORS } from '@/components/common/editor-toolbar/formatting'
import { toastUploadError } from '@/lib/upload'
import { emailNodeExtensions } from './emailNodes'
import { emailTemplateApi } from '../api/emailTemplateApi'

type Align = 'left' | 'center' | 'right' | 'justify'
const ALIGN_ICON: Record<Align, LucideIcon> = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }
/** Mẫu email chỉ có tiêu đề mục cấp 2 / 3 (cấp 1 to quá so với khung thư). */
const STYLE_OPTIONS = ['paragraph', 'heading-2', 'heading-3'] as const
type StyleOption = (typeof STYLE_OPTIONS)[number]
const STYLE_ICON: Record<StyleOption, LucideIcon> = { paragraph: Pilcrow, 'heading-2': Heading2, 'heading-3': Heading3 }

/** Mã hex đang lưu trong mẫu → tên màu trong bảng chung (màu cũ ngoài bảng thì không tô ô nào). */
function colorName(palette: Record<string, string>, hex: unknown): string | null {
  if (typeof hex !== 'string') return null
  const h = hex.toLowerCase()
  return Object.entries(palette).find(([, v]) => v.toLowerCase() === h)?.[0] ?? null
}

/**
 * Trình soạn mẫu email: MỘT vùng soạn thảo TipTap chứa cả chữ lẫn các khối đặc thù (nút bấm, ô mã OTP, bảng thông tin,
 * khung nhấn mạnh) dưới dạng node. Mọi thứ nằm chung một dòng nội dung nên kéo thả, sao chép, hoàn tác dùng chung cơ chế
 * của TipTap; `editor.getHTML()` cho ra thẳng HTML thân email nhờ `renderHTML` của từng node.
 *
 * Thanh công cụ là bộ CHUNG `ToolbarKit`, bản GỌN một hàng kiểu Gmail giống ô soạn thư gửi tài liệu (H▾ kiểu đoạn, AA▾ cỡ
 * chữ, không ô phông — ứng dụng thư phần lớn bỏ phông riêng), thêm nút chèn dữ liệu hệ thống và "Chèn khối" của mẫu email. Vẫn giữ TipTap (không chuyển sang BlockNote như tài liệu): mẫu lưu dạng HTML có biến `{{...}}` và khối
 * riêng, đổi trình soạn sẽ làm hỏng mẫu các tổ chức đã chỉnh.
 */
export default function EmailEditor({
  value, onChange, variables,
}: {
  value: string
  onChange: (html: string) => void
  /** Tên biến → mô tả, dùng cho nút chèn dữ liệu và các dropdown trong node. */
  variables: Record<string, string>
}) {
  const { t } = useTranslation('organization')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: t('EmailEditor.enterTheEmailContent') }),
      ...emailNodeExtensions(variables),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'outline-none px-10 py-4 text-sm leading-relaxed min-h-[380px] [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[var(--color-primary)] [&_a]:underline [&_h2]:text-lg [&_h2]:font-medium [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_hr]:my-6 [&_hr]:border-[var(--color-border)] [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:text-[var(--color-subtle-foreground)] [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:pointer-events-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Nội dung đổi từ bên ngoài (đổi template, khôi phục mặc định) thì nạp lại.
  // So với getHTML() trước khi ghi đè, nếu không mỗi lần gõ sẽ bị đặt lại con trỏ.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] transition-colors focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
      {/* Thanh công cụ — dính trên đầu khi cuộn nội dung dài */}
      <div className="sticky top-0 z-20 rounded-t-card border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <EmailToolbar editor={editor} variables={variables} />
      </div>

      {/* Tay cầm kéo của TipTap: hiện ra bên trái khối đang trỏ chuột tới,
          áp dụng cho MỌI loại nội dung (đoạn văn, nút bấm, bảng, khung nhấn mạnh). */}
      <div className="relative">
        <DragHandle editor={editor}>
          <div
            title={t('EmailEditor.dragToMoveTheBlock')}
            className="-ml-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-control text-[var(--color-subtle-foreground)] transition-colors hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] active:cursor-grabbing"
          >
            <GripVertical size={16} aria-hidden="true" />
          </div>
        </DragHandle>

        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function EmailToolbar({ editor, variables }: { editor: Editor; variables: Record<string, string> }) {
  const { t } = useTranslation('organization')
  const { t: ts } = useTranslation('shared')
  const T = (k: string) => ts(`EditorToolbar.${k}`)

  // Đọc trạng thái mỗi khi con trỏ / nội dung đổi để nút đang bật sáng đúng.
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const ts = ed.getAttributes('textStyle')
      const px = typeof ts.fontSize === 'string' ? Number.parseInt(ts.fontSize, 10) : NaN
      const align = (['center', 'right', 'justify'] as Align[]).find(a => ed.isActive({ textAlign: a })) ?? 'left'
      return {
        style: (ed.isActive('heading', { level: 2 }) ? 'heading-2' : ed.isActive('heading', { level: 3 }) ? 'heading-3' : 'paragraph') as StyleOption,
        bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), strike: ed.isActive('strike'),
        bullet: ed.isActive('bulletList'), ordered: ed.isActive('orderedList'),
        align,
        color: colorName(TEXT_COLORS, ts.color),
        highlight: colorName(BG_COLORS, ts.backgroundColor),
        fontSize: Number.isFinite(px) ? px : DEFAULT_FONT_SIZE,
        link: (ed.getAttributes('link').href as string | undefined) ?? '',
        canUndo: ed.can().undo(), canRedo: ed.can().redo(),
      }
    },
  })

  const chain = () => editor.chain().focus()
  const setStyle = (v: StyleOption) => {
    if (v === 'paragraph') chain().setParagraph().run()
    else chain().setHeading({ level: v === 'heading-2' ? 2 : 3 }).run()
  }
  const insertImage = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    try {
      const url = await emailTemplateApi.uploadImage(file)
      chain().insertContent({ type: 'emailImage', attrs: { src: url, alt: '', width: 300, align: 'center' } }).run()
    } catch (err) {
      toastUploadError(err, () => void insertImage([file]), t('EmailEditor.imageUploadFailed'))
    }
  }

  const BLOCKS: { label: string; hint: string; icon: LucideIcon; run: () => void }[] = [
    { label: t('EmailEditor.button'), hint: t('EmailEditor.aButtonLinkingToAUrl'), icon: MousePointerClick,
      run: () => chain().insertContent({ type: 'emailButton' }).run() },
    { label: t('EmailEditor.highlightedCodeBox'), hint: t('EmailEditor.aLargeBoxShowingTheOtp'), icon: KeyRound,
      run: () => chain().insertContent({ type: 'emailCode' }).run() },
    { label: t('EmailEditor.infoTable'), hint: t('EmailEditor.labelValueRows'), icon: ListTree,
      run: () => chain().insertContent({ type: 'emailInfo', attrs: { rows: [{ label: '', value: '' }] } }).run() },
    { label: t('EmailEditor.calloutBox'), hint: t('EmailEditor.aColoredBoxYouCanType'), icon: AlertTriangle,
      run: () => chain().insertContent({ type: 'emailAlert', attrs: { variant: 'warning' }, content: [{ type: 'paragraph' }] }).run() },
    { label: t('EmailEditor.horizontalLine'), hint: t('EmailEditor.separatesTwoSections'), icon: Minus,
      run: () => chain().setHorizontalRule().run() },
  ]

  const AlignIcon = ALIGN_ICON[state.align]
  const groups = ([
    {
      key: 'history',
      node: (
        <>
          <Tool icon={Undo2} label={T('undo')} shortcut="Ctrl+Z" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
          <Tool icon={Redo2} label={T('redo')} shortcut="Ctrl+Y" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
        </>
      ),
    },
    {
      key: 'style',
      node: (
        <>
          <StyleMenu options={STYLE_OPTIONS.map(o => ({ value: o, label: T(`styles.${o}`), icon: STYLE_ICON[o] }))}
                     current={state.style} onPick={setStyle} />
          <SizeMenu current={state.fontSize} onPick={px => (px ? chain().setFontSize(`${px}px`).run() : chain().unsetFontSize().run())} />
        </>
      ),
    },
    {
      key: 'marks',
      node: (
        <>
          <Tool icon={Bold} label={T('bold')} shortcut="Ctrl+B" active={state.bold} onClick={() => chain().toggleBold().run()} />
          <Tool icon={Italic} label={T('italic')} shortcut="Ctrl+I" active={state.italic} onClick={() => chain().toggleItalic().run()} />
          <Tool icon={Underline} label={T('underline')} shortcut="Ctrl+U" active={state.underline} onClick={() => chain().toggleUnderline().run()} />
          <Tool icon={Strikethrough} label={T('strike')} shortcut="Ctrl+Shift+S" active={state.strike} onClick={() => chain().toggleStrike().run()} />
          <ColorButton icon={Baseline} label={T('textColor')} palette={TEXT_COLORS} current={state.color} swatch="text"
                       onPick={n => (n ? chain().setColor(TEXT_COLORS[n]!).run() : chain().unsetColor().run())} />
          <ColorButton icon={Highlighter} label={T('highlight')} palette={BG_COLORS} current={state.highlight} swatch="background"
                       onPick={n => (n ? chain().setBackgroundColor(BG_COLORS[n]!).run() : chain().unsetBackgroundColor().run())} />
          <Tool icon={RemoveFormatting} label={T('clear')} onClick={() => chain().unsetAllMarks().run()} />
        </>
      ),
    },
    {
      key: 'insert',
      node: (
        <>
          <LinkButton current={state.link} onApply={url => (url
            ? chain().extendMarkRange('link').setLink({ href: /^(https?:|mailto:)/i.test(url) ? url : `https://${url}` }).run()
            : chain().extendMarkRange('link').unsetLink().run())} />
          <ImageButton accept="image/png,image/jpeg,image/gif,image/webp" onFiles={insertImage} />
          <EmojiButton onPick={emoji => chain().insertContent(emoji).run()} />
          {Object.keys(variables).length > 0 && (
            <Menu icon={Braces} label={t('EmailEditor.insertSystemData')} className="custom-scrollbar max-h-72 w-72 overflow-y-auto">
              {close => Object.entries(variables).map(([name, desc]) => (
                <MenuItem key={name} icon={Braces} label={desc} hint={`{{${name}}}`}
                          onClick={() => { close(); chain().insertContent({ type: 'emailVariable', attrs: { name } }).run() }} />
              ))}
            </Menu>
          )}
          <Menu icon={Plus} label={t('EmailEditor.insertBlock')} text={t('EmailEditor.insertBlock')} chevron className="w-72">
            {close => BLOCKS.map(b => (
              <MenuItem key={b.label} icon={b.icon} label={b.label} hint={b.hint} onClick={() => { close(); b.run() }} />
            ))}
          </Menu>
        </>
      ),
    },
    {
      key: 'paragraph',
      node: (
        <>
          <Menu icon={AlignIcon} label={T('align')} chevron>
            {close => (
              <div className="flex gap-0.5">
                {(Object.keys(ALIGN_ICON) as Align[]).map(a => (
                  <Tool key={a} icon={ALIGN_ICON[a]} label={T(`aligns.${a}`)} active={state.align === a}
                        onClick={() => { close(); chain().setTextAlign(a).run() }} />
                ))}
              </div>
            )}
          </Menu>
          <Tool icon={List} label={T('bulletList')} active={state.bullet} onClick={() => chain().toggleBulletList().run()} />
          <Tool icon={ListOrdered} label={T('numberedList')} active={state.ordered} onClick={() => chain().toggleOrderedList().run()} />
        </>
      ),
    },
  ] as (ToolGroup | false)[]).filter((g): g is ToolGroup => !!g)

  return <OverflowToolbar groups={groups} className="rounded-none rounded-t-card" spread />
}
