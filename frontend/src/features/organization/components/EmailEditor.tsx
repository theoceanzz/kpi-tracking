import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import TextAlign from '@tiptap/extension-text-align'
import DragHandle from '@tiptap/extension-drag-handle-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { emailNodeExtensions } from './emailNodes'
import { emailTemplateApi } from '../api/emailTemplateApi'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link2, Link2Off, Smile, Palette, Highlighter,
  Type, Undo2, Redo2, Braces, Heading2, GripVertical, Plus, Loader2,
  Image as ImageIcon, MousePointerClick, KeyRound, ListTree, AlertTriangle, Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

// Bộ chọn emoji khá nặng — nạp muộn để không phình bundle của những trang không dùng.
const EmojiPicker = lazy(() => import('emoji-picker-react'))

const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px']

const TEXT_COLORS = [
  '#0f172a', '#475569', '#94a3b8',
  '#2563eb', '#4f46e5', '#7c3aed',
  '#059669', '#0891b2', '#ca8a04',
  '#dc2626', '#db2777', '#ea580c',
]

const HIGHLIGHTS = ['#fef3c7', '#dcfce7', '#dbeafe', '#fae8ff', '#fee2e2', '#f1f5f9']

/**
 * Trình soạn email hợp nhất: MỘT vùng soạn thảo duy nhất chứa cả chữ lẫn các khối
 * đặc thù (nút bấm, ô mã OTP, bảng thông tin, khung nhấn mạnh) dưới dạng node TipTap.
 *
 * <p>Mọi thứ nằm chung một dòng nội dung nên kéo thả, sao chép, hoàn tác đều dùng
 * chung một cơ chế của TipTap — không còn hệ thống khối tự viết song song.
 *
 * <p>`editor.getHTML()` cho ra thẳng HTML thân email, nhờ `renderHTML` của từng node.
 */
export default function EmailEditor({
  value, onChange, variables,
}: {
  value: string
  onChange: (html: string) => void
  /** Tên biến → mô tả, dùng cho nút chèn dữ liệu và các dropdown trong node. */
  variables: Record<string, string>
}) {
  const [openMenu, setOpenMenu] = useState<
    'color' | 'highlight' | 'size' | 'emoji' | 'variable' | 'insert' | 'link' | null
  >(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Nhập nội dung email...' }),
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

  useEffect(() => {
    if (!openMenu) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openMenu])

  if (!editor) return null

  const toggleMenu = (menu: typeof openMenu) => setOpenMenu(prev => (prev === menu ? null : menu))

  const applyLink = () => {
    const url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    setOpenMenu(null)
  }

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setOpenMenu(null)
  }

  /** Mở popover link, nạp sẵn đường dẫn hiện tại nếu con trỏ đang nằm trong một liên kết. */
  const openLinkMenu = () => {
    if (openMenu === 'link') { setOpenMenu(null); return }
    setLinkUrl((editor.getAttributes('link').href as string) || 'https://')
    setOpenMenu('link')
  }

  const insert = (content: object) => {
    editor.chain().focus().insertContent(content).run()
    setOpenMenu(null)
  }

  const pickImage = () => fileInputRef.current?.click()

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Xoá value ngay để chọn lại đúng file vừa rồi vẫn kích hoạt onChange.
    e.target.value = ''
    if (!file) return

    setUploading(true)
    try {
      const url = await emailTemplateApi.uploadImage(file)
      editor.chain().focus().insertContent({
        type: 'emailImage',
        attrs: { src: url, alt: '', width: 300, align: 'center' },
      }).run()
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, 'Tải ảnh lên thất bại'),
      )
    } finally {
      setUploading(false)
    }
  }

  const INSERTABLES: { label: string; hint: string; icon: LucideIcon; run: () => void }[] = [
    {
      label: 'Nút bấm', hint: 'Nút dẫn tới một đường link', icon: MousePointerClick,
      run: () => insert({ type: 'emailButton' }),
    },
    {
      label: 'Ô mã nổi bật', hint: 'Khung to hiển thị mã OTP', icon: KeyRound,
      run: () => insert({ type: 'emailCode' }),
    },
    {
      label: 'Bảng thông tin', hint: 'Các dòng nhãn – giá trị', icon: ListTree,
      run: () => insert({ type: 'emailInfo', attrs: { rows: [{ label: '', value: '' }] } }),
    },
    {
      label: 'Khung nhấn mạnh', hint: 'Ô màu, gõ chữ được bên trong', icon: AlertTriangle,
      run: () => insert({
        type: 'emailAlert',
        attrs: { variant: 'warning' },
        content: [{ type: 'paragraph' }],
      }),
    },
    {
      label: 'Đường kẻ ngang', hint: 'Ngăn cách hai phần', icon: Minus,
      run: () => { editor.chain().focus().setHorizontalRule().run(); setOpenMenu(null) },
    },
  ]

  return (
    <div
      ref={wrapRef}
      className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] transition-colors focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]"
    >
      {/* Thanh công cụ — dính trên đầu khi cuộn nội dung dài */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 rounded-t-card border-b border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1.5" role="toolbar" aria-label="Công cụ soạn thảo">
        <Tool icon={Bold} title="Đậm (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Tool icon={Italic} title="Nghiêng (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Tool icon={UnderlineIcon} title="Gạch chân (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <Tool icon={Strikethrough} title="Gạch ngang" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />

        <Divider />

        <Menu open={openMenu === 'size'} onToggle={() => toggleMenu('size')} icon={Type} title="Cỡ chữ">
          <div className="w-36 p-1" role="menu">
            {FONT_SIZES.map(size => (
              <button type="button" role="menuitem" key={size}
                className="flex h-9 w-full items-center justify-between rounded-control px-2.5 text-left text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none"
                onMouseDown={e => e.preventDefault()} onClick={() => { editor.chain().focus().setFontSize(size).run(); setOpenMenu(null) }}>
                <span style={{ fontSize: size }}>Aa</span>
                <span className="text-caption tabular-nums">{size.replace('px', '')}</span>
              </button>
            ))}
            <button type="button" role="menuitem"
              className="mt-1 flex h-9 w-full items-center rounded-control border-t border-[var(--color-border)] px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none"
              onMouseDown={e => e.preventDefault()} onClick={() => { editor.chain().focus().unsetFontSize().run(); setOpenMenu(null) }}>
              Mặc định
            </button>
          </div>
        </Menu>

        <Tool icon={Heading2} title="Tiêu đề mục" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />

        <Divider />

        <Menu open={openMenu === 'color'} onToggle={() => toggleMenu('color')} icon={Palette} title="Màu chữ">
          <div className="p-2 w-[168px]">
            <div className="grid grid-cols-4 gap-1.5">
              {TEXT_COLORS.map(color => (
                <button
                  key={color}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { editor.chain().focus().setColor(color).run(); setOpenMenu(null) }}
                  type="button"
                  title={color}
                  aria-label={`Màu chữ ${color}`}
                  className="h-8 w-8 rounded-control border border-[var(--color-border)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full" onMouseDown={e => e.preventDefault()} onClick={() => { editor.chain().focus().unsetColor().run(); setOpenMenu(null) }}>
              Bỏ màu
            </Button>
          </div>
        </Menu>

        <Menu open={openMenu === 'highlight'} onToggle={() => toggleMenu('highlight')} icon={Highlighter} title="Màu nền chữ">
          <div className="p-2 w-[168px]">
            <div className="grid grid-cols-3 gap-1.5">
              {HIGHLIGHTS.map(color => (
                <button
                  key={color}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { editor.chain().focus().setBackgroundColor(color).run(); setOpenMenu(null) }}
                  type="button"
                  title={color}
                  aria-label={`Màu nền ${color}`}
                  className="h-8 w-11 rounded-control border border-[var(--color-border)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full" onMouseDown={e => e.preventDefault()} onClick={() => { editor.chain().focus().unsetBackgroundColor().run(); setOpenMenu(null) }}>
              Bỏ nền
            </Button>
          </div>
        </Menu>

        <Divider />

        <Tool icon={AlignLeft} title="Căn trái" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <Tool icon={AlignCenter} title="Căn giữa" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <Tool icon={AlignRight} title="Căn phải" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />

        <Divider />

        <Tool icon={List} title="Danh sách chấm" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Tool icon={ListOrdered} title="Danh sách số" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        {/* Liên kết trong dòng — khác với khối "Nút bấm" (nút CTA căn giữa),
            đây là gắn link vào một đoạn chữ đang chọn. */}
        <span className="relative">
          <ChoiceChip selected={openMenu === 'link' || editor.isActive('link')} className="w-8 px-0" title={editor.isActive('link') ? 'Sửa hoặc bỏ liên kết' : 'Gắn liên kết vào chữ đang chọn'} aria-label="Liên kết" onMouseDown={e => e.preventDefault()} onClick={openLinkMenu}>
            <Link2 aria-hidden="true" />
          </ChoiceChip>
          {openMenu === 'link' && (
            <span className="absolute top-full z-50 mt-1 block rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] shadow-lg left-0 w-72 p-3">
              <span className="mb-1.5 block text-label">
                Đường dẫn
              </span>
              <input
                autoFocus
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                  if (e.key === 'Escape') { e.preventDefault(); setOpenMenu(null) }
                }}
                placeholder="https://..."
                aria-label="Đường dẫn"
                className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              />
              <span className="mt-2.5 flex items-center gap-2">
                <Button size="sm" className="flex-1" type="button" onClick={applyLink}>
                  Áp dụng
                </Button>
                {editor.isActive('link') && (
                  <Button variant="outline" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label="Bỏ liên kết" type="button" onClick={removeLink} title="Bỏ liên kết">
                    <Link2Off aria-hidden="true" />
                  </Button>
                )}
              </span>
            </span>
          )}
        </span>

        <Tool
          icon={uploading ? Loader2 : ImageIcon}
          title="Chèn ảnh"
          disabled={uploading}
          spin={uploading}
          onClick={pickImage}
        />

        <Menu open={openMenu === 'emoji'} onToggle={() => toggleMenu('emoji')} icon={Smile} title="Chèn biểu tượng cảm xúc" wide>
          <Suspense fallback={<div className="p-6 text-caption">Đang tải…</div>}>
            <EmojiPicker
              lazyLoadEmojis
              width={320}
              height={380}
              onEmojiClick={(e: { emoji: string }) => {
                editor.chain().focus().insertContent(e.emoji).run()
                setOpenMenu(null)
              }}
            />
          </Suspense>
        </Menu>

        {Object.keys(variables).length > 0 && (
          <Menu open={openMenu === 'variable'} onToggle={() => toggleMenu('variable')} icon={Braces} title="Chèn dữ liệu hệ thống" wide>
            <div className="custom-scrollbar max-h-64 w-64 overflow-y-auto p-1.5" role="menu">
              {Object.entries(variables).map(([name, desc]) => (
                <button type="button" role="menuitem" className="flex w-full flex-col items-start rounded-control px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:bg-[var(--color-muted)]" key={name} onMouseDown={e => e.preventDefault()} onClick={() => insert({ type: 'emailVariable', attrs: { name } })}>
                  <span className="block w-full truncate text-sm text-[var(--color-foreground)]">{desc}</span>
                  <span className="block font-mono text-caption">{`{{${name}}}`}</span>
                </button>
              ))}
            </div>
          </Menu>
        )}

        <Divider />

        <Tool icon={Undo2} title="Hoàn tác" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <Tool icon={Redo2} title="Làm lại" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />

        {/* Chèn khối đặc thù — đẩy sang phải cho nổi bật */}
        <span className="ml-auto relative">
          <ChoiceChip selected={openMenu === 'insert'} variant="solid" aria-haspopup="menu" aria-expanded={openMenu === 'insert'} onMouseDown={e => e.preventDefault()} onClick={() => toggleMenu('insert')}>
            <Plus aria-hidden="true" /> Chèn khối
          </ChoiceChip>
          {openMenu === 'insert' && (
            <span className="absolute top-full z-50 mt-1 block rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] shadow-lg right-0 w-72 p-1.5" role="menu">
              {INSERTABLES.map(item => (
                <button type="button" role="menuitem" className="flex w-full items-start gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none" key={item.label} onMouseDown={e => e.preventDefault()} onClick={item.run}>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <item.icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--color-foreground)]">{item.label}</span>
                    <span className="block text-caption">{item.hint}</span>
                  </span>
                </button>
              ))}
            </span>
          )}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleImageSelected}
      />

      {/* Tay cầm kéo của TipTap: hiện ra bên trái khối đang trỏ chuột tới,
          áp dụng cho MỌI loại nội dung (đoạn văn, nút bấm, bảng, khung nhấn mạnh). */}
      <div className="relative">
        <DragHandle editor={editor}>
          <div
            title="Kéo để đổi vị trí khối"
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

function Tool({ icon: Icon, title, active, disabled, spin, onClick }: {
  icon: LucideIcon
  title: string
  active?: boolean
  disabled?: boolean
  spin?: boolean
  onClick: () => void
}) {
  return (
    <ChoiceChip selected={!!active} className="w-8 px-0" title={title} aria-label={title} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={onClick}>
      <Icon className={spin ? 'animate-spin' : undefined} aria-hidden="true" />
    </ChoiceChip>
  )
}

function Menu({ open, onToggle, icon: Icon, title, wide, children }: {
  open: boolean
  onToggle: () => void
  icon: LucideIcon
  title: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <span className="relative">
      <ChoiceChip selected={open} className="w-8 px-0" title={title} aria-label={title} aria-haspopup="true" aria-expanded={open} onMouseDown={e => e.preventDefault()} onClick={onToggle}>
        <Icon aria-hidden="true" />
      </ChoiceChip>
      {open && (
        <span className={cn(
          'absolute top-full z-50 mt-1 block rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] shadow-lg left-0 overflow-hidden',
          wide ? '' : 'min-w-max',
        )}>
          {children}
        </span>
      )}
    </span>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-[var(--color-border)]" role="separator" aria-orientation="vertical" />
}
