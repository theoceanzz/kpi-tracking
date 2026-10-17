import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ConditionOperator } from '@/features/approvalProcess/types'
import MultiSelectPopover from '@/features/approvalProcess/components/pickers/MultiSelectPopover'
import { NUMBER_OPS, OPTION_OPS, isChoice, isNumeric } from '../../model/formState'
import { formulaFromText, formulaToText } from '../../model/formula'
import { CURRENCIES, MAX_FILES, TABLE_CHILD_TYPES, newOptionId } from '../../model/widgets'
import type { FormIssue } from '../../model/formIssues'
import type { FormSchema, FormWidget, VisibilityRule, WidgetType } from '../../types'

const NONE = '__none__'

/**
 * Cột phải của bước "Thiết kế form": thiết lập của widget đang chọn — tab Cơ bản (tiêu đề, gợi ý, bắt buộc, thiết lập
 * riêng từng loại) và tab Hiển thị (điều kiện hiện theo widget chọn / số phía trên).
 */
export default function WidgetSettings({
  widget, parent, schema, onChange, onAddColumn, onMoveColumn, onSelect, issues, showErrors, focus, readOnly,
}: {
  widget: FormWidget
  /** Bảng chứa widget này nếu là cột bảng. */
  parent: FormWidget | null
  schema: FormSchema
  onChange: (next: FormWidget) => void
  onAddColumn: (type: WidgetType) => void
  onMoveColumn: (childId: string, delta: -1 | 1) => void
  onSelect: (id: string) => void
  issues: FormIssue[]
  showErrors: boolean
  /** Ô cần focus (hộp "chỗ chưa xong" vừa nhảy tới). */
  focus: { setting?: string; seq: number } | null
  readOnly: boolean
}) {
  const { t } = useTranslation('approvalForms')
  const [tab, setTab] = useState<'basic' | 'visibility'>('basic')
  const rootRef = useRef<HTMLDivElement>(null)
  const set = (patch: Partial<FormWidget>) => onChange({ ...widget, ...patch })
  const issueOf = (setting: string) => (showErrors ? issues.find((i) => i.widgetId === widget.id && i.setting === setting) : undefined)
  const errorText = (setting: string) => {
    const e = issueOf(setting)
    return e ? <p className="mt-1 text-xs text-[var(--color-error)]">{t(`issues.${e.key}`, e.args)}</p> : null
  }

  const focusSeq = focus?.seq
  useEffect(() => {
    if (!focus) return
    if (focus.setting === 'visibility') setTab('visibility')
    else setTab('basic')
    const timer = window.setTimeout(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-setting="${focus.setting ?? 'title'}"]`)
      const target = el?.matches('input,textarea,button') ? el : el?.querySelector<HTMLElement>('input,textarea,button')
      target?.focus()
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
    return () => window.clearTimeout(timer)
    // Chỉ khi có yêu cầu focus MỚI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq])

  const hasVisibility = !parent && widget.type !== 'DESCRIPTION'
  const index = schema.widgets.findIndex((w) => w.id === widget.id)
  const sources = schema.widgets.slice(0, Math.max(index, 0)).filter((w) => isChoice(w) || isNumeric(w))

  return (
    <div ref={rootRef} className="space-y-4">
      <h2 className="text-section-title">{t(`widgets.${widget.type}`)}</h2>
      {hasVisibility && (
        <div role="tablist" className="grid grid-cols-2 rounded-control border border-[var(--color-border)] p-0.5">
          {(['basic', 'visibility'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn('rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-sm transition-colors',
                tab === k ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'hover:bg-[var(--color-muted)]')}>
              {t(`settings.tab_${k}`)}
              {k === 'visibility' && (widget.visibility?.length ?? 0) > 0 && ` (${widget.visibility!.length})`}
            </button>
          ))}
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-4">
        {tab === 'basic' || !hasVisibility ? (
          <>
            <Field label={t('settings.title')} required setting="title" error={errorText('title')}>
              <Input value={widget.title} onChange={(e) => set({ title: e.target.value })} maxLength={100}
                invalid={!!issueOf('title')} />
            </Field>

            {widget.type === 'DESCRIPTION' ? (
              <Field label={t('settings.content')} required setting="content" error={errorText('content')}>
                <Textarea rows={5} value={widget.content ?? ''} onChange={(e) => set({ content: e.target.value })}
                  maxLength={2000} invalid={!!issueOf('content')} />
              </Field>
            ) : widget.type !== 'FORMULA' && (
              <Field label={t('settings.placeholder')} setting="placeholder" error={errorText('placeholder')}>
                <Input value={widget.placeholder ?? ''} onChange={(e) => set({ placeholder: e.target.value || null })}
                  placeholder={t('settings.placeholderHint')} maxLength={200} />
              </Field>
            )}

            <TypeSettings widget={widget} schema={schema} set={set} errorText={errorText} issueOf={issueOf}
              onAddColumn={onAddColumn} onMoveColumn={onMoveColumn} onSelect={onSelect} />

            {widget.type !== 'DESCRIPTION' && widget.type !== 'FORMULA' && (
              <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
                <p className="text-label">{t('settings.other')}</p>
                <label className="flex items-center gap-2 text-sm" data-setting="required">
                  <Checkbox checked={!!widget.required} onCheckedChange={(required) => set({ required })} />
                  {t('settings.required')}
                </label>
              </div>
            )}
          </>
        ) : (
          <VisibilityEditor widget={widget} sources={sources} onChange={(visibility) => set({ visibility })}
            error={errorText('visibility')} />
        )}
      </fieldset>
    </div>
  )
}

function Field({ label, required, setting, error, hint, children }: {
  label: string; required?: boolean; setting: string; error?: ReactNode; hint?: string; children: ReactNode
}) {
  return (
    <div data-setting={setting}>
      <span className="mb-1.5 block text-label">
        {label}{required && <span className="ml-0.5 text-[var(--color-error)]">*</span>}
      </span>
      {children}
      {hint && <p className="mt-1 text-caption">{hint}</p>}
      {error}
    </div>
  )
}

const numberOrNull = (v: string) => (v === '' ? null : Number(v))

function TypeSettings({ widget: w, schema, set, errorText, issueOf, onAddColumn, onMoveColumn, onSelect }: {
  widget: FormWidget
  schema: FormSchema
  set: (patch: Partial<FormWidget>) => void
  errorText: (setting: string) => ReactNode
  issueOf: (setting: string) => FormIssue | undefined
  onAddColumn: (type: WidgetType) => void
  onMoveColumn: (childId: string, delta: -1 | 1) => void
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('approvalForms')
  const decimals = (
    <Field label={t('settings.decimals')} setting="decimals" error={errorText('decimals')}>
      <Select value={String(w.decimals ?? 0)} onValueChange={(v) => set({ decimals: Number(v) })}>
        <SelectTrigger aria-label={t('settings.decimals')}><SelectValue /></SelectTrigger>
        <SelectContent>{['0', '1', '2', '3', '4'].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  )

  switch (w.type) {
    case 'TEXT':
    case 'TEXTAREA':
      return (
        <Field label={t('settings.maxLength')} setting="maxLength" error={errorText('maxLength')} hint={t('settings.maxLengthHint')}>
          <Input type="number" data-keep-value-on-focus className="no-edit-hint" value={w.maxLength == null ? '' : String(w.maxLength)}
            onChange={(e) => set({ maxLength: numberOrNull(e.target.value) })} invalid={!!issueOf('maxLength')} />
        </Field>
      )
    case 'NUMBER':
      return (
        <>
          {decimals}
          <Field label={t('settings.unit')} setting="unit">
            <Input value={w.unit ?? ''} onChange={(e) => set({ unit: e.target.value || null })} maxLength={20}
              placeholder={t('settings.unitPlaceholder')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('settings.min')} setting="min" error={errorText('min')}>
              <Input type="number" data-keep-value-on-focus className="no-edit-hint" value={w.min == null ? '' : String(w.min)}
                onChange={(e) => set({ min: numberOrNull(e.target.value) })} invalid={!!issueOf('min')} />
            </Field>
            <Field label={t('settings.max')} setting="max">
              <Input type="number" data-keep-value-on-focus className="no-edit-hint" value={w.max == null ? '' : String(w.max)}
                onChange={(e) => set({ max: numberOrNull(e.target.value) })} />
            </Field>
          </div>
        </>
      )
    case 'AMOUNT':
      return (
        <>
          <Field label={t('settings.currency')} setting="currency">
            <Select value={w.currency ?? 'VND'} onValueChange={(currency) => set({ currency })}>
              <SelectTrigger aria-label={t('settings.currency')}><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {decimals}
        </>
      )
    case 'FORMULA':
      return (
        <>
          <FormulaEditor widget={w} schema={schema} onChange={(expression) => set({ expression })}
            error={errorText('expression')} invalid={!!issueOf('expression')} />
          <Field label={t('settings.currency')} setting="currency" hint={t('settings.formulaCurrencyHint')}>
            <Select value={w.currency ?? NONE} onValueChange={(v) => set({ currency: v === NONE ? null : v })}>
              <SelectTrigger aria-label={t('settings.currency')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('settings.noCurrency')}</SelectItem>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {decimals}
        </>
      )
    case 'RADIO':
    case 'CHECKBOX':
      return (
        <>
          <OptionsEditor widget={w} set={set} error={errorText('options')} invalid={!!issueOf('options')} />
          {w.type === 'RADIO' && (
            <>
              <Field label={t('settings.display')} setting="display">
                <Select value={w.display ?? 'DROPDOWN'} onValueChange={(v) => set({ display: v as FormWidget['display'] })}>
                  <SelectTrigger aria-label={t('settings.display')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DROPDOWN">{t('settings.displayDropdown')}</SelectItem>
                    <SelectItem value="LIST">{t('settings.displayList')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('settings.defaultValue')} setting="defaultValue" error={errorText('defaultValue')}>
                <Select value={typeof w.defaultValue === 'string' ? w.defaultValue : NONE}
                  onValueChange={(v) => set({ defaultValue: v === NONE ? null : v })}>
                  <SelectTrigger aria-label={t('settings.defaultValue')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t('settings.noDefault')}</SelectItem>
                    {(w.options ?? []).filter((o) => o.label.trim()).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </>
      )
    case 'DATE':
    case 'DATE_RANGE':
      return (
        <>
          <Field label={t('settings.dateFormat')} setting="dateFormat">
            <Select value={w.dateFormat ?? 'DATE'} onValueChange={(v) => set({
              dateFormat: v as FormWidget['dateFormat'],
              durationUnit: w.type === 'DATE_RANGE' ? (v === 'DATETIME' ? 'HOUR' : 'DAY') : w.durationUnit,
            })}>
              <SelectTrigger aria-label={t('settings.dateFormat')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DATE">{t('settings.formatDate')}</SelectItem>
                <SelectItem value="DATETIME">{t('settings.formatDateTime')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {w.type === 'DATE' ? (
            <label className="flex items-center gap-2 text-sm" data-setting="defaultValue">
              <Checkbox checked={w.defaultValue === 'TODAY'} onCheckedChange={(on) => set({ defaultValue: on ? 'TODAY' : null })} />
              {t('settings.defaultToday')}
            </label>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm" data-setting="showDuration">
                <Checkbox checked={!!w.showDuration} onCheckedChange={(showDuration) => set({ showDuration })} />
                {t('settings.showDuration')}
              </label>
              {w.showDuration && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('settings.durationUnit')} setting="durationUnit">
                    <Select value={w.durationUnit ?? 'DAY'} onValueChange={(v) => set({ durationUnit: v as FormWidget['durationUnit'] })}
                      disabled={w.dateFormat !== 'DATETIME'}>
                      <SelectTrigger aria-label={t('settings.durationUnit')}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAY">{t('settings.unitDay')}</SelectItem>
                        <SelectItem value="HOUR">{t('settings.unitHour')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('settings.durationLabel')} setting="durationLabel">
                    <Input value={w.durationLabel ?? ''} onChange={(e) => set({ durationLabel: e.target.value || null })}
                      placeholder={t('renderer.duration')} maxLength={50} />
                  </Field>
                </div>
              )}
              <p className="text-caption">{t('settings.durationHint')}</p>
            </>
          )}
        </>
      )
    case 'TABLE':
      return (
        <>
          <Field label={t('settings.columns')} required setting="children" error={errorText('children')}>
            <ul className="space-y-1.5">
              {(w.children ?? []).map((c, i, list) => (
                <li key={c.id} className="flex items-center gap-1 rounded-control border border-[var(--color-border)] px-2 py-1 text-sm">
                  <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate text-left hover:underline">
                    {c.title} <span className="text-caption">· {t(`widgets.${c.type}`)}</span>
                  </button>
                  <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => onMoveColumn(c.id, -1)} aria-label={t('settings.moveUp')}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" disabled={i === list.length - 1} onClick={() => onMoveColumn(c.id, 1)} aria-label={t('settings.moveDown')}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <Select value="" onValueChange={(v) => onAddColumn(v as WidgetType)}>
              <SelectTrigger aria-label={t('settings.addColumn')} className="mt-2"><SelectValue placeholder={t('settings.addColumn')} /></SelectTrigger>
              <SelectContent>{TABLE_CHILD_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`widgets.${type}`)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={t('settings.addLabel')} setting="addLabel">
            <Input value={w.addLabel ?? ''} onChange={(e) => set({ addLabel: e.target.value || null })}
              placeholder={t('renderer.addRow')} maxLength={50} />
          </Field>
          <label className="flex items-center gap-2 text-sm" data-setting="showTotal">
            <Checkbox checked={!!w.showTotal} onCheckedChange={(showTotal) => set({ showTotal })} />
            {t('settings.showTotal')}
          </label>
        </>
      )
    case 'IMAGE':
    case 'ATTACHMENT':
      return (
        <Field label={t('settings.maxCount')} setting="maxCount" error={errorText('maxCount')}>
          <Select value={String(w.maxCount ?? MAX_FILES)} onValueChange={(v) => set({ maxCount: Number(v) })}>
            <SelectTrigger aria-label={t('settings.maxCount')}><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: MAX_FILES }, (_, i) => String(i + 1)).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )
    case 'CONTACT':
    case 'DEPARTMENT':
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm" data-setting="multiple">
            <Checkbox checked={!!w.multiple} onCheckedChange={(multiple) => set({ multiple })} />
            {t('settings.multiple')}
          </label>
          <label className="flex items-center gap-2 text-sm" data-setting="defaultValue">
            <Checkbox checked={w.defaultValue != null}
              onCheckedChange={(on) => set({ defaultValue: on ? (w.type === 'CONTACT' ? 'ME' : 'MY_UNIT') : null })} />
            {w.type === 'CONTACT' ? t('settings.defaultMe') : t('settings.defaultMyUnit')}
          </label>
        </div>
      )
    default:
      return null
  }
}

function OptionsEditor({ widget: w, set, error, invalid }: {
  widget: FormWidget; set: (patch: Partial<FormWidget>) => void; error: ReactNode; invalid: boolean
}) {
  const { t } = useTranslation('approvalForms')
  const options = w.options ?? []
  const update = (next: typeof options) => {
    // Phương án mặc định bị xoá thì bỏ mặc định luôn.
    const ids = new Set(next.map((o) => o.id))
    const def = w.defaultValue
    const keepDefault = Array.isArray(def) ? def.filter((d) => ids.has(String(d))) : def != null && ids.has(String(def)) ? def : null
    set({ options: next, defaultValue: keepDefault })
  }
  return (
    <Field label={t('settings.options')} required setting="options" error={error}>
      <ul className="space-y-1.5">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-center gap-1">
            <Input size="sm" value={o.label} invalid={invalid && !o.label.trim()}
              onChange={(e) => update(options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)))}
              aria-label={t('settings.optionN', { n: i + 1 })} maxLength={100} />
            <Button variant="ghost" size="icon-sm" disabled={i === 0} aria-label={t('settings.moveUp')}
              onClick={() => update(options.map((x, j) => (j === i - 1 ? options[i]! : j === i ? options[i - 1]! : x)))}>
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={options.length <= 1} aria-label={t('settings.removeOption')}
              onClick={() => update(options.filter((x) => x.id !== o.id))}>
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="mt-1"
        onClick={() => update([...options, { id: newOptionId(), label: t('settings.optionDefault', { n: options.length + 1 }) }])}>
        <Plus aria-hidden="true" /> {t('settings.addOption')}
      </Button>
    </Field>
  )
}

function FormulaEditor({ widget: w, schema, onChange, error, invalid }: {
  widget: FormWidget; schema: FormSchema; onChange: (expression: string) => void; error: ReactNode; invalid: boolean
}) {
  const { t } = useTranslation('approvalForms')
  const inputRef = useRef<HTMLInputElement>(null)
  const index = schema.widgets.findIndex((x) => x.id === w.id)
  const above = schema.widgets.slice(0, Math.max(index, 0))
  const numbers = above.filter(isNumeric)
  const columns = above.filter((x) => x.type === 'TABLE')
    .flatMap((tb) => (tb.children ?? []).filter((c) => c.type === 'NUMBER' || c.type === 'AMOUNT'))
  const text = formulaToText(w.expression ?? '', schema.widgets)
  const insert = (token: string) => {
    const el = inputRef.current
    const at = el?.selectionStart ?? text.length
    const next = text.slice(0, at) + token + text.slice(el?.selectionEnd ?? at)
    onChange(formulaFromText(next, schema.widgets))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }
  return (
    <Field label={t('settings.formula')} required setting="expression" error={error} hint={t('settings.formulaHint')}>
      <Input ref={inputRef} value={text} onChange={(e) => onChange(formulaFromText(e.target.value, schema.widgets))}
        placeholder={t('settings.formulaPlaceholder')} invalid={invalid} className="font-mono" />
      <div className="mt-2 flex flex-wrap gap-1">
        {['+', '-', '*', '/', '(', ')'].map((op) => (
          <Button key={op} variant="outline" size="sm" className="w-8 px-0 font-mono" onClick={() => insert(` ${op} `)}>{op}</Button>
        ))}
      </div>
      {numbers.length + columns.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {numbers.map((n) => (
            <Button key={n.id} variant="secondary" size="sm" onClick={() => insert(`[${n.title}]`)}>{n.title}</Button>
          ))}
          {columns.map((c) => (
            <Button key={c.id} variant="secondary" size="sm" onClick={() => insert(`SUM([${c.title}])`)}>
              {t('settings.sumOf', { name: c.title })}
            </Button>
          ))}
        </div>
      ) : <p className="mt-2 text-caption">{t('settings.formulaNoFields')}</p>}
    </Field>
  )
}

function VisibilityEditor({ widget, sources, onChange, error }: {
  widget: FormWidget; sources: FormWidget[]; onChange: (rules: VisibilityRule[]) => void; error: ReactNode
}) {
  const { t } = useTranslation('approvalForms')
  const rules = widget.visibility ?? []
  const byId = new Map(sources.map((s) => [s.id, s]))
  const patch = (i: number, p: Partial<VisibilityRule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <div className="space-y-3" data-setting="visibility">
      <p className="text-sm text-[var(--color-muted-foreground)]">{t('settings.visibilityHint')}</p>
      {sources.length === 0 ? (
        <p className="rounded-card bg-[var(--color-muted)] px-3 py-2 text-caption">{t('settings.visibilityNoSources')}</p>
      ) : (
        <>
          {rules.map((r, i) => {
            const source = byId.get(r.widget)
            const ops: ConditionOperator[] = source && isChoice(source) ? OPTION_OPS : NUMBER_OPS
            return (
              <div key={i} className="space-y-2 rounded-card border border-[var(--color-border)] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-caption">{i === 0 ? t('settings.when') : t('settings.and')}</span>
                  <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => onChange(rules.filter((_, j) => j !== i))}
                    aria-label={t('settings.removeRule')}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
                <Select value={source ? r.widget : undefined} onValueChange={(id) => {
                  const s = byId.get(id)
                  patch(i, { widget: id, operator: s && isChoice(s) ? 'IN' : 'GT', values: [] })
                }}>
                  <SelectTrigger aria-label={t('settings.sourceField')}><SelectValue placeholder={t('settings.sourceField')} /></SelectTrigger>
                  <SelectContent>{sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={r.operator} onValueChange={(op) => patch(i, { operator: op as ConditionOperator })} disabled={!source}>
                  <SelectTrigger aria-label={t('settings.operator')}><SelectValue /></SelectTrigger>
                  <SelectContent>{ops.map((op) => <SelectItem key={op} value={op}>{t(`operators.${op}`)}</SelectItem>)}</SelectContent>
                </Select>
                {source && isChoice(source) ? (
                  <MultiSelectPopover value={r.values} onChange={(values) => patch(i, { values })}
                    options={(source.options ?? []).map((o) => ({ value: o.id, label: o.label }))} placeholder={t('settings.chooseOptions')} />
                ) : (
                  <Input type="number" data-keep-value-on-focus className="no-edit-hint" disabled={!source} value={r.values[0] ?? ''}
                    onChange={(e) => patch(i, { values: e.target.value ? [e.target.value] : [] })} placeholder={t('settings.number')} />
                )}
              </div>
            )
          })}
          <Button variant="outline" size="sm" onClick={() => onChange([...rules, { widget: '', operator: 'IN', values: [] }])}>
            <Plus aria-hidden="true" /> {t('settings.addRule')}
          </Button>
        </>
      )}
      {error}
    </div>
  )
}
