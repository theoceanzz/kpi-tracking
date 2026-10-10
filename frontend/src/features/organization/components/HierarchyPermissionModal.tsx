import { useState, useMemo } from 'react'
import {
  X,
  Zap,
  Check,
  Lock,
  Loader2
} from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useAllPermissions, useUpdateRolePermissions } from '../hooks/useRolePermissions'
import { useRoles } from '../hooks/useRoles'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'


interface HierarchyPermissionModalProps {
  isOpen: boolean
  onClose: () => void
  hierarchyLevels: any[]
}

const PERMISSION_DESCRIPTIONS = perLanguage((): Record<string, string> => ({
  'DASHBOARD:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingChartsOverviewStatisticsAnd'),
  'COMPANY:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheCompanyOrganizationProfile'),
  'COMPANY:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingAndUpdatingTheCompany'),
  'COMPANY:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingOrArchivingTheOrganization'),
  'ORG:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheOrganizationChartAnd'),
  'ORG:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsCreatingNewUnitsDepartmentsIn'),
  'ORG:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingUnitDepartmentInformationName'),
  'ORG:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingUnitsDepartmentsFromThe'),
  'ORG:VIEW_TREE': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheOrganizationTreeIn'),
  'USER:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheDirectoryAndDetailed'),
  'USER:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsAddingNewUserAccountsProfiles'),
  'USER:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingPeoplesPersonalInformationPositions'),
  'USER:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingOrDeactivatingUserAccounts'),
  'USER:IMPORT': i18n.t('organization:HierarchyPermissionModal.allowsImportingPeopleInBulkFrom'),
  'USER:VIEW_LIST': i18n.t('organization:HierarchyPermissionModal.allowsViewingThePeopleListIn'),
  'ROLE:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheListOfExisting'),
  'ROLE:ASSIGN': i18n.t('organization:HierarchyPermissionModal.allowsAssigningOneOrMoreRoles'),
  'ROLE:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsCreatingNewRolesAlongWith'),
  'ROLE:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingTheNameDescriptionAnd'),
  'ROLE:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingRolesFromTheSystem'),
  'PERMISSION:EDIT': i18n.t('organization:HierarchyPermissionModal.allowsConfiguringInDetailAndTurning'),
  'PERMISSION:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheListOfAll'),
  'KPI:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheListAndDetails'),
  'KPI:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsSettingUpNewKpisFor'),
  'KPI:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingTheContentWeightAnd'),
  'KPI:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingKpisFromTheSystem'),
  'KPI:APPROVE_CRITERIA': i18n.t('organization:HierarchyPermissionModal.allowsApprovingKpisProposedBySubordinates'),
  'KPI:APPROVE_ADJUSTMENT': i18n.t('organization:HierarchyPermissionModal.allowsApprovingKpiAdjustmentRequestsDuring'),
  'KPI:APPROVE_OWN': i18n.t('organization:HierarchyPermissionModal.whenAPersonAtTheHighest'),
  'KPI:APPROVE_FINAL': i18n.t('organization:HierarchyPermissionModal.finalApprovalOfKpisAndAdjustment'),
  'KPI:VIEW_MY': i18n.t('organization:HierarchyPermissionModal.allowsViewingKpisAssignedToThe'),
  'KPI:IMPORT': i18n.t('organization:HierarchyPermissionModal.allowsImportingKpisInBulkFrom'),
  'KPI:SUBMIT': i18n.t('organization:HierarchyPermissionModal.allowsSubmittingConfiguredKpisToThe'),
  'KPI:REJECT': i18n.t('organization:HierarchyPermissionModal.allowsRejectingAndReturningInvalidKpis'),
  'KPI_PERIOD:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheListOfKpi'),
  'KPI_PERIOD:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsCreatingNewKpiEvaluationCycles'),
  'KPI_PERIOD:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsUpdatingTheInformationAndStatus'),
  'KPI_PERIOD:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingKpiEvaluationCyclesFrom'),
  'SUBMISSION:REVIEW': i18n.t('organization:HierarchyPermissionModal.allowsApprovingRejectingSubordinatesKpiResult'),
  'SUBMISSION:REVIEW_KPI': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheDetailsOfEmployees'),
  'SUBMISSION:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsSubmittingPersonalKpiResultReports'),
  'SUBMISSION:VIEW_MY': i18n.t('organization:HierarchyPermissionModal.allowsReviewingTheHistoryOfOnes'),
  'SUBMISSION:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingAllKpiSubmissionsOf'),
  'SUBMISSION:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingKpiSubmissionsThatHave'),
  'SUBMISSION:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingTheContentOfExisting'),
  'EVALUATION:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingKpiEvaluationResultsAnd'),
  'EVALUATION:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsEvaluatingScoringAndRatingEmployees'),
  'EVALUATION:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingPreviouslyCreatedKpiEvaluation'),
  'EVALUATION:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingKpiEvaluationResultsFrom'),
  'EVALUATION:VIEW_MY': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheUsersOwnKpi'),
  'NOTIF:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheListOfNotifications'),
  'NOTIF:MANAGE': i18n.t('organization:HierarchyPermissionModal.allowsManagingComposingAndSendingSystem'),
  'AI:SUGGEST_KPI': i18n.t('organization:HierarchyPermissionModal.allowsUsingArtificialIntelligenceFeaturesTo'),
  'POLICY:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheOrganizationsInternalPolicies'),
  'POLICY:CREATE': i18n.t('organization:HierarchyPermissionModal.allowsDraftingAndCreatingInternalPolicies'),
  'POLICY:UPDATE': i18n.t('organization:HierarchyPermissionModal.allowsEditingTheContentOfIssued'),
  'POLICY:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingPoliciesRegulationsFromThe'),
  'POLICY:ASSIGN': i18n.t('organization:HierarchyPermissionModal.allowsAssigningPoliciesRegulationsToSpecific'),
  'STATS:VIEW_ORG': i18n.t('organization:HierarchyPermissionModal.allowsViewingStatisticsAndSummaryReports'),
  'STATS:VIEW_EMPLOYEE': i18n.t('organization:HierarchyPermissionModal.allowsViewingDetailedKpiResultStatistics'),
  'STATS:VIEW_MY': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheUsersOwnKpi2'),
  'SYSTEM:ADMIN': i18n.t('organization:HierarchyPermissionModal.systemWideAdministrationPermissionThatBypasses'),
  'USER_ROLE:VIEW': i18n.t('organization:HierarchyPermissionModal.allowsViewingTheListOfRoles'),
  'USER_ROLE:ASSIGN': i18n.t('organization:HierarchyPermissionModal.allowsAssigningNewRolesToUsers'),
  'USER_ROLE:REVOKE': i18n.t('organization:HierarchyPermissionModal.allowsRevokingRemovingAssignedRolesFrom'),
  'ATTACHMENT:UPLOAD': i18n.t('organization:HierarchyPermissionModal.allowsUploadingAttachmentsEvidenceDocumentsFor'),
  'ATTACHMENT:DELETE': i18n.t('organization:HierarchyPermissionModal.allowsDeletingUploadedAttachmentsFromThe'),
  'REMINDER:SEND': i18n.t('organization:HierarchyPermissionModal.allowsSendingRemindersToEmployeesAbout'),
  'ADJUSTMENT:VIEW_MY': i18n.t('organization:HierarchyPermissionModal.allowsViewingKpiAdjustmentRequestsOne')
}));

// Define core permission codes for easier mapping - strictly following V2 Seed Data logic
const PERMS = {
  // Director gets almost everything
  DIRECTOR_EXCLUDES: ['KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY'],
  
  // Head/Manager (Rank 0, Level 1 or 2)
  MANAGER_CORE: [
    'DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE', 'KPI:REJECT', 'KPI:SUBMIT', 'KPI:IMPORT', 'KPI:VIEW_MY',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY',
    'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY',
    'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD',
    'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'
  ],

  // Deputy (Rank 1, Level 1 or 2)
  DEPUTY_CORE: [
    'DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:UPDATE', 'KPI:SUBMIT', 'KPI:VIEW_MY',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY',
    'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY',
    'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD',
    'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'
  ],

  // Staff (Rank 2, Level 2)
  STAFF_CORE: [
    'DASHBOARD:VIEW', 'KPI:VIEW_MY', 'KPI:SUBMIT', 'KPI_PERIOD:VIEW',
    'SUBMISSION:CREATE', 'SUBMISSION:VIEW_MY',
    'EVALUATION:VIEW_MY', 'EVALUATION:CREATE',
    'NOTIF:VIEW', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_MY'
  ]
}

export default function HierarchyPermissionModal({ isOpen, onClose, hierarchyLevels }: HierarchyPermissionModalProps) {
  const { t } = useTranslation('organization')
  const { data: allPermissions = [] } = useAllPermissions()
  const { data: roles = [] } = useRoles()
  const updateMutation = useUpdateRolePermissions()
  const [isApplying, setIsApplying] = useState(false)
  
  const hierarchyCount = hierarchyLevels.length

  // Define what each role type gets based on SQL V2 definitions
  const roleTypeDefinitions = useMemo(() => {
    const director = allPermissions
      .filter(p => !PERMS.DIRECTOR_EXCLUDES.includes(p.code))
      .map(p => p.code)
      
    const manager = PERMS.MANAGER_CORE
    const deputy = PERMS.DEPUTY_CORE
    const staff = PERMS.STAFF_CORE

    return { director, manager, deputy, staff }
  }, [allPermissions])

  // Group all available permissions by resource for the matrix display
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, string[]> = {}
    allPermissions.forEach(p => {
      const resource = p.resource || t('HierarchyPermissionModal.unclassified')
      if (!groups[resource]) groups[resource] = []
      if (!groups[resource].includes(p.code)) groups[resource].push(p.code)
    })
    return groups
  }, [allPermissions, t])

  const displayRoles = useMemo(() => {
    const activeRoleLevels = Array.from(new Set(hierarchyLevels.map(l => l.roleLevel))).sort((a, b) => a - b)
    const result: any[] = []
    
    activeRoleLevels.forEach((levelVal, idx) => {
      const lvl = hierarchyLevels.find(l => l.roleLevel === levelVal)
      if (!lvl) return
      
      const isTop = idx === 0
      const isBottom = idx === activeRoleLevels.length - 1
      
      // Pattern: Each level has Head (0) and Deputy (1). Bottom level also has Staff (2).
      const ranks = isBottom ? [0, 1, 2] : [0, 1]
      
      ranks.forEach(rank => {
        // Try to find an actual role for this position to get a realistic label
        const actualRole = roles.find(r => r.level === levelVal && r.rank === rank && !r.isSystem)
        
        let label = ''
        if (actualRole) {
          label = actualRole.name
        } else {
          // Fallback labels based on hierarchy info
          if (rank === 0) {
            label = isTop ? (lvl.managerRoleLabel || t('HierarchyPermissionModal.director')) : t('HierarchyPermissionModal.headOf', { unitTypeName: lvl.unitTypeName })
          } else if (rank === 1) {
            label = t('HierarchyPermissionModal.deputy', { value: isTop ? (lvl.managerRoleLabel || t('HierarchyPermissionModal.director2')) : lvl.unitTypeName })
          } else {
            label = t('HierarchyPermissionModal.employee')
          }
        }
        
        result.push({
          key: `lvl_${levelVal}_rank_${rank}`,
          label: label.toUpperCase(),
          roleLevel: levelVal,
          rank: rank
        })
      })
    })
    return result
  }, [roles, hierarchyLevels, t])

  const handleApply = async () => {
    if (blockedByTour()) return
    setIsApplying(true)
    try {
      let successCount = 0
      // Get the set of active role levels for this company
      const activeRoleLevels = new Set(hierarchyLevels.map(l => l.roleLevel))

      for (const role of roles) {
        // Skip roles that are not in the active hierarchy levels
        if (!activeRoleLevels.has(role.level)) continue

        let targetCodes: string[] = []
        
        // Find if this role is at the top-most level of the company
        const minRoleLevel = Math.min(...Array.from(activeRoleLevels))
        const maxRoleLevel = Math.max(...Array.from(activeRoleLevels))

        if (role.level === minRoleLevel && role.rank === 0) {
          // Top-most manager gets director permissions
          targetCodes = roleTypeDefinitions.director
        } else if (role.level === maxRoleLevel && role.rank === 2) {
          // Bottom-most staff gets staff permissions
          targetCodes = roleTypeDefinitions.staff
        } else {
          // Everyone else in between or deputy
          targetCodes = role.rank === 0 ? roleTypeDefinitions.manager : roleTypeDefinitions.deputy
        }

        if (targetCodes.length > 0) {
          const permissionIds = allPermissions
            .filter(p => targetCodes.includes(p.code))
            .map(p => p.id)
            
          await updateMutation.mutateAsync({
            roleId: role.id,
            permissionIds
          })
          successCount++
        }
      }
      toast.success(t('HierarchyPermissionModal.updatedPermissionsForRolesAccordingTo', { count: successCount }))
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('HierarchyPermissionModal.failedToApplyPermissions')))
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog {...tourAnchor('hier.modal')}
      open={isOpen}
      onClose={onClose}
      size="full"
      dismissible={!isApplying}
      title={t('HierarchyPermissionModal.setUpPermissionsByHierarchy')}
      description={<>{t('HierarchyPermissionModal.organizationModel')} <span className="font-medium text-[var(--color-foreground)]">{hierarchyCount} {t('HierarchyPermissionModal.level')}</span></>}
      footer={
        <DialogFooter
          note={t('HierarchyPermissionModal.replacesAllCurrentPermissionSettingsOf')}
          secondary={<Button variant="outline" onClick={onClose} disabled={isApplying}>{t('HierarchyPermissionModal.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('hier.apply')} onClick={handleApply} disabled={isApplying}>
              {isApplying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Zap aria-hidden="true" />}
              {isApplying ? t('HierarchyPermissionModal.settingUp') : t('HierarchyPermissionModal.confirmApplyingToTheWholeCompany')}
            </Button>
          }
        />
      }
    >
      <div className="space-y-8">
        {/* Permission Matrix Preview */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
             <h4 className="text-eyebrow flex items-center gap-2">
               <Zap size={14} className="text-[var(--color-warning)]" /> {t('HierarchyPermissionModal.detailedPermissionMatrix')}
             </h4>
             <div {...tourAnchor('hier.legend')} className="hidden sm:flex items-center gap-6">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--color-success-solid)]" />
                  <span className="text-caption">{t('HierarchyPermissionModal.full')}</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--color-warning-solid)]" />
                  <span className="text-caption">{t('HierarchyPermissionModal.partial')}</span>
               </div>
               <div className="flex items-center gap-2">
                  <X size={12} className="text-[var(--color-subtle-foreground)]" />
                  <span className="text-caption">{t('HierarchyPermissionModal.none')}</span>
               </div>
             </div>
          </div>

          {/* Desktop matrix */}
          <div {...tourAnchor('hier.matrix')} className="hidden md:block overflow-x-auto pb-4 -mx-2 px-2 custom-scrollbar">
            <div className="min-width-max space-y-3" style={{ minWidth: `${180 + 250 + (displayRoles.length * 75)}px` }}>
              {Object.entries(groupedPermissions).map(([resource, codes]) => (
                <div key={resource} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
                  <div className="px-6 py-2.5 bg-[var(--color-muted)] border-b border-[var(--color-border)] flex items-center">
                    <div className="w-[180px] shrink-0 flex items-center gap-2">
                      <Lock size={12} className="text-[var(--color-primary)]" />
                      <span className="text-eyebrow text-[var(--color-foreground)] truncate">{resource}</span>
                    </div>
                    <div className="w-[250px] shrink-0 text-left text-eyebrow tracking-tighter pl-4 border-l border-[var(--color-border)] ml-2">
                      {t('HierarchyPermissionModal.detailedPermissionDescriptions')}
                    </div>
                    <div className="flex items-center gap-2">
                      {displayRoles.map(r => (
                        <div key={r.key} className="w-[70px] text-center text-eyebrow tracking-tighter whitespace-normal leading-tight">
                          {r.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--color-border)]">
                    {codes.map(code => (
                      <div key={code} className="px-6 py-2 flex items-center hover:bg-[var(--color-muted)] transition-colors">
                        <div className="w-[180px] shrink-0 flex flex-col pr-4">
                          <span className="text-xs font-medium text-[var(--color-foreground)] truncate" title={code}>{code}</span>
                          <span className="text-caption font-medium">{code.split(':')[1]} action</span>
                        </div>
                        <div className="w-[250px] shrink-0 text-left text-caption font-medium leading-tight pr-6 border-l border-[var(--color-border)] pl-4 ml-2">
                          {allPermissions.find(p => p.code === code)?.description || PERMISSION_DESCRIPTIONS()[code] || t('HierarchyPermissionModal.descriptionIsBeingUpdated')}
                        </div>
                        <div className="flex items-center gap-2">
                          {displayRoles.map(r => {
                            const activeRoleLevels = Array.from(new Set(hierarchyLevels.map(l => l.roleLevel))).sort((a, b) => a - b)
                            const minRoleLevel = activeRoleLevels[0]
                            const maxRoleLevel = activeRoleLevels[activeRoleLevels.length - 1]
                            let targetCodes: string[] = []
                            if (r.roleLevel === minRoleLevel && r.rank === 0) {
                              targetCodes = roleTypeDefinitions.director
                            } else if (r.roleLevel === maxRoleLevel && r.rank === 2) {
                              targetCodes = roleTypeDefinitions.staff
                            } else {
                              targetCodes = r.rank === 0 ? roleTypeDefinitions.manager : roleTypeDefinitions.deputy
                            }
                            const has = targetCodes.includes(code)
                            return (
                              <div key={r.key} className="w-[70px] flex justify-center shrink-0">
                                {has ? (
                                  <div className="w-5 h-5 rounded bg-[var(--color-success-bg)] flex items-center justify-center text-[var(--color-success)] shadow-sm border border-[var(--color-success-border)]">
                                    <Check size={12} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 flex items-center justify-center">
                                    <X size={12} className="text-[var(--color-subtle-foreground)] opacity-50" />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile matrix - card layout with role pills */}
          <div {...tourAnchor('hier.matrix')} className="md:hidden space-y-3">
            {Object.entries(groupedPermissions).map(([resource, codes]) => (
              <div key={resource} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
                <div className="px-4 py-2.5 bg-[var(--color-muted)] border-b border-[var(--color-border)] flex items-center gap-2">
                  <Lock size={11} className="text-[var(--color-primary)]" />
                  <span className="text-eyebrow text-[var(--color-foreground)]">{resource}</span>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {codes.map(code => {
                    const activeRoleLevels = Array.from(new Set(hierarchyLevels.map(l => l.roleLevel))).sort((a, b) => a - b)
                    const minRoleLevel = activeRoleLevels[0]
                    const maxRoleLevel = activeRoleLevels[activeRoleLevels.length - 1]
                    return (
                      <div key={code} className="px-4 py-3 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-[var(--color-foreground)]">{code}</span>
                          <span className="text-caption font-medium ml-2">{code.split(':')[1]} action</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {displayRoles.map(r => {
                            let targetCodes: string[] = []
                            if (r.roleLevel === minRoleLevel && r.rank === 0) {
                              targetCodes = roleTypeDefinitions.director
                            } else if (r.roleLevel === maxRoleLevel && r.rank === 2) {
                              targetCodes = roleTypeDefinitions.staff
                            } else {
                              targetCodes = r.rank === 0 ? roleTypeDefinitions.manager : roleTypeDefinitions.deputy
                            }
                            const has = targetCodes.includes(code)
                            return (
                              <span key={r.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                has
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
                                  : 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] border-[var(--color-border)]'
                              }`}>
                                {has ? <Check size={8} strokeWidth={3} /> : <X size={8} />}
                                {r.label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
