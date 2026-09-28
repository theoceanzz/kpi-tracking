import { useState } from 'react'
import { HeartHandshake } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import AiShortcutButton from '@/features/analytics/components/AiShortcutButton'
import { aiShortcuts } from '@/features/analytics/aiShortcuts'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import ConductSheetTable from '../components/ConductSheetTable'
import ConductTargetPicker from '../components/ConductTargetPicker'
import { useConductSheet } from '../hooks/useConduct'
import type { ConductTarget } from '../api/conductApi'
import { useTranslation } from 'react-i18next'

/**
 * Tự đánh giá hạnh kiểm của chính mình theo đợt/kỳ. Cùng một bảng với màn quản lý chấm,
 * chỉ khác là ở đây server chỉ mở cột "CBNV/giảng viên tự đánh giá" và ô dẫn chứng.
 */
export default function MyConductPage() {
  const { t } = useTranslation('conduct')
  const user = useAuthStore(s => s.user)
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)

  const [target, setTarget] = useState<ConductTarget>({ scope: 'PERIOD', periodId: null, cycleId: null })
  const { data: sheet, isLoading, saveSelf, isSavingSelf, saveManager, isSavingManager } =
    useConductSheet(target)

  if (org && !org.enableConduct) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState
          icon={HeartHandshake}
          title={t('MyConductPage.theOrganizationHasNotEnabledConduct')}
          description={t('MyConductPage.anAdministratorEnablesThisFeatureIn')}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        title={t('MyConductPage.myConduct')}
        description={t('MyConductPage.selfScoreYourConductAgainstThe')}
        stats={
          sheet
            ? [
                { label: t('MyConductPage.selfAssessment'), value: sheet.selfScore ?? '—', icon: HeartHandshake },
                { label: t('MyConductPage.managerScore'), value: sheet.managerScore ?? '—' },
                { label: t('MyConductPage.scoringScales'), value: sheet.maxScore },
                // Kỳ nào chấm theo bộ nào là thứ dễ hiểu nhầm nhất khi mỗi kỳ một bộ.
                ...(sheet.criteriaSetName ? [{ label: t('MyConductPage.criteriaSet'), value: sheet.criteriaSetName }] : []),
              ]
            : undefined
        }
        actions={<AiShortcutButton prompt={aiShortcuts.myConduct()} title={t('MyConductPage.kAiReadsYourConductForm')} />}
      >
        <div id="tour-my-conduct-target" className="flex flex-wrap items-center gap-3">
          <ConductTargetPicker organizationId={orgId} value={target} onChange={setTarget} />
        </div>
      </WorkspaceHeader>

      {isLoading && <LoadingSkeleton rows={6} />}

      {!isLoading && !sheet && (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={HeartHandshake}
            title={t('MyConductPage.noPeriodCycleSelected')}
            description={t('MyConductPage.chooseAPeriodOrACycle')}
          />
        </div>
      )}

      {!isLoading && sheet && (
        <ConductSheetTable
          sheet={sheet}
          onSaveSelf={saveSelf}
          onSaveManager={saveManager}
          isSavingSelf={isSavingSelf}
          isSavingManager={isSavingManager}
        />
      )}
    </div>
  )
}
