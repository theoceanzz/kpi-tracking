import { useRef, useState } from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { Trash2, Plus, AlignLeft, AlignCenter, AlignRight, X } from 'lucide-react'
import {
  ALERT_COLORS, ALERT_LABEL, ALERT_VARIANTS, resolveAlertColors, nodeInputClass,
  EMAIL_CONTENT_WIDTH, IMAGE_PRESETS,
} from './emailNodeStyles'

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
          <span className="inline-block px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold">
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
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giá trị hiển thị</span>
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
        <div className="mt-3 rounded-xl bg-slate-100 dark:bg-slate-800 py-4 text-center">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">{node.attrs.label}</span>
          <span className="block text-2xl font-black tracking-[0.2em] text-blue-600 mt-1">{node.attrs.value || '——'}</span>
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
                  'w-5 h-5 rounded-full transition-transform hover:scale-110',
                  !custom && variant === v
                    ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900'
                    : 'opacity-70 hover:opacity-100',
                )}
              />
            ))}

            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* Màu tự chọn: input type=color mở bảng màu của hệ điều hành */}
            <label
              title="Chọn màu khác"
              className={cn(
                'relative w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110 overflow-hidden',
                custom
                  ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900'
                  : 'border border-slate-300 dark:border-slate-600',
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
                className="p-0.5 rounded text-slate-400 hover:text-red-600"
              >
                <X size={12} />
              </button>
            )}
          </span>
        }
      >
        {/* Vùng gõ được bên trong khung — dùng chung mọi định dạng của thanh công cụ */}
        <NodeViewContent
          className="rounded-xl px-4 py-3 text-sm font-semibold [&_p]:my-1"
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
              <button
                type="button"
                title="Xoá dòng"
                onClick={() => setRows(rows.filter((_, x) => x !== i))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRows([...rows, { label: '', value: '' }])}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600"
            >
              <Plus size={12} /> Thêm dòng
            </button>
            <select
              value=""
              onChange={e => {
                if (!e.target.value) return
                setRows([...rows, { label: variables[e.target.value] || e.target.value, value: `{{${e.target.value}}}` }])
              }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-transparent outline-none cursor-pointer"
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
          'my-3 rounded-2xl border transition-colors',
          selected ? 'border-indigo-400 ring-4 ring-indigo-500/10' : 'border-slate-200 dark:border-slate-700',
        )}
      >
        <div
          contentEditable={false}
          className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-slate-200/70 dark:border-slate-700/70"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Ảnh</span>

          <span className="flex gap-1">
            {IMAGE_PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => updateAttributes({ width: p.width })}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-colors',
                  width === p.width
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600',
                )}
              >
                {p.label}
              </button>
            ))}
          </span>

          <span className="flex gap-0.5">
            {([
              ['left', AlignLeft, 'Căn trái'],
              ['center', AlignCenter, 'Căn giữa'],
              ['right', AlignRight, 'Căn phải'],
            ] as const).map(([value, Icon, title]) => (
              <button
                key={value}
                type="button"
                title={title}
                onClick={() => updateAttributes({ align: value })}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  align === value
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                <Icon size={13} />
              </button>
            ))}
          </span>

          <span className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">{width}px</span>
            <button
              type="button"
              title="Xoá ảnh"
              onClick={deleteNode}
              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={13} />
            </button>
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
              className="rounded-lg align-middle"
            />
            {/* Tay cầm đổi kích thước ở góc phải-dưới */}
            <span
              onPointerDown={startResize}
              title="Kéo để đổi kích thước"
              className={cn(
                'absolute -right-1.5 -bottom-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-500 cursor-nwse-resize shadow',
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
        className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[12px] font-bold align-baseline"
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
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
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
    <div className="my-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 overflow-hidden">
      <div
        contentEditable={false}
        className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-200/70 dark:border-slate-700/70"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex-1">{label}</span>
        {toolbar}
        <button
          type="button"
          title="Xoá khối"
          onClick={onDelete}
          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}
