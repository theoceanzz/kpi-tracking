import { type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Eyebrow, Headline, MoreToggle, Reveal, Screenshot } from './primitives'
import { useTranslation } from 'react-i18next'

/**
 * Bốn chương của "bộ phim", mỗi chương một ảnh chụp thật của app.
 * Mặc định chỉ hiện tiêu đề + một câu tóm tắt; phần giải thích và gạch đầu dòng
 * nằm sau nút "Xem chi tiết" để người xem lướt nhanh vẫn hiểu hệ thống.
 */
export function StoryChapters() {
  const { t } = useTranslation('landing')
  return (
    <div id="story" className="scroll-mt-24">
      <Chapter
        no="01"
        eyebrow={t('StoryChapters.setGoals')}
        title={<>{t('StoryChapters.oneCompanyGoal')} <em>{t('StoryChapters.cascaded')}</em> {t('StoryChapters.toEveryPerson')}</>}
        summary={t('StoryChapters.turnOnExactlyTheStepsOf')}
        detail={t('StoryChapters.okrKpiAndTheBalancedScorecard')}
        bullets={['OKR · KPI · BSC', t('StoryChapters.kpiWaterfallAlongTheStructure'), t('StoryChapters.importFromExcelPreviewBeforeSaving')]}
        shot={{ src: 'kpi-workflow.webp', title: t('StoryChapters.kpiFlowSetup'), alt: t('StoryChapters.theKpiFlowScreenChooseThe') }}
      />
      <Chapter
        no="02"
        eyebrow={t('StoryChapters.measureEvaluate')}
        title={<>{t('StoryChapters.employeesSubmitManagersApprove')} <em>{t('StoryChapters.theSystemSummarizes')}</em>.</>}
        summary={t('StoryChapters.selfScoringWithEvidenceManagersScoring')}
        detail={t('StoryChapters.thereIsAFlowForRequesting')}
        bullets={[t('StoryChapters.evaluationByPeriodByCycle'), t('StoryChapters.attachedEvidenceMidCycleAdjustmentRequests'), t('StoryChapters.conductRatingMatrix')]}
        shot={{ src: 'evaluation-batch.webp', title: t('StoryChapters.performanceManagementPeriodEvaluation'), alt: t('StoryChapters.thePeriodEvaluationScreenPeopleList') }}
        flip
      />
      <Chapter
        no="03"
        eyebrow={t('StoryChapters.seeTheResults')}
        title={<>{t('StoryChapters.cycleResults')} <em>{t('StoryChapters.summarizedAutomatically')}</em>{t('StoryChapters.rewardedRightAway')}</>}
        summary={t('StoryChapters.cycleScoreAverageOfPeriodsConduct')}
        detail={t('StoryChapters.dragAndDropDashboardsPinImportant')}
        bullets={[t('StoryChapters.customizableDashboardsPinImportantCards'), t('StoryChapters.rewardsCheckInsGiftsWallet'), t('StoryChapters.oneClickReportExport')]}
        shot={{ src: 'evaluation-period.webp', title: t('StoryChapters.performanceManagementCycleEvaluation'), alt: t('StoryChapters.theCycleEvaluationScreenScoreSummary') }}
      />
      <Chapter
        no="04"
        eyebrow={t('StoryChapters.kAiAssistant')}
        title={<>{t('StoryChapters.askForFiguresLike')} <em>{t('StoryChapters.askingAColleague')}</em>.</>}
        summary={t('StoryChapters.kAiReadsYourOwnOrganizations')}
        detail={t('StoryChapters.answersWithinTheAskersPermissionsFills')}
        bullets={[t('StoryChapters.dataQAWithinTheAskers'), t('StoryChapters.fillsInKpiFormsSuggestsComments'), t('StoryChapters.chooseYourModelInHouseOr')]}
        shot={{ src: 'kai.webp', title: t('StoryChapters.kAiDataAssistant'), alt: t('StoryChapters.theKAiAssistantScreenSuggested') }}
        flip
      />
    </div>
  )
}

function Chapter({
  no,
  eyebrow,
  title,
  summary,
  detail,
  bullets,
  shot,
  flip,
}: {
  no: string
  eyebrow: string
  title: ReactNode
  summary: string
  detail: string
  bullets: string[]
  shot: { src: string; title: string; alt: string }
  flip?: boolean
}) {
  const { t } = useTranslation('landing')
  return (
    <section className={cn('relative border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36', flip && 'lp-section-alt')}>
      <div className="lp-dots pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_50%_60%_at_50%_50%,#000,transparent)]" />
      <div className={cn('mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16', flip && 'lg:grid-cols-[3fr_2fr] lg:[&>*:first-child]:order-2')}>
        <div>
          <Reveal>
            <div className="mb-5 flex items-center gap-4">
              <span className="text-6xl font-black leading-none text-slate-900/[0.06] sm:text-7xl">{no}</span>
              <Eyebrow>{t('StoryChapters.chapter')} {no} · {eyebrow}</Eyebrow>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <Headline>{title}</Headline>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-700 text-pretty">{summary}</p>
          </Reveal>
          <Reveal delay={300}>
            <MoreToggle className="mt-2">
              <p className="pt-3 max-w-xl text-base leading-relaxed text-slate-600 text-pretty">{detail}</p>
              <ul className="mt-4 space-y-2.5 pb-1">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-sm font-semibold text-slate-700 sm:text-base">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </MoreToggle>
          </Reveal>
        </div>

        <Reveal from={flip ? 'left' : 'right'} delay={150} className="lg:sticky lg:top-28">
          <Screenshot src={shot.src} alt={shot.alt} title={shot.title} />
        </Reveal>
      </div>
    </section>
  )
}
