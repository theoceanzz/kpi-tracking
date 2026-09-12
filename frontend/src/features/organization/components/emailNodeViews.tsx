import { useRef, useState } from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { Trash2, Plus, AlignLeft, AlignCenter, AlignRight, X } from 'lucide-react'
import {
  ALERT_COLORS, ALERT_LABEL, ALERT_VARIANTS, resolveAlertColors, nodeInputClass,
  EMAIL_CONTENT_WIDTH, IMAGE_PRESETS,
} from './emailNodeStyles'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

/**
 * Giao diện chỉnh sửa của từng node email bên trong trình soạn.
 * Định nghĩa node (và HTML sinh ra) nằm ở `emailNodes.ts`.
 */

export function ButtonView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper>
      <BlockShell label="Nút bấm" onDelete={deleteNode}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <LabeledInput label="Chữ trên nút" value={node.attrs.label} onChange={v => updateAttributes({ label: v })} />
          <LabeledInput label="Đường dẫn" value={node.attrs.url} onChange={v => updateAttributes({ url: v })} />
        </div>
        <div className="mt-3 flex justify-center">
          <span className="inline-block px-6 py-2.5 rounded-control bg-[var(--color-info-solid)] text-white text-sm font-semibold">
            {node.attrs.label || 'Nút bấm'}
          </span>
        </div>
      </BlockShell>
    </NodeViewWrapper>
  )
}

export function CodeView({ node, updateAttributes, deleteNode, extension }: NodeViewProps) {
  const variables: Record<string, string> = extension.options.variables || {}
  return (
    <NodeViewWrapper>
      <BlockShell label="Ô mã nổi bật" onDelete={deleteNode}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <LabeledInput label="Nhãn phía trên" value={node.attrs.label} onChange={v => updateAttributes({ label: v })} />
          <label className="block">
            <span className="text-eyebrow">Giá trị hiển thị</span>
            <select
              value={node.attrs.value}
              onChange={e => updateAttributes({ value: e.target.value })}
              className={nodeInputClass}
            >
              <option value="">— Chọn dữ liệu —</option>
              {Object.entries(variables).map(([name, desc]) => (
                <option key={name} value={`{{${name}}}`}>{desc}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 rounded-card bg-[var(--color-muted)] py-4 text-center">
          <span className="text-eyebrow block">{node.attrs.label}</span>
          <span className="block text-2xl font-semibold tracking-[0.2em] text-[var(--color-info)] mt-1">{node.attrs.value || '——'}</span>
        </div>
      </BlockShell>
    </NodeViewWrapper>
  )
}

export function AlertView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const variant = node.attrs.variant as string
  const custom = node.attrs.color as string | null
  const { color, bg } = resolveAlertColors(variant, custom)

  return (
    <NodeViewWrapper>
      <BlockShell
        label="Khung nhấn mạnh"
        onDelete={deleteNode}
        toolbar={
          <span className="flex items-center gap-1.5" contentEditable={false}>
            {ALERT_VARIANTS.map(v => (
              <button
                key={v}
                type="button"
                title={ALERT_LABEL[v]}
                // Chọn màu sẵn thì xoá màu tự chọn, nếu không nó vẫn đè lên.
                onClick={() => updateAttributes({ variant: v, color: null })}
                style={{ backgroundColor: ALERT_COLORS[v]?.color }}
                className={cn(
                  'w-5 h-5 rounded-full transition-transform',
                  !custom && variant === v
                    ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900'
                    : 'opacity-70 hover:opacity-100',
                )}
              />
            ))}

            <span className="w-px h-4 bg-[var(--color-border)] mx-0.5" />

            {/* Màu tự chọn: input type=color mở bảng màu của hệ điều hành */}
            <label
              title="Chọn màu khác"
              className={cn(
                'relative w-5 h-5 rounded-full cursor-pointer transition-transform overflow-hidden',
                custom
                  ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900'
                  : 'border border-[var(--color-border-strong)]',
              )}
              style={custom
                ? { backgroundColor: custom }
                : { background: 'conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)' }}
            >
              <input
                type="color"
                value={custom || color}
                onChange={e => updateAttributes({ color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>

            {custom && (
              <button
                type="button"
                title="Bỏ màu tự chọn"
                onClick={() => updateAttributes({ color: null })}
                className="p-0.5 rounded text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)]"
              >
                <X size={12} />
              </button>
            )}
          </span>
        }
      >
        {/* Vùng gõ được bên trong khung — dùng chung mọi định dạng của thanh công cụ */}
        <NodeViewContent
          className="rounded-card px-4 py-3 text-sm font-semibold [&_p]:my-1"
          style={{ backgroundColor: bg, color, borderLeft: `4px solid ${color}` }}
        />
      </BlockShell>
    </NodeViewWrapper>
  )
}

export function InfoView({ node, updateAttributes, deleteNode, extension }: NodeViewProps) {
  const rows: { label: string; value: string }[] = node.attrs.rows ?? []
  const variables: Record<string, string> = extension.options.variables || {}
  const setRows = (next: typeof rows) => updateAttributes({ rows: next })

  return (
    <NodeViewWrapper>
      <BlockShell label="Bảng thông tin" onDelete={deleteNode}>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={row.label}
                onChange={e => setRows(rows.map((r, x) => x === i ? { ...r, label: e.target.value } : r))}
                placeholder="Nhãn"
                className={cn(nodeInputClass, 'flex-1')}
              />
              <input
                value={row.value}
                onChange={e => setRows(rows.map((r, x) => x === i ? { ...r, value: e.target.value } : r))}
                placeholder="Giá trị"
                className={cn(nodeInputClass, 'flex-1')}
              />
              <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label="Xoá dòng" type="button" title="Xoá dòng" onClick={() => setRows(rows.filter((_, x) => x !== i))}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" type="button" onClick={() => setRows([...rows, { label: '', value: '' }])}>
              <Plus aria-hidden="true" /> Thêm dòng
            </Button>
            <select
              value=""
              onChange={e => {
                if (!e.target.value) return
                setRows([...rows, { label: variables[e.target.value] || e.target.value, value: `{{${e.target.value}}}` }])
              }}
              className="text-eyebrow bg-transparent outline-none cursor-pointer"
            >
              <option value="">+ Thêm dòng từ dữ liệu hệ thống</option>
              {Object.entries(variables).map(([name, d]) => <option key={name} value={name}>{d}</option>)}
            </select>
          </div>
        </div>
      </BlockShell>
    </NodeViewWrapper>
  )
}

export function ImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { src, alt, width, align } = node.attrs as {
    src: string; alt: string; width: number; align: string
  }
  const imgRef = useRef<HTMLImageElement>(null)
  const [dragging, setDragging] = useState(false)

  /**
   * Kéo góc phải-dưới để đổi bề ngang. Dùng pointer capture nên chuột rê ra
   * ngoài ảnh vẫn theo, và không cần gắn listener lên document.
   */
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = imgRef.current?.offsetWidth ?? width
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture(e.pointerId)
    setDragging(true)

    const onMove = (ev: PointerEvent) => {
      const next = Math.round(startWidth + (ev.clientX - startX))
      updateAttributes({ width: Math.max(40, Math.min(EMAIL_CONTENT_WIDTH, next)) })
    }
    const onUp = () => {
      setDragging(false)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          'my-3 rounded-card border transition-colors',
          selected ? 'border-[var(--color-primary)] ring-4 ring-[var(--color-ring)]' : 'border-[var(--color-border)]',
        )}
      >
        <div
          contentEditable={false}
          className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)]"
        >
          <span className="text-eyebrow text-[var(--color-primary)]">Ảnh</span>

          <span className="flex gap-1">
            {IMAGE_PRESETS.map(p => (
              <ChoiceChip selected={width === p.width} className="py-0.5" key={p.label} onClick={() => updateAttributes({ width: p.width })}>
                {p.label}
              </ChoiceChip>
            ))}
          </span>

          <span className="flex gap-0.5">
            {([
              ['left', AlignLeft, 'Căn trái'],
              ['center', AlignCenter, 'Căn giữa'],
              ['right', AlignRight, 'Căn phải'],
            ] as const).map(([value, Icon, title]) => (
              <ChoiceChip selected={align === value} key={value} title={title} onClick={() => updateAttributes({ align: value })}>
                <Icon />
              </ChoiceChip>
            ))}
          </span>

          <span className="ml-auto flex items-center gap-2">
            <span className="text-caption tabular-nums">{width}px</span>
            <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label="Xoá ảnh" type="button" title="Xoá ảnh" onClick={deleteNode}>
              <Trash2 aria-hidden="true" />
            </Button>
          </span>
        </div>

        <div className="p-3" style={{ textAlign: align as 'left' | 'center' | 'right' }}>
          <span className="relative inline-block">
            <img
              ref={imgRef}
              src={src}
              alt={alt || ''}
              draggable={false}
              style={{ width: `${width}px`, maxWidth: '100%', height: 'auto' }}
              className="rounded-control align-middle"
            />
            {/* Tay cầm đổi kích thước ở góc phải-dưới */}
            <span
              onPointerDown={startResize}
              title="Kéo để đổi kích thước"
              className={cn(
                'absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-full border-2 border-white bg-[var(--color-primary)] cursor-nwse-resize shadow',
                dragging ? 'scale-125' : 'opacity-0 hover:opacity-100 group-hover:opacity-100',
                selected && 'opacity-100',
              )}
            />
          </span>
        </div>

        <div contentEditable={false} className="px-3 pb-3">
          <input
            value={alt || ''}
            onChange={e => updateAttributes({ alt: e.target.value })}
            placeholder="Mô tả ảnh (hiện khi mail client chặn ảnh)"
            className={cn(nodeInputClass, 'text-xs')}
          />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export function VariableView({ node, extension }: NodeViewProps) {
  const variables: Record<string, string> = extension.options.variables || {}
  const name = node.attrs.name as string
  return (
    <NodeViewWrapper as="span">
      <span
        title={`{{${name}}}`}
        className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-[12px] font-medium align-baseline"
      >
        {variables[name] || name}
      </span>
    </NodeViewWrapper>
  )
}

// ─────────────────────────────── Dùng chung ───────────────────────────────

function LabeledInput({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-eyebrow">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} className={nodeInputClass} />
    </label>
  )
}

/** Khung bao quanh mỗi khối đặc biệt trong trình soạn: nhãn loại + nút xoá. */
function BlockShell({ label, onDelete, toolbar, children }: {
  label: string
  onDelete: () => void
  toolbar?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="my-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] overflow-hidden">
      <div
        contentEditable={false}
        className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)]"
      >
        <span className="text-eyebrow text-[var(--color-primary)] flex-1">{label}</span>
        {toolbar}
        <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label="Xoá khối" type="button" title="Xoá khối" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}
