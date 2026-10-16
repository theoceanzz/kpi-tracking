import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BlockNoteEditor } from '@blocknote/core'
import { useEditorState } from '@blocknote/react'
import type { LucideIcon } from 'lucide-react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, ChevronRight, Code,
  FileCode2, Heading1, Heading2, Heading3, Highlighter, IndentDecrease, IndentIncrease, Italic, List, ListChecks,
  ListOrdered, Minus, Pilcrow, Plus, Printer, Quote, Redo2, RemoveFormatting, Strikethrough, Table, Underline, Undo2,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SelectItem } from '@/components/ui/select'
import {
  ColorButton, EmojiButton, FontSizeControl, ImageButton, LinkButton, Menu, MenuItem, OverflowToolbar, SizeMenu, StyleMenu, Tip,
  Tool, ToolButton, ToolSelect, type ToolGroup,
} from '@/components/common/editor-toolbar/ToolbarKit'
import { BG_COLORS, DEFAULT_FONT_SIZE, FONT_FAMILIES, TEXT_COLORS, ZOOM_LEVELS } from '@/components/common/editor-toolbar/formatting'
import { cn } from '@/lib/utils'
import { IMAGE_ACCEPT, uploadEditorImage } from './uploadImage'

type Align = 'left' | 'center' | 'right' | 'justify'
const ALIGN_ICON: Record<Align, LucideIcon> = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }

/** Kiểu đoạn trong ô "Văn bản thường / Tiêu đề…". Danh sách có nút riêng nên hiện như "Văn bản thường". */
const STYLE_OPTIONS = ['paragraph', 'heading-1', 'heading-2', 'heading-3', 'quote', 'codeBlock'] as const
type StyleOption = (typeof STYLE_OPTIONS)[number]
/**
 * Cỡ chữ thực của tiêu đề trong trình soạn — khớp blocknote.css (thứ bậc Lark: 26 / 22 / 19px) — để ô cỡ chữ hiện đúng số
 * khi chưa đặt cỡ riêng.
 */
const HEADING_SIZE: Record<number, number> = { 1: 26, 2: 22, 3: 19 }
const STYLE_ICON: Record<StyleOption, LucideIcon> = {
  paragraph: Pilcrow, 'heading-1': Heading1, 'heading-2': Heading2, 'heading-3': Heading3, quote: Quote, codeBlock: FileCode2,
}
/** Radix Select không nhận value="" — phông mặc định dùng hằng riêng. */
const DEFAULT_FONT = '__default__'
const TABLE_GRID = 8

export interface ToolbarFeatures {
  /** Màu chữ / nền, căn lề, phông / cỡ chữ — tắt với tệp .md (Markdown không lưu được). */
  rich: boolean
  /** Menu Chèn (bảng, đường kẻ…), khối mã, mã nội dòng — chỉ tài liệu, thư không cần. */
  insert: boolean
  /**
   * Bản gọn một hàng kiểu Gmail cho khung hẹp (ô soạn thư): kiểu đoạn và cỡ chữ thành nút icon ▾, bỏ ô phông và danh sách
   * việc cần làm, các cụm dàn đều hết bề ngang.
   */
  compact?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>
type InsertBlock = Parameters<AnyEditor['insertBlocks']>[0][number]

/**
 * Thanh công cụ CỐ ĐỊNH kiểu Google Docs cho trình soạn BlockNote — trang soạn tài liệu và ô soạn thư gửi tài liệu.
 * Giao diện là bộ chung `ToolbarKit` (trình soạn mẫu email cũng dùng), file này chỉ nối nút vào API của BlockNote — nội
 * dung vẫn là khối BlockNote, tài liệu đã có mở ra y nguyên.
 *
 * In và thu phóng chỉ có khi trang truyền `onPrint` / `onZoom` (trang soạn tài liệu); ô soạn thư không có.
 */
export default function DocToolbar({ editor, features, zoom, onZoom, onPrint, className }: {
  editor: AnyEditor
  features: ToolbarFeatures
  zoom?: number
  onZoom?: (zoom: number) => void
  onPrint?: () => void
  className?: string
}) {
  const { t } = useTranslation('shared')
  const T = (k: string) => t(`EditorToolbar.${k}`)
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => readState(ed),
    equalityFn: (a, b) => !!b && shallowEqual(a, b),
  })

  // Thao tác trên các khối đang chọn (hoặc khối có con trỏ), rồi trả con trỏ về trình soạn.
  const selectedBlocks = () => editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block]
  const updateBlocks = (fn: (b: ReturnType<typeof selectedBlocks>[number]) => Parameters<AnyEditor['updateBlock']>[1] | null) => {
    editor.focus()
    editor.transact(() => {
      for (const b of selectedBlocks()) {
        const update = fn(b)
        if (update) editor.updateBlock(b, update)
      }
    })
  }
  const setStyle = (v: StyleOption) => updateBlocks(() =>
    v.startsWith('heading-') ? { type: 'heading', props: { level: Number(v.slice(8)) } } : { type: v })
  const toggleList = (type: 'bulletListItem' | 'numberedListItem' | 'checkListItem') =>
    updateBlocks(b => ({ type: b.type === type ? 'paragraph' : type }))
  const setAlign = (a: Align) => updateBlocks(b => ('textAlignment' in b.props ? { props: { textAlignment: a } } : null))
  const toggle = (style: 'bold' | 'italic' | 'underline' | 'strike' | 'code') => {
    editor.focus()
    editor.toggleStyles({ [style]: true })
  }
  const setMark = (kind: 'textColor' | 'backgroundColor' | 'fontFamily' | 'fontSize', value: string | null) => {
    editor.focus()
    if (value) editor.addStyles({ [kind]: value })
    else editor.removeStyles({ [kind]: '' })
  }
  const clear = () => {
    editor.focus()
    const active = editor.getActiveStyles()
    if (Object.keys(active).length) editor.removeStyles(active)
  }
  const insert = (block: InsertBlock) => {
    editor.focus()
    const at = editor.getTextCursorPosition().block
    const [inserted] = editor.insertBlocks([block], at, 'after')
    if (inserted) {
      try { editor.setTextCursorPosition(inserted, 'start') } catch { /* khối không có chữ (đường kẻ, ảnh) */ }
    }
  }
  /** Ảnh chọn từ máy: tải lên kho công khai rồi chèn liền nhau sau khối có con trỏ (ảnh lỗi thì bỏ qua, đã báo lỗi). */
  const insertImages = async (files: File[]) => {
    const results = await Promise.allSettled(files.map(f => uploadEditorImage(f).then(url => ({ url, name: f.name }))))
    const blocks = results.flatMap(r => (r.status === 'fulfilled'
      ? [{ type: 'image', props: { url: r.value.url, name: r.value.name } } as InsertBlock] : []))
    if (!blocks.length) return
    editor.focus()
    editor.insertBlocks(blocks, editor.getTextCursorPosition().block, 'after')
  }
  const setLink = (url: string) => {
    editor.focus()
    if (url) editor.createLink(/^(https?:|mailto:)/i.test(url) ? url : `https://${url}`)
    else editor._tiptapEditor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  if (!state) return null
  const AlignIcon = ALIGN_ICON[state.align]
  const size = state.fontSize ?? (state.blockType === 'heading' ? HEADING_SIZE[state.headingLevel] ?? DEFAULT_FONT_SIZE : DEFAULT_FONT_SIZE)
  const refocus = () => editor.focus()

  const groups = ([
    {
      key: 'history',
      node: (
        <>
          <Tool icon={Undo2} label={T('undo')} shortcut="Ctrl+Z" onClick={() => { editor.focus(); editor.undo() }} />
          <Tool icon={Redo2} label={T('redo')} shortcut="Ctrl+Y" onClick={() => { editor.focus(); editor.redo() }} />
          {onPrint && <Tool icon={Printer} label={T('print')} shortcut="Ctrl+P" onClick={onPrint} />}
          {onZoom && zoom != null && (
            <ToolSelect value={String(zoom)} onChange={v => onZoom(Number(v))} label={T('zoom')} width="w-[76px]" onClosed={refocus}>
              {ZOOM_LEVELS.map(z => <SelectItem key={z} value={String(z)}>{z}%</SelectItem>)}
            </ToolSelect>
          )}
        </>
      ),
    },
    features.compact ? {
      // Bản gọn: kiểu đoạn + cỡ chữ chung một cụm, mỗi cái một nút icon ▾ (như nút "TT" của Gmail).
      key: 'style',
      node: (
        <>
          <StyleMenu options={STYLE_OPTIONS.filter(o => o !== 'codeBlock').map(o => ({ value: o, label: T(`styles.${o}`), icon: STYLE_ICON[o] }))}
                     current={state.style} onPick={setStyle} />
          <SizeMenu current={size} onPick={px => setMark('fontSize', px ? `${px}px` : null)} />
        </>
      ),
    } : {
      key: 'style',
      node: (
        <ToolSelect value={state.style} onChange={v => setStyle(v as StyleOption)} label={T('style')} width="w-[156px]" onClosed={refocus}>
          {STYLE_OPTIONS.filter(o => o !== 'codeBlock' || features.insert).map(o => (
            <SelectItem key={o} value={o}>
              <span className={cn(o === 'heading-1' && 'text-xl font-bold', o === 'heading-2' && 'text-lg font-bold',
                o === 'heading-3' && 'text-base font-semibold', o === 'quote' && 'italic text-[var(--color-muted-foreground)]',
                o === 'codeBlock' && 'font-mono text-xs')}>
                {T(`styles.${o}`)}
              </span>
            </SelectItem>
          ))}
        </ToolSelect>
      ),
    },
    features.rich && !features.compact && {
      key: 'font',
      node: (
        <ToolSelect value={state.fontFamily ?? DEFAULT_FONT} label={T('font')} width="w-[124px]" onClosed={refocus}
                    onChange={v => setMark('fontFamily', v === DEFAULT_FONT ? null : v)}>
          <SelectItem value={DEFAULT_FONT}>{T('defaultFont')}</SelectItem>
          {FONT_FAMILIES.map(f => (
            <SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>
          ))}
        </ToolSelect>
      ),
    },
    features.rich && !features.compact && { key: 'size', node: <FontSizeControl size={size} onChange={px => setMark('fontSize', `${px}px`)} /> },
    {
      key: 'marks',
      node: (
        <>
          <Tool icon={Bold} label={T('bold')} shortcut="Ctrl+B" active={state.bold} onClick={() => toggle('bold')} />
          <Tool icon={Italic} label={T('italic')} shortcut="Ctrl+I" active={state.italic} onClick={() => toggle('italic')} />
          <Tool icon={Underline} label={T('underline')} shortcut="Ctrl+U" active={state.underline} onClick={() => toggle('underline')} />
          <Tool icon={Strikethrough} label={T('strike')} shortcut="Ctrl+Shift+S" active={state.strike} onClick={() => toggle('strike')} />
          {features.insert && <Tool icon={Code} label={T('code')} shortcut="Ctrl+E" active={state.code} onClick={() => toggle('code')} />}
          {features.rich && (
            <>
              <ColorButton icon={Baseline} label={T('textColor')} palette={TEXT_COLORS} current={state.textColor}
                           swatch="text" onPick={n => setMark('textColor', n)} />
              <ColorButton icon={Highlighter} label={T('highlight')} palette={BG_COLORS} current={state.backgroundColor}
                           swatch="background" onPick={n => setMark('backgroundColor', n)} />
            </>
          )}
          {features.compact && <Tool icon={RemoveFormatting} label={T('clear')} onClick={clear} />}
        </>
      ),
    },
    {
      key: 'insert',
      node: (
        <>
          <LinkButton current={state.link} onApply={setLink} />
          <ImageButton accept={IMAGE_ACCEPT} multiple onFiles={insertImages} />
          <EmojiButton onPick={emoji => { editor.focus(); editor.insertInlineContent(emoji) }} />
          {features.insert && <InsertMenu onInsert={insert} />}
        </>
      ),
    },
    {
      key: 'paragraph',
      node: (
        <>
          {features.rich && (
            <Menu icon={AlignIcon} label={T('align')} chevron>
              {close => (
                <div className="flex gap-0.5">
                  {(Object.keys(ALIGN_ICON) as Align[]).map(a => (
                    <Tool key={a} icon={ALIGN_ICON[a]} label={T(`aligns.${a}`)} active={state.align === a}
                          onClick={() => { close(); setAlign(a) }} />
                  ))}
                </div>
              )}
            </Menu>
          )}
          {!features.compact && (
            <Tool icon={ListChecks} label={T('checkList')} active={state.blockType === 'checkListItem'} onClick={() => toggleList('checkListItem')} />
          )}
          <Tool icon={List} label={T('bulletList')} active={state.blockType === 'bulletListItem'} onClick={() => toggleList('bulletListItem')} />
          <Tool icon={ListOrdered} label={T('numberedList')} active={state.blockType === 'numberedListItem'}
                onClick={() => toggleList('numberedListItem')} />
        </>
      ),
    },
    !features.compact && {
      key: 'indent',
      node: (
        <>
          <Tool icon={IndentDecrease} label={T('outdent')} shortcut="Shift+Tab" disabled={!state.canUnnest}
                onClick={() => { editor.focus(); editor.unnestBlock() }} />
          <Tool icon={IndentIncrease} label={T('indent')} shortcut="Tab" disabled={!state.canNest}
                onClick={() => { editor.focus(); editor.nestBlock() }} />
          <Tool icon={RemoveFormatting} label={T('clear')} onClick={clear} />
        </>
      ),
    },
  ] as (ToolGroup | false)[]).filter((g): g is ToolGroup => !!g)

  return <OverflowToolbar groups={groups} className={className} spread={features.compact} />
}

function readState(ed: AnyEditor) {
  let block: { type: string; props: Record<string, unknown> } | null = null
  try {
    block = ed.getTextCursorPosition().block as { type: string; props: Record<string, unknown> }
  } catch {
    // trình soạn chưa gắn xong
  }
  const styles = ed.getActiveStyles() as Record<string, unknown>
  const type = block?.type ?? 'paragraph'
  const headingLevel = Math.min(3, Math.max(1, Number(block?.props.level) || 1))
  const style: StyleOption = type === 'heading' ? (`heading-${headingLevel}` as StyleOption)
    : type === 'quote' || type === 'codeBlock' ? type : 'paragraph'
  const str = (v: unknown) => (typeof v === 'string' && v && v !== 'default' ? v : null)
  const px = str(styles.fontSize)
  return {
    blockType: type,
    headingLevel,
    style,
    align: (block?.props.textAlignment as Align | undefined) ?? 'left',
    bold: !!styles.bold, italic: !!styles.italic, underline: !!styles.underline, strike: !!styles.strike, code: !!styles.code,
    textColor: str(styles.textColor),
    backgroundColor: str(styles.backgroundColor),
    fontFamily: str(styles.fontFamily),
    fontSize: px ? Number.parseInt(px, 10) || null : null,
    link: ed.getSelectedLinkUrl() ?? '',
    canNest: ed.canNestBlock(),
    canUnnest: ed.canUnnestBlock(),
  }
}

function shallowEqual<T extends object>(a: T, b: T) {
  return (Object.keys(a) as (keyof T)[]).every(k => a[k] === b[k])
}

/** Menu "Chèn" của tài liệu: bảng (lưới rê chuột chọn số hàng × cột như Google Docs), đường kẻ, danh sách thu gọn, khối mã. */
function InsertMenu({ onInsert }: { onInsert: (block: InsertBlock) => void }) {
  const { t } = useTranslation('shared')
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<'menu' | 'table'>('menu')
  const [hover, setHover] = useState<[number, number]>([0, 0])
  const close = () => { setOpen(false); setPanel('menu'); setHover([0, 0]) }
  const more = <ChevronRight size={14} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />

  return (
    <Popover open={open} onOpenChange={o => (o ? setOpen(true) : close())}>
      <Tip label={t('EditorToolbar.insert')}>
        <PopoverTrigger asChild>
          <ToolButton aria-label={t('EditorToolbar.insert')} active={open} className="px-1.5">
            <Plus size={17} aria-hidden="true" />
            <span className="text-[13px] font-medium">{t('EditorToolbar.insert')}</span>
            <ChevronDown size={12} aria-hidden="true" className="opacity-70" />
          </ToolButton>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-64 p-1.5" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}>
        {panel === 'menu' && (
          <>
            <MenuItem icon={Table} label={t('EditorToolbar.insertTable')} onClick={() => setPanel('table')} trailing={more} />
            <MenuItem icon={Minus} label={t('EditorToolbar.insertDivider')} onClick={() => { close(); onInsert({ type: 'divider' }) }} />
            <MenuItem icon={ChevronRight} label={t('EditorToolbar.insertToggle')} onClick={() => { close(); onInsert({ type: 'toggleListItem' }) }} />
            <MenuItem icon={FileCode2} label={t('EditorToolbar.insertCode')} onClick={() => { close(); onInsert({ type: 'codeBlock' }) }} />
          </>
        )}
        {panel === 'table' && (
          <div className="p-1.5">
            <p className="mb-2 text-xs font-medium text-[var(--color-muted-foreground)]">
              {hover[0] ? t('EditorToolbar.tableSize', { rows: hover[0], cols: hover[1] }) : t('EditorToolbar.tablePick')}
            </p>
            <div className="grid w-fit gap-[3px]" style={{ gridTemplateColumns: `repeat(${TABLE_GRID}, 1fr)` }}
                 onMouseLeave={() => setHover([0, 0])}>
              {Array.from({ length: TABLE_GRID * TABLE_GRID }, (_, i) => {
                const r = Math.floor(i / TABLE_GRID) + 1
                const c = (i % TABLE_GRID) + 1
                const on = r <= hover[0] && c <= hover[1]
                return (
                  <button key={i} type="button" aria-label={t('EditorToolbar.tableSize', { rows: r, cols: c })}
                          onMouseDown={e => e.preventDefault()} onMouseEnter={() => setHover([r, c])} onFocus={() => setHover([r, c])}
                          onClick={() => {
                            close()
                            onInsert({
                              type: 'table',
                              content: { type: 'tableContent', rows: Array.from({ length: r }, () => ({ cells: Array.from({ length: c }, () => '') })) },
                            })
                          }}
                          className={cn('h-[18px] w-[18px] rounded-[3px] border transition-colors',
                            on ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/20' : 'border-[var(--color-border-strong)] bg-[var(--color-card)]')} />
                )
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
