import { useEffect, useRef, useState } from 'react'
import { Copy, MessageSquareText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { RELATIONSHIP_LABEL, type F360Question, type F360Template } from '../api/feedback360Api'
import { mergeInto, pickFromTemplate, type QuestionSetDraft } from '../utils/questionSet'
import { useTranslation } from 'react-i18next'

type Mode = 'append' | 'replace'

/**
 * Xem trước câu hỏi của nguồn rồi tích câu muốn chép. Nằm NGAY TRONG form (thay chỗ trình soạn trong
 * lúc chọn) chứ không mở hộp thoại thứ hai — Dialog của dự án không chồng được.
 */
export default function CopyQuestionsPanel({ sourceLabel, template, current, onApply, onCancel }: {
  sourceLabel: string
  template: F360Template | null
  current: QuestionSetDraft
  onApply: (next: QuestionSetDraft, copied: number) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('feedback360')
  const allIds = template
    ? [...template.competencies.flatMap(c => c.questions.map(q => q.id)), ...template.openQuestions.map(q => q.id)]
    : []
  const [picked, setPicked] = useState<Set<string> | null>(null)
  // Mặc định tích hết khi nguồn vừa tải xong.
  const sel = picked ?? new Set(allIds)
  const [mode, setMode] = useState<Mode>('append')

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(sel)
    ids.forEach(id => (on ? next.add(id) : next.delete(id)))
    setPicked(next)
  }
  const count = allIds.filter(id => sel.has(id)).length

  const apply = () => {
    if (!template) return
    const part = pickFromTemplate(template, sel)
    onApply(mode === 'replace' ? part : mergeInto(current, part), count)
  }

  return (
    <div className="rounded-card border border-[var(--color-primary)]/40 bg-[var(--color-card)]">
      <div className="flex items-start gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <Copy size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t('CopyQuestionsPanel.copyFrom')} {sourceLabel}</p>
          <p className="text-caption">{t('CopyQuestionsPanel.tickTheQuestionsToCopyCompetencies')}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label={t('CopyQuestionsPanel.cancelCopy')} onClick={onCancel}><X /></Button>
      </div>

      {!template ? (
        <div className="m-3 h-32 animate-pulse rounded-control bg-[var(--color-muted)]" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
            <label className="flex items-center gap-2 text-sm">
              <TriCheckbox checked={count === allIds.length} indeterminate={count > 0 && count < allIds.length}
                onChange={on => toggle(allIds, on)} ariaLabel={t('CopyQuestionsPanel.selectAll')} />
              {t('CopyQuestionsPanel.selectAll')} <span className="text-caption tabular-nums">({count}/{allIds.length})</span>
            </label>
            {template.scaleMax !== current.scaleMax && mode === 'append' && (
              <span className="text-caption text-[var(--color-warning)]">
                {t('CopyQuestionsPanel.theSourceUsesA1')}{template.scaleMax}{t('CopyQuestionsPanel.scaleCopiedQuestionsUseThe1')}{current.scaleMax} {t('CopyQuestionsPanel.scaleOfTheCurrentSet')}
              </span>
            )}
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
            {template.competencies.map(c => {
              const ids = c.questions.map(q => q.id)
              const n = ids.filter(id => sel.has(id)).length
              return (
                <div key={c.id} className="rounded-control border border-[var(--color-border)]">
                  <label className="flex items-center gap-2 bg-[var(--color-muted)] px-3 py-2">
                    <TriCheckbox checked={n === ids.length} indeterminate={n > 0 && n < ids.length}
                      onChange={on => toggle(ids, on)} ariaLabel={t('CopyQuestionsPanel.chooseCompetency', { name: c.name })} />
                    <span className="flex-1 text-sm font-semibold">{c.name}</span>
                    <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">{c.weight}% · {n}/{ids.length} {t('CopyQuestionsPanel.questions')}</span>
                  </label>
                  <ul className="divide-y divide-[var(--color-border)]">
                    {c.questions.map(q => <QuestionPick key={q.id} q={q} checked={sel.has(q.id)} onChange={on => toggle([q.id], on)} />)}
                  </ul>
                </div>
              )
            })}
            {template.openQuestions.length > 0 && (
              <div className="rounded-control border border-dashed border-[var(--color-border)]">
                <p className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
                  <MessageSquareText size={14} className="text-slate-400" /> {t('CopyQuestionsPanel.openEndedCommentQuestion')}
                </p>
                <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
                  {template.openQuestions.map(q => <QuestionPick key={q.id} q={q} checked={sel.has(q.id)} onChange={on => toggle([q.id], on)} />)}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-3 py-2.5">
            <div className="flex gap-1">
              <ChoiceChip size="sm" selected={mode === 'append'} onClick={() => setMode('append')}>{t('CopyQuestionsPanel.addToTheCurrentSet')}</ChoiceChip>
              <ChoiceChip size="sm" selected={mode === 'replace'} onClick={() => setMode('replace')}>{t('CopyQuestionsPanel.replaceTheWholeCurrentSet')}</ChoiceChip>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>{t('CopyQuestionsPanel.cancel')}</Button>
              <Button size="sm" onClick={apply} disabled={count === 0}>{t('CopyQuestionsPanel.copy')} {count} {t('CopyQuestionsPanel.questions')}</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function QuestionPick({ q, checked, onChange }: { q: F360Question; checked: boolean; onChange: (on: boolean) => void }) {
  const { t } = useTranslation('feedback360')
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-[var(--color-muted)]">
        <Checkbox className="mt-0.5" checked={checked} onCheckedChange={onChange} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm">{q.text}</span>
          <span className="block text-caption">
            {t('CopyQuestionsPanel.asks')} {q.relationships.length === 0 ? t('CopyQuestionsPanel.allGroups') : q.relationships.map(r => RELATIONSHIP_LABEL()[r]).join(', ')}
            {q.required ? t('CopyQuestionsPanel.required') : ''}
          </span>
        </span>
      </label>
    </li>
  )
}

/** Ô tích có trạng thái "một phần" (chọn vài câu trong năng lực). */
function TriCheckbox({ checked, indeterminate, onChange, ariaLabel }: {
  checked: boolean; indeterminate: boolean; onChange: (on: boolean) => void; ariaLabel: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return <Checkbox ref={ref} checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} />
}
