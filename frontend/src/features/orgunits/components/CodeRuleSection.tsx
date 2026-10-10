import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hash, Loader2, RotateCcw, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { codeRuleApi, type CodeRule, type CodeType, type UpdateCodeRuleRequest } from '../api/codeRuleApi'
import { useCodeRules, useUpdateCodeRules } from '../hooks/useCodeRules'
import { getApiErrorMessage } from '@/lib/apiError'
import { Switch as SwitchControl } from '@/components/ui/switch'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'

/**
 * Mẫu mã tự sinh cho Mục tiêu, Kết quả then chốt và Hạng mục BSC — mỗi công ty một kiểu.
 *
 * Bản nháp giữ ở đây và chỉ gửi những dòng THỰC SỰ đổi: mẫu mã cần gõ xong mới lưu được,
 * nên gạt công tắc mà lưu ngay lập tức sẽ khiến hai nửa của cùng một dòng lưu ở hai thời
 * điểm khác nhau — người dùng đọc không ra là mình đã lưu cái gì.
 *
 * Ô xem trước gọi thẳng backend chứ không tự dựng chuỗi ở trình duyệt: số thứ tự kế tiếp
 * phụ thuộc các mã đã tồn tại, chỉ máy chủ biết. Nhờ vậy thông báo lỗi mẫu cũng là đúng
 * thông báo người dùng sẽ gặp lúc lưu.
 */

/** Ý nghĩa từng token, hiện thành chip bấm được để chèn vào mẫu. */
const TOKEN_HINTS = perLanguage((): Record<string, string> => ({
  '{YYYY}': i18n.t('orgunits:CodeRuleSection.n4DigitYear2026'),
  '{YY}': i18n.t('orgunits:CodeRuleSection.n2DigitYear26'),
  '{MM}': i18n.t('orgunits:CodeRuleSection.n2DigitMonth09'),
  '{ORG}': i18n.t('orgunits:CodeRuleSection.companyCode'),
  '{UNIT}': i18n.t('orgunits:CodeRuleSection.assignedUnitCode'),
  '{PARENT}': i18n.t('orgunits:CodeRuleSection.parentObjectiveCode'),
  '{###}': i18n.t('orgunits:CodeRuleSection.sequenceNumberTheNumberOfSigns'),
}))

interface Draft {
  pattern: string
  autoGenerate: boolean
  allowManualOverride: boolean
}

export default function CodeRuleSection({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation('orgunits')
  const { data: rules, isLoading } = useCodeRules(organizationId)
  const updateMutation = useUpdateCodeRules(organizationId)

  const [drafts, setDrafts] = useState<Partial<Record<CodeType, Draft>>>({})

  const draftOf = (rule: CodeRule): Draft =>
    drafts[rule.codeType] ?? {
      pattern: rule.pattern,
      autoGenerate: rule.autoGenerate,
      allowManualOverride: rule.allowManualOverride,
    }

  const patch = (rule: CodeRule, changes: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [rule.codeType]: { ...draftOf(rule), ...changes } }))

  /** Dòng đã đổi so với máy chủ — cũng là những dòng sẽ được gửi lên. */
  const changed = useMemo(() => {
    if (!rules) return []
    return rules.filter(rule => {
      const draft = drafts[rule.codeType]
      if (!draft) return false
      return draft.pattern !== rule.pattern
        || draft.autoGenerate !== rule.autoGenerate
        || draft.allowManualOverride !== rule.allowManualOverride
    })
  }, [rules, drafts])

  const handleSave = () => {
    if (changed.length === 0) return
    const payload: UpdateCodeRuleRequest[] = changed.map(rule => {
      const draft = draftOf(rule)
      return {
        codeType: rule.codeType,
        pattern: draft.pattern.trim(),
        autoGenerate: draft.autoGenerate,
        allowManualOverride: draft.allowManualOverride,
      }
    })
    updateMutation.mutate(payload, { onSuccess: () => setDrafts({}) })
  }

  if (isLoading) {
    return (
      <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-8">
        <LoadingSkeleton rows={4} />
      </section>
    )
  }
  if (!rules) return null

  return (
    <section {...tourAnchor('coderules.section')} className="mx-auto max-w-4xl overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="text-section-title">{t('CodeRuleSection.codeGenerationRules')}</h3>
        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
          {t('CodeRuleSection.codesOfObjectivesKeyResultsAnd')}
        </p>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {rules.map(rule => {
          const draft = draftOf(rule)
          const isDirty = changed.some(c => c.codeType === rule.codeType)

          return (
            <div key={rule.codeType} className="space-y-4 px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 rounded-card flex items-center justify-center bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Hash size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-[var(--color-foreground)]">{rule.label}</h4>
                  <p className="text-[12px] font-medium text-[var(--color-muted-foreground)] leading-relaxed">
                    {draft.autoGenerate
                      ? draft.allowManualOverride
                        ? t('CodeRuleSection.autoGeneratedButUsersMayType')
                        : t('CodeRuleSection.autoGeneratedTheCodeFieldIn')
                      : t('CodeRuleSection.usersMustEnterTheCodeThemselves')}
                  </p>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <Switch {...tourAnchor('coderules.auto')}
                    label={t('CodeRuleSection.autoGenerate')}
                    checked={draft.autoGenerate}
                    onChange={next => patch(rule, { autoGenerate: next })}
                  />
                  <Switch {...tourAnchor('coderules.manual')}
                    label={t('CodeRuleSection.allowManualEdit')}
                    checked={draft.allowManualOverride}
                    disabled={!draft.autoGenerate}
                    onChange={next => patch(rule, { allowManualOverride: next })}
                  />
                </div>
              </div>

              {draft.autoGenerate && (
                <div className="pl-0 sm:pl-14 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-label ml-1">
                      {t('CodeRuleSection.codePattern')}
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        value={draft.pattern}
                        onChange={e => patch(rule, { pattern: e.target.value })}
                        spellCheck={false}
                        placeholder={rule.codeType === 'BSC_PERSPECTIVE' ? 'PSP_{##}' : 'OBJ-{YYYY}-{###}'}
                        className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 font-mono text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] sm:w-72"
                      />
                      <PreviewLine organizationId={organizationId} rule={rule} pattern={draft.pattern} />
                      {draft.pattern !== rule.pattern && (
                        <Button variant="ghost" size="sm" type="button" onClick={() => patch(rule, { pattern: rule.pattern })}>
                          <RotateCcw aria-hidden="true" /> {t('CodeRuleSection.backToTheSavedPattern')}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[...rule.supportedTokens, '{###}'].map(token => (
                      <Button {...tourAnchor('coderules.token')} variant="secondary" size="sm" key={token} type="button" title={TOKEN_HINTS()[token] ?? token} onClick={() => patch(rule, { pattern: draft.pattern + token })}>
                        {token}
                      </Button>
                    ))}
                  </div>

                  <p className="text-caption leading-relaxed">
                    {t('CodeRuleSection.thePatternMustHaveExactlyOne')} <span className="font-mono font-semibold">{'{YYYY}'}</span> {t('CodeRuleSection.theNumberRestartsFrom1Each')}
                  </p>
                </div>
              )}

              {isDirty && (
                <p className="pl-0 sm:pl-14 text-xs font-medium text-[var(--color-warning)]">
                  {t('CodeRuleSection.notSaved')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] px-5 py-3">
        <p className="text-caption">
          {changed.length > 0 ? t('CodeRuleSection.unsavedRules', { count: changed.length }) : ''}{t('CodeRuleSection.codesAlreadyAssignedToExistingData')}
        </p>
        <Button {...tourAnchor('coderules.save')} onClick={handleSave} disabled={changed.length === 0 || updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
          {t('CodeRuleSection.saveRules')}
        </Button>
      </div>
    </section>
  )
}

/** Mã kế tiếp theo mẫu đang gõ, hỏi thẳng máy chủ để đúng cả số thứ tự lẫn thông báo lỗi. */
function PreviewLine({
  organizationId,
  rule,
  pattern,
}: {
  organizationId: string
  rule: CodeRule
  pattern: string
}) {
  const { t } = useTranslation('orgunits')
  const debounced = useDebounce(pattern.trim(), 400)
  const isSaved = debounced === rule.pattern

  const { data, error, isFetching } = useQuery({
    queryKey: ['org-code-rules', organizationId, 'preview', rule.codeType, debounced],
    queryFn: () => codeRuleApi.preview(organizationId, rule.codeType, debounced),
    // Mẫu đang lưu thì lấy luôn preview kèm trong danh sách, khỏi gọi thêm một lượt.
    enabled: !!debounced && !isSaved,
    retry: false,
    staleTime: 30 * 1000,
  })

  if (isSaved) {
    if (rule.previewError) return <PreviewError message={rule.previewError} />
    return <PreviewValue value={rule.preview} />
  }
  if (isFetching) return <span className="text-caption">{t('CodeRuleSection.buildingCode')}</span>
  if (error) {
    const message = getApiErrorMessage(error, t('CodeRuleSection.invalidCodePattern'))
    return <PreviewError message={message} />
  }
  return <PreviewValue value={data} />
}

function PreviewValue({ value }: { value?: string | null }) {
  const { t } = useTranslation('orgunits')
  if (!value) return null
  return (
    <span className="text-eyebrow inline-flex items-center gap-2">
      {t('CodeRuleSection.nextCode')}
      <code className="px-2 py-1 rounded-control bg-[var(--color-success-bg)] text-[var(--color-success)] text-xs font-mono font-semibold normal-case tracking-normal">
        {value}
      </code>
    </span>
  )
}

function PreviewError({ message }: { message: string }) {
  return <span className="text-xs font-medium text-[var(--color-error)] max-w-md">{message}</span>
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
  'data-tour': dataTour,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  /** Neo cho bài hướng dẫn. */
  'data-tour'?: string
}) {
  return (
    <div data-tour={dataTour} className="flex flex-col items-center gap-1.5">
      <span className={cn(
        'text-eyebrow',
        disabled && 'opacity-60'
      )}>
        {label}
      </span>
      <SwitchControl checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  )
}
