import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DraftNotice from '@/components/common/DraftNotice'
import { InfoHint } from '@/components/common/InfoHint'
import { useStateDraft } from '@/hooks/useFormDraft'
import { cn } from '@/lib/utils'
import type { ApproverSpec, PersonRef, ProcessNode } from '../../types'
import type { ProcessOptions } from '../../hooks/useProcessOptions'
import ApproverPicker from '../pickers/ApproverPicker'

interface Form {
  name: string
  approvers: ApproverSpec[]
}

interface Props {
  open: boolean
  node: ProcessNode | null
  code?: string
  options: ProcessOptions
  users: Record<string, PersonRef>
  onUsers: (people: PersonRef[]) => void
  maxLevelsUp: number
  readOnly?: boolean
  draftKey: string
  onClose: () => void
  onSave: (patch: Pick<ProcessNode, 'name' | 'approvers'>) => void
}

/** "Cài đặt duyệt" của một bước: tên bước + người duyệt. Thân gắn `key` theo node, như hộp điều kiện. */
export default function StepSettingsDialog(props: Props) {
  if (!props.open || !props.node) return null
  return <StepSettingsBody key={props.node.id} {...props} node={props.node} />
}

function StepSettingsBody({
  node, code, options, users, onUsers, maxLevelsUp, readOnly, draftKey, onClose, onSave,
}: Props & { node: ProcessNode }) {
  const { t } = useTranslation('approvalProcess')
  const [form, setForm] = useState<Form>(() => ({ name: node.name ?? '', approvers: [...(node.approvers ?? [])] }))
  const [expanded, setExpanded] = useState(true)
  const [showErrors, setShowErrors] = useState(false)

  const draft = useStateDraft(form, setForm, { key: draftKey, enabled: !readOnly })

  const nameMissing = !form.name.trim()
  const approversMissing = form.approvers.length === 0

  const save = () => {
    if (nameMissing || approversMissing) {
      setShowErrors(true)
      setExpanded(true)
      return
    }
    draft.clear()
    onSave({ name: form.name.trim(), approvers: form.approvers })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={code ? t('stepDialog.titleWithCode', { code }) : t('stepDialog.title')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{readOnly ? t('common.close') : t('common.cancel')}</Button>}
          primary={readOnly ? undefined : <Button onClick={save}>{t('common.update')}</Button>}
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mb-3 flex w-full items-center gap-1.5 border-b border-[var(--color-border)] pb-2 text-left text-sm font-semibold text-[var(--color-primary)]"
      >
        <ChevronDown size={16} aria-hidden="true" className={cn('transition-transform', !expanded && '-rotate-90')} />
        {t('stepDialog.approvalInfo')}
      </button>
      {expanded && (
        <div className="space-y-4">
          <div>
            <label htmlFor="step-name" className="mb-1.5 block text-label">
              {t('stepDialog.name')} <span className="text-[var(--color-error)]">*</span>
            </label>
            <Input
              id="step-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('stepDialog.namePlaceholder')}
              invalid={showErrors && nameMissing}
              disabled={readOnly}
              maxLength={255}
              autoFocus
            />
            {showErrors && nameMissing && <p className="mt-1 text-caption text-[var(--color-error)]">{t('stepDialog.nameRequired')}</p>}
          </div>
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-label">
              <span>{t('stepDialog.approvers')} <span className="text-[var(--color-error)]">*</span></span>
              <InfoHint label={t('common.moreInfo')}>{t('stepDialog.approversHint')}</InfoHint>
            </span>
            <ApproverPicker
              value={form.approvers}
              onChange={(approvers) => setForm((f) => ({ ...f, approvers }))}
              options={options}
              users={users}
              onUsers={onUsers}
              maxLevelsUp={maxLevelsUp}
              disabled={readOnly}
              invalid={showErrors && approversMissing}
            />
            {showErrors && approversMissing && (
              <p className="mt-1 text-caption text-[var(--color-error)]">{t('stepDialog.approversRequired')}</p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
