import { useState } from 'react'
import { ChevronDown, MessageSquareText, Plus, Scale, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { RELATIONSHIP_LABEL, type F360Relationship } from '../api/feedback360Api'
import {
  blankCompetency, blankQuestion, evenWeights, totalWeight,
  type DraftCompetency, type DraftQuestion, type QuestionSetDraft,
} from '../utils/questionSet'
import { useTranslation } from 'react-i18next'

const ASKABLE: F360Relationship[] = ['MANAGER', 'PEER', 'DIRECT_REPORT', 'OTHER']

/**
 * Soạn năng lực + câu hỏi NGAY TRONG form chiến dịch — cùng cách BSC soạn hạng mục ngay trong bộ
 * tiêu chí. Component điều khiển hoàn toàn từ ngoài (value/onChange), không tự lưu.
 */
export default function QuestionSetEditor({ value: d, onChange }: {
  value: QuestionSetDraft
  onChange: (next: QuestionSetDraft) => void
}) {
  const { t } = useTranslation('feedback360')
  const total = totalWeight(d)
  const weightOk = Math.abs(total - 100) < 0.01

  const setComp = (key: string, patch: Partial<DraftCompetency>) =>
    onChange({ ...d, competencies: d.competencies.map(c => (c.key === key ? { ...c, ...patch } : c)) })
  const setQuestion = (compKey: string | null, qKey: string, patch: Partial<DraftQuestion>) =>
    onChange(compKey
      ? { ...d, competencies: d.competencies.map(c => c.key !== compKey ? c : { ...c, questions: c.questions.map(q => (q.key === qKey ? { ...q, ...patch } : q)) }) }
      : { ...d, openQuestions: d.openQuestions.map(q => (q.key === qKey ? { ...q, ...patch } : q)) })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
          weightOk ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
        )}>
          {t('QuestionSetEditor.totalWeight')} {total}%
        </span>
        {!weightOk && d.competencies.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange(evenWeights(d))}><Scale /> {t('QuestionSetEditor.splitEvenly')}</Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-caption">{t('QuestionSetEditor.scoringScales')}</span>
          <Select value={String(d.scaleMax)} onValueChange={v => onChange({ ...d, scaleMax: Number(v) })}>
            <SelectTrigger className="h-8 w-[96px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6, 7, 10].map(n => <SelectItem key={n} value={String(n)}>1 - {n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {d.competencies.map((c, ci) => (
        <CompetencyCard
          key={c.key}
          index={ci}
          competency={c}
          canRemove={d.competencies.length > 1}
          onChange={patch => setComp(c.key, patch)}
          onRemove={() => onChange({ ...d, competencies: d.competencies.filter(x => x.key !== c.key) })}
          onQuestion={(qKey, patch) => setQuestion(c.key, qKey, patch)}
        />
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...d, competencies: [...d.competencies, blankCompetency(Math.max(0, Math.round((100 - total) * 100) / 100))] })}>
        <Plus /> {t('QuestionSetEditor.addCompetency')}
      </Button>

      <div className="space-y-2 rounded-card border border-dashed border-[var(--color-border)] p-3">
        <div className="flex items-center gap-2">
          <MessageSquareText size={15} className="text-slate-400" />
          <h5 className="flex-1 text-sm font-semibold">{t('QuestionSetEditor.openEndedCommentQuestion')}</h5>
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...d, openQuestions: [...d.openQuestions, blankQuestion(true)] })}>
            <Plus /> {t('QuestionSetEditor.add')}
          </Button>
        </div>
        {d.openQuestions.length === 0 && (
          <p className="text-caption">{t('QuestionSetEditor.ratersAnswerInTextShownOn')}</p>
        )}
        {d.openQuestions.map(q => (
          <QuestionRow key={q.key} question={q} open
            onChange={patch => setQuestion(null, q.key, patch)}
            onRemove={() => onChange({ ...d, openQuestions: d.openQuestions.filter(x => x.key !== q.key) })} />
        ))}
      </div>
    </div>
  )
}

function CompetencyCard({ index, competency: c, canRemove, onChange, onRemove, onQuestion }: {
  index: number
  competency: DraftCompetency
  canRemove: boolean
  onChange: (patch: Partial<DraftCompetency>) => void
  onRemove: () => void
  onQuestion: (qKey: string, patch: Partial<DraftQuestion>) => void
}) {
  const { t } = useTranslation('feedback360')
  // Năng lực mới (chưa tên) mở sẵn để gõ; năng lực có sẵn thu gọn cho form ngắn.
  const [expanded, setExpanded] = useState(() => !c.name)
  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center gap-2 p-2.5">
        <button type="button" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
          aria-label={expanded ? t('QuestionSetEditor.collapseCompetency') : t('QuestionSetEditor.openCompetency')}
          className="flex size-7 shrink-0 items-center justify-center rounded-control text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]">
          <ChevronDown size={16} className={cn('transition-transform', !expanded && '-rotate-90')} />
        </button>
        <span className="w-5 shrink-0 text-center text-xs font-semibold text-[var(--color-muted-foreground)] tabular-nums">{index + 1}</span>
        <Input size="sm" className="min-w-0 flex-1" placeholder={t('QuestionSetEditor.competencyNameEGCommunication')}
          value={c.name} onChange={e => onChange({ name: e.target.value })} />
        <Input size="sm" type="number" min={0} max={100} className="no-edit-hint w-[88px] shrink-0" aria-label={t('QuestionSetEditor.weight')}
          value={c.weight} onChange={e => onChange({ weight: Number(e.target.value) })} suffix="%" />
        <Button variant="ghost" size="icon-sm" aria-label={t('QuestionSetEditor.deleteCompetency')} onClick={onRemove} disabled={!canRemove}><Trash2 /></Button>
      </div>
      {!expanded && (
        <button type="button" onClick={() => setExpanded(true)}
          className="block w-full border-t border-[var(--color-border)] px-3 py-1.5 text-left text-caption hover:bg-[var(--color-muted)]">
          {c.questions.length} {t('QuestionSetEditor.questions')}{c.questions[0]?.text ? `: ${c.questions.map(q => q.text).filter(Boolean).join(' · ')}` : ''}
        </button>
      )}
      {expanded && (
        <div className="space-y-2 border-t border-[var(--color-border)] p-3">
          <Input size="sm" placeholder={t('QuestionSetEditor.shortDescriptionOptional')} value={c.description} onChange={e => onChange({ description: e.target.value })} />
          {c.questions.map(q => (
            <QuestionRow key={q.key} question={q}
              onChange={patch => onQuestion(q.key, patch)}
              onRemove={c.questions.length > 1 ? () => onChange({ questions: c.questions.filter(x => x.key !== q.key) }) : undefined} />
          ))}
          <Button size="sm" variant="ghost" onClick={() => onChange({ questions: [...c.questions, blankQuestion()] })}>
            <Plus /> {t('QuestionSetEditor.addQuestion')}
          </Button>
        </div>
      )}
    </div>
  )
}

function QuestionRow({ question, onChange, onRemove, open = false }: {
  question: DraftQuestion
  onChange: (patch: Partial<DraftQuestion>) => void
  onRemove?: () => void
  open?: boolean
}) {
  const { t } = useTranslation('feedback360')
  const rels = question.relationships ?? []
  const toggleRel = (r: F360Relationship) =>
    onChange({ relationships: rels.includes(r) ? rels.filter(x => x !== r) : [...rels, r] })

  return (
    <div className="space-y-1.5 rounded-control bg-[var(--color-muted)] p-2.5">
      <div className="flex items-center gap-2">
        <Input size="sm" className="flex-1"
          placeholder={open ? t('QuestionSetEditor.eGWhatShouldThisPerson') : t('QuestionSetEditor.questionText')}
          value={question.text} onChange={e => onChange({ text: e.target.value })} />
        {onRemove && <Button variant="ghost" size="icon-sm" aria-label={t('QuestionSetEditor.deleteQuestion')} onClick={onRemove}><Trash2 /></Button>}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-caption">{t('QuestionSetEditor.asks')}</span>
        <ChoiceChip size="sm" selected={rels.length === 0} onClick={() => onChange({ relationships: [] })}>{t('QuestionSetEditor.allGroups')}</ChoiceChip>
        {ASKABLE.map(r => (
          <ChoiceChip key={r} size="sm" selected={rels.includes(r)} onClick={() => toggleRel(r)}>{RELATIONSHIP_LABEL()[r]}</ChoiceChip>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        <ChoiceChip size="sm" selected={!!question.required} onClick={() => onChange({ required: !question.required })}>{t('QuestionSetEditor.required')}</ChoiceChip>
        {!open && (
          <ChoiceChip size="sm" selected={question.allowNa !== false} onClick={() => onChange({ allowNa: question.allowNa === false })}>
            {t('QuestionSetEditor.allowCannotAssess')}
          </ChoiceChip>
        )}
      </div>
    </div>
  )
}
