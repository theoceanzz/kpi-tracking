import { useState, useEffect, useMemo, useRef } from 'react'
import { read, write, utils } from 'xlsx'
import {
  X, Save, AlertCircle, Trash2, Plus, Loader2,
  ListPlus, Search, User, UserCheck, Check,
  Scale, ArrowRight, ChevronDown, ChevronUp, BarChart3, SlidersHorizontal
} from 'lucide-react'
import type { KpiType } from '@/types/kpi'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useKpiTotalWeight } from '@/features/kpi/hooks/useKpiTotalWeight'
import { toast } from 'sonner'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { FREQUENCY_MAP } from '@/lib/utils'
import { kpiApi } from '@/features/kpi/api/kpiApi'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useBscPerspectives, useScorecards } from '@/features/bsc/hooks/useBsc'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface KpiExcelPreviewModalProps {
  open: boolean
  file: File | null
  kpiType?: KpiType
  onClose: () => void
  onImport: (modifiedFile: File, kpiType: KpiType) => void
  isImporting: boolean
}

interface KpiRow {
  id: string
  Name: string
  Description: string
  Weight: string
  TargetValue: string
  MinimumValue: string
  IsReverseKpi: string
  IsBonusKpi: string
  Deadline: string
  Unit: string
  Frequency: string
  EmployeeCode: string
  Period: string
  OrgUnit: string
  ObjectiveCode?: string
  KeyResultCode?: string
  Perspective?: string
  _errors?: Record<string, string>
}

const frequencyOptions = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED']

const kpiRowSchema = perLanguage(() => (z.object({
  Name: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.kpiNameIsRequired')),
  Description: z.string().optional().nullable(),
  Weight: z.string().refine(val => {
    const n = Number(val)
    return !isNaN(n) && n >= 1 && n <= 100
  }, i18n.t('kpi:KpiExcelPreviewModal.weightMustBeBetween1And')),
  TargetValue: z.string().refine(val => !isNaN(Number(val)), i18n.t('kpi:KpiExcelPreviewModal.targetValueMustBeANumber')),
  MinimumValue: z.string().refine(val => !val || !isNaN(Number(val)), i18n.t('kpi:KpiExcelPreviewModal.minimumValueMustBeANumber')).optional().nullable(),
  Deadline: z.string().refine(val => !val || /^\d{1,2}\/\d{1,2}\/\d{4}( \d{1,2}:\d{2})?$/.test(val), i18n.t('kpi:KpiExcelPreviewModal.formatDdMmYyyyOrDd')).optional().nullable(),
  Unit: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.unitIsRequired')),
  Frequency: z.string().refine(val => frequencyOptions.includes(val.toUpperCase()), i18n.t('kpi:KpiExcelPreviewModal.invalidFrequency')),
  EmployeeCode: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.employeeCodeIsRequired')),
  Period: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.kpiPeriodIsRequired')),
  OrgUnit: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.departmentIsRequired')),
})))

// Qualitative KPIs have no numeric target/unit — those fields are not validated.
const qualitativeKpiRowSchema = perLanguage(() => (z.object({
  Name: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.kpiNameIsRequired')),
  Description: z.string().optional().nullable(),
  Weight: z.string().refine(val => {
    const n = Number(val)
    return !isNaN(n) && n >= 1 && n <= 100
  }, i18n.t('kpi:KpiExcelPreviewModal.weightMustBeBetween1And')),
  Deadline: z.string().refine(val => !val || /^\d{1,2}\/\d{1,2}\/\d{4}( \d{1,2}:\d{2})?$/.test(val), i18n.t('kpi:KpiExcelPreviewModal.formatDdMmYyyyOrDd')).optional().nullable(),
  Frequency: z.string().refine(val => frequencyOptions.includes(val.toUpperCase()), i18n.t('kpi:KpiExcelPreviewModal.invalidFrequency')),
  EmployeeCode: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.employeeCodeIsRequired')),
  Period: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.kpiPeriodIsRequired')),
  OrgUnit: z.string().min(1, i18n.t('kpi:KpiExcelPreviewModal.departmentIsRequired')),
})))

const QUANTITATIVE_CRITICAL_FIELDS = ['Name', 'Weight', 'TargetValue', 'Unit', 'Frequency', 'EmployeeCode', 'Period']
const QUALITATIVE_CRITICAL_FIELDS = ['Name', 'Weight', 'Frequency', 'EmployeeCode', 'Period']

/** KPI thưởng nằm ngoài 100% trọng số (backend cũng loại nó khỏi tổng), nên không cộng vào cột "Excel". */
const countsTowardWeight = (row: KpiRow) => row.IsBonusKpi !== 'true'

export default function KpiExcelPreviewModal({ open, file, kpiType, onClose, onImport, isImporting }: KpiExcelPreviewModalProps) {
  const { t } = useTranslation('kpi')
  const [data, setData] = useState<KpiRow[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()
  // The type is seeded from the guide-modal tab but stays editable here so the
  // reviewer can correct it before importing.
  const [localKpiType, setLocalKpiType] = useState<KpiType>(kpiType ?? 'QUANTITATIVE')
  const isQualitative = localKpiType === 'QUALITATIVE'
  const rowSchema = isQualitative ? qualitativeKpiRowSchema() : kpiRowSchema()
  const criticalFields = isQualitative ? QUALITATIVE_CRITICAL_FIELDS : QUANTITATIVE_CRITICAL_FIELDS
  
  // Bulk settings state
  const [bulkFreq, setBulkFreq] = useState('')
  const [bulkPeriod, setBulkPeriod] = useState('')
  const [bulkOrgUnits, setBulkOrgUnits] = useState<string[]>([])
  const [isBulkOrgOpen, setIsBulkOrgOpen] = useState(false)
  const [openOrgDropdownId, setOpenOrgDropdownId] = useState<string | null>(null)
  const [orgDropdownPos, setOrgDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [bulkEmpCode, setBulkEmpCode] = useState('')
  const [isEmpTableOpen, setIsEmpTableOpen] = useState(false)
  const bulkOrgDropdownRef = useRef<HTMLDivElement>(null)

  const { data: objectivesData } = useObjectives(user?.memberships?.[0]?.organizationId)
  const objectives = objectivesData || []
  const { data: perspectivesData } = useBscPerspectives(user?.memberships?.[0]?.organizationId)
  const perspectives = perspectivesData || []

  // Fetch data for dropdowns
  const { data: periodsData } = useKpiPeriods({ 
    size: 100, 
    organizationId: user?.memberships?.[0]?.organizationId 
  })

  const newestPeriod = useMemo(() => {
    if (!periodsData?.content || periodsData.content.length === 0) return ''
    const sorted = [...periodsData.content].sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : 0
      const timeB = b.startDate ? new Date(b.startDate).getTime() : 0
      return timeB - timeA
    })
    return sorted[0]?.name || ''
  }, [periodsData])
  const { data: orgTree } = useOrgUnitTree()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const enableWaterfall = org?.enableWaterfall || false
  const enableOkr = org?.enableOkr || false
  const enableQualitative = org?.enableQualitative || false
  const enableBsc = org?.enableBsc || false

  // Lọc hạng mục theo (đơn vị + đợt) của TỪNG dòng — giống form tạo KPI / task khẩn.
  const { data: bscScorecards } = useScorecards(enableBsc ? user?.memberships?.[0]?.organizationId : undefined)
  const unitParent = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgTree || [])
    return map
  }, [orgTree])
  const unitIdByName = useMemo(() => {
    const map = new Map<string, string>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { if (n.name) map.set(String(n.name).trim().toLowerCase(), n.id); if (n.children) walk(n.children) })
    walk(orgTree || [])
    return map
  }, [orgTree])
  const periodIdByName = useMemo(() => {
    const map = new Map<string, string>()
    ;(periodsData?.content || []).forEach((p: any) => map.set(String(p.name).trim().toLowerCase(), p.id))
    return map
  }, [periodsData])
  const availablePerspIdsForRow = (row: KpiRow): Set<string> | null => {
    if (!enableBsc || !bscScorecards) return null
    const periodId = periodIdByName.get((row.Period || '').trim().toLowerCase())
    if (!periodId) return null // đợt chưa khớp ⇒ chưa lọc
    const periodScs = scorecardsForPeriod(bscScorecards, periodId)
    if (!periodScs.length) return new Set<string>() // đợt chưa có bộ tiêu chí ⇒ rỗng
    const unitIds = (row.OrgUnit || '').split(',').map(s => unitIdByName.get(s.trim().toLowerCase())).filter(Boolean) as string[]
    if (!unitIds.length) return null // chưa khớp đơn vị ⇒ chưa lọc
    const resolve = (uid: string) => {
      let cur: string | null = uid, guard = 0
      while (cur && guard++ < 100) {
        const found = periodScs.find(s => (s.orgUnits || []).some((u: any) => u.id === cur))
        if (found) return found
        cur = unitParent.get(cur) ?? null
      }
      return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    }
    const ids = new Set<string>()
    unitIds.forEach(uid => (resolve(uid)?.perspectives || []).forEach((p: any) => ids.add(p.perspectiveId)))
    return ids
  }

  // Seed the local type from the prop each time the modal opens.
  useEffect(() => {
    if (open) setLocalKpiType(kpiType ?? 'QUANTITATIVE')
  }, [open, kpiType])

  // Re-validate rows when switching type (target/unit requirements differ).
  useEffect(() => {
    setData(prev => prev.length ? prev.map(row => validateRow(row)) : prev)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localKpiType])

  const { data: usersData } = useUsers({ 
    page: 0, 
    size: 1000,
    organizationId: user?.memberships?.[0]?.organizationId
  })
  const allUsers = usersData?.content || []

  const flatOrgUnits = (() => {
    const flatten = (nodes: any[]): any[] => {
      let res: any[] = []
      nodes.forEach(n => {
        res.push(n)
        if (n.children?.length) res = res.concat(flatten(n.children))
      })
      return res
    }
    const allUnits = orgTree ? flatten(orgTree) : []
    
    // Filter based on user permissions/role
    const isGlobalAdmin = user?.permissions?.includes('SYSTEM:ADMIN')
    if (isGlobalAdmin) return allUnits

    // For non-admins (Heads/Team Leads), only show units they are a member of
    // and EXCLUDE the root organization (parent is null) because managers 
    // usually only manage specific teams/departments, not the whole company unit.
    const userUnitIds = user?.memberships?.map(m => m.orgUnitId) || []
    const userMemberUnits = allUnits.filter(u => userUnitIds.includes(u.id))
    
    return allUnits.filter(u => {
      if (u.parentId === null) return false
      return userMemberUnits.some(uu => u.path.startsWith(uu.path))
    })
  })()

  // Default selections - Removed automatic defaults as per user request
  useEffect(() => {
    // We no longer auto-select period and org unit
  }, [open, periodsData, flatOrgUnits])

  // Automatically apply defaults to rows with empty values
  useEffect(() => {
    const singleOrgUnit = bulkOrgUnits.length === 1 ? bulkOrgUnits[0] : ''
    if (data.length > 0 && (bulkPeriod || singleOrgUnit)) {
      let hasChanges = false
      const updated = data.map(row => {
        let needsUpdate = false
        const newRow = { ...row }

        if (!newRow.Period && bulkPeriod) {
          newRow.Period = bulkPeriod
          needsUpdate = true
        }
        if (!newRow.OrgUnit && singleOrgUnit) {
          newRow.OrgUnit = singleOrgUnit
          needsUpdate = true
        }

        if (needsUpdate) {
          hasChanges = true
          return validateRow(newRow)
        }
        return row
      })

      if (hasChanges) {
        setData(updated)
      }
    }
  }, [bulkPeriod, bulkOrgUnits, data])

  useEffect(() => {
    if (open && file) {
      parseFile(file)
    } else {
      setData([])
    }
  }, [open, file])

  // Re-validate when users or assignment type changes
  useEffect(() => {
    if (allUsers.length > 0 && data.length > 0) {
      setData(prev => prev.map(row => validateRow(row)))
    }
  }, [allUsers.length])
  

  const parseFile = async (f: File) => {
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const wb = read(buffer)
      const sheetName = wb.SheetNames[0]
      if (!sheetName) throw new Error(t('KpiExcelPreviewModal.theFileHasNoSheets'))
      const ws = wb.Sheets[sheetName]
      if (!ws) throw new Error(t('KpiExcelPreviewModal.couldNotReadDataFromThe'))
      const rawData = utils.sheet_to_json<any>(ws)

      const parsed: KpiRow[] = rawData.map((row, index) => {
        const rawOrgValue = (row['OrgUnitCode'] || row['OrgUnit'] || (bulkOrgUnits.length === 1 ? bulkOrgUnits[0] : '') || '').toString().trim()

        const item: KpiRow = {
          id: `row-${index}`,
          Name: (row['Name'] || '').toString().trim(),
          Description: (row['Description'] || '').toString().trim(),
          Weight: (row['Weight'] ?? '').toString().trim(),
          TargetValue: (row['TargetValue'] ?? '').toString().trim(),
          MinimumValue: (row['MinimumValue'] ?? '').toString().trim(),
          Deadline: (row['Deadline'] ?? '').toString().trim(),
          IsReverseKpi: (row['IsReverseKpi'] ?? '').toString().trim().toLowerCase(),
          IsBonusKpi: (row['IsBonusKpi'] ?? '').toString().trim().toLowerCase(),
          Unit: (row['Unit'] || '').toString().trim(),
          Frequency: (row['Frequency'] || bulkFreq || '').toString().toUpperCase().trim(),
          EmployeeCode: (row['EmployeeCode'] || bulkEmpCode || '').toString().trim(),
          Period: (row['Period'] || bulkPeriod || newestPeriod || '').toString().trim(),
          OrgUnit: rawOrgValue,
          ObjectiveCode: (row['ObjectiveCode'] || '').toString().trim(),
          KeyResultCode: (row['KeyResultCode'] || '').toString().trim(),
          Perspective: (row['Perspective'] || '').toString().trim(),
        }

        const errors: Record<string, string> = {}

        // Smart Matching for Period
        const oldPeriod = item.Period || t('KpiExcelPreviewModal.empty')
        const matchedPeriod = periodsData?.content?.find((p: any) => p.name.toLowerCase() === item.Period.toLowerCase())
        if (matchedPeriod) {
          item.Period = matchedPeriod.name
          if (!item.Frequency) {
            item.Frequency = matchedPeriod.periodType
          }
        } else {
          item.Period = newestPeriod
          if (oldPeriod !== 'Trống') {
            errors['Period'] = t('KpiExcelPreviewModal.periodDoesNotExistInThe', { oldPeriod })
          }
        }

        // Smart Matching for OrgUnit — supports comma-separated codes e.g. "MK1,MK2"
        const orgCodes = rawOrgValue.split(',').map((s: string) => s.trim()).filter(Boolean)
        const matchedNames: string[] = []
        const unmatchedCodes: string[] = []

        for (const code of orgCodes) {
          const matched = flatOrgUnits.find(u =>
            u.code?.toLowerCase() === code.toLowerCase() ||
            u.name?.toLowerCase() === code.toLowerCase()
          )
          if (matched) {
            matchedNames.push(matched.name)
          } else if (code) {
            unmatchedCodes.push(code)
          }
        }

        if (matchedNames.length > 0) {
          if (enableOkr && matchedNames.length > 1) {
            item.OrgUnit = matchedNames[0] || ''
            errors['OrgUnit'] = t('KpiExcelPreviewModal.okrModeAllowsOnly1Unit', { value: matchedNames[0] })
          } else {
            item.OrgUnit = matchedNames.join(', ')
          }
          
          if (unmatchedCodes.length > 0) {
            const unmatchedMsg = t('KpiExcelPreviewModal.unitDoesNotExistInThe', { join: unmatchedCodes.join(', ') })
            errors['OrgUnit'] = errors['OrgUnit'] ? `${errors['OrgUnit']}. ${unmatchedMsg}` : unmatchedMsg
          }
        } else if (rawOrgValue) {
          item.OrgUnit = ''
          errors['OrgUnit'] = t('KpiExcelPreviewModal.unitDoesNotExistInThe2', { rawOrgValue })
        } else {
          item.OrgUnit = ''
          errors['OrgUnit'] = t('KpiExcelPreviewModal.departmentIsRequired')
        }

        const rowWithFallback = validateRow(item)
        if (Object.keys(errors).length > 0) {
          rowWithFallback._errors = { ...(rowWithFallback._errors || {}), ...errors }
        }
        return rowWithFallback
      })

      if (parsed.length === 0) {
        toast.error(t('KpiExcelPreviewModal.theFileHasNoDataOr'))
        onClose()
        return
      }

      setData(parsed)
    } catch {
      toast.error(t('KpiExcelPreviewModal.errorReadingTheExcelCsvFile'))
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const validateRow = (row: KpiRow): KpiRow => {
    const result = rowSchema.safeParse(row)
    const errors: Record<string, string> = {}
    
    if (!result.success) {
      result.error.issues.forEach(issue => {
        const path = issue.path[0]
        if (typeof path === 'string') {
          errors[path] = issue.message
        }
      })
    }

    // Check if EmployeeCode exists in system and belongs to the specified OrgUnit
    if (row.EmployeeCode && allUsers.length > 0) {
      const codes = row.EmployeeCode.split(',').map(s => s.trim()).filter(Boolean)
      
      // 1. Check existence
      const nonExistentCodes = codes.filter(code => !allUsers.some(u => u.employeeCode === code))
      
      if (nonExistentCodes.length > 0) {
        errors['EmployeeCode'] = t('KpiExcelPreviewModal.codeDoesNotExist', { join: nonExistentCodes.join(', ') })
      } else if (row.OrgUnit) {
        // 2. Check department mismatch — support comma-separated org units
        const orgNames = row.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
        const mismatchedCodes = codes.filter(code => {
          const u = allUsers.find(user => user.employeeCode === code)
          return !u?.memberships?.some(m =>
            orgNames.some(orgName => m.orgUnitName?.toLowerCase().trim() === orgName.toLowerCase().trim())
          )
        })

        if (mismatchedCodes.length > 0) {
          errors['EmployeeCode'] = t('KpiExcelPreviewModal.employeeDoesNotBelongTo', { join: mismatchedCodes.join(', '), OrgUnit: row.OrgUnit })
        }
      }
    }

    // 3. Check Frequency compatibility with Period
    if (row.Frequency && row.Period && periodsData?.content) {
      const periodObj = periodsData.content.find((p: any) => p.name.toLowerCase() === row.Period.toLowerCase())
      if (periodObj) {
        const TYPE_LEVEL: Record<string, number> = {
          'DAILY': 1, 'WEEKLY': 2, 'MONTHLY': 3, 'QUARTERLY': 4, 'SEMI_ANNUALLY': 5, 'YEARLY': 6
        }
        const periodLevel = TYPE_LEVEL[periodObj.periodType] || 0
        const kpiLevel = TYPE_LEVEL[row.Frequency.toUpperCase()] || 0
        if (kpiLevel > periodLevel) {
          errors['Frequency'] = t('KpiExcelPreviewModal.frequencyDoesNotMatchPeriod', { periodType: periodObj.periodType })
        }
      }
    }

    // 4. Check OKR codes if enabled
    if (enableOkr && row.ObjectiveCode) {
      const obj = objectives.find(o => o.code?.toLowerCase() === row.ObjectiveCode?.toLowerCase())
      if (!obj) {
        errors['ObjectiveCode'] = t('KpiExcelPreviewModal.objectiveCodeDoesNotExist')
      } else {
        // Validation: OrgUnit mismatch check — support comma-separated org units
        if (row.OrgUnit && obj.orgUnitNames && obj.orgUnitNames.length > 0) {
          const orgNames = row.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
          const anyMatch = orgNames.some(n => obj.orgUnitNames!.some(un => un.toLowerCase() === n.toLowerCase()))
          if (!anyMatch) {
            errors['ObjectiveCode'] = t('KpiExcelPreviewModal.thisObjectiveBelongsToNotMatching', { join: obj.orgUnitNames.join(', '), OrgUnit: row.OrgUnit })
          }
        }

        if (row.KeyResultCode) {
          const kr = obj.keyResults?.find(k => k.code?.toLowerCase() === row.KeyResultCode?.toLowerCase())
          if (!kr) {
            errors['KeyResultCode'] = t('KpiExcelPreviewModal.theKrDoesNotBelongTo')
          }
        }
      }
    } else if (enableOkr && row.KeyResultCode && !row.ObjectiveCode) {
      errors['ObjectiveCode'] = t('KpiExcelPreviewModal.anObjectiveCodeIsNeededTo')
    }

    // 4b. Check BSC perspective if enabled (match by code or name)
    if (enableBsc && row.Perspective) {
      const val = row.Perspective.toLowerCase()
      const matched = perspectives.find((p: any) => p.code?.toLowerCase() === val || p.name?.toLowerCase() === val)
      if (!matched) {
        errors['Perspective'] = t('KpiExcelPreviewModal.itemDoesNotExist')
      } else {
        // Hạng mục phải nằm trong bộ tiêu chí của (đơn vị + đợt) của dòng này.
        const avail = availablePerspIdsForRow(row)
        if (avail && !avail.has(matched.id)) {
          errors['Perspective'] = t('KpiExcelPreviewModal.theItemIsNotInThis')
        }
      }
    }

    // 5. Waterfall specific validation: If waterfall is enabled, only allow assignment to unit leaders
    if (enableWaterfall && row.EmployeeCode) {
      const codes = row.EmployeeCode.split(',').map(s => s.trim()).filter(Boolean)
      const nonLeaders = codes.filter(code => {
        const u = allUsers.find(user => user.employeeCode === code)
        if (!u) return true // Let zod handle existence check, but filter out here for logic
        return !u.memberships?.some(m => m.roleRank === 0) && 
               !u.permissions?.includes('SUBMISSION:REVIEW')
      })
      if (nonLeaders.length > 0) {
        errors['EmployeeCode'] = t('KpiExcelPreviewModal.theWaterfallModelIsOnKpis', { join: nonLeaders.join(', ') })
      }
    }


    if (Object.keys(errors).length > 0) {
      return { ...row, _errors: errors }
    }
    return { ...row, _errors: undefined }
  }

  const handleCellChange = (id: string, field: keyof KpiRow, value: string) => {
    setData(prev => prev.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value }
        return validateRow(updated)
      }
      return row
    }))
  }

  const handleRemoveRow = (id: string) => {
    setData(prev => prev.filter(r => r.id !== id))
  }

  const handleAddRow = () => {
    const newRow = validateRow({
      id: `new-${Date.now()}`,
      Name: '',
      Description: '',
      Weight: '10',
      TargetValue: '0',
      MinimumValue: '0',
      Deadline: '',
      IsReverseKpi: 'false',
      IsBonusKpi: 'false',
      Unit: '',
      Frequency: bulkFreq || (periodsData?.content?.find((p: any) => p.name === bulkPeriod)?.periodType) || 'MONTHLY',
      EmployeeCode: bulkEmpCode || '',
      Period: bulkPeriod || newestPeriod || '',
      OrgUnit: (bulkOrgUnits.length === 1 ? bulkOrgUnits[0] : '') || '',
      ObjectiveCode: '',
      KeyResultCode: '',
      Perspective: '',
    })
    setData([...data, newRow])
  }

  const handleBulkApply = () => {
    if (!bulkFreq && !bulkPeriod && !bulkOrgUnits.length && !bulkEmpCode) {
      toast.error(t('KpiExcelPreviewModal.pleaseChooseAtLeastOneValue'))
      return
    }

    const singleOrgUnit = bulkOrgUnits.length === 1 ? bulkOrgUnits[0] : ''
    setData(prev => prev.map(row => {
      const updated = {
        ...row,
        Frequency: bulkFreq || row.Frequency,
        Period: bulkPeriod || row.Period,
        OrgUnit: singleOrgUnit || row.OrgUnit,
        EmployeeCode: bulkEmpCode || row.EmployeeCode,
      }
      return validateRow(updated)
    }))
    toast.success(t('KpiExcelPreviewModal.bulkInformationApplied'))
  }

  const handleSave = async () => {
    if (data.length === 0) {
      toast.error(t('KpiExcelPreviewModal.noDataToImport'))
      return
    }

    // Validate all rows first (Check for critical errors)
    const criticalErrorFields = criticalFields
    const invalidRows = data.filter(row => {
      if (!row._errors) return false
      return Object.keys(row._errors).some(field => criticalErrorFields.includes(field))
    })
    
    if (invalidRows.length > 0) {
      toast.error(t('KpiExcelPreviewModal.dataRowsStillHaveCriticalErrors', { count: invalidRows.length }))
      return
    }

    // Check total weight per employee per org unit (Employee + Period + OrgUnit)
    const employeeGroups = Array.from(new Set(data.flatMap(r => {
      const codes = r.EmployeeCode.split(',').map((s: string) => s.trim()).filter(Boolean)
      const orgNames = r.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
      return codes.flatMap(c => orgNames.map(org => `${c}|${r.Period}|${org}`))
    })))

    setLoading(true)

    // Validate Employees per org unit (per-person weight must reach 100%)
    const empValidations = await Promise.all(employeeGroups.map(async (groupKey) => {
      const [empCode, periodName, orgName] = groupKey.split('|')
      if (!empCode || !periodName || !orgName) return { name: empCode ?? '', total: 0, isValid: true }

      const excelWeight = data
        .filter(r => {
          const codes = r.EmployeeCode.split(',').map((s: string) => s.trim())
          const orgNames = r.OrgUnit.split(',').map((s: string) => s.trim())
          return codes.includes(empCode) && orgNames.includes(orgName) && r.Period === periodName && countsTowardWeight(r)
        })
        .reduce((sum, r) => sum + (parseFloat(r.Weight) || 0), 0)

      const userObj = allUsers.find(u => u.employeeCode === empCode)
      const periodId = periodsData?.content?.find((p: any) => p.name === periodName)?.id
      const unitId = flatOrgUnits.find(u => u.name === orgName)?.id

      let systemWeight = 0
      if (userObj?.id && periodId && unitId) {
        try {
          systemWeight = await kpiApi.getTotalWeight(unitId, periodId, userObj.id)
        } catch { /* lỗi ở đây không đổi được gì cho người dùng */ }
      }

      const total = systemWeight + excelWeight
      const fullName = userObj?.fullName || empCode
      return { name: fullName, code: empCode, periodName, orgName, total, isValid: Math.abs(total - 100) < 0.01 }
    }))


    const invalidEmps = empValidations.filter(v => !v.isValid)

    if (invalidEmps.length > 0) {
      setLoading(false)
      const errorMsg = invalidEmps.map(v => `${v.name} / ${(v as any).orgName || ''} [${v.periodName}] (${v.total.toFixed(1)}%)`).join(', ')
      toast.error(t('KpiExcelPreviewModal.eachEmployeesTotalWeightMustReach', { errorMsg }))
      return
    }


    try {
      const exportData = data.map(({ Name, Description, Weight, TargetValue, MinimumValue, IsReverseKpi, IsBonusKpi, Deadline, Unit, Frequency, EmployeeCode, Period, OrgUnit, ObjectiveCode, KeyResultCode, Perspective }) => ({
        Name, Description, Weight, TargetValue, MinimumValue, IsReverseKpi, IsBonusKpi, Deadline, Unit, Frequency, EmployeeCode, Period, OrgUnit, ObjectiveCode, KeyResultCode, Perspective
      }))
      
      const ws = utils.json_to_sheet(exportData)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'KPIs')
      
      const wbout = write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const newFile = new File([blob], file?.name || 'import_kpis.xlsx', { type: blob.type })

      onImport(newFile, localKpiType)
    } catch {
      toast.error(t('KpiExcelPreviewModal.errorCreatingTheImportFile'))
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const hasCriticalErrors = data.some((r: KpiRow) => {
    if (!r._errors) return false
    return Object.keys(r._errors).some(field => criticalFields.includes(field))
  })
  const hasAnyErrors = data.some(r => r._errors && Object.keys(r._errors).length > 0)

  return (
    <>
    <Dialog
      open
      onClose={onClose}
      size="full"
      dismissible={!isImporting}
      title={t('KpiExcelPreviewModal.previewCheckKpis')}
      description={`File: ${file?.name ?? ''}`}
      headerExtra={enableQualitative ? (
        <div className="flex items-center gap-1 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] p-0.5" role="group" aria-label={t('KpiExcelPreviewModal.kpiType')}>
          <ChoiceChip selected={!isQualitative} variant="segment" size="sm" onClick={() => setLocalKpiType('QUANTITATIVE')} aria-pressed={!isQualitative}>
            <BarChart3 aria-hidden="true" /> {t('KpiExcelPreviewModal.quantitative')}
          </ChoiceChip>
          <ChoiceChip selected={isQualitative} variant="segment" size="sm" onClick={() => setLocalKpiType('QUALITATIVE')} aria-pressed={isQualitative}>
            <SlidersHorizontal aria-hidden="true" /> {t('KpiExcelPreviewModal.qualitative')}
          </ChoiceChip>
        </div>
      ) : (
        <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
          {isQualitative ? t('KpiExcelPreviewModal.qualitativeKpis') : t('KpiExcelPreviewModal.quantitativeKpis')}
        </span>
      )}
      footer={
        <DialogFooter
          note={<>{t('KpiExcelPreviewModal.total')} <span className="font-medium text-[var(--color-foreground)] tabular-nums">{data.length}</span> {t('KpiExcelPreviewModal.kpisReady')}</>}
          secondary={<Button variant="outline" onClick={onClose} disabled={isImporting}>{t('KpiExcelPreviewModal.cancel')}</Button>}
          primary={
            <Button onClick={handleSave} disabled={isImporting || hasCriticalErrors || data.length === 0}>
              {isImporting ? <><Loader2 className="animate-spin" aria-hidden="true" /> {t('KpiExcelPreviewModal.importing')}</> : <><Save aria-hidden="true" /> {t('KpiExcelPreviewModal.confirmImport')}</>}
            </Button>
          }
        />
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-[var(--color-subtle-foreground)]">
          <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-semibold text-sm">{t('KpiExcelPreviewModal.analyzingData')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Real-time Weight Summary Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-foreground)] flex items-center gap-2">
                <Scale size={18} className="text-[var(--color-primary)]" />
                {t('KpiExcelPreviewModal.weightStatus')}
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const uniquePairs = Array.from(new Set(data.flatMap(r => {
                  const orgNames = r.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
                  return orgNames.map(name => `${name}|${r.Period}`)
                })))
                return uniquePairs.map(pair => {
                  const [unitName, periodName] = pair.split('|')
                  if (!unitName || !periodName) return null

                  const unitId = flatOrgUnits.find(u => u.name === unitName)?.id
                  const periodId = periodsData?.content?.find((p: any) => p.name === periodName)?.id

                  // Compute per-person weight totals, then take the max as the unit's representative weight
                  const filteredRows = data.filter(r => {
                    const orgNames = r.OrgUnit.split(',').map((s: string) => s.trim())
                    return orgNames.includes(unitName) && r.Period === periodName && countsTowardWeight(r)
                  })
                  const perEmpWeights: Record<string, number> = {}
                  filteredRows.forEach(r => {
                    const codes = r.EmployeeCode.split(',').map((s: string) => s.trim()).filter(Boolean)
                    codes.forEach(code => {
                      perEmpWeights[code] = (perEmpWeights[code] || 0) + (parseFloat(r.Weight) || 0)
                    })
                  })
                  const excelWeight = Object.values(perEmpWeights).length > 0
                    ? Math.max(...Object.values(perEmpWeights))
                    : 0

                  return (
                    <UnitWeightStatus
                      key={`unit-${pair}`}
                      unitId={unitId}
                      unitName={unitName}
                      periodId={periodId}
                      periodName={periodName}
                      excelWeight={excelWeight}
                    />
                  )
                })
              })()}
            </div>

            {/* Employee Weight Table */}
            <div className="mt-8 space-y-4">
              <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] group" onClick={() => setIsEmpTableOpen(!isEmpTableOpen)}>
                <h4 className="text-eyebrow group-hover:text-[var(--color-primary)] transition-colors px-1">{t('KpiExcelPreviewModal.weightDetailsByEmployee')}</h4>
                <div className="w-5 h-5 rounded-full bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-subtle-foreground)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-foreground)] transition-all">
                  {isEmpTableOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                </div>
              </button>

              {isEmpTableOpen && (
                <div className="border border-[var(--color-border)] rounded-card overflow-hidden shadow-sm bg-[var(--color-card)] animate-in slide-in-from-top-2 duration-300">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-eyebrow bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-6 py-4">{t('KpiExcelPreviewModal.employee')}</th>
                          <th className="px-6 py-4">{t('KpiExcelPreviewModal.periodUnit')}</th>
                          <th className="px-6 py-4 text-center">{t('KpiExcelPreviewModal.current')}</th>
                          <th className="px-6 py-4 text-center">Excel</th>
                          <th className="px-6 py-4 text-center">{t('KpiExcelPreviewModal.total2')}</th>
                          <th className="px-6 py-4">{t('KpiExcelPreviewModal.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {(() => {
                          const uniqueEmpPairs = Array.from(new Set(data.flatMap(r => {
                            const codes = r.EmployeeCode.split(',').map((s: string) => s.trim()).filter(Boolean)
                            const orgNames = r.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
                            return codes.flatMap(c => orgNames.map(org => `${c}|${r.Period}|${org}`))
                          })))

                          return uniqueEmpPairs.map(pair => {
                            const [empCode, periodName, unitName] = pair.split('|')
                            if (!empCode || !periodName || !unitName) return null

                            const userObj = allUsers.find(u => u.employeeCode === empCode)
                            const periodId = periodsData?.content?.find((p: any) => p.name === periodName)?.id
                            const unitId = flatOrgUnits.find(u => u.name === unitName)?.id

                            const excelWeight = data
                              .filter(r => {
                                const codes = r.EmployeeCode.split(',').map((s: string) => s.trim())
                                const orgNames = r.OrgUnit.split(',').map((s: string) => s.trim())
                                return codes.includes(empCode) && orgNames.includes(unitName) && r.Period === periodName && countsTowardWeight(r)
                              })
                              .reduce((sum, r) => sum + (parseFloat(r.Weight) || 0), 0)

                            return (
                              <EmployeeWeightRow
                                key={`emp-row-${pair}`}
                                userId={userObj?.id}
                                orgUnitId={unitId}
                                fullName={userObj?.fullName || empCode}
                                empCode={empCode}
                                unitName={unitName || ''}
                                periodId={periodId}
                                periodName={periodName}
                                excelWeight={excelWeight}
                              />
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          {hasAnyErrors && (
            <div className="p-5 bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-widget flex items-start gap-4 border border-[var(--color-error-border)] shadow-sm animate-in shake duration-500">
              <AlertCircle size={24} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">{t('KpiExcelPreviewModal.invalidDataDetected')}</p>
                <p className="text-xs mt-1 font-medium opacity-80">{t('KpiExcelPreviewModal.pleaseCheckAndFixTheCells')}</p>
              </div>
            </div>
          )}

          {/* Bulk Assignment Panel */}
          <div className="p-6 bg-[var(--color-primary-soft)] rounded-card border border-[var(--color-border)] relative z-20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-card bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-foreground)]">
                <ListPlus size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{t('KpiExcelPreviewModal.bulkSettings')}</h3>
                <p className="text-eyebrow">{t('KpiExcelPreviewModal.quicklyAssignInformationToAllRows')}</p>
              </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-label px-1">{t('KpiExcelPreviewModal.frequency')}</label>
                <select 
                  value={bulkFreq}
                  onChange={e => setBulkFreq(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-card bg-[var(--color-card)] border-none shadow-sm text-sm font-medium focus:ring-2 focus:ring-[var(--color-ring)]"
                >
                  <option value="">{t('KpiExcelPreviewModal.chooseFrequency')}</option>
                  {frequencyOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {FREQUENCY_MAP()[opt as keyof ReturnType<typeof FREQUENCY_MAP>] || opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-label px-1">{t('KpiExcelPreviewModal.kpiPeriod')}</label>
                <select 
                  value={bulkPeriod}
                  onChange={e => setBulkPeriod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-card bg-[var(--color-card)] border-none shadow-sm text-sm font-medium focus:ring-2 focus:ring-[var(--color-ring)]"
                >
                  <option value="">{t('KpiExcelPreviewModal.choosePeriod')}</option>
                  {periodsData?.content?.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-label px-1 flex flex-col">
                  <span>{t('KpiExcelPreviewModal.department')} {bulkOrgUnits.length > 0 && <span className="text-[var(--color-primary)]">({bulkOrgUnits.length})</span>}</span>
                  {enableOkr && <span className="text-xs text-[var(--color-primary)] italic lowercase font-medium">{t('KpiExcelPreviewModal.only1CanBeChosenBecause')}</span>}
                </label>
                <div className="relative" ref={bulkOrgDropdownRef}>
                  {isBulkOrgOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsBulkOrgOpen(false)} />
                  )}
                  <button className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]" type="button" onClick={() => setIsBulkOrgOpen(v => !v)}>
                    <span className={cn(bulkOrgUnits.length === 0 ? 'text-[var(--color-subtle-foreground)]' : 'text-[var(--color-foreground)]')}>
                      {bulkOrgUnits.length === 0 ? t('KpiExcelPreviewModal.chooseDepartment') : t('KpiExcelPreviewModal.departmentsSelected', { count: bulkOrgUnits.length })}
                    </span>
                    <ChevronDown aria-hidden="true" className={cn('text-[var(--color-subtle-foreground)] transition-transform', isBulkOrgOpen && 'rotate-180')} />
                  </button>

                  {isBulkOrgOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-[var(--color-card)] rounded-card shadow-2xl border border-[var(--color-border)] z-50 max-h-56 overflow-y-auto p-2 space-y-0.5">
                      {flatOrgUnits.map((u: any) => {
                        const isChecked = bulkOrgUnits.includes(u.name)
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setBulkOrgUnits(prev => {
                              if (isChecked) return prev.filter(n => n !== u.name)
                              if (enableOkr) return [u.name]
                              return [...prev, u.name]
                            })}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-card flex items-center justify-between transition-colors',
                              isChecked
                                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                                : 'hover:bg-[var(--color-muted)]'
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{u.name}</span>
                              <span className="text-eyebrow font-medium">{u.code}</span>
                            </div>
                            {isChecked && <Check size={14} className="text-[var(--color-primary)] shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {bulkOrgUnits.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {bulkOrgUnits.map(name => (
                        <span key={name} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[var(--color-primary-soft)] text-[var(--color-primary)] rounded-control text-xs font-semibold max-w-full">
                          <span className="truncate max-w-[120px]">{name}</span>
                          <button
                            type="button"
                            onClick={() => setBulkOrgUnits(prev => prev.filter(n => n !== name))}
                            className="hover:text-[var(--color-primary)] ml-0.5 shrink-0"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label px-1">{t('KpiExcelPreviewModal.employeeCodeS')}</label>
                <div className="relative group/search">
                  <input 
                    value={bulkEmpCode}
                    onChange={e => setBulkEmpCode(e.target.value)}
                    placeholder={t('KpiExcelPreviewModal.chooseOrEnterACode')}
                    className="w-full px-4 py-2.5 pl-10 rounded-card bg-[var(--color-card)] border-none shadow-sm text-sm font-semibold focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
                  
                  {/* Search results dropdown */}
                  <div className="absolute top-full left-0 w-full mt-2 bg-[var(--color-card)] rounded-card shadow-2xl border border-[var(--color-border)] z-50 max-h-60 overflow-y-auto p-2 space-y-1 hidden group-focus-within/search:block">
                    {(() => {
                      const selectedCodes = bulkEmpCode.split(',').map(s => s.trim()).filter(Boolean)
                      const parts = bulkEmpCode.split(',')
                      const lastPart = (parts[parts.length - 1] ?? '').trim().toLowerCase()
                      
                      // If last part is an exact match of an already selected code, treat it as "not searching"
                      const isExactMatch = selectedCodes.some(c => c.toLowerCase() === lastPart)
                      const effectiveSearch = isExactMatch ? '' : lastPart

                      const filtered = allUsers.filter(u => {
                        const matchesOrg = !bulkOrgUnits.length || bulkOrgUnits.some(orgName =>
                          u.memberships?.some(m =>
                            m.orgUnitName?.toLowerCase().trim() === orgName.toLowerCase().trim()
                          )
                        )
                        const isSelected = u.employeeCode && selectedCodes.includes(u.employeeCode)
                        const matchesSearch = !effectiveSearch ||
                          u.fullName.toLowerCase().includes(effectiveSearch) ||
                          u.employeeCode?.toLowerCase().includes(effectiveSearch)
                        const isLeader = u.memberships?.some(m => m.roleRank === 0) || u.permissions?.includes('SUBMISSION:REVIEW')
                        const waterfallCheck = !enableWaterfall || isLeader || isSelected

                        return matchesOrg && (isSelected || matchesSearch) && waterfallCheck
                      })

                      // Sort: selected ones first
                      return filtered.sort((a, b) => {
                        const aSel = a.employeeCode && selectedCodes.includes(a.employeeCode) ? 1 : 0
                        const bSel = b.employeeCode && selectedCodes.includes(b.employeeCode) ? 1 : 0
                        return bSel - aSel
                      }).slice(0, 50).map(u => (
                        <button
                          key={u.id}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            const current = bulkEmpCode.split(',').map(s => s.trim()).filter(Boolean)
                            if (u.employeeCode) {
                              if (current.includes(u.employeeCode)) {
                                setBulkEmpCode(current.filter(c => c !== u.employeeCode).join(', ') + (current.length > 0 ? ', ' : ''))
                              } else {
                                setBulkEmpCode([...current, u.employeeCode].join(', ') + ', ')
                              }
                            }
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 rounded-card flex items-center justify-between group transition-colors",
                            u.employeeCode && selectedCodes.includes(u.employeeCode) 
                              ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold" 
                              : "hover:bg-[var(--color-muted)]"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">{u.fullName}</span>
                            <span className="text-eyebrow">{u.employeeCode}</span>
                          </div>
                          <UserCheck 
                            size={14} 
                            className={cn(
                              "text-[var(--color-primary)] transition-opacity",
                              u.employeeCode && selectedCodes.includes(u.employeeCode) ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                            )} 
                          />
                        </button>
                      ))
                    })()}
                    {allUsers.length === 0 && (
                      <p className="p-3 text-center text-xs text-[var(--color-subtle-foreground)] font-medium">{t('KpiExcelPreviewModal.noEmployeeData')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-end">
                <Button className="w-full" onClick={handleBulkApply}>
                  {t('KpiExcelPreviewModal.applyToAll')}
                </Button>
              </div>
            </div>
          </div>

          <div className="border border-[var(--color-border)] rounded-card overflow-hidden shadow-sm bg-[var(--color-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-eyebrow bg-[var(--color-muted)] border-b border-[var(--color-border)] sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-4 w-12 text-center">{t('KpiExcelPreviewModal.rowNo')}</th>
                    <th className="px-5 py-4 min-w-[200px]">{t('KpiExcelPreviewModal.kpiName')} <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-5 py-4 min-w-[150px]">{t('KpiExcelPreviewModal.weight')} <span className="text-[var(--color-error)]">*</span></th>
                    {!isQualitative && <th className="px-5 py-4 min-w-[150px]">{t('KpiExcelPreviewModal.target')} <span className="text-[var(--color-error)]">*</span></th>}
                    {!isQualitative && <th className="px-5 py-4 min-w-[150px]">{t('KpiExcelPreviewModal.minimum')} <span className="text-[var(--color-error)]">*</span></th>}
                    <th className="px-5 py-4 min-w-[160px]">{t('KpiExcelPreviewModal.ownDeadline')}</th>
                    {!isQualitative && <th className="px-5 py-4 min-w-[120px]">{t('KpiExcelPreviewModal.inverseKpi')}</th>}
                    <th className="px-5 py-4 min-w-[120px]">{t('KpiExcelPreviewModal.bonusKpi')}</th>
                    {!isQualitative && <th className="px-5 py-4 min-w-[150px]">{t('KpiExcelPreviewModal.unit')} <span className="text-[var(--color-error)]">*</span></th>}
                    <th className="px-5 py-4 min-w-[180px]">{t('KpiExcelPreviewModal.frequency')} <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-5 py-4 min-w-[160px]">{t('KpiExcelPreviewModal.employeeCode')} <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-5 py-4 min-w-[220px]">{t('KpiExcelPreviewModal.kpiPeriod')} <span className="text-[var(--color-error)]">*</span></th>
                    <th className="px-5 py-4 min-w-[300px]">{t('KpiExcelPreviewModal.departmentUnit')} <span className="text-[var(--color-error)]">*</span></th>
                    {enableOkr && (
                      <>
                        <th className="px-5 py-4 min-w-[200px]">{t('KpiExcelPreviewModal.objectiveCode')}</th>
                        <th className="px-5 py-4 min-w-[200px]">{t('KpiExcelPreviewModal.krCode')}</th>
                      </>
                    )}
                    {enableBsc && <th className="px-5 py-4 min-w-[200px]">{t('KpiExcelPreviewModal.bscItem')}</th>}
                    <th className="px-5 py-4 w-16 text-center">{t('KpiExcelPreviewModal.delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {data.map((row, index) => (
                    <tr key={row.id} className="hover:bg-[var(--color-muted)] transition-colors group">
                      <td className="px-5 py-4 text-center text-[var(--color-subtle-foreground)] font-semibold text-xs">
                        {index + 1}
                      </td>
                      <td className="px-5 py-3">
                        <input
                          value={row.Name}
                          onChange={e => handleCellChange(row.id, 'Name', e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-card border text-sm font-medium transition-all",
                            row._errors?.Name 
                              ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)] focus:border-[var(--color-error-border)] focus:ring-2 focus:ring-[var(--color-error-solid)]" 
                              : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)] bg-transparent hover:bg-[var(--color-card)]"
                          )}
                          placeholder={t('KpiExcelPreviewModal.enterName')}
                        />
                        {row._errors?.Name && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.Name}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="relative">
                            <input
                            value={row.Weight}
                            onChange={e => handleCellChange(row.id, 'Weight', e.target.value)}
                            className={cn(
                                "no-edit-hint w-full px-4 py-2 pr-8 rounded-card border text-sm font-semibold transition-all",
                                row._errors?.Weight ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                            )}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption">%</span>
                        </div>
                        {row._errors?.Weight && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.Weight}</p>}
                      </td>
                      {!isQualitative && (
                      <td className="px-5 py-3">
                        <input
                          value={row.TargetValue}
                          onChange={e => handleCellChange(row.id, 'TargetValue', e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-card border text-sm font-semibold transition-all",
                            row._errors?.TargetValue ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                          )}
                        />
                        {row._errors?.TargetValue && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.TargetValue}</p>}
                      </td>
                      )}
                      {!isQualitative && (
                      <td className="px-5 py-3">
                        <input
                          value={row.MinimumValue || ''}
                          onChange={e => handleCellChange(row.id, 'MinimumValue', e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-card border text-sm font-semibold transition-all",
                            row._errors?.MinimumValue ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                          )}
                        />
                        {row._errors?.MinimumValue && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.MinimumValue}</p>}
                      </td>
                      )}
                      <td className="px-5 py-3">
                        <input
                          value={row.Deadline || ''}
                          onChange={e => handleCellChange(row.id, 'Deadline', e.target.value)}
                          placeholder="dd/MM/yyyy HH:mm"
                          className={cn(
                            "w-full px-4 py-2 rounded-card border text-sm font-semibold transition-all",
                            row._errors?.Deadline ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                          )}
                        />
                        {row._errors?.Deadline && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.Deadline}</p>}
                      </td>
                      {!isQualitative && (
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => handleCellChange(row.id, 'IsReverseKpi', row.IsReverseKpi === 'true' ? 'false' : 'true')}
                          className={cn(
                            'relative w-10 h-6 rounded-full transition-all flex-shrink-0',
                            row.IsReverseKpi === 'true' ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-border)]'
                          )}
                        >
                          <div className={cn(
                            'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                            row.IsReverseKpi === 'true' ? 'left-5' : 'left-1'
                          )} />
                        </button>
                      </td>
                      )}
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => handleCellChange(row.id, 'IsBonusKpi', row.IsBonusKpi === 'true' ? 'false' : 'true')}
                          className={cn(
                            'relative w-10 h-6 rounded-full transition-all flex-shrink-0',
                            row.IsBonusKpi === 'true' ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-border)]'
                          )}
                        >
                          <div className={cn(
                            'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                            row.IsBonusKpi === 'true' ? 'left-5' : 'left-1'
                          )} />
                        </button>
                      </td>
                      {!isQualitative && (
                      <td className="px-5 py-3">
                        <input
                          value={row.Unit}
                          onChange={e => handleCellChange(row.id, 'Unit', e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-card border text-sm font-medium transition-all",
                            row._errors?.Unit ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                          )}
                          placeholder="VD: VND, %..."
                        />
                        {row._errors?.Unit && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.Unit}</p>}
                      </td>
                      )}
                      <td className="px-5 py-3">
                        <select
                          value={row.Frequency}
                          onChange={e => handleCellChange(row.id, 'Frequency', e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-card border text-sm font-medium transition-all bg-transparent outline-none",
                            row._errors?.Frequency ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                          )}
                        >
                          <option value="">{t('KpiExcelPreviewModal.choose')}</option>
                          {frequencyOptions.map(opt => (
                            <option key={opt} value={opt}>
                              {FREQUENCY_MAP()[opt as keyof ReturnType<typeof FREQUENCY_MAP>] || opt}
                            </option>
                          ))}
                        </select>
                        {row._errors?.Frequency && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.Frequency}</p>}
                      </td>
                      <td className="px-5 py-3 min-w-[200px]">
                        <div className="relative group/cell">
                          <input
                            value={row.EmployeeCode}
                            onChange={e => handleCellChange(row.id, 'EmployeeCode', e.target.value)}
                            className={cn(
                              "w-full px-4 py-2 pl-9 rounded-card border text-sm font-medium transition-all bg-transparent outline-none",
                              row._errors?.EmployeeCode ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                            )}
                            placeholder={t('KpiExcelPreviewModal.chooseEmployee')}
                          />
                          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
                          
                          <div className={cn(
                            "absolute left-0 w-64 z-50 max-h-48 overflow-y-auto p-2 space-y-1 bg-[var(--color-card)] rounded-card shadow-2xl border border-[var(--color-border)] hidden group-focus-within/cell:block",
                            index >= data.length / 2 ? "bottom-full mb-1" : "top-full mt-1"
                          )}>
                            {(() => {
                              const selectedCodes = row.EmployeeCode.split(',').map(s => s.trim()).filter(Boolean)
                              const parts = row.EmployeeCode.split(',')
                              const lastPart = (parts[parts.length - 1] ?? '').trim().toLowerCase()

                              // If last part is an exact match of an already selected code, treat it as "not searching"
                              const isExactMatch = selectedCodes.some(c => c.toLowerCase() === lastPart)
                              const effectiveSearch = isExactMatch ? '' : lastPart

                              const filtered = allUsers.filter(u => {
                                const rowOrgNames = row.OrgUnit
                                  ? row.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
                                  : []
                                const matchesOrg = !rowOrgNames.length || rowOrgNames.some(orgName =>
                                  u.memberships?.some(m =>
                                    m.orgUnitName?.toLowerCase().trim() === orgName.toLowerCase().trim()
                                  )
                                )
                                const isSelected = u.employeeCode && selectedCodes.includes(u.employeeCode)
                                const matchesSearch = !effectiveSearch || 
                                  u.fullName.toLowerCase().includes(effectiveSearch) || 
                                  u.employeeCode?.toLowerCase().includes(effectiveSearch)
                                const isLeader = u.memberships?.some(m => m.roleRank === 0) || u.permissions?.includes('SUBMISSION:REVIEW')
                                const waterfallCheck = !enableWaterfall || isLeader || isSelected
                                
                                return matchesOrg && (isSelected || matchesSearch) && waterfallCheck
                              })

                              return filtered.sort((a, b) => {
                                const aSel = a.employeeCode && selectedCodes.includes(a.employeeCode) ? 1 : 0
                                const bSel = b.employeeCode && selectedCodes.includes(b.employeeCode) ? 1 : 0
                                return bSel - aSel
                              }).slice(0, 10).map(u => (
                                <button
                                  key={u.id}
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    const current = row.EmployeeCode.split(',').map(s => s.trim()).filter(Boolean)
                                    if (u.employeeCode) {
                                      let newValue = ''
                                      if (current.includes(u.employeeCode)) {
                                        newValue = current.filter(c => c !== u.employeeCode).join(', ') + (current.length > 0 ? ', ' : '')
                                      } else {
                                        newValue = [...current, u.employeeCode].join(', ') + ', '
                                      }
                                      handleCellChange(row.id, 'EmployeeCode', newValue)
                                    }
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-card flex items-center gap-3 transition-colors",
                                    u.employeeCode && selectedCodes.includes(u.employeeCode)
                                      ? "bg-[var(--color-primary-soft)]"
                                      : "hover:bg-[var(--color-muted)]"
                                  )}
                                >
                                  <div className={cn(
                                    "w-7 h-7 rounded-control flex items-center justify-center text-xs font-semibold transition-colors",
                                    u.employeeCode && selectedCodes.includes(u.employeeCode)
                                      ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                                      : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                                  )}>
                                    {u.employeeCode && selectedCodes.includes(u.employeeCode) ? <Check size={12} /> : u.fullName.charAt(0)}
                                  </div>
                                  <div className="flex flex-col flex-1">
                                    <span className={cn(
                                      "text-xs font-medium transition-colors",
                                      u.employeeCode && selectedCodes.includes(u.employeeCode) ? "text-[var(--color-primary)]" : "text-[var(--color-foreground)]"
                                    )}>{u.fullName}</span>
                                    <span className="text-eyebrow">{u.employeeCode}</span>
                                  </div>
                                  {u.employeeCode && selectedCodes.includes(u.employeeCode) && (
                                    <UserCheck size={12} className="text-[var(--color-primary)]" />
                                  )}
                                </button>
                              ))
                            })()}
                          </div>
                        </div>
                        {row._errors?.EmployeeCode && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.EmployeeCode}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={row.Period}
                          onChange={e => handleCellChange(row.id, 'Period', e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-card border text-sm font-medium transition-all bg-transparent outline-none",
                            row._errors?.Period ? "border-[var(--color-error-border)] bg-[var(--color-error-bg)]" : "border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)]"
                          )}
                        >

                          {periodsData?.content?.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                        {row._errors?.Period && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.Period}</p>}
                      </td>
                      <td className="px-5 py-3 min-w-[240px]">
                        {(() => {
                          const selectedOrgNames = row.OrgUnit
                            ? row.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : []
                          return (
                            <div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (openOrgDropdownId === row.id) {
                                    setOpenOrgDropdownId(null)
                                    setOrgDropdownPos(null)
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const dropdownH = 220
                                    const showAbove = rect.bottom + dropdownH > window.innerHeight && rect.top > dropdownH
                                    setOrgDropdownPos({
                                      top: showAbove ? rect.top - dropdownH - 4 : rect.bottom + 4,
                                      left: rect.left,
                                    })
                                    setOpenOrgDropdownId(row.id)
                                  }
                                }}
                                className={cn(
                                  'w-full px-3 py-2 rounded-card border text-sm font-medium transition-all text-left flex items-center justify-between',
                                  row._errors?.OrgUnit
                                    ? 'border-[var(--color-error-border)] bg-[var(--color-error-bg)]'
                                    : 'border-transparent hover:border-[var(--color-border)]'
                                )}
                              >
                                <span className={cn('truncate', !selectedOrgNames.length && 'text-[var(--color-subtle-foreground)] font-normal')}>
                                  {selectedOrgNames.length ? selectedOrgNames.join(', ') : t('KpiExcelPreviewModal.choose')}
                                </span>
                                <ChevronDown size={12} className="text-[var(--color-subtle-foreground)] shrink-0 ml-1" />
                              </button>
                            </div>
                          )
                        })()}
                        {row._errors?.OrgUnit && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.OrgUnit}</p>}
                      </td>
                      {enableOkr && (
                        <>
                          <td className="px-5 py-3">
                            <select
                              value={row.ObjectiveCode || ''}
                              onChange={e => handleCellChange(row.id, 'ObjectiveCode', e.target.value)}
                              className="w-full px-4 py-2 rounded-card border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] text-sm font-medium transition-all bg-transparent outline-none"
                            >
                              <option value="">{t('KpiExcelPreviewModal.empty2')}</option>
                              {objectives.map((obj: any) => (
                                <option key={obj.id} value={obj.code}>{obj.name} ({obj.code})</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={row.KeyResultCode || ''}
                              onChange={e => handleCellChange(row.id, 'KeyResultCode', e.target.value)}
                              className="w-full px-4 py-2 rounded-card border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] text-sm font-medium transition-all bg-transparent outline-none"
                              disabled={!row.ObjectiveCode}
                            >
                              <option value="">{t('KpiExcelPreviewModal.empty2')}</option>
                              {(() => {
                                const selectedObj = objectives.find((obj: any) => obj.code === row.ObjectiveCode)
                                if (!selectedObj || !selectedObj.keyResults) return null
                                return selectedObj.keyResults.map((kr: any) => (
                                  <option key={kr.id} value={kr.code}>{kr.name} ({kr.code})</option>
                                ))
                              })()}
                            </select>
                          </td>
                        </>
                      )}
                      {enableBsc && (
                        <td className="px-5 py-3">
                          <select
                            value={(() => {
                              const v = (row.Perspective || '').toLowerCase()
                              const m = perspectives.find((p: any) => p.code?.toLowerCase() === v || p.name?.toLowerCase() === v)
                              return m ? m.code : ''
                            })()}
                            onChange={e => handleCellChange(row.id, 'Perspective', e.target.value)}
                            className="w-full px-4 py-2 rounded-card border border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] text-sm font-medium transition-all bg-transparent outline-none"
                          >
                            <option value="">{t('KpiExcelPreviewModal.empty2')}</option>
                            {(() => {
                              const avail = availablePerspIdsForRow(row)
                              const list = avail ? perspectives.filter((p: any) => avail.has(p.id)) : perspectives
                              return list.map((p: any) => (
                                <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
                              ))
                            })()}
                          </select>
                          {row._errors?.Perspective && <p className="text-xs text-[var(--color-error)] mt-1 font-semibold px-2">{row._errors.Perspective}</p>}
                        </td>
                      )}
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-2 text-[var(--color-subtle-foreground)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] dark:hover:bg-[var(--color-error-bg)] rounded-card transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length === 0 && (
              <div className="text-center py-20 text-[var(--color-subtle-foreground)] font-semibold italic">
                {t('KpiExcelPreviewModal.noDataToDisplay')}
              </div>
            )}
            <div className="bg-[var(--color-muted)] border-t border-[var(--color-border)] p-4 flex justify-center">
              <Button variant="outline" onClick={handleAddRow}>
                <Plus aria-hidden="true" /> {t('KpiExcelPreviewModal.addANewRow')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>

      {/* OrgUnit multi-select dropdown — rendered fixed outside the table to avoid overflow clipping */}
      {openOrgDropdownId && orgDropdownPos && (() => {
        const activeRow = data.find(r => r.id === openOrgDropdownId)
        if (!activeRow) return null
        const selectedOrgNames = activeRow.OrgUnit
          ? activeRow.OrgUnit.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
        return (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => { setOpenOrgDropdownId(null); setOrgDropdownPos(null) }}
            />
            <div
              style={{ top: orgDropdownPos.top, left: orgDropdownPos.left }}
              className="fixed w-64 bg-[var(--color-card)] rounded-card shadow-2xl border border-[var(--color-border)] z-[9999] max-h-[220px] overflow-y-auto p-2 space-y-0.5"
            >
              {flatOrgUnits.map((u: any) => {
                const checked = selectedOrgNames.includes(u.name)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                        const newVal = checked
                          ? selectedOrgNames.filter((n: string) => n !== u.name).join(', ')
                          : enableOkr ? u.name : [...selectedOrgNames, u.name].join(', ')
                        handleCellChange(openOrgDropdownId, 'OrgUnit', newVal)
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-card flex items-center justify-between transition-colors',
                      checked
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'hover:bg-[var(--color-muted)]'
                    )}
                  >
                    <div>
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-caption ml-1">({u.code})</span>
                    </div>
                    {checked && <Check size={12} className="text-[var(--color-primary)] shrink-0" />}
                  </button>
                )
              })}
            </div>
          </>
        )
      })()}
    </>
  )
}

function UnitWeightStatus({ unitId, unitName, periodId, periodName, excelWeight }: { 
  unitId?: string, unitName: string, periodId?: string, periodName: string, excelWeight: number 
}) {
  const { t } = useTranslation('kpi')
  const { data: systemWeight = 0 } = useKpiTotalWeight(unitId, periodId)
  const total = systemWeight + excelWeight
  const isPerfect = Math.abs(total - 100) < 0.01
  const isOver = total > 100.01

  return (
    <div className={cn(
      "p-4 rounded-card border transition-all duration-300 shadow-sm",
      isPerfect 
        ? "bg-[var(--color-success-bg)] border-[var(--color-success-border)] dark:bg-[var(--color-success-bg)] dark:border-[var(--color-success-border)]" 
        : isOver
          ? "bg-[var(--color-error-bg)] border-[var(--color-error-border)] dark:bg-[var(--color-error-bg)] dark:border-[var(--color-error-border)]"
          : "bg-[var(--color-warning-bg)] border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)] dark:border-[var(--color-warning-border)]"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-control flex items-center justify-center",
            isPerfect ? "bg-[var(--color-success-solid)] text-white" : isOver ? "bg-[var(--color-error-solid)] text-white" : "bg-[var(--color-warning-solid)] text-white"
          )}>
            <Scale size={16} />
          </div>
          <div>
            <p className="text-eyebrow leading-none">{t('KpiExcelPreviewModal.department')}</p>
            <p className="text-sm font-semibold text-[var(--color-foreground)] truncate max-w-[120px]">{unitName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-eyebrow leading-none">{t('KpiExcelPreviewModal.aPeriod')}</p>
          <p className="text-caption">{periodName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-card)] rounded-card border border-inherit">
        <div className="text-center flex-1">
          <p className="text-eyebrow mb-0.5">{t('KpiExcelPreviewModal.current')}</p>
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{systemWeight}%</p>
        </div>
        <Plus size={12} className="text-[var(--color-subtle-foreground)]" />
        <div className="text-center flex-1">
          <p className="text-eyebrow text-[var(--color-primary)] mb-0.5">Excel</p>
          <p className="text-sm font-semibold text-[var(--color-primary)]">{excelWeight}%</p>
        </div>
        <ArrowRight size={12} className="text-[var(--color-subtle-foreground)]" />
        <div className="text-center flex-1">
          <p className="text-eyebrow mb-0.5">{t('KpiExcelPreviewModal.total2')}</p>
          <p className={cn(
            "text-sm font-semibold",
            isPerfect ? "text-[var(--color-success)]" : isOver ? "text-[var(--color-error)]" : "text-[var(--color-warning)]"
          )}>{total.toFixed(1)}%</p>
        </div>
      </div>
      
      {!isPerfect && (
        <p className={cn(
          "text-xs font-medium mt-2 text-center",
          isOver ? "text-[var(--color-error)]" : "text-[var(--color-warning)]"
        )}>
          {isOver ? t('KpiExcelPreviewModal.weightExceeds100') : t('KpiExcelPreviewModal.shortOf100', { value: (100 - total).toFixed(1) })}
        </p>
      )}
    </div>
  )
}

function EmployeeWeightRow({ userId, orgUnitId, fullName, empCode, unitName, periodId, periodName, excelWeight }: {
  userId?: string, orgUnitId?: string, fullName: string, empCode: string, unitName: string, periodId?: string, periodName: string, excelWeight: number
}) {
  const { t } = useTranslation('kpi')
  const { data: systemWeight = 0 } = useKpiTotalWeight(orgUnitId, periodId, userId)
  const total = systemWeight + excelWeight
  const isPerfect = Math.abs(total - 100) < 0.01
  const isOver = total > 100.01

  return (
    <tr className="hover:bg-[var(--color-muted)] transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-control flex items-center justify-center text-xs font-semibold",
            isPerfect ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : isOver ? "bg-[var(--color-error-bg)] text-[var(--color-error)]" : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
          )}>
            {fullName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{fullName}</p>
            <p className="text-eyebrow tracking-tight">{empCode}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-caption">{periodName}</p>
        <p className="text-caption truncate max-w-[150px]">{unitName}</p>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="text-caption">{systemWeight}%</span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className="text-xs font-semibold text-[var(--color-primary)]">{excelWeight}%</span>
      </td>
      <td className="px-6 py-4 text-center">
        <span className={cn(
          "text-sm font-semibold",
          isPerfect ? "text-[var(--color-success)]" : isOver ? "text-[var(--color-error)]" : "text-[var(--color-warning)]"
        )}>
          {total.toFixed(1)}%
        </span>
      </td>
      <td className="px-6 py-4">
        <div className={cn(
          "text-eyebrow inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
          isPerfect 
            ? "bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]" 
            : isOver
              ? "bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]"
              : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]"
        )}>
          {isPerfect ? (
            <><Check size={10} /> {t('KpiExcelPreviewModal.n100Reached')}</>
          ) : isOver ? (
            <><AlertCircle size={10} /> {t('KpiExcelPreviewModal.over')}</>
          ) : (
            <><Plus size={10} /> {t('KpiExcelPreviewModal.short')} {(100 - total).toFixed(1)}%</>
          )}
        </div>
      </td>
    </tr>
  )
}
