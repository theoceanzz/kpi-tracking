import {
  forwardRef, Fragment, lazy, Suspense, useCallback, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import { ALargeSmall, Check, ChevronDown, Heading, ImagePlus, Link2, Loader2, Minus, MoreVertical, Plus, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { FONT_SIZE_MAX, FONT_SIZE_MIN, FONT_SIZES } from './formatting'

/**
 * Bộ khối giao diện CHUNG của mọi thanh công cụ soạn thảo — trang soạn tài liệu, ô soạn thư gửi tài liệu (BlockNote) và
 * trình soạn mẫu email (TipTap). Ở đây chỉ có giao diện; mỗi trình soạn tự nối nút vào lệnh của thư viện soạn thảo của
 * nó. Nhờ vậy ba nơi cùng một hình dáng, cùng bảng màu / phông / cỡ chữ, cùng chú thích + phím tắt.
 *
 * Chữ lấy ở `shared:EditorToolbar.*`.
 */

// Bộ chọn emoji khá nặng — nạp muộn, chỉ ai bấm nút Icon mới tải.
const EmojiPicker = lazy(() => import('emoji-picker-react'))

/** Giữ nguyên vùng chọn trong trình soạn khi bấm nút (không để nút cướp focus). */
const keepSelection = (e: React.MouseEvent) => e.preventDefault()

export interface ToolGroup { key: string; node: ReactNode }

/** Bề rộng nút ⋮ (Thêm) + khoảng cách. */
const MORE_W = 44
/** Bề rộng vạch ngăn giữa hai cụm (1px + lề 6px mỗi bên; bản `spread` gọn: 4px mỗi bên). */
const SEP_W = 13
const SEP_W_TIGHT = 9

/**
 * Hàng công cụ LUÔN một dòng như Google Docs: cụm nào không đủ chỗ thì dồn vào nút ⋮ ở cuối (mở ra là các cụm còn lại).
 * Bề rộng từng cụm đo lúc còn hiện và nhớ lại, nên co / giãn cửa sổ thì cụm tự ra vào đúng thứ tự.
 *
 * `spread`: bản gọn cho thanh hẹp (ô soạn thư) — nút 28px, vạch ngăn hẹp, và đủ chỗ thì các cụm dàn đều hết bề ngang
 * (vạch ngăn nằm giữa hai cụm) thay vì dồn trái chừa khoảng trống.
 */
export function OverflowToolbar({ groups, className, spread }: { groups: ToolGroup[]; className?: string; spread?: boolean }) {
  const { t } = useTranslation('shared')
  const container = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const widths = useRef(new Map<string, number>())
  const [count, setCount] = useState(groups.length)
  const keys = groups.map(g => g.key).join('|')

  const compute = useCallback(() => {
    const el = container.current
    if (!el) return
    const cs = getComputedStyle(el)
    const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const sep = spread ? SEP_W_TIGHT : SEP_W
    const ws = keys.split('|').map((k, i) => (widths.current.get(k) ?? 0) + (i > 0 ? sep : 0))
    let n = ws.length
    if (ws.reduce((a, b) => a + b, 0) > avail) {
      let used = MORE_W
      n = 0
      for (const w of ws) {
        if (used + w > avail) break
        used += w
        n++
      }
    }
    setCount(Math.max(1, n))
  }, [keys, spread])

  // Theo dõi cả khung lẫn từng cụm đang hiện: khung co giãn hay một cụm đổi bề rộng đều tính lại. Cụm đã dồn vào ⋮
  // giữ số đo lần cuối còn hiện (lần vẽ đầu hiện đủ mọi cụm nên cụm nào cũng có số đo).
  const observer = useRef<ResizeObserver | null>(null)
  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      nodes.current.forEach((node, key) => { widths.current.set(key, node.offsetWidth) })
      compute()
    })
    observer.current = obs
    obs.observe(el)
    nodes.current.forEach(node => obs.observe(node))
    return () => { obs.disconnect(); observer.current = null }
  }, [compute])
  const groupRef = (key: string) => (el: HTMLDivElement | null) => {
    if (!el) return
    nodes.current.set(key, el)
    observer.current?.observe(el)
    return () => {
      nodes.current.delete(key)
      observer.current?.unobserve(el)
    }
  }

  const shown = groups.slice(0, count)
  const hidden = groups.slice(count)
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={150}>
      <div ref={container} role="toolbar" aria-label={t('EditorToolbar.label')}
           className={cn('flex min-w-0 flex-nowrap items-center overflow-hidden rounded-[24px] px-2 py-1 text-[var(--color-foreground)]',
             'bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--color-card))]',
             spread && '[&_button]:min-w-7 [&_button]:px-1', spread && hidden.length === 0 && 'justify-between', className)}>
        {shown.map((g, i) => (
          <Fragment key={g.key}>
            {i > 0 && <Sep tight={spread} />}
            <div className="flex shrink-0 items-center gap-0.5" ref={groupRef(g.key)}>{g.node}</div>
          </Fragment>
        ))}
        {hidden.length > 0 && <MoreMenu label={t('EditorToolbar.more')} groups={hidden} />}
      </div>
    </TooltipProvider>
  )
}

function Sep({ tight }: { tight?: boolean }) {
  return <span aria-hidden="true" className={cn('h-5 w-px shrink-0 bg-[var(--color-border-strong)] opacity-70', tight ? 'mx-1' : 'mx-1.5')} />
}

function MoreMenu({ label, groups }: { label: string; groups: ToolGroup[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ml-auto flex shrink-0 items-center pl-1">
      <Popover open={open} onOpenChange={setOpen}>
        <Tip label={label}>
          <PopoverTrigger asChild>
            <ToolButton aria-label={label} active={open}>
              <MoreVertical size={18} aria-hidden="true" />
            </ToolButton>
          </PopoverTrigger>
        </Tip>
        <PopoverContent align="end" className="flex w-auto max-w-[min(92vw,560px)] flex-wrap items-center gap-y-1 p-1.5"
                        onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}>
          {groups.map((g, i) => (
            <div key={g.key} className="flex shrink-0 items-center gap-0.5">
              {i > 0 && <Sep />}
              {g.node}
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

const toolCls = (active?: boolean) => cn(
  'inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-0.5 rounded-control px-1.5 text-[var(--color-foreground)] outline-none transition-colors',
  'hover:bg-[var(--color-foreground)]/[0.08] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-35',
  active && 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20',
)

/** Chú thích kiểu Google Docs: tên nút + phím tắt mờ hơn. */
export function Tip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="bg-[var(--color-foreground)] text-[var(--color-background)]">
        {label}{shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

export const ToolButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & { active?: boolean }>(
  ({ active, className, ...props }, ref) => (
    <button ref={ref} type="button" onMouseDown={keepSelection} aria-pressed={active} className={cn(toolCls(active), className)} {...props} />
  ),
)
ToolButton.displayName = 'ToolButton'

export function Tool({ icon: Icon, label, shortcut, active, disabled, spin, onClick }: {
  icon: LucideIcon; label: string; shortcut?: string; active?: boolean; disabled?: boolean; spin?: boolean; onClick: () => void
}) {
  return (
    <Tip label={label} shortcut={shortcut}>
      <ToolButton aria-label={label} active={active} disabled={disabled} onClick={onClick}>
        <Icon size={18} strokeWidth={1.9} aria-hidden="true" className={spin ? 'animate-spin' : undefined} />
      </ToolButton>
    </Tip>
  )
}

/** Ô chọn gọn trên thanh (kiểu đoạn, phông, thu phóng). Đóng lại thì trả con trỏ về trình soạn qua `onClosed`. */
export function ToolSelect({ value, onChange, label, width, onClosed, children }: {
  value: string; onChange: (v: string) => void; label: string; width: string; onClosed: () => void; children: ReactNode
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <Tip label={label}>
        <SelectTrigger aria-label={label}
                       className={cn('h-8 shrink-0 gap-1 border-0 bg-transparent px-2 text-sm font-medium shadow-none hover:bg-[var(--color-foreground)]/[0.08] focus-visible:shadow-none', width)}>
          <SelectValue />
        </SelectTrigger>
      </Tip>
      <SelectContent className="max-h-80" onCloseAutoFocus={e => { e.preventDefault(); onClosed() }}>
        {children}
      </SelectContent>
    </Select>
  )
}

/** Cỡ chữ − [16] + như Google Docs: hai nút nhảy theo nấc `FONT_SIZES`, ô giữa gõ được số khác rồi Enter. */
export function FontSizeControl({ size, onChange }: { size: number; onChange: (px: number) => void }) {
  const { t } = useTranslation('shared')
  const set = (px: number) => onChange(Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(px))))
  const step = (dir: 1 | -1) => set(dir > 0
    ? FONT_SIZES.find(s => s > size) ?? size + 1
    : [...FONT_SIZES].reverse().find(s => s < size) ?? size - 1)
  return (
    <>
      <Tool icon={Minus} label={t('EditorToolbar.fontSizeDown')} disabled={size <= FONT_SIZE_MIN} onClick={() => step(-1)} />
      <FontSizeInput key={size} value={size} label={t('EditorToolbar.fontSize')} onApply={set} />
      <Tool icon={Plus} label={t('EditorToolbar.fontSizeUp')} disabled={size >= FONT_SIZE_MAX} onClick={() => step(1)} />
    </>
  )
}

/**
 * Ô số cỡ chữ: gõ số rồi Enter. `<input>` thô — ngoại lệ có chủ đích của quy ước Input (CLAUDE.md), như ô sửa trong bảng:
 * nằm lọt trong thanh công cụ, không phải ô của form.
 */
function FontSizeInput({ value, label, onApply }: { value: number; label: string; onApply: (px: number) => void }) {
  const [text, setText] = useState(String(value))
  const apply = () => {
    const n = Number.parseInt(text, 10)
    if (Number.isFinite(n) && n !== value) onApply(n)
    else setText(String(value))
  }
  return (
    <Tip label={label}>
      <input value={text} inputMode="numeric" aria-label={label} onChange={e => setText(e.target.value.replace(/\D/g, '').slice(0, 2))}
             onKeyDown={e => {
               if (e.key === 'Enter') { e.preventDefault(); apply() }
               if (e.key === 'Escape') setText(String(value))
             }}
             onBlur={apply}
             className="no-edit-hint h-7 w-10 shrink-0 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-card)] text-center text-[13px] outline-none focus:border-[var(--color-ring)]" />
    </Tip>
  )
}


/**
 * Nút mở một menu thả xuống. `text` có thì hiện thêm chữ cạnh icon (như "Chèn"). Nội dung nhận hàm `close` để chọn xong
 * thì đóng.
 */
export function Menu({ icon: Icon, label, text, chevron, align = 'start', className, children }: {
  icon: LucideIcon; label: string; text?: string; chevron?: boolean; align?: 'start' | 'end'; className?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={label}>
        <PopoverTrigger asChild>
          <ToolButton aria-label={label} active={open}>
            <Icon size={text ? 17 : 18} aria-hidden="true" />
            {text && <span className="text-[13px] font-medium">{text}</span>}
            {chevron && <ChevronDown size={12} aria-hidden="true" className="opacity-70" />}
          </ToolButton>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align={align} className={cn('w-auto p-1.5', className)} onOpenAutoFocus={e => e.preventDefault()}
                      onCloseAutoFocus={e => e.preventDefault()}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}

/** Một dòng trong menu: icon + tên (+ dòng mô tả nhỏ) + phần đuôi (mũi tên mở menu con…). */
export function MenuItem({ icon: Icon, label, hint, onClick, trailing }: {
  icon: LucideIcon; label: string; hint?: string; onClick?: () => void; trailing?: ReactNode
}) {
  return (
    <button type="button" onMouseDown={keepSelection} onClick={onClick}
            className={cn('flex w-full items-center gap-3 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]',
              hint ? 'py-2' : 'h-9')}>
      <Icon size={16} aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-caption">{hint}</span>}
      </span>
      {trailing}
    </button>
  )
}

/** Bốn nấc cỡ chữ của thanh gọn (như nút "TT" của Gmail); "Bình thường" = bỏ cỡ riêng. */
const COMPACT_SIZES = [['small', 13], ['normal', 16], ['large', 20], ['huge', 28]] as const

const checkMark = <Check size={15} className="text-[var(--color-primary)]" aria-hidden="true" />

/** Nút "H ▾" của thanh gọn: chọn kiểu đoạn (Văn bản thường / Tiêu đề… ), mục đang dùng có dấu ✓. */
export function StyleMenu<V extends string>({ options, current, onPick }: {
  options: { value: V; label: string; icon: LucideIcon }[]; current: V; onPick: (v: V) => void
}) {
  const { t } = useTranslation('shared')
  return (
    <Menu icon={Heading} label={t('EditorToolbar.style')} chevron>
      {close => options.map(o => (
        <MenuItem key={o.value} icon={o.icon} label={o.label} onClick={() => { close(); onPick(o.value) }}
                  trailing={current === o.value ? checkMark : undefined} />
      ))}
    </Menu>
  )
}

/** Nút "AA ▾" của thanh gọn: Nhỏ / Bình thường / Lớn / Rất lớn. `onPick(null)` = về cỡ mặc định. */
export function SizeMenu({ current, onPick }: { current: number; onPick: (px: number | null) => void }) {
  const { t } = useTranslation('shared')
  return (
    <Menu icon={ALargeSmall} label={t('EditorToolbar.fontSize')} chevron>
      {close => COMPACT_SIZES.map(([name, px]) => (
        <MenuItem key={name} icon={ALargeSmall} label={t(`EditorToolbar.sizes.${name}`)}
                  onClick={() => { close(); onPick(px === 16 ? null : px) }}
                  trailing={current === px ? checkMark : undefined} />
      ))}
    </Menu>
  )
}

/**
 * Màu chữ / tô sáng: bảng màu tròn + ô "không màu" gạch chéo. `palette` là tên màu → mã hex (bảng chung ở `formatting.ts`);
 * `current` là TÊN màu đang chọn.
 */
export function ColorButton({ icon: Icon, label, palette, current, swatch, onPick }: {
  icon: LucideIcon; label: string; palette: Record<string, string>; current: string | null
  swatch: 'text' | 'background'; onPick: (name: string | null) => void
}) {
  const { t } = useTranslation('shared')
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={label}>
        <PopoverTrigger asChild>
          <ToolButton aria-label={label} active={open} className="flex-col gap-0">
            <Icon size={15} aria-hidden="true" />
            <span className="h-[3px] w-4 rounded-full"
                  style={{ backgroundColor: current ? palette[current] : swatch === 'text' ? 'currentColor' : 'transparent' }} />
          </ToolButton>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-auto p-3" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}>
        <p className="mb-2 text-xs font-medium text-[var(--color-muted-foreground)]">{label}</p>
        <div className="grid grid-cols-5 gap-2">
          <Tip label={t('EditorToolbar.colors.default')}>
            <button type="button" onMouseDown={keepSelection} onClick={() => { onPick(null); setOpen(false) }}
                    aria-label={t('EditorToolbar.colors.default')}
                    className={cn('relative h-7 w-7 overflow-hidden rounded-full border border-[var(--color-border-strong)] bg-[var(--color-card)] transition-transform hover:scale-110',
                      !current && 'ring-2 ring-[var(--color-ring)] ring-offset-2 ring-offset-[var(--color-popover)]')}>
              {/* Gạch chéo = không màu, như ô "Không" của Google Docs. */}
              <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[var(--color-error)]" />
            </button>
          </Tip>
          {Object.entries(palette).map(([name, hex]) => (
            <Tip key={name} label={t(`EditorToolbar.colors.${name}`)}>
              <button type="button" onMouseDown={keepSelection} onClick={() => { onPick(name); setOpen(false) }}
                      aria-label={t(`EditorToolbar.colors.${name}`)}
                      className={cn('h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110',
                        current === name && 'ring-2 ring-[var(--color-ring)] ring-offset-2 ring-offset-[var(--color-popover)]')}
                      style={{ backgroundColor: hex }} />
            </Tip>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Gắn / sửa / bỏ link cho chữ đang chọn. `current` là link đang ở con trỏ (rỗng = chưa có). */
export function LinkButton({ current, onApply }: { current: string; onApply: (url: string) => void }) {
  const { t } = useTranslation('shared')
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const apply = () => { onApply(url.trim()); setOpen(false) }
  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) setUrl(current) }}>
      <Tip label={t('EditorToolbar.link')}>
        <PopoverTrigger asChild>
          <ToolButton aria-label={t('EditorToolbar.link')} active={!!current || open}>
            <Link2 size={17} aria-hidden="true" />
          </ToolButton>
        </PopoverTrigger>
      </Tip>
      <PopoverContent className="w-80 space-y-2 p-3" align="start" onCloseAutoFocus={e => e.preventDefault()}>
        <p className="text-xs text-[var(--color-muted-foreground)]">{t('EditorToolbar.linkHint')}</p>
        <Input size="sm" autoFocus value={url} placeholder="https://" onChange={e => setUrl(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply() } }} />
        <div className="flex justify-end gap-2">
          {current && <Button size="sm" variant="ghost" onClick={() => { onApply(''); setOpen(false) }}>{t('EditorToolbar.removeLink')}</Button>}
          <Button size="sm" disabled={!url.trim()} onClick={apply}>{t('EditorToolbar.applyLink')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Chèn ảnh từ máy. `onFiles` tự tải lên và chèn (mỗi trình soạn một kho / một kiểu khối); nút quay vòng + báo "đang tải"
 * trong lúc chờ.
 */
export function ImageButton({ accept, multiple, onFiles }: {
  accept: string; multiple?: boolean; onFiles: (files: File[]) => Promise<void>
}) {
  const { t } = useTranslation('shared')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const toastId = toast.loading(t('EditorToolbar.imageUploading', { count: files.length }))
    try {
      await onFiles(files)
    } finally {
      toast.dismiss(toastId)
      setBusy(false)
    }
  }
  return (
    <>
      <input ref={input} type="file" accept={accept} multiple={multiple} className="hidden"
             onChange={e => { void pick(Array.from(e.target.files ?? [])); e.target.value = '' }} />
      <Tip label={t('EditorToolbar.image')} shortcut={t('EditorToolbar.imagePasteHint')}>
        <ToolButton aria-label={t('EditorToolbar.image')} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
        </ToolButton>
      </Tip>
    </>
  )
}

/** Bảng icon (emoji) của `emoji-picker-react` — nạp muộn, chỉ tải khi bấm mở; theo chế độ sáng / tối của ứng dụng. */
export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation('shared')
  const isDark = useThemeStore(s => s.isDark)
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={t('EditorToolbar.emoji')}>
        <PopoverTrigger asChild>
          <ToolButton aria-label={t('EditorToolbar.emoji')} active={open}>
            <Smile size={18} aria-hidden="true" />
          </ToolButton>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0" onOpenAutoFocus={e => e.preventDefault()}
                      onCloseAutoFocus={e => e.preventDefault()}>
        <Suspense fallback={<div className="flex h-[380px] w-[330px] items-center justify-center"><Loader2 className="animate-spin" aria-hidden="true" /></div>}>
          <EmojiPicker
            lazyLoadEmojis
            width={330}
            height={380}
            // Enum Theme nằm trong chính gói nạp muộn — import nó sẽ kéo cả gói vào bundle chính, nên truyền chuỗi.
            theme={(isDark ? 'dark' : 'light') as never}
            searchPlaceholder={t('EditorToolbar.emojiSearch')}
            previewConfig={{ showPreview: false }}
            onEmojiClick={(e: { emoji: string }) => { onPick(e.emoji); setOpen(false) }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  )
}
