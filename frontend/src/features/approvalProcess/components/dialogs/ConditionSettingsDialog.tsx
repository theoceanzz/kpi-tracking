import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import type {
  ApprovalObjectType,
  ApprovalProcessCatalog,
  ConditionGroup,
  ConditionRule,
  PersonRef,
  ProcessNode,
} from '../../types'
import type { ProcessOptions } from '../../hooks/useProcessOptions'
import MultiSelectPopover from '../pickers/MultiSelectPopover'
import UserPickerPopover from '../pickers/UserPickerPopover'

type FieldInfo = ApprovalProcessCatalog['fields'][number]

interface Form {
  name: string
  groups: ConditionGroup[]
}

const emptyRule = (): ConditionRule => ({ field: null, operator: null, values: [] })

function isBlank(r: ConditionRule) {
  return !r.field && !r.operator && r.values.length === 0
}

function isComplete(r: ConditionRule, fields: Map<string, FieldInfo>) {
  if (!r.field || !r.operator) return false
  if (r.operator === 'IS_TRUE' || r.operator === 'IS_FALSE') return true
  const info = fields.get(r.field)
  const values = r.values.filter((v) => v.trim())
  if (info?.valueType === 'NUMBER') return values.length === 1 && Number.isFinite(Number(values[0]))
  return values.length > 0
}

interface Props {
  open: boolean
  node: ProcessNode | null
  objectType: ApprovalObjectType | null
  catalog: ApprovalProcessCatalog | undefined
  options: ProcessOptions
  users: Record<string, PersonRef>
  onUsers: (people: PersonRef[]) => void
  readOnly?: boolean
  draftKey: string
  onClose: () => void
  onSave: (patch: Pick<ProcessNode, 'name' | 'groups'>) => void
}

/**
 * "Cài đặt điều kiện duyệt": tên điều kiện + các nhóm. Trong một nhóm mọi dòng phải thoả đồng
 * thời; giữa các nhóm là "hoặc". Mỗi dòng là [trường] [phép so sánh] [giá trị].
 *
 * Thân hộp thoại gắn `key` theo node nên form khởi tạo lại mỗi lần mở một điều kiện khác.
 */
export default function ConditionSettingsDialog(props: Props) {
  if (!props.open || !props.node) return null
  return <ConditionSettingsBody key={props.node.id} {...props} node={props.node} />
}

function ConditionSettingsBody({
  node, objectType, catalog, options, users, onUsers, readOnly, draftKey, onClose, onSave,
}: Props & { node: ProcessNode }) {
  const { t } = useTranslation('approvalProcess')
  const [form, setForm] = useState<Form>(() => ({
    name: node.name ?? '',
    groups: node.groups?.length
      ? node.groups.map((g) => ({ rules: g.rules.map((r) => ({ ...r, values: [...r.values] })) }))
      : [{ rules: [emptyRule()] }],
  }))
  const [showErrors, setShowErrors] = useState(false)

  const draft = useStateDraft(form, setForm, { key: draftKey, enabled: !readOnly })

  const fields = useMemo(() => new Map((catalog?.fields ?? []).map((f) => [f.code as string, f])), [catalog])
  const availableFields = useMemo(
    () => (catalog?.fields ?? []).filter((f) => !objectType || f.objects.includes(objectType)),
    [catalog, objectType],
  )

  const patchRule = (gi: number, ri: number, patch: Partial<ConditionRule>) =>
    setForm((f) => ({
      ...f,
      groups: f.groups.map((g, i) => (i !== gi ? g : { rules: g.rules.map((r, j) => (j === ri ? { ...r, ...patch } : r)) })),
    }))
  const addRule = (gi: number) =>
    setForm((f) => ({ ...f, groups: f.groups.map((g, i) => (i === gi ? { rules: [...g.rules, emptyRule()] } : g)) }))
  const removeRule = (gi: number, ri: number) =>
    setForm((f) => ({
      ...f,
      groups: f.groups
        .map((g, i) => (i === gi ? { rules: g.rules.filter((_, j) => j !== ri) } : g))
        .filter((g) => g.rules.length > 0),
    }))
  const addGroup = () => setForm((f) => ({ ...f, groups: [...f.groups, { rules: [emptyRule()] }] }))
  const removeGroup = (gi: number) => setForm((f) => ({ ...f, groups: f.groups.filter((_, i) => i !== gi) }))

  const cleaned = form.groups
    .map((g) => ({ rules: g.rules.filter((r) => !isBlank(r)) }))
    .filter((g) => g.rules.length > 0)
  const incomplete = cleaned.some((g) => g.rules.some((r) => !isComplete(r, fields)))
  const empty = cleaned.length === 0

  const save = () => {
    if (incomplete || empty) {
      setShowErrors(true)
      return
    }
    draft.clear()
    onSave({ name: form.name.trim() || t('canvas.defaultConditionName'), groups: cleaned })
  }

  const valueEditor = (rule: ConditionRule, gi: number, ri: number) => {
    const info = rule.field ? fields.get(rule.field) : undefined
    if (!info || !rule.operator) {
      return <Input disabled placeholder={t('conditionDialog.valuePlaceholder')} />
    }
    if (rule.operator === 'IS_TRUE' || rule.operator === 'IS_FALSE') return <span className="hidden sm:block" />
    const invalid = showErrors && !isComplete(rule, fields)
    const set = (values: string[]) => patchRule(gi, ri, { values })
    const common = { value: rule.values, onChange: set, disabled: readOnly, invalid, placeholder: t('conditionDialog.valuePlaceholder') }
    switch (info.valueType) {
      case 'ENUM':
        return <MultiSelectPopover {...common} options={info.options.map((o) => ({ value: o, label: t(`enumValues.${o}`) }))} />
      case 'ROLE':
        return <MultiSelectPopover {...common} options={options.roles} />
      case 'ORG_LEVEL':
        return <MultiSelectPopover {...common} options={options.levels} />
      case 'PERIOD':
        return <MultiSelectPopover {...common} options={options.periods} />
      case 'ORG_UNIT':
        return <MultiSelectPopover {...common} options={options.units} />
      case 'USER':
        return (
          <UserPickerPopover
            value={rule.values.map((id) => users[id] ?? { id, name: t('pickers.unknown') })}
            onChange={(people) => { onUsers(people); set(people.map((p) => p.id)) }}
            disabled={readOnly}
            invalid={invalid}
            placeholder={t('conditionDialog.valuePlaceholder')}
          />
        )
      case 'NUMBER':
        return (
          <Input
            type="number"
            data-keep-value-on-focus
            value={rule.values[0] ?? ''}
            onChange={(e) => set(e.target.value ? [e.target.value] : [])}
            disabled={readOnly}
            invalid={invalid}
            placeholder={t('conditionDialog.numberPlaceholder')}
            suffix={info.code === 'WEIGHT' || info.code === 'TARGET_CHANGE_PERCENT' ? '%' : undefined}
            className="no-edit-hint"
          />
        )
      default:
        return null
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={t('conditionDialog.title')}
      footer={
        <DialogFooter
          note={showErrors && (incomplete || empty)
            ? <span className="text-[var(--color-error)]">{empty ? t('conditionDialog.needOneRule') : t('conditionDialog.incompleteRules')}</span>
            : undefined}
          secondary={<Button variant="outline" onClick={onClose}>{readOnly ? t('common.close') : t('common.cancel')}</Button>}
          primary={readOnly ? undefined : <Button onClick={save}>{t('common.update')}</Button>}
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        <div>
          <label htmlFor="condition-name" className="mb-1.5 block text-label">{t('conditionDialog.name')}</label>
          <Input
            id="condition-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('conditionDialog.namePlaceholder')}
            disabled={readOnly}
            maxLength={255}
          />
        </div>

        {form.groups.map((g, gi) => (
          <div key={gi} className="space-y-3">
            {gi > 0 && (
              <div className="flex items-center gap-3 text-eyebrow text-[var(--color-muted-foreground)]" role="separator">
                <span className="h-px flex-1 bg-[var(--color-border)]" />
                {t('conditionDialog.or')}
                <span className="h-px flex-1 bg-[var(--color-border)]" />
              </div>
            )}
            <div className="relative rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4">
              <p className="mb-3 pr-8 text-sm font-medium italic">{t('conditionDialog.allOfTheFollowing')}</p>
              {!readOnly && form.groups.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-2 top-2"
                  onClick={() => removeGroup(gi)}
                  aria-label={t('conditionDialog.removeGroup')}
                  title={t('conditionDialog.removeGroup')}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
              <div className="space-y-2">
                {g.rules.map((rule, ri) => {
                  const info = rule.field ? fields.get(rule.field) : undefined
                  return (
                    <div key={ri} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,11rem)_minmax(0,1fr)_auto] sm:items-start">
                      <Select
                        value={rule.field ?? undefined}
                        onValueChange={(v) => {
                          const next = fields.get(v)
                          patchRule(gi, ri, { field: next?.code ?? null, operator: next?.operators[0] ?? null, values: [] })
                        }}
                        disabled={readOnly}
                      >
                        <SelectTrigger aria-label={t('conditionDialog.field')} className={showErrors && !rule.field ? 'border-[var(--color-error)]' : undefined}>
                          <SelectValue placeholder={t('conditionDialog.chooseField')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((f) => <SelectItem key={f.code} value={f.code}>{t(`fields.${f.code}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select
                        value={rule.operator ?? undefined}
                        onValueChange={(v) => {
                          const op = info?.operators.find((o) => o === v) ?? null
                          patchRule(gi, ri, { operator: op, values: op === 'IS_TRUE' || op === 'IS_FALSE' ? [] : rule.values })
                        }}
                        disabled={readOnly || !info}
                      >
                        <SelectTrigger aria-label={t('conditionDialog.operator')}>
                          <SelectValue placeholder={t('conditionDialog.compare')} />
                        </SelectTrigger>
                        <SelectContent>
                          {(info?.operators ?? []).map((o) => <SelectItem key={o} value={o}>{t(`operators.${o}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="min-w-0">{valueEditor(rule, gi, ri)}</div>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRule(gi, ri)}
                          aria-label={t('conditionDialog.removeRule')}
                          title={t('conditionDialog.removeRule')}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => addRule(gi)}>
                  <Plus aria-hidden="true" /> {t('conditionDialog.addRule')}
                </Button>
              )}
            </div>
          </div>
        ))}

        {!readOnly && (
          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus aria-hidden="true" /> {t('conditionDialog.addGroup')}
          </Button>
        )}
      </div>
    </Dialog>
  )
}
