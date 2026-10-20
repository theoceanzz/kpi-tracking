import { Lock, MessageSquareText, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RELATIONSHIP_LABEL, type F360Campaign, type F360Question } from '../api/feedback360Api'
import { useF360CampaignQuestions } from '../hooks/useFeedback360'
import { useTranslation } from 'react-i18next'

/**
 * Câu hỏi của chiến dịch — nội dung tab "Câu hỏi" trên trang chi tiết. Nháp: bộ đang soạn (kèm nút
 * sửa); đã khởi động: bản chụp lúc khởi động, đúng thứ người chấm nhìn thấy. Đã nằm trong tab riêng
 * nên mở sẵn toàn bộ, không còn thu gọn.
 */
export default function CampaignQuestionsCard({ campaign, onEdit }: { campaign: F360Campaign; onEdit?: () => void }) {
  const { t } = useTranslation('feedback360')
  const { data: q, isLoading } = useF360CampaignQuestions(campaign.id)
  const draft = campaign.status === 'DRAFT'
  const total = q ? q.competencies.reduce((n, c) => n + c.questions.length, 0) + q.openQuestions.length : campaign.questionCount ?? 0

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption tabular-nums">
          {q?.competencies.length ?? campaign.competencyNames?.length ?? 0} {t('CampaignQuestionsCard.competencies')} {total} {t('CampaignQuestionsCard.questionsScale1')}{campaign.scaleMax}
        </span>
        <span className="ml-auto" />
        {draft && onEdit && <Button variant="outline" size="sm" onClick={onEdit}><Pencil /> {t('CampaignQuestionsCard.editQuestions')}</Button>}
        {!draft && (
          <span className="inline-flex items-center gap-1 text-caption" title={t('CampaignQuestionsCard.questionsAreLockedWhenTheCampaign')}>
            <Lock size={12} /> {t('CampaignQuestionsCard.finalized')}
          </span>
        )}
      </div>

      {isLoading && <div className="h-24 animate-pulse rounded-card bg-[var(--color-muted)]" />}
      {q && q.competencies.length === 0 && q.openQuestions.length === 0 && (
        <p className="text-caption">{t('CampaignQuestionsCard.theCampaignHasNoQuestionsYet')}</p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {q?.competencies.map((c, i) => (
          <div key={c.id} className="rounded-control border border-[var(--color-border)]">
            <div className="flex items-baseline gap-2 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2">
              <span className="text-xs font-semibold tabular-nums text-[var(--color-muted-foreground)]">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold">{c.name}</span>
              <span className="text-xs font-medium tabular-nums">{c.weight}%</span>
            </div>
            {c.description && <p className="px-3 pt-2 text-caption">{c.description}</p>}
            <ol className="divide-y divide-[var(--color-border)]">
              {c.questions.map((x, qi) => <QuestionLine key={x.id} index={`${i + 1}.${qi + 1}`} question={x} />)}
            </ol>
          </div>
        ))}
      </div>
      {q && q.openQuestions.length > 0 && (
        <div className="rounded-control border border-dashed border-[var(--color-border)]">
          <div className="flex items-center gap-2 px-3 py-2">
            <MessageSquareText size={14} className="text-[var(--color-muted-foreground)]" />
            <span className="text-sm font-semibold">{t('CampaignQuestionsCard.openEndedCommentQuestion')}</span>
          </div>
          <ol className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
            {q.openQuestions.map((x, qi) => <QuestionLine key={x.id} index={String(qi + 1)} question={x} />)}
          </ol>
        </div>
      )}
    </div>
  )
}

function QuestionLine({ index, question: x }: { index: string; question: F360Question }) {
  const { t } = useTranslation('feedback360')
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <span className="w-7 shrink-0 pt-px text-xs tabular-nums text-[var(--color-muted-foreground)]">{index}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{x.text}</p>
        <p className="mt-0.5 text-caption">
          {t('CampaignQuestionsCard.asks')} {x.relationships.length === 0 ? t('CampaignQuestionsCard.allGroups') : x.relationships.map(r => RELATIONSHIP_LABEL()[r]).join(', ')}
          {x.required ? t('CampaignQuestionsCard.required') : t('CampaignQuestionsCard.optional')}
          {x.questionType === 'RATING' && x.allowNa ? t('CampaignQuestionsCard.allowsCannotAssess') : ''}
        </p>
      </div>
    </li>
  )
}
