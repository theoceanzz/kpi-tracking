import { AlertTriangle } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STAGE_HINTS } from '../../workflowStageIcons'
import type { WorkflowStage, WorkflowStageCode } from '../../types'
import { useTranslation } from 'react-i18next'

interface Props {
  stage: WorkflowStage
  /** Để tra tên các bước trong `requires`. */
  allStages: WorkflowStage[]
  warning?: string
  readOnly: boolean
  onOption: (code: WorkflowStageCode, key: string, value: unknown) => void
}

/**
 * Phần thân của drawer cài đặt một bước — chủ trang bọc nó trong `Drawer` và tự vẽ header (tên,
 * người thực hiện, công tắc).
 *
 * Chỉ còn những thứ HIẾM DÙNG: tuỳ chọn riêng và phụ thuộc. Thao tác hay dùng nhất — bật/tắt —
 * nằm ngay trên thẻ của sơ đồ và trên header drawer, không phải tìm xuống đây.
 */
export default function StageInspector({
  stage,
  allStages,
  warning,
  readOnly,
  onOption,
}: Props) {
  const { t } = useTranslation('kpi')
  const byCode = new Map(allStages.map(s => [s.code, s]))
  const requires = stage.requires.map(code => byCode.get(code)?.label ?? code)

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">{STAGE_HINTS()[stage.code]}</p>

      {warning && (
        <p className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 text-xs font-medium text-[var(--color-warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}

      {requires.length > 0 && (
        <div>
          <p className="text-eyebrow mb-1.5">{t('StageInspector.requiresStep')}</p>
          <div className="flex flex-wrap gap-1.5">
            {requires.map(label => (
              <span key={label} className="rounded-control bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {stage.enabled && (
        <StageOptions stage={stage} readOnly={readOnly} onOption={(k, v) => onOption(stage.code, k, v)} />
      )}
    </div>
  )
}

/** Tuỳ chọn riêng của từng bước. Chỉ hiện khi bước đang bật — tắt rồi thì tuỳ chọn vô nghĩa. */
function StageOptions({
  stage,
  readOnly,
  onOption,
}: {
  stage: WorkflowStage
  readOnly: boolean
  onOption: (key: string, value: unknown) => void
}) {
  const { t } = useTranslation('kpi')
  const o = stage.options ?? {}

  if (stage.code === 'CRITERIA_APPROVAL') {
    return (
      <OptionBox>
        <Choice
          label={t('StageInspector.whoApproves')}
          value={String(o.approverMode ?? 'CHAIN')}
          disabled={readOnly}
          onChange={v => onOption('approverMode', v)}
          options={[
            { value: 'CHAIN', label: t('StageInspector.hierarchicalApprovalChainDefault') },
            { value: 'UNIT_HEAD', label: t('StageInspector.oneLevelDirectManagerPreviousWorkflow') },
            { value: 'ANY_WITH_PERMISSION', label: t('StageInspector.oneLevelAnyoneWithApprovalPermission') },
          ]}
        />
        {String(o.approverMode ?? 'CHAIN') === 'CHAIN' && (
          <>
            <p className="text-caption">
              {t('StageInspector.directUnitHeadParentHeadTop')}
            </p>
            <label className="text-label flex flex-col gap-1 text-[var(--color-muted-foreground)]">
              {t('StageInspector.remindTheApproverWhenAStep')}
              <Input
                type="number"
                min={1}
                max={60}
                size="sm"
                disabled={readOnly}
                value={Number(o.reminderAfterDays ?? 3)}
                onChange={e => onOption('reminderAfterDays', Number(e.target.value))}
                suffix={<span className="text-xs text-[var(--color-muted-foreground)]">{t('StageInspector.days')}</span>}
                className="no-edit-hint w-32"
              />
            </label>
          </>
        )}
        <Check
          label={String(o.approverMode ?? 'CHAIN') === 'CHAIN'
            ? t('StageInspector.ifTheTopApprovalLevelHas')
            : t('StageInspector.forPeopleWithSelfApprovalPermission')}
          checked={o.allowSelfApprove !== false}
          disabled={readOnly}
          onChange={v => onOption('allowSelfApprove', v)}
        />
      </OptionBox>
    )
  }

  if (stage.code === 'CRITERIA_ADJUSTMENT') {
    return (
      <OptionBox>
        <p className="text-caption">{t('StageInspector.onlyAppliesToTheOneLevel')}</p>
        <label className="text-label flex flex-col gap-1 text-[var(--color-muted-foreground)]">
          {t('StageInspector.autoRejectAfter')}
          <Input
            type="number"
            min={1}
            max={720}
            size="sm"
            disabled={readOnly}
            value={Number(o.autoRejectAfterHours ?? 24)}
            onChange={e => onOption('autoRejectAfterHours', Number(e.target.value))}
            suffix={<span className="text-xs text-[var(--color-muted-foreground)]">{t('StageInspector.hours')}</span>}
            className="no-edit-hint w-32"
          />
        </label>
      </OptionBox>
    )
  }

  if (stage.code === 'SUBMISSION') {
    return (
      <OptionBox>
        <Check
          label={t('StageInspector.allowSavingDraftsBeforeSubmitting')}
          checked={o.allowDraft !== false}
          disabled={readOnly}
          onChange={v => onOption('allowDraft', v)}
        />
        <Check
          label={t('StageInspector.requireEvidenceAttachments')}
          checked={o.requireAttachment === true}
          disabled={readOnly}
          onChange={v => onOption('requireAttachment', v)}
        />
      </OptionBox>
    )
  }

  if (stage.code === 'SUBMISSION_REVIEW') {
    return (
      <OptionBox>
        <Choice
          label={t('StageInspector.approvalMode')}
          value={String(o.mode ?? 'MANUAL')}
          disabled={readOnly}
          onChange={v => onOption('mode', v)}
          options={[
            { value: 'MANUAL', label: t('StageInspector.manualApprovalByTheManagerDefault') },
            { value: 'AUTO_APPROVE', label: t('StageInspector.autoApproveEverySubmission') },
          ]}
        />
      </OptionBox>
    )
  }

  return null
}

function OptionBox({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('kpi')
  return (
    <div>
      <p className="text-eyebrow mb-1.5">{t('StageInspector.options')}</p>
      <div className="flex flex-col gap-3 rounded-card bg-[var(--color-muted)] p-3">{children}</div>
    </div>
  )
}

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="text-label flex cursor-pointer items-start gap-2 text-[var(--color-muted-foreground)]">
      <Checkbox className="mt-0.5" checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  )
}

function Choice({
  label,
  value,
  disabled,
  onChange,
  options,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="text-label flex flex-col gap-1 text-[var(--color-muted-foreground)]">
      {label}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
