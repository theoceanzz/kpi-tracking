import { useState, useEffect, useMemo } from 'react'
import {
  Lock, 
  CheckSquare, 
  Square,
  Loader2,
  Save,
  Search,
  Zap,
  Check
} from 'lucide-react'
import { useAllPermissions, useRolePermissions, useUpdateRolePermissions } from '../hooks/useRolePermissions'
import { RoleResponse } from '../api/role.api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Drawer, Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface RolePermissionDrawerProps {
  role: RoleResponse | null
  isOpen: boolean
  onClose: () => void
  hierarchyLevels: any[]
}

const PERMISSION_DESCRIPTIONS = perLanguage((): Record<string, string> => ({
  'DASHBOARD:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingChartsOverviewStatisticsAnd'),
  'COMPANY:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheCompanyOrganizationProfile'),
  'COMPANY:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingAndUpdatingTheCompany'),
  'COMPANY:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingOrArchivingTheOrganization'),
  'ORG:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheOrganizationChartAnd'),
  'ORG:CREATE': i18n.t('organization:RolePermissionDrawer.allowsCreatingNewUnitsDepartmentsIn'),
  'ORG:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingUnitDepartmentInformationName'),
  'ORG:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingUnitsDepartmentsFromThe'),
  'ORG:VIEW_TREE': i18n.t('organization:RolePermissionDrawer.allowsViewingTheOrganizationTreeIn'),
  'USER:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheDirectoryAndDetailed'),
  'USER:CREATE': i18n.t('organization:RolePermissionDrawer.allowsAddingNewUserAccountsProfiles'),
  'USER:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingPeoplesPersonalInformationPositions'),
  'USER:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingOrDeactivatingUserAccounts'),
  'USER:IMPORT': i18n.t('organization:RolePermissionDrawer.allowsImportingPeopleInBulkFrom'),
  'USER:VIEW_LIST': i18n.t('organization:RolePermissionDrawer.allowsViewingThePeopleListIn'),
  'ROLE:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheListOfExisting'),
  'ROLE:ASSIGN': i18n.t('organization:RolePermissionDrawer.allowsAssigningOneOrMoreRoles'),
  'ROLE:CREATE': i18n.t('organization:RolePermissionDrawer.allowsCreatingNewRolesAlongWith'),
  'ROLE:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingTheNameDescriptionAnd'),
  'ROLE:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingRolesFromTheSystem'),
  'PERMISSION:EDIT': i18n.t('organization:RolePermissionDrawer.allowsConfiguringInDetailAndTurning'),
  'PERMISSION:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheListOfAll'),
  'KPI:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheListAndDetails'),
  'KPI:CREATE': i18n.t('organization:RolePermissionDrawer.allowsSettingUpNewKpisFor'),
  'KPI:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingTheContentWeightAnd'),
  'KPI:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingKpisFromTheSystem'),
  'KPI:APPROVE_CRITERIA': i18n.t('organization:RolePermissionDrawer.allowsApprovingKpisProposedBySubordinates'),
  'KPI:APPROVE_ADJUSTMENT': i18n.t('organization:RolePermissionDrawer.allowsApprovingKpiAdjustmentRequestsDuring'),
  'KPI:APPROVE_OWN': i18n.t('organization:RolePermissionDrawer.whenAPersonAtTheHighest'),
  'KPI:APPROVE_FINAL': i18n.t('organization:RolePermissionDrawer.finalApprovalOfKpisAndAdjustment'),
  'KPI:VIEW_MY': i18n.t('organization:RolePermissionDrawer.allowsViewingKpisAssignedToThe'),
  'KPI:IMPORT': i18n.t('organization:RolePermissionDrawer.allowsImportingKpisInBulkFrom'),
  'KPI:SUBMIT': i18n.t('organization:RolePermissionDrawer.allowsSubmittingConfiguredKpisToThe'),
  'KPI:REJECT': i18n.t('organization:RolePermissionDrawer.allowsRejectingAndReturningInvalidKpis'),
  'KPI_PERIOD:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheListOfKpi'),
  'KPI_PERIOD:CREATE': i18n.t('organization:RolePermissionDrawer.allowsCreatingNewKpiEvaluationCycles'),
  'KPI_PERIOD:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsUpdatingTheInformationAndStatus'),
  'KPI_PERIOD:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingKpiEvaluationCyclesFrom'),
  'SUBMISSION:REVIEW': i18n.t('organization:RolePermissionDrawer.allowsApprovingRejectingSubordinatesKpiResult'),
  'SUBMISSION:REVIEW_KPI': i18n.t('organization:RolePermissionDrawer.allowsViewingTheDetailsOfEmployees'),
  'SUBMISSION:CREATE': i18n.t('organization:RolePermissionDrawer.allowsSubmittingPersonalKpiResultReports'),
  'SUBMISSION:VIEW_MY': i18n.t('organization:RolePermissionDrawer.allowsReviewingTheHistoryOfOnes'),
  'SUBMISSION:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingAllKpiSubmissionsOf'),
  'SUBMISSION:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingKpiSubmissionsThatHave'),
  'SUBMISSION:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingTheContentOfExisting'),
  'EVALUATION:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingKpiEvaluationResultsAnd'),
  'EVALUATION:CREATE': i18n.t('organization:RolePermissionDrawer.allowsEvaluatingScoringAndRatingEmployees'),
  'EVALUATION:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingPreviouslyCreatedKpiEvaluation'),
  'EVALUATION:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingKpiEvaluationResultsFrom'),
  'EVALUATION:VIEW_MY': i18n.t('organization:RolePermissionDrawer.allowsViewingTheUsersOwnKpi'),
  'NOTIF:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheListOfNotifications'),
  'NOTIF:MANAGE': i18n.t('organization:RolePermissionDrawer.allowsManagingComposingAndSendingSystem'),
  'AI:SUGGEST_KPI': i18n.t('organization:RolePermissionDrawer.allowsUsingArtificialIntelligenceFeaturesTo'),
  'POLICY:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheOrganizationsInternalPolicies'),
  'POLICY:CREATE': i18n.t('organization:RolePermissionDrawer.allowsDraftingAndCreatingInternalPolicies'),
  'POLICY:UPDATE': i18n.t('organization:RolePermissionDrawer.allowsEditingTheContentOfIssued'),
  'POLICY:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingPoliciesRegulationsFromThe'),
  'POLICY:ASSIGN': i18n.t('organization:RolePermissionDrawer.allowsAssigningPoliciesRegulationsToSpecific'),
  'STATS:VIEW_ORG': i18n.t('organization:RolePermissionDrawer.allowsViewingStatisticsAndSummaryReports'),
  'STATS:VIEW_EMPLOYEE': i18n.t('organization:RolePermissionDrawer.allowsViewingDetailedKpiResultStatistics'),
  'STATS:VIEW_MY': i18n.t('organization:RolePermissionDrawer.allowsViewingTheUsersOwnKpi2'),
  'SYSTEM:ADMIN': i18n.t('organization:RolePermissionDrawer.systemWideAdministrationPermissionThatBypasses'),
  'USER_ROLE:VIEW': i18n.t('organization:RolePermissionDrawer.allowsViewingTheListOfRoles'),
  'USER_ROLE:ASSIGN': i18n.t('organization:RolePermissionDrawer.allowsAssigningNewRolesToUsers'),
  'USER_ROLE:REVOKE': i18n.t('organization:RolePermissionDrawer.allowsRevokingRemovingAssignedRolesFrom'),
  'ATTACHMENT:UPLOAD': i18n.t('organization:RolePermissionDrawer.allowsUploadingAttachmentsEvidenceDocumentsFor'),
  'ATTACHMENT:DELETE': i18n.t('organization:RolePermissionDrawer.allowsDeletingUploadedAttachmentsFromThe'),
  'REMINDER:SEND': i18n.t('organization:RolePermissionDrawer.allowsSendingRemindersToEmployeesAbout'),
  'ADJUSTMENT:VIEW_MY': i18n.t('organization:RolePermissionDrawer.allowsViewingKpiAdjustmentRequestsOne')
}));

function PermissionTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  
  return (
    <div className="relative" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-[var(--color-foreground)] text-[var(--color-background)] text-xs font-medium rounded-card shadow-2xl z-[200] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <div className="relative">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--color-foreground)]" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RolePermissionDrawer({ role, isOpen, onClose, hierarchyLevels }: RolePermissionDrawerProps) {
  const { t } = useTranslation('organization')
  const { data: allPermissions = [], isLoading: isLoadingAll } = useAllPermissions()
  const { data: rolePermissions, isLoading: isLoadingRole } = useRolePermissions(role?.id)
  const updateMutation = useUpdateRolePermissions()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showDefaultPreview, setShowDefaultPreview] = useState<{ isOpen: boolean; type: string; codes: string[] }>({
    isOpen: false,
    type: '',
    codes: []
  })

  // Sync role permissions to local state when loaded
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      return
    }

    if (rolePermissions) {
      setSelectedIds(new Set(rolePermissions.map(p => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [rolePermissions, isOpen])

  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, typeof allPermissions> = {}
    allPermissions
      .filter(p => (p.code?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || (p.resource?.toLowerCase() || '').includes(searchQuery.toLowerCase()))
      .forEach(p => {
        const resource = p.resource || t('RolePermissionDrawer.unclassified')
        if (!groups[resource]) {
          groups[resource] = []
        }
        groups[resource].push(p)
      })
    return groups
  }, [allPermissions, searchQuery, t])

  const togglePermission = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleResource = (_resource: string, permissions: typeof allPermissions) => {
    const next = new Set(selectedIds)
    const allIds = permissions.map(p => p.id)
    const isAllSelected = allIds.every(id => next.has(id))

    if (isAllSelected) {
      allIds.forEach(id => next.delete(id))
    } else {
      allIds.forEach(id => next.add(id))
    }
    setSelectedIds(next)
  }

  const handleSave = async () => {
    if (!role) return
    await updateMutation.mutateAsync({
      roleId: role.id,
      permissionIds: Array.from(selectedIds)
    })
    onClose()
  }

  const handleApplyDefaults = () => {
    if (!role) return;

    let targetType = 'staff';
    let label = t('RolePermissionDrawer.employee');

    // Get the set of active role levels for this company
    const activeRoleLevels = Array.from(new Set(hierarchyLevels.map((l: any) => l.roleLevel)) as Set<number>).sort((a: number, b: number) => a - b)
    const minRoleLevel = activeRoleLevels[0]
    const maxRoleLevel = activeRoleLevels[activeRoleLevels.length - 1]

    if (role.level === minRoleLevel && role.rank === 0) {
      targetType = 'director';
      label = role.name;
    } else if (role.level === maxRoleLevel && role.rank === 2) {
      targetType = 'staff';
      label = role.name;
    } else {
      if (role.rank === 0) { targetType = 'manager'; label = role.name; }
      else if (role.rank === 1) { targetType = 'deputy'; label = role.name; }
      else { targetType = 'staff'; label = role.name; }
    }

    // Use the same definitions as the global modal (strictly following SQL V2 logic)
    const EXCLUDES = ['KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY'];
    const MANAGER = ['DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE', 'KPI:REJECT', 'KPI:SUBMIT', 'KPI:IMPORT', 'KPI:VIEW_MY', 'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY', 'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'];
    const DEPUTY = ['DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:UPDATE', 'KPI:SUBMIT', 'KPI:VIEW_MY', 'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY', 'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'];
    const STAFF = ['DASHBOARD:VIEW', 'KPI:VIEW_MY', 'KPI:SUBMIT', 'KPI_PERIOD:VIEW', 'SUBMISSION:CREATE', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'EVALUATION:CREATE', 'NOTIF:VIEW', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_MY'];

    let codes: string[] = [];
    if (targetType === 'director') codes = allPermissions.filter(p => !EXCLUDES.includes(p.code)).map(p => p.code);
    else if (targetType === 'manager') codes = MANAGER;
    else if (targetType === 'deputy') codes = DEPUTY;
    else codes = STAFF;

    setShowDefaultPreview({ isOpen: true, type: label, codes });
  };

  const confirmApplyDefaults = () => {
    const nextIds = new Set(selectedIds);
    const suggestedIds = allPermissions
      .filter(p => showDefaultPreview.codes.includes(p.code))
      .map(p => p.id);
    
    suggestedIds.forEach(id => nextIds.add(id));
    setSelectedIds(nextIds);
    setShowDefaultPreview({ ...showDefaultPreview, isOpen: false });
    toast.success(t('RolePermissionDrawer.suggestedAPermissionSetFor', { type: showDefaultPreview.type }));
  };

  return (
    <>
    <Drawer
      open={isOpen}
      onClose={onClose}
      size="lg"
      flush
      dismissible={!updateMutation.isPending}
      title={t('RolePermissionDrawer.permissionSetup')}
      description={<>{t('RolePermissionDrawer.role')} <span className="font-medium text-[var(--color-foreground)]">{role?.name}</span></>}
      headerExtra={
        <Button variant="outline" size="sm" onClick={handleApplyDefaults} className="shrink-0">
          <Zap aria-hidden="true" />
          <span className="hidden sm:inline">{t('RolePermissionDrawer.applyDefaultPermissions')}</span>
          <span className="sm:hidden">{t('RolePermissionDrawer.default')}</span>
        </Button>
      }
      footer={
        <DialogFooter
          note={<>{t('RolePermissionDrawer.selected')} <span className="font-medium text-[var(--color-foreground)] tabular-nums">{selectedIds.size}</span> {t('RolePermissionDrawer.permissions')}</>}
          secondary={<Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>{t('RolePermissionDrawer.cancel')}</Button>}
          primary={
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {t('RolePermissionDrawer.savePermissions')}
            </Button>
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Search */}
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
            <input
              type="text"
              placeholder={t('RolePermissionDrawer.searchPermissionsOrResources')}
              aria-label={t('RolePermissionDrawer.searchPermissions')}
              className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Body */}
        <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto bg-[var(--color-muted)] p-5">
          {(isLoadingAll || isLoadingRole) ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
              <p className="text-[var(--color-muted-foreground)] font-semibold animate-pulse">{t('RolePermissionDrawer.loadingPermissionData')}</p>
            </div>
          ) : (
            Object.entries(groupedPermissions).map(([resource, permissions]) => {
              const allIds = permissions.map(p => p.id)
              const selectedCount = allIds.filter(id => selectedIds.has(id)).length
              const isAllSelected = selectedCount === allIds.length

              return (
                <div key={resource} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] transition-all">
                  <div className="p-6 border-b bg-[var(--color-muted)] flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Lock className="w-4 h-4 text-[var(--color-subtle-foreground)]" />
                      <h4 className="text-sm font-semibold text-[var(--color-foreground)]">{resource}</h4>
                      <span className="px-2 py-0.5 bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold rounded-full">
                        {selectedCount}/{allIds.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleResource(resource, permissions)}>
                      {isAllSelected ? t('RolePermissionDrawer.deselectAll') : t('RolePermissionDrawer.selectAll')}
                    </Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissions.map(p => (
                      <PermissionTooltip key={p.id} text={p.description || PERMISSION_DESCRIPTIONS()[p.code] || t('RolePermissionDrawer.permissionToPerformTheActionOn', { action: p.action, resource: p.resource })}>
                        <button
                          onClick={() => togglePermission(p.id)}
                          className={cn(
                            "w-full flex items-center space-x-3 px-4 py-3 rounded-card border transition-all text-left",
                            selectedIds.has(p.id) 
                              ? "bg-[var(--color-primary-soft)] border-[var(--color-border)] text-[var(--color-primary)] shadow-sm" 
                              : "bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-border)]"
                          )}
                        >
                          {selectedIds.has(p.id) ? (
                            <CheckSquare className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-[var(--color-subtle-foreground)] shrink-0" />
                          )}
                          <div>
                            <div className="text-sm font-medium truncate tracking-tight">{p.code}</div>
                            <div className="text-eyebrow tracking-tighter">{p.action}</div>
                          </div>
                        </button>
                      </PermissionTooltip>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Drawer>

      <Dialog
        open={showDefaultPreview.isOpen}
        onClose={() => setShowDefaultPreview({ ...showDefaultPreview, isOpen: false })}
        size="md"
        title={t('RolePermissionDrawer.previewDefaultPermissions')}
        description={<>{t('RolePermissionDrawer.suggestedForRole')} <span className="font-medium text-[var(--color-foreground)]">{showDefaultPreview.type}</span></>}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowDefaultPreview({ ...showDefaultPreview, isOpen: false })}>{t('RolePermissionDrawer.cancel')}</Button>}
            primary={<Button onClick={confirmApplyDefaults}>{t('RolePermissionDrawer.confirmApply')}</Button>}
          />
        }
      >
        <p className="text-eyebrow mb-3">{t('RolePermissionDrawer.listOfPermissionCodesToBe')}</p>
        <div className="grid grid-cols-2 gap-2">
          {showDefaultPreview.codes.map(code => (
            <div key={code} className="flex items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-caption">
              <Check size={12} className="shrink-0 text-[var(--color-success)]" strokeWidth={3} aria-hidden="true" /> <span className="truncate">{code}</span>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  )
}
