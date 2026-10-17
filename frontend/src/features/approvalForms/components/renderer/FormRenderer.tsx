import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Loader2, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFormat } from '@/i18n/useFormat'
import { toastUploadError } from '@/lib/upload'
import { cn } from '@/lib/utils'
import MultiSelectPopover, { type PickOption } from '@/features/approvalProcess/components/pickers/MultiSelectPopover'
import UserPickerPopover from '@/features/approvalProcess/components/pickers/UserPickerPopover'
import { PeopleSearchContext } from '@/features/approvalProcess/components/pickers/peopleSearch'
import { approvalFormsApi, directoryPeopleSearch } from '../../api/approvalFormsApi'
import { computeFormState, isEmptyValue as isEmpty, type DateRangeValue, type FormState } from '../../model/formState'
import { MAX_FILES } from '../../model/widgets'
import type { FormSchema, FormValues, FormWidget, UploadedFile } from '../../types'

/** Người / đơn vị đã chọn: lưu kèm tên để chip hiện ngay (backend vẫn tra lại tên). */
interface RefValue {
  id: string
  name: string
}

export type RendererMode = 'edit' | 'preview' | 'view'

interface Props {
  schema: FormSchema
  values: FormValues
  onChange?: (values: FormValues) => void
  /** edit: điền thật; preview: điền thử, không tải tệp; view: chỉ đọc giá trị đã nộp. */
  mode: RendererMode
  /** Lỗi bắt buộc theo id widget (bản kiểm phía giao diện). */
  errors?: Record<string, string>
}

/**
 * Bộ dựng form đơn từ dùng chung: xem trước ở trình sửa / thư viện mẫu, nộp đơn, xem đơn đã nộp. Luật ẩn/hiện,
 * công thức và thời lượng tính bằng `computeFormState` (cùng luật với backend).
 */
export default function FormRenderer({ schema, values, onChange, mode, errors = {} }: Props) {
  const state = useMemo(() => computeFormState(schema, values), [schema, values])
  const set = (id: string, v: unknown) => onChange?.({ ...values, [id]: v })
  return (
    <PeopleSearchContext.Provider value={directoryPeopleSearch}>
      <div className="space-y-4">
        {schema.widgets
          // Xem đơn đã nộp: bỏ trường trống cho gọn (Mô tả, Công thức vẫn hiện).
          .filter((w) => state.visible.has(w.id)
            && (mode !== 'view' || w.type === 'DESCRIPTION' || w.type === 'FORMULA' || !isEmpty(values[w.id])))
          .map((w) => (
          <WidgetField key={w.id} widget={w} value={values[w.id]} onChange={(v) => set(w.id, v)} mode={mode}
            state={state} errors={errors} errorKey={w.id} />
        ))}
      </div>
    </PeopleSearchContext.Provider>
  )
}

function FieldShell({ widget, error, children, htmlFor, readOnly }: {
  widget: FormWidget; error?: string; children: ReactNode; htmlFor?: string; readOnly?: boolean
}) {
  return (
    <div data-widget-id={widget.id}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-label">
        {widget.title}
        {widget.required && !readOnly && widget.type !== 'FORMULA' && <span className="ml-0.5 text-[var(--color-error)]">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  )
}

function WidgetField({ widget: w, value, onChange, mode, state, errors, errorKey }: {
  widget: FormWidget
  value: unknown
  onChange: (v: unknown) => void
  mode: RendererMode
  state: FormState
  errors: Record<string, string>
  errorKey: string
}) {
  const { t } = useTranslation('approvalForms')
  const fmt = useFormat()
  const readOnly = mode === 'view'
  const error = errors[errorKey]
  const inputId = `af-${errorKey}`

  if (w.type === 'DESCRIPTION') {
    return (
      <div data-widget-id={w.id} className="rounded-card bg-[var(--color-muted)] px-3 py-2.5 text-sm">
        {w.title && <p className="mb-1 font-medium">{w.title}</p>}
        <p className="whitespace-pre-wrap text-[var(--color-muted-foreground)]">{w.content}</p>
      </div>
    )
  }

  const numberText = (n: number | null | undefined) => numberTextFor(w, n, fmt)

  if (w.type === 'FORMULA') {
    const n = mode === 'view' && typeof value === 'number' ? value : state.formulas[w.id]
    return (
      <FieldShell widget={w}>
        <div className="flex h-9 items-center rounded-control bg-[var(--color-muted)] px-3 text-sm font-medium tabular-nums">
          {numberText(n)}
        </div>
        <p className="mt-1 text-caption">{t('renderer.autoCalculated')}</p>
      </FieldShell>
    )
  }

  if (readOnly) {
    return <FieldShell widget={w} readOnly><ViewValue widget={w} value={value} numberText={numberText} /></FieldShell>
  }

  const placeholder = w.placeholder || t('renderer.enter')
  switch (w.type) {
    case 'TEXT':
    case 'PHONE':
      return (
        <FieldShell widget={w} error={error} htmlFor={inputId}>
          <Input id={inputId} type={w.type === 'PHONE' ? 'tel' : 'text'} value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={w.maxLength ?? (w.type === 'PHONE' ? 20 : 1000)}
            invalid={!!error} />
        </FieldShell>
      )
    case 'TEXTAREA':
      return (
        <FieldShell widget={w} error={error} htmlFor={inputId}>
          <Textarea id={inputId} rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder} maxLength={w.maxLength ?? 5000} invalid={!!error} />
        </FieldShell>
      )
    case 'NUMBER':
    case 'AMOUNT':
      return (
        <FieldShell widget={w} error={error} htmlFor={inputId}>
          <Input id={inputId} type="number" data-keep-value-on-focus value={value == null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            placeholder={placeholder} invalid={!!error} className="no-edit-hint"
            suffix={w.type === 'AMOUNT' ? w.currency ?? undefined : w.unit ?? undefined}
            min={w.min ?? undefined} max={w.max ?? undefined} />
        </FieldShell>
      )
    case 'RADIO':
      return (
        <FieldShell widget={w} error={error}>
          {w.display === 'LIST' ? (
            <div role="radiogroup" aria-label={w.title} className="flex flex-wrap gap-2">
              {(w.options ?? []).map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={value === o.id}
                  onClick={() => onChange(value === o.id ? null : o.id)}
                  className={cn('rounded-control border px-3 py-1.5 text-sm transition-colors',
                    value === o.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]')}>
                  {o.label}
                </button>
              ))}
            </div>
          ) : (
            <Select value={(value as string) || undefined} onValueChange={onChange}>
              <SelectTrigger aria-label={w.title} className={error ? 'border-[var(--color-error)]' : undefined}>
                <SelectValue placeholder={w.placeholder || t('renderer.select')} />
              </SelectTrigger>
              <SelectContent>
                {(w.options ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </FieldShell>
      )
    case 'CHECKBOX': {
      const chosen = Array.isArray(value) ? (value as string[]) : []
      return (
        <FieldShell widget={w} error={error}>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(w.options ?? []).map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={chosen.includes(o.id)}
                  onCheckedChange={(on) => onChange(on ? [...chosen, o.id] : chosen.filter((x) => x !== o.id))} />
                {o.label}
              </label>
            ))}
          </div>
        </FieldShell>
      )
    }
    case 'DATE':
      return (
        <FieldShell widget={w} error={error} htmlFor={inputId}>
          <Input id={inputId} type={w.dateFormat === 'DATETIME' ? 'datetime-local' : 'date'} value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value || null)} invalid={!!error} />
        </FieldShell>
      )
    case 'DATE_RANGE': {
      const r = (value as DateRangeValue) ?? {}
      const kind = w.dateFormat === 'DATETIME' ? 'datetime-local' : 'date'
      const duration = state.durations[w.id]
      return (
        <FieldShell widget={w} error={error}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type={kind} aria-label={t('renderer.start')} value={r.start ?? ''} invalid={!!error}
              onChange={(e) => onChange({ ...r, start: e.target.value || null })} />
            <Input type={kind} aria-label={t('renderer.end')} value={r.end ?? ''} invalid={!!error}
              onChange={(e) => onChange({ ...r, end: e.target.value || null })} />
          </div>
          {w.showDuration && (
            <p className="mt-1.5 text-sm">
              <span className="text-[var(--color-muted-foreground)]">{w.durationLabel || t('renderer.duration')}: </span>
              <span className="font-medium tabular-nums">
                {duration == null ? t('renderer.autoCalculated')
                  : t(w.durationUnit === 'HOUR' ? 'renderer.hours' : 'renderer.days', { count: duration, value: fmt.number(duration) })}
              </span>
            </p>
          )}
        </FieldShell>
      )
    }
    case 'TABLE':
      return <TableField widget={w} value={value} onChange={onChange} mode={mode} state={state} errors={errors} />
    case 'IMAGE':
    case 'ATTACHMENT':
      return (
        <FieldShell widget={w} error={error}>
          <FilesField widget={w} value={(value as UploadedFile[]) ?? []} onChange={onChange} disabled={mode === 'preview'} />
        </FieldShell>
      )
    case 'CONTACT': {
      const people = (Array.isArray(value) ? value : []) as RefValue[]
      return (
        <FieldShell widget={w} error={error}>
          <UserPickerPopover value={people} invalid={!!error} placeholder={w.placeholder || t('renderer.choosePeople')}
            onChange={(list) => onChange((w.multiple ? list : list.slice(-1)).map((p) => ({ id: p.id, name: p.name })))} />
        </FieldShell>
      )
    }
    case 'DEPARTMENT':
      return (
        <FieldShell widget={w} error={error}>
          <UnitField widget={w} value={(Array.isArray(value) ? value : []) as RefValue[]} onChange={onChange} invalid={!!error} />
        </FieldShell>
      )
    default:
      return null
  }
}

function TableField({ widget: w, value, onChange, mode, state, errors }: {
  widget: FormWidget; value: unknown; onChange: (v: unknown) => void; mode: RendererMode; state: FormState
  errors: Record<string, string>
}) {
  const { t } = useTranslation('approvalForms')
  const fmt = useFormat()
  const rows = (Array.isArray(value) && value.length ? value : [{}]) as Record<string, unknown>[]
  const columns = w.children ?? []
  const setRow = (i: number, row: Record<string, unknown>) => onChange(rows.map((r, j) => (j === i ? row : r)))
  const sums = columns.filter((c) => c.type === 'NUMBER' || c.type === 'AMOUNT')
  return (
    <FieldShell widget={w} error={errors[w.id]}>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-card border border-[var(--color-border)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{t('renderer.row', { n: i + 1 })}</span>
              {mode !== 'view' && rows.length > 1 && (
                <Button variant="ghost" size="icon-sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  aria-label={t('renderer.removeRow', { n: i + 1 })} title={t('renderer.removeRow', { n: i + 1 })}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {columns.map((c) => (
                <WidgetField key={c.id} widget={c} value={row[c.id]} mode={mode} state={state} errors={errors}
                  errorKey={`${w.id}.${i}.${c.id}`} onChange={(v) => setRow(i, { ...row, [c.id]: v })} />
              ))}
            </div>
          </div>
        ))}
        {mode !== 'view' && (
          <Button variant="outline" size="sm" onClick={() => onChange([...rows, {}])}>
            <Plus aria-hidden="true" /> {w.addLabel || t('renderer.addRow')}
          </Button>
        )}
        {w.showTotal && sums.length > 0 && (
          <div className="space-y-1 rounded-card bg-[var(--color-muted)] px-3 py-2 text-sm">
            {sums.map((c) => (
              <div key={c.id} className="flex justify-between gap-3">
                <span className="text-[var(--color-muted-foreground)]">{t('renderer.total', { name: c.title })}</span>
                <span className="font-medium tabular-nums">{numberTextFor(c, state.columnSums[`${w.id}.${c.id}`] ?? 0, fmt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </FieldShell>
  )
}

function FilesField({ widget: w, value, onChange, disabled }: {
  widget: FormWidget; value: UploadedFile[]; onChange: (v: unknown) => void; disabled: boolean
}) {
  const { t } = useTranslation('approvalForms')
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const max = w.maxCount ?? MAX_FILES
  const upload = async (files: File[]) => {
    const room = files.slice(0, Math.max(0, max - value.length))
    if (!room.length) return
    setBusy(true)
    try {
      const uploaded = await approvalFormsApi.upload(room)
      onChange([...value, ...uploaded])
    } catch (e) {
      toastUploadError(e, () => void upload(room))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((f) => (
            <li key={f.publicId} className="flex items-center gap-2 rounded-control border border-[var(--color-border)] px-2.5 py-1.5 text-sm">
              {w.type === 'IMAGE'
                ? <img src={f.url} alt="" className="h-8 w-8 rounded object-cover" />
                : <Paperclip size={14} aria-hidden="true" className="shrink-0 text-[var(--color-muted-foreground)]" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.publicId !== f.publicId))}
                aria-label={t('renderer.removeFile', { name: f.name })} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]">
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <>
          <input ref={inputRef} type="file" hidden multiple={max - value.length > 1}
            accept={w.type === 'IMAGE' ? 'image/*' : undefined}
            onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          <Button variant="outline" size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
            {w.type === 'IMAGE' ? t('renderer.uploadImage') : t('renderer.uploadFile')}
          </Button>
          <p className="text-caption">{disabled ? t('renderer.uploadDisabledInPreview') : t('renderer.maxFiles', { count: max })}</p>
        </>
      )}
    </div>
  )
}

function UnitField({ widget: w, value, onChange, invalid }: {
  widget: FormWidget; value: RefValue[]; onChange: (v: unknown) => void; invalid: boolean
}) {
  const { t } = useTranslation('approvalForms')
  const { data } = useQuery({ queryKey: ['approval-forms', 'directory-units'], queryFn: approvalFormsApi.units, staleTime: 5 * 60_000 })
  const options = useMemo<PickOption[]>(() => {
    const list = data ?? []
    const parent = new Map(list.map((u) => [u.id, u.parentId]))
    const depth = (id: string | null, n = 0): number => (id && parent.get(id) && n < 20 ? depth(parent.get(id)!, n + 1) : n)
    return list.map((u) => ({ value: u.id, label: u.name, depth: depth(u.id) }))
  }, [data])
  const names = new Map(options.map((o) => [o.value, o.label]))
  return (
    <MultiSelectPopover
      value={value.map((v) => v.id)}
      options={options}
      single={!w.multiple}
      invalid={invalid}
      placeholder={w.placeholder || t('renderer.chooseUnits')}
      onChange={(ids) => {
        const picked = w.multiple ? ids : ids.slice(-1)
        onChange(picked.map((id) => ({ id, name: names.get(id) ?? value.find((v) => v.id === id)?.name ?? id })))
      }}
    />
  )
}

/** Giá trị đã nộp, chỉ đọc. */
function ViewValue({ widget: w, value, numberText }: {
  widget: FormWidget; value: unknown; numberText: (n: number | null | undefined) => string
}) {
  const { t } = useTranslation('approvalForms')
  const fmt = useFormat()
  if (isEmpty(value)) return <p className="text-sm text-[var(--color-muted-foreground)]">—</p>
  const text = (s: ReactNode) => <p className="whitespace-pre-wrap text-sm">{s}</p>
  const label = (id: unknown) => (w.options ?? []).find((o) => o.id === id)?.label ?? String(id)
  switch (w.type) {
    case 'NUMBER':
    case 'AMOUNT':
      return text(numberText(Number(value)))
    case 'RADIO':
      return text(label(value))
    case 'CHECKBOX':
      return text((value as string[]).map(label).join(', '))
    case 'DATE':
      return text(w.dateFormat === 'DATETIME' ? fmt.dateTime(value as string) : fmt.date(value as string))
    case 'DATE_RANGE': {
      const r = value as DateRangeValue
      const f = (s?: string | null) => (s ? (w.dateFormat === 'DATETIME' ? fmt.dateTime(s) : fmt.date(s)) : '—')
      return text(
        <>
          {f(r.start)} → {f(r.end)}
          {r.duration != null && (
            <span className="text-[var(--color-muted-foreground)]">
              {' · '}{t(w.durationUnit === 'HOUR' ? 'renderer.hours' : 'renderer.days', { count: r.duration, value: fmt.number(r.duration) })}
            </span>
          )}
        </>,
      )
    }
    case 'CONTACT':
    case 'DEPARTMENT':
      return text((value as RefValue[]).map((v) => v.name).join(', '))
    case 'IMAGE':
    case 'ATTACHMENT':
      return (
        <ul className="flex flex-wrap gap-2">
          {(value as UploadedFile[]).map((f) => (
            <li key={f.publicId}>
              <a href={f.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-control border border-[var(--color-border)] px-2.5 py-1 text-sm hover:bg-[var(--color-muted)]">
                {w.type === 'IMAGE' ? <img src={f.url} alt="" className="h-10 w-10 rounded object-cover" /> : <Paperclip size={14} aria-hidden="true" />}
                <span className="max-w-[16rem] truncate">{f.name}</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )
    case 'TABLE': {
      const rows = value as Record<string, unknown>[]
      return (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="rounded-card border border-[var(--color-border)] p-3">
              <p className="mb-2 text-sm font-medium">{t('renderer.row', { n: i + 1 })}</p>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {(w.children ?? []).map((c) => (
                  <div key={c.id}>
                    <dt className="text-caption">{c.title}</dt>
                    <dd><ViewValue widget={c} value={row[c.id]} numberText={(n) => numberTextFor(c, n, fmt)} /></dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )
    }
    default:
      return text(String(value))
  }
}

function numberTextFor(w: FormWidget, n: number | null | undefined, fmt: ReturnType<typeof useFormat>) {
  if (n == null || !Number.isFinite(n)) return '—'
  const base = w.currency
    ? fmt.number(n, { style: 'currency', currency: w.currency, minimumFractionDigits: 0, maximumFractionDigits: w.decimals ?? 2 })
    : fmt.number(n, { maximumFractionDigits: w.decimals ?? 4 })
  return w.unit ? `${base} ${w.unit}` : base
}
