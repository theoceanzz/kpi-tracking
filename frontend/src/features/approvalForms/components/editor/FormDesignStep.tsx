import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, Copy, MousePointerClick, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tourAnchor } from '@/components/common/tours/anchors'
import type { FormIssue } from '../../model/formIssues'
import { findWidget, insertWidget, moveChild, removeWidget, replaceWidget } from '../../model/schemaOps'
import { PALETTE, WIDGET_ICONS, allWidgets, cloneWidget, newWidget } from '../../model/widgets'
import type { FormSchema, FormWidget, WidgetType } from '../../types'
import WidgetSettings from './WidgetSettings'

const NEW_PREFIX = 'new:'
const CANVAS_ID = 'canvas'

/**
 * Bước 2 — Thiết kế form (như Lark): bảng widget bên trái (bấm hoặc kéo vào), form trong khung điện thoại ở giữa (kéo
 * để sắp xếp, nút nhân bản / xoá trên widget đang chọn), thiết lập của widget đang chọn bên phải.
 */
export default function FormDesignStep({
  schema, onChange, selectedId, onSelect, title, issues, showErrors, focus, readOnly,
}: {
  schema: FormSchema
  onChange: (schema: FormSchema) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  title: string
  issues: FormIssue[]
  showErrors: boolean
  focus: { widgetId: string; setting?: string; seq: number } | null
  readOnly: boolean
}) {
  const { t } = useTranslation('approvalForms')
  const [dragging, setDragging] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const titles = () => allWidgets(schema.widgets).map((w) => w.title)
  const make = (type: WidgetType) =>
    newWidget(type, (tp) => t(`widgets.${tp}`), titles(), (n) => t('settings.optionDefault', { n }))

  const add = (type: WidgetType, index?: number) => {
    const w = make(type)
    onChange(insertWidget(schema, w, index))
    onSelect(w.id)
  }
  const selected = findWidget(schema, selectedId)
  const invalidIds = new Set(showErrors ? issues.map((i) => i.widgetId).filter(Boolean) as string[] : [])

  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const id = String(e.active.id)
    const overId = e.over ? String(e.over.id) : null
    if (id.startsWith(NEW_PREFIX)) {
      if (!overId) return
      const at = schema.widgets.findIndex((w) => w.id === overId)
      add(id.slice(NEW_PREFIX.length) as WidgetType, at < 0 ? undefined : at)
      return
    }
    if (!overId || id === overId) return
    const ids = schema.widgets.map((w) => w.id)
    const from = ids.indexOf(id)
    const to = ids.indexOf(overId)
    if (from < 0 || to < 0) return
    onChange({ widgets: arrayMove(schema.widgets, from, to) })
  }

  const duplicate = (w: FormWidget, parent: FormWidget | null) => {
    const copy = cloneWidget(w, titles())
    if (parent) onChange(insertWidget(schema, copy, undefined, parent.id))
    else onChange(insertWidget(schema, copy, schema.widgets.findIndex((x) => x.id === w.id) + 1))
    onSelect(copy.id)
  }
  const remove = (w: FormWidget) => {
    onChange(removeWidget(schema, w.id))
    onSelect(null)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        {/* Bảng widget */}
        <aside className="border-b border-[var(--color-border)] bg-[var(--color-card)] p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r"
          {...tourAnchor('formEditor.palette')}>
          <h2 className="mb-3 text-section-title">{t('design.widgets')}</h2>
          {PALETTE.map((g) => (
            <div key={g.group} className="mb-4">
              <p className="mb-2 text-eyebrow text-[var(--color-muted-foreground)]">{t(`design.group_${g.group}`)}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.types.map((type) => <PaletteItem key={type} type={type} disabled={readOnly} onAdd={() => add(type)} />)}
              </div>
            </div>
          ))}
        </aside>

        {/* Khung điện thoại */}
        <section className="min-h-[480px] overflow-y-auto bg-[var(--color-muted)] p-4 sm:p-6" {...tourAnchor('formEditor.canvas')}>
          <div className="mx-auto w-full max-w-[380px] rounded-[32px] border-[6px] border-[var(--color-border)] bg-[var(--color-background)] p-1 shadow-lg">
            <CanvasDrop>
              <p className="border-b border-[var(--color-border)] px-4 py-3 text-center font-semibold">{title || t('editor.untitled')}</p>
              <SortableContext items={schema.widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-[var(--color-border)]">
                  {schema.widgets.map((w) => (
                    <CanvasItem key={w.id} widget={w} selectedId={selectedId} invalid={invalidIds}
                      readOnly={readOnly} onSelect={onSelect}
                      onDuplicate={(x, p) => duplicate(x, p)} onRemove={remove} />
                  ))}
                </ul>
              </SortableContext>
              <p className="flex items-center justify-center gap-1.5 px-4 py-6 text-center text-caption">
                <MousePointerClick size={14} aria-hidden="true" /> {t('design.dropHint')}
              </p>
            </CanvasDrop>
          </div>
        </section>

        {/* Thiết lập */}
        <aside className="border-t border-[var(--color-border)] bg-[var(--color-card)] p-4 lg:overflow-y-auto lg:border-l lg:border-t-0"
          {...tourAnchor('formEditor.settings')}>
          {selected ? (
            <WidgetSettings
              key={selected.widget.id}
              widget={selected.widget}
              parent={selected.parent}
              schema={schema}
              onChange={(next) => onChange(replaceWidget(schema, next))}
              onAddColumn={(type) => {
                const c = make(type)
                onChange(insertWidget(schema, c, undefined, selected.widget.id))
              }}
              onMoveColumn={(childId, delta) => onChange(moveChild(schema, selected.widget.id, childId, delta))}
              onSelect={onSelect}
              issues={issues}
              showErrors={showErrors}
              focus={focus && focus.widgetId === selected.widget.id ? focus : null}
              readOnly={readOnly}
            />
          ) : (
            <p className="py-10 text-center text-caption">{t('design.selectHint')}</p>
          )}
        </aside>
      </div>
      <DragOverlay>
        {dragging?.startsWith(NEW_PREFIX) && <PaletteChip type={dragging.slice(NEW_PREFIX.length) as WidgetType} />}
      </DragOverlay>
    </DndContext>
  )
}

/** Cả khung form nhận thả: thả vào chỗ trống (hoặc khi form chưa có gì) thì thêm vào cuối. */
function CanvasDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_ID })
  return (
    <div ref={setNodeRef} className={cn('min-h-[560px] rounded-[24px] bg-[var(--color-card)]', isOver && 'ring-2 ring-[var(--color-primary)]')}>
      {children}
    </div>
  )
}

function PaletteChip({ type }: { type: WidgetType }) {
  const { t } = useTranslation('approvalForms')
  const Icon = WIDGET_ICONS[type]
  return (
    <span className="flex items-center justify-between gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm shadow-md">
      {t(`widgets.${type}`)} <Icon size={16} aria-hidden="true" className="text-[var(--color-muted-foreground)]" />
    </span>
  )
}

function PaletteItem({ type, disabled, onAdd }: { type: WidgetType; disabled: boolean; onAdd: () => void }) {
  const { t } = useTranslation('approvalForms')
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: NEW_PREFIX + type, disabled })
  const Icon = WIDGET_ICONS[type]
  return (
    <button ref={setNodeRef} type="button" onClick={onAdd} disabled={disabled} {...attributes} {...listeners}
      className={cn('flex items-center justify-between gap-1.5 rounded-control border border-[var(--color-border)] px-2.5 py-2 text-left text-sm',
        'hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50',
        isDragging && 'opacity-40')}>
      <span className="truncate">{t(`widgets.${type}`)}</span>
      <Icon size={16} aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />
    </button>
  )
}

function CanvasItem({ widget: w, selectedId, invalid, readOnly, onSelect, onDuplicate, onRemove }: {
  widget: FormWidget
  selectedId: string | null
  invalid: Set<string>
  readOnly: boolean
  onSelect: (id: string) => void
  onDuplicate: (w: FormWidget, parent: FormWidget | null) => void
  onRemove: (w: FormWidget) => void
}) {
  const { t } = useTranslation('approvalForms')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id, disabled: readOnly })
  const selected = selectedId === w.id
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative bg-[var(--color-card)]', isDragging && 'z-10 shadow-md')}>
      <div {...attributes} {...listeners}
        onClick={() => onSelect(w.id)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect(w.id) }}
        className={cn('cursor-pointer px-4 py-3 outline-none ring-inset focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          selected ? 'ring-2 ring-[var(--color-primary)]' : invalid.has(w.id) ? 'ring-2 ring-[var(--color-error)]' : 'hover:bg-[var(--color-muted)]')}>
        <WidgetLine widget={w} />
      </div>
      {w.type === 'TABLE' && (
        <div className="space-y-1 px-4 pb-3">
          {(w.children ?? []).map((c) => (
            <button key={c.id} type="button" onClick={() => onSelect(c.id)}
              className={cn('flex w-full items-center rounded-control border px-3 py-2 text-left',
                selectedId === c.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                  : invalid.has(c.id) ? 'border-[var(--color-error)]' : 'border-dashed border-[var(--color-border)] hover:bg-[var(--color-muted)]')}>
              <WidgetLine widget={c} />
            </button>
          ))}
          {(w.children ?? []).length === 0 && (
            <p className="flex items-center gap-1 rounded-control border border-dashed border-[var(--color-border)] px-3 py-2 text-caption">
              <Plus size={12} aria-hidden="true" /> {t('design.addColumnsHint')}
            </p>
          )}
        </div>
      )}
      {!readOnly && (selected || (w.children ?? []).some((c) => c.id === selectedId)) && (
        <SelectedToolbar
          onDuplicate={() => {
            const child = (w.children ?? []).find((c) => c.id === selectedId)
            onDuplicate(child ?? w, child ? w : null)
          }}
          onRemove={() => onRemove((w.children ?? []).find((c) => c.id === selectedId) ?? w)}
        />
      )}
    </li>
  )
}

function SelectedToolbar({ onDuplicate, onRemove }: { onDuplicate: () => void; onRemove: () => void }) {
  const { t } = useTranslation('approvalForms')
  return (
    <div className="absolute -top-3 right-2 z-10 flex items-center overflow-hidden rounded-control bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow">
      <button type="button" onClick={onDuplicate} aria-label={t('design.duplicate')} title={t('design.duplicate')} className="px-2 py-1 hover:bg-black/10">
        <Copy size={14} aria-hidden="true" />
      </button>
      <span className="h-4 w-px bg-white/40" aria-hidden="true" />
      <button type="button" onClick={onRemove} aria-label={t('design.remove')} title={t('design.remove')} className="px-2 py-1 hover:bg-black/10">
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Một dòng trong khung điện thoại: tiêu đề bên trái, gợi ý / kiểu nhập bên phải (như form di động của Lark). */
function WidgetLine({ widget: w }: { widget: FormWidget }) {
  const { t } = useTranslation('approvalForms')
  if (w.type === 'DESCRIPTION') {
    return (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{w.title}</p>
        <p className="line-clamp-2 text-caption">{w.content || t('design.descriptionEmpty')}</p>
      </div>
    )
  }
  const hint = w.type === 'FORMULA' ? t('design.autoCalculate')
    : w.type === 'RADIO' || w.type === 'CHECKBOX' || w.type === 'DATE' || w.type === 'DATE_RANGE'
      || w.type === 'CONTACT' || w.type === 'DEPARTMENT' ? (w.placeholder || t('renderer.select'))
      : w.type === 'TABLE' ? '' : w.type === 'IMAGE' || w.type === 'ATTACHMENT' ? t('design.upload') : (w.placeholder || t('renderer.enter'))
  const chevron = ['RADIO', 'CHECKBOX', 'DATE', 'DATE_RANGE', 'CONTACT', 'DEPARTMENT'].includes(w.type)
  return (
    <div className={cn('flex w-full items-start gap-3', w.type === 'TEXTAREA' && 'flex-col gap-1')}>
      <span className="min-w-0 flex-1 truncate text-sm">
        {w.title || t('design.untitledField')}
        {w.required && <span className="ml-0.5 text-[var(--color-error)]">*</span>}
        {(w.visibility?.length ?? 0) > 0 && <span className="ml-1.5 text-caption">({t('design.conditional')})</span>}
      </span>
      {hint && (
        <span className="flex shrink-0 items-center gap-0.5 text-sm text-[var(--color-muted-foreground)]">
          {hint}{chevron && <ChevronRight size={14} aria-hidden="true" />}
        </span>
      )}
    </div>
  )
}
