import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Target, GitBranch, SlidersHorizontal, Gift, Wallet, ChevronDown, ArrowRight, AlertTriangle, HeartHandshake, Users } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import F360RatingToggle from '@/features/feedback360/components/F360RatingToggle'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'

/**
 * Bật/tắt module của tổ chức.
 *
 * Trước đây mỗi module là một thẻ riêng xếp thành lưới 3 cột. Nội dung mỗi thẻ dài
 * ngắn rất khác nhau — OKR có thêm sơ đồ 3 bước nên cao gấp ba thẻ BSC — khiến lưới
 * so le và thẻ ngắn để lại mảng trống lớn. Quan trọng hơn: thứ người dùng đến đây để
 * làm chỉ là GẠT CÔNG TẮC, mà công tắc lại nằm rải rác ở sáu vị trí khác nhau.
 *
 * Giờ là một danh sách: mỗi module một dòng cao bằng nhau, mọi công tắc thẳng một cột
 * bên phải nên mắt quét dọc một lần là biết tổ chức đang bật gì. Phần giải thích dài
 * thu vào mục "Chi tiết" — vẫn còn đó cho ai cần, nhưng không chiếm chỗ mặc định.
 */

type OrgFlagField =
  | 'enableOkr'
  | 'enableQualitative'
  | 'enableConduct'
  | 'enableFeedback360'
  | 'enableBsc'
  | 'enableWaterfall'
  | 'enableReward'
  | 'enableCashWallet'

interface ModuleDef {
  field: OrgFlagField
  icon: ReactNode
  /** Màu ô icon — mỗi module một sắc để nhận ra nhanh khi quét danh sách. */
  tone: string
  title: string
  subtitle: string
  /** Tên dùng trong thông báo sau khi bật/tắt. */
  toastName: string
  detail: ReactNode
  /** Cảnh báo hiện ngay trên dòng, không giấu trong "Chi tiết". */
  caution?: string
  manageTo?: string
  manageLabel?: string
}

/** Ba bước của một mô hình, dùng chung cho OKR và Thác nước. */
function Steps({ items, tone }: { items: [string, string][]; tone: string }) {
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {items.map(([name, desc], i) => (
        <li key={name} className="flex items-start gap-3 p-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
          <span className={cn('w-6 h-6 shrink-0 rounded-full bg-[var(--color-card)] flex items-center justify-center text-xs font-semibold shadow-sm', tone)}>
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-foreground)]">{name}</p>
            <p className="text-caption font-medium leading-relaxed">{desc}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

const MODULES = perLanguage((): ModuleDef[] => ([
  {
    field: 'enableOkr',
    icon: <Target size={18} />,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    title: 'OKR',
    subtitle: i18n.t('orgunits:ModuleSections.strategicObjectivesAndKeyResults'),
    toastName: i18n.t('orgunits:ModuleSections.theOkrFeature'),
    manageTo: '/settings/tools?section=okr',
    manageLabel: i18n.t('orgunits:ModuleSections.okrManagement'),
    detail: (
      <div className="space-y-3">
        <p>
          {i18n.t('orgunits:ModuleSections.whenOnYouSetStrategicObjectives')}
        </p>
        <Steps
          tone="text-[var(--color-primary)]"
          items={[
            [i18n.t('orgunits:ModuleSections.objectiveQualitative'), i18n.t('orgunits:ModuleSections.defineTheOrganizationsStrategicObjectives')],
            [i18n.t('orgunits:ModuleSections.keyResultQuantitative'), i18n.t('orgunits:ModuleSections.keyMetricsMeasuringTheCompletionOf')],
            [i18n.t('orgunits:ModuleSections.kpiOperational'), i18n.t('orgunits:ModuleSections.linkKpisToKeyResultsFor')],
          ]}
        />
      </div>
    ),
  },
  {
    field: 'enableQualitative',
    icon: <SlidersHorizontal size={18} />,
    tone: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    title: i18n.t('orgunits:ModuleSections.behavioralKpis'),
    subtitle: i18n.t('orgunits:ModuleSections.scoreByEvaluationLevelInsteadOf'),
    toastName: i18n.t('orgunits:ModuleSections.behavioralKpis'),
    manageTo: '/settings/tools?section=scoring&scoring=qualitative',
    manageLabel: i18n.t('orgunits:ModuleSections.qualitativeScale'),
    detail: (
      <p>
        {i18n.t('orgunits:ModuleSections.forKpisThatCannotBeMeasured')} <span className="font-semibold">{i18n.t('orgunits:ModuleSections.qualitativeScale')}</span>{i18n.t('orgunits:ModuleSections.whenOffTheSystemOnlyShows')}
        <span className="font-semibold"> {i18n.t('orgunits:ModuleSections.conductScoring')}</span> {i18n.t('orgunits:ModuleSections.toFillInTheMissingAxis')}
      </p>
    ),
  },
  {
    field: 'enableConduct',
    icon: <HeartHandshake size={18} />,
    tone: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    title: i18n.t('orgunits:ModuleSections.conductScoring'),
    subtitle: i18n.t('orgunits:ModuleSections.conductScoreByWeightedCriteriaSet'),
    toastName: i18n.t('orgunits:ModuleSections.conductScoring2'),
    manageTo: '/settings/tools?section=scoring&scoring=conduct',
    manageLabel: i18n.t('orgunits:ModuleSections.conductCriteriaSets'),
    detail: (
      <div className="space-y-3">
        <p>
          {i18n.t('orgunits:ModuleSections.eachPeriodOrCyclePeopleSelf')}{' '}
          <span className="font-semibold">{i18n.t('orgunits:ModuleSections.criterionScoreWeight')}</span>{i18n.t('orgunits:ModuleSections.byDefaultThereAre4Criteria')}
        </p>
        <p>
          {i18n.t('orgunits:ModuleSections.thisScoreAlso')} <span className="font-semibold">{i18n.t('orgunits:ModuleSections.fillsTheMissingAxisOfThe')}</span>{i18n.t('orgunits:ModuleSections.ifTheOrganizationHasOnlyQuantitative')}
        </p>
      </div>
    ),
  },
  {
    field: 'enableFeedback360',
    icon: <Users size={18} />,
    tone: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    title: i18n.t('orgunits:ModuleSections.n360Feedback'),
    subtitle: i18n.t('orgunits:ModuleSections.collectManagersPeersAndDirectReports'),
    toastName: i18n.t('orgunits:ModuleSections.n360Feedback2'),
    manageTo: '/performance?section=feedback360',
    manageLabel: i18n.t('orgunits:ModuleSections.n360Campaign'),
    detail: (
      <div className="space-y-3">
        <p>
          {i18n.t('orgunits:ModuleSections.hrOpensA')} <span className="font-semibold">{i18n.t('orgunits:ModuleSections.campaigns')}</span>{i18n.t('orgunits:ModuleSections.choosesRevieweesTheSystemSuggestsRaters')}
        </p>
        <p>
          {i18n.t('orgunits:ModuleSections.peerAndDirectReportFormsAre')} <span className="font-semibold">{i18n.t('orgunits:ModuleSections.anonymous')}</span>{i18n.t('orgunits:ModuleSections.groupsBelowTheThresholdDefault3')}
        </p>
        <F360RatingToggle />
      </div>
    ),
  },
  {
    field: 'enableBsc',
    icon: <Layers size={18} />,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    title: i18n.t('orgunits:ModuleSections.scorecardBsc'),
    subtitle: i18n.t('orgunits:ModuleSections.strategyManagementAcross4Areas'),
    toastName: i18n.t('orgunits:ModuleSections.theScorecardBsc'),
    manageTo: '/settings/tools?section=bsc',
    manageLabel: i18n.t('orgunits:ModuleSections.bscManagement'),
    detail: (
      <p>
        {i18n.t('orgunits:ModuleSections.eachCycleBuildsAScorecardOf')}
      </p>
    ),
  },
  {
    field: 'enableWaterfall',
    icon: <GitBranch size={18} />,
    tone: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    title: i18n.t('orgunits:ModuleSections.waterfallKpi'),
    subtitle: i18n.t('orgunits:ModuleSections.cascadeKpisDownRollResultsUp'),
    toastName: i18n.t('orgunits:ModuleSections.theWaterfallKpiFeature'),
    detail: (
      <div className="space-y-3">
        <p>
          {i18n.t('orgunits:ModuleSections.letsUnitHeadsReassignPartOr')}
        </p>
        <Steps
          tone="text-[var(--color-info)]"
          items={[
            [i18n.t('orgunits:ModuleSections.assignDown'), i18n.t('orgunits:ModuleSections.theUnitHeadSplits1Billion')],
            [i18n.t('orgunits:ModuleSections.execute'), i18n.t('orgunits:ModuleSections.employeesSubmitResultReportsForTheir')],
            [i18n.t('orgunits:ModuleSections.rollUp'), i18n.t('orgunits:ModuleSections.theSystemAutomaticallySummarizesEmployeesResults')],
          ]}
        />
      </div>
    ),
  },
  {
    field: 'enableReward',
    icon: <Gift size={18} />,
    tone: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    title: i18n.t('orgunits:ModuleSections.rewardPoints'),
    subtitle: i18n.t('orgunits:ModuleSections.giveRecognitionPointsRedeemGifts'),
    toastName: i18n.t('orgunits:ModuleSections.theRewardPointsFeature'),
    manageTo: '/settings/tools?section=rewards',
    manageLabel: i18n.t('orgunits:ModuleSections.rewardManagement'),
    detail: (
      <p>
        {i18n.t('orgunits:ModuleSections.managersGivePointsToEmployeesWithin')} <span className="font-semibold">{i18n.t('orgunits:ModuleSections.completelySeparate')}</span> {i18n.t('orgunits:ModuleSections.fromKpiEvaluationScoresTheyAre')}
      </p>
    ),
  },
  {
    field: 'enableCashWallet',
    icon: <Wallet size={18} />,
    tone: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    title: i18n.t('orgunits:ModuleSections.wallet'),
    subtitle: i18n.t('orgunits:ModuleSections.topUpRealMoneyViaVietqr'),
    toastName: i18n.t('orgunits:ModuleSections.theWalletFeature'),
    caution: i18n.t('orgunits:ModuleSections.thisIsRealMoneyTransferredInto'),
    manageTo: '/settings/tools?section=wallet',
    manageLabel: i18n.t('orgunits:ModuleSections.walletManagement'),
    detail: (
      <p>
        {i18n.t('orgunits:ModuleSections.employeesTopUpViaAVietqr')}
      </p>
    ),
  },
]))

/** Ranh giới cụm: từ "Thưởng điểm" trở đi là nhóm ghi nhận & thưởng. */
const REWARD_GROUP_START: OrgFlagField = 'enableReward'

type OrgFlags = { id: string } & Partial<Record<OrgFlagField, boolean>>

export function ModuleTogglesSection({ org }: { org: OrgFlags }) {
  const { t } = useTranslation('orgunits')
  const updateMutation = useUpdateOrganization(org.id)
  const [openField, setOpenField] = useState<OrgFlagField | null>(null)
  const [savingField, setSavingField] = useState<OrgFlagField | null>(null)
  /** Giá trị vừa gạt, hiển thị trong lúc chờ máy chủ trả lời. */
  const [pending, setPending] = useState<Partial<Record<OrgFlagField, boolean>>>({})

  // `org` là nguồn sự thật; `pending` chỉ đè lên trong lúc lưu và TỰ TIÊU ngay khi
  // dữ liệu mới về khớp với giá trị đã gạt. Nhờ vậy không cần mirror state trong
  // useEffect — thứ vừa gây render thừa vừa dễ lệch khi org đổi từ nơi khác.
  const overrides = Object.fromEntries(
    Object.entries(pending).filter(([field, value]) => !!org[field as OrgFlagField] !== value)
  ) as Partial<Record<OrgFlagField, boolean>>

  const isEnabled = (field: OrgFlagField) => overrides[field] ?? !!org[field]

  const handleToggle = (mod: ModuleDef) => {
    const next = !isEnabled(mod.field)
    setPending(prev => ({ ...prev, [mod.field]: next }))
    setSavingField(mod.field)
    updateMutation.mutate({ [mod.field]: next }, {
      onSuccess: () => {
        setSavingField(null)
        toast.success(t('ModuleSections.text', { value: next ? t('ModuleSections.turnedOn') : t('ModuleSections.turnedOff'), toastName: mod.toastName }))
      },
      onError: (error) => {
        // Bỏ override để công tắc quay về đúng trạng thái máy chủ đang giữ —
        // giao diện không được nói dối về thứ chưa lưu được.
        setSavingField(null)
        setPending(prev => {
          const rest = { ...prev }
          delete rest[mod.field]
          return rest
        })
        toast.error(getApiErrorMessage(error, t('ModuleSections.couldNotUpdate', { toastName: mod.toastName })))
      },
    })
  }

  return (
    <section {...tourAnchor('modules.list')} className="mx-auto max-w-4xl overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="text-section-title">{t('ModuleSections.modulesFeatures')}</h3>
        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
          {t('ModuleSections.whenAModuleIsTurnedOff')}
        </p>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {MODULES().map(mod => {
          const enabled = isEnabled(mod.field)
          const isOpen = openField === mod.field

          return (
            <div key={mod.field}>
              {mod.field === REWARD_GROUP_START && (
                <div className="bg-[var(--color-muted)] px-5 py-2">
                  <span className="text-eyebrow">{t('ModuleSections.recognitionRewards')}</span>
                </div>
              )}

              <div className="flex items-start gap-4 px-5 py-4">
                <div className={cn('w-10 h-10 shrink-0 rounded-card flex items-center justify-center', mod.tone)}>
                  {mod.icon}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-sm font-semibold text-[var(--color-foreground)]">{mod.title}</h4>
                  <p className="text-caption leading-relaxed">{mod.subtitle}</p>

                  {mod.caution && (
                    <p className="flex items-start gap-1.5 text-xs font-medium text-[var(--color-warning)] pt-0.5">
                      <AlertTriangle size={13} className="shrink-0 mt-px" />
                      {mod.caution}
                    </p>
                  )}

                  <div className="flex items-center gap-4 pt-1">
                    <Button {...tourAnchor('modules.details')} variant="ghost" size="sm" type="button" onClick={() => setOpenField(isOpen ? null : mod.field)} aria-expanded={isOpen}>
                      {t('ModuleSections.details')}
                      <ChevronDown aria-hidden="true" className={cn('transition-transform', isOpen && 'rotate-180')} />
                    </Button>

                    {/* Chỉ hiện khi đã bật: module đang tắt thì trang quản lý của nó cũng
                        không vào được, đưa link ra chỉ dẫn tới ngõ cụt. */}
                    {enabled && mod.manageTo && (
                      <Link
                        to={mod.manageTo}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {mod.manageLabel}
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>

                  {isOpen && (
                    <div className="space-y-3 pt-3 text-caption leading-relaxed">
                      {mod.detail}
                    </div>
                  )}
                </div>

                {/* Công tắc thẳng một cột bên phải ở mọi dòng — đây là thứ duy nhất
                    người dùng đến trang này để bấm. */}
                <Switch {...tourAnchor('modules.switch')}
                  checked={enabled}
                  onCheckedChange={() => handleToggle(mod)}
                  disabled={savingField === mod.field}
                  aria-label={`${enabled ? t('ModuleSections.off') : t('ModuleSections.on')} ${mod.title}`}
                  className="mt-0.5"
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
