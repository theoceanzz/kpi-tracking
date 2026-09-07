import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import TextAlign from '@tiptap/extension-text-align'
import DragHandle from '@tiptap/extension-drag-handle-react'
import type { LucideIcon } from 'lucide-react'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { emailNodeExtensions } from './emailNodes'
import { emailTemplateApi } from '../api/emailTemplateApi'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link2, Link2Off, Smile, Palette, Highlighter,
  Type, Undo2, Redo2, Braces, Heading2, GripVertical, Plus, Loader2,
  Image as ImageIcon, MousePointerClick, KeyRound, ListTree, AlertTriangle, Minus,
} from 'lucide-react'

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
        class: 'outline-none px-10 py-4 text-sm leading-relaxed min-h-[380px] [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-indigo-600 [&_a]:underline [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h3]:text-base [&_h3]:font-bold [&_hr]:my-6 [&_hr]:border-slate-200 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:text-slate-400 [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:pointer-events-none',
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
        (err as AxiosError<{ message?: string }>)?.response?.data?.message || 'Tải ảnh lên thất bại',
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
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/50 transition-all"
    >
      {/* Thanh công cụ — dính trên đầu khi cuộn nội dung dài */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur rounded-t-2xl">
        <Tool icon={Bold} title="Đậm (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Tool icon={Italic} title="Nghiêng (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Tool icon={UnderlineIcon} title="Gạch chân (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <Tool icon={Strikethrough} title="Gạch ngang" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />

        <Divider />

        <Menu open={openMenu === 'size'} onToggle={() => toggleMenu('size')} icon={Type} title="Cỡ chữ">
          <div className="p-1 w-32">
            {FONT_SIZES.map(size => (
              <button
                key={size}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { editor.chain().focus().setFontSize(size).run(); setOpenMenu(null) }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                style={{ fontSize: size }}
              >
                {size.replace('px', '')}
              </button>
            ))}
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { editor.chain().focus().unsetFontSize().run(); setOpenMenu(null) }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
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
                  title={color}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { editor.chain().focus().unsetColor().run(); setOpenMenu(null) }}
              className="w-full mt-2 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Bỏ màu
            </button>
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
                  title={color}
                  className="w-11 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => { editor.chain().focus().unsetBackgroundColor().run(); setOpenMenu(null) }}
              className="w-full mt-2 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Bỏ nền
            </button>
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
          <button
            type="button"
            title={editor.isActive('link') ? 'Sửa hoặc bỏ liên kết' : 'Gắn liên kết vào chữ đang chọn'}
            onMouseDown={e => e.preventDefault()}
            onClick={openLinkMenu}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              openMenu === 'link' || editor.isActive('link')
                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'
                : 'text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800',
            )}
          >
            <Link2 size={15} />
          </button>
          {openMenu === 'link' && (
            <span className="absolute left-0 top-full mt-1 z-50 block w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3">
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
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
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50"
              />
              <span className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={applyLink}
                  className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                >
                  Áp dụng
                </button>
                {editor.isActive('link') && (
                  <button
                    type="button"
                    onClick={removeLink}
                    title="Bỏ liên kết"
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    <Link2Off size={14} />
                  </button>
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
          <Suspense fallback={<div className="p-6 text-xs text-slate-400">Đang tải…</div>}>
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
            <div className="p-1.5 w-64 max-h-64 overflow-y-auto">
              {Object.entries(variables).map(([name, desc]) => (
                <button
                  key={name}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => insert({ type: 'emailVariable', attrs: { name } })}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">{desc}</span>
                  <span className="block text-[10px] font-mono text-slate-400">{`{{${name}}}`}</span>
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
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => toggleMenu('insert')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors',
              openMenu === 'insert'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
            )}
          >
            <Plus size={13} /> Chèn khối
          </button>
          {openMenu === 'insert' && (
            <span className="absolute right-0 top-full mt-1 z-50 block w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden p-1.5">
              {INSERTABLES.map(item => (
                <button
                  key={item.label}
                  onMouseDown={e => e.preventDefault()}
                  onClick={item.run}
                  className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
                >
                  <item.icon size={15} className="text-indigo-500 mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                    <span className="block text-[10px] text-slate-400 font-medium">{item.hint}</span>
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
            className="flex items-center justify-center w-6 h-6 -ml-1 rounded-lg cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <GripVertical size={16} />
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
    <button
      type="button"
      title={title}
      disabled={disabled}
      // Giữ vùng chọn trong trình soạn khi bấm nút, nếu không lệnh sẽ không biết áp vào đâu.
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
        active
          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
          : 'text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800',
      )}
    >
      <Icon size={15} className={spin ? 'animate-spin' : undefined} />
    </button>
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
      <button
        type="button"
        title={title}
        onMouseDown={e => e.preventDefault()}
        onClick={onToggle}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          open ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800',
        )}
      >
        <Icon size={15} />
      </button>
      {open && (
        <span className={cn(
          'absolute left-0 top-full mt-1 z-50 block rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden',
          wide ? '' : 'min-w-max',
        )}>
          {children}
        </span>
      )}
    </span>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
}
