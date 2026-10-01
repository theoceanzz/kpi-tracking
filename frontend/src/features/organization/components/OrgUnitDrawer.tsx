import { useEffect, useState, useMemo } from 'react'
import { useForm, SubmitHandler, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useFormAssistStore } from '@/store/formAssistStore'
import { Upload, Building2, MapPin, Phone, Mail, Image as ImageIcon } from 'lucide-react'
import { 
  useCreateOrgUnit, 
  useUpdateOrgUnit, 
  useProvinces, 
  useDistricts, 
  useUploadLogo,
  useOrganization
} from '../hooks/useOrganizationStructure'
import { useRoles } from '../hooks/useUserRoles'

import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getApiErrorMessage } from '@/lib/apiError'
import { Drawer, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'


export type DrawerMode = 'create-root' | 'create-child' | 'edit'

/**
 * Giá trị "chưa chọn". Radix Select cấm SelectItem mang value là chuỗi rỗng, trong khi form
 * lưu tỉnh/quận rỗng là '' — nên hiển thị bằng sentinel rồi đổi ngược về '' khi ghi vào form.
 */
const NONE = '__NONE__'


const triggerCls =
  'w-full text-sm font-normal ' +
  'disabled:bg-[var(--color-muted)] disabled:text-[var(--color-subtle-foreground)]'

export interface DrawerState {
  isOpen: boolean
  mode: DrawerMode
  parentNode: Record<string, any> | null
  currentNode: Record<string, any> | null
}

interface OrgUnitDrawerProps {
  orgId: string
  drawerState: DrawerState
  onClose: () => void
  hierarchyLevels: Record<number, string> // level -> unitTypeName
}

const schema = perLanguage(() => (z.object({
  name: z.string().min(1, i18n.t('organization:OrgUnitDrawer.pleaseEnterAName')),
  code: z.string().min(1, i18n.t('organization:OrgUnitDrawer.pleaseEnterACode')),
  unitTypeName: z.string().min(1, i18n.t('organization:OrgUnitDrawer.pleaseEnterTheOrganizationType')),
  email: z.string().email(i18n.t('organization:OrgUnitDrawer.invalidEmail')).optional().or(z.literal('')),
  phone: z.string().regex(/^0\d{9}$/, i18n.t('organization:OrgUnitDrawer.thePhoneNumberMustHave10')).optional().or(z.literal('')),
  address: z.string().optional(),
  provinceId: z.string().optional(),
  districtId: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
  status: z.string().optional()
})))

type FormData = z.infer<ReturnType<typeof schema>>

export function OrgUnitDrawer({ orgId, drawerState, onClose, hierarchyLevels }: OrgUnitDrawerProps) {
  const { t } = useTranslation('organization')
  const createMutation = useCreateOrgUnit()
  const updateMutation = useUpdateOrgUnit()
  const uploadLogoMutation = useUploadLogo()
  
  const { data: provinces = [] } = useProvinces()
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | undefined>()
  const { data: districts = [] } = useDistricts(selectedProvinceId)
  const { data: allRoles = [] } = useRoles()
  const { data: organization } = useOrganization(orgId)

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const { minDepth, maxDepth } = useMemo(() => {
    const levels = Object.keys(hierarchyLevels || {}).map(Number)
    return {
      minDepth: levels.length > 0 ? Math.min(...levels) : 1,
      maxDepth: levels.length > 0 ? Math.max(...levels) : 5
    }
  }, [hierarchyLevels])

  const calculatedLevel = drawerState.mode === 'create-root' 
    ? minDepth 
    : drawerState.mode === 'create-child' && drawerState.parentNode
      ? Number(drawerState.parentNode.level) + 1
      // `Number(undefined)` ra NaN chứ không phải null, nên `?? minDepth` trước đây không bao
      // giờ chạy — thiếu `level` là cả ô nhập cấp hiện NaN. Kiểm null trước rồi mới ép kiểu.
      : drawerState.currentNode?.level != null ? Number(drawerState.currentNode.level) : minDepth
      
  const parentName = drawerState.parentNode?.name || t('OrgUnitDrawer.noneRoot')
  
  const totalLevels = Object.keys(hierarchyLevels || {}).length
  
  const isRoot = calculatedLevel === minDepth
  const isBottom = calculatedLevel === maxDepth
  const isMiddle = !isRoot && !isBottom

  const filteredRoles = allRoles.filter(role => {
    const roleLevel = role.level
    if (roleLevel === undefined || roleLevel === null) return false
    
    // Trường hợp 1: Công ty có 2 phân cấp (vd: Công ty -> Team)
    if (totalLevels === 2) {
      if (isRoot) return roleLevel === 2 || roleLevel === 4
      if (isBottom) return roleLevel === 4
    }
    
    // Trường hợp 2: Công ty có 3 phân cấp (vd: Công ty -> Phòng -> Team)
    if (totalLevels === 3) {
      if (isRoot) return roleLevel === 2 || roleLevel === 4
      if (isMiddle) return roleLevel === 3
      if (isBottom) return roleLevel === 4
    }

    // Trường hợp 3: Công ty có 4 phân cấp
    if (totalLevels === 4) {
      if (isRoot) return roleLevel === 1 || roleLevel === 4
      if (calculatedLevel === minDepth + 1) return roleLevel === 2
      if (calculatedLevel === minDepth + 2) return roleLevel === 3
      if (isBottom) return roleLevel === 4
    }
    
    // Trường hợp 4: Công ty có 5 phân cấp
    if (totalLevels === 5) {
      if (isRoot) return roleLevel === 0 || roleLevel === 4
      if (calculatedLevel === minDepth + 1) return roleLevel === 1
      if (calculatedLevel === minDepth + 2) return roleLevel === 2
      if (calculatedLevel === minDepth + 3) return roleLevel === 3
      if (isBottom) return roleLevel === 4
    }
  })
      
  const formApi = useForm<FormData>({
    resolver: zodResolver(schema()),
    defaultValues: {
      name: '',
      code: '',
      unitTypeName: '',
      email: '',
      phone: '',
      address: '',
      provinceId: '',
      districtId: '',
      roleIds: [],
      status: 'ACTIVE'
    }
  })
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch, setError, control, getValues } = formApi
  const draft = useFormDraft(formApi, { key: `org-unit:${drawerState.mode}:${drawerState.currentNode?.id ?? drawerState.parentNode?.id ?? 'root'}`, enabled: drawerState.isOpen })

  const formProvinceId = watch('provinceId')
  const selectedRoleIds = watch('roleIds') || []

  useEffect(() => {
    setSelectedProvinceId(formProvinceId)
  }, [formProvinceId])

  // Giới thiệu form này với trợ lý AI. Drawer mở/đóng bằng drawerState.isOpen chứ không có prop
  // `open` như các modal khác.
  useEffect(() => {
    if (!drawerState.isOpen) return
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'org_unit_drawer_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      // status chỉ vẽ ở chế độ sửa; unitTypeName bị khoá trừ khi tạo đơn vị gốc; code bị khoá
      // khi tạo gốc (điền sẵn theo mã tổ chức). Cả ba vẫn được gửi lên khi lưu, nên để trợ lý
      // điền lén là đổi dữ liệu thật mà người dùng không nhìn thấy gì.
      fillableFields: () => [
        'name', 'email', 'phone', 'address',
        ...(drawerState.mode === 'edit' ? ['status'] : []),
        ...(drawerState.mode === 'create-root' ? ['unitTypeName'] : ['code']),
      ],
      setValue: (field, value) =>
        setValue(field as keyof FormData, value as never,
          { shouldValidate: true, shouldDirty: true }),
    })
    return () => unregister('org_unit_drawer_form')
  }, [drawerState.isOpen, drawerState.mode, getValues, setValue])

  // Manager/Deputy validation logic
  const selectedRolesDetails = useMemo(() => {
    return allRoles.filter(r => selectedRoleIds.includes(r.id))
  }, [allRoles, selectedRoleIds])

  const hasManagerSelected = selectedRolesDetails.some(r => r.rank === 0)
  const hasDeputySelected = selectedRolesDetails.some(r => r.rank === 1)

  const getRoleDisableReason = (role: any) => {
    if (selectedRoleIds.includes(role.id)) return null // Never disable if already selected
    if (role.rank === 0 && hasManagerSelected) return t('OrgUnitDrawer.n1HeadRoleSelected')
    if (role.rank === 1 && hasDeputySelected) return t('OrgUnitDrawer.n1DeputyRoleSelected')
    return null
  }

  // Pre-fill
  useEffect(() => {
    if (drawerState.isOpen) {
      if (drawerState.mode === 'edit' && drawerState.currentNode) {
        setValue('name', drawerState.currentNode.name)
        setValue('code', drawerState.currentNode.code || '')
        setValue('unitTypeName', drawerState.currentNode.type || hierarchyLevels[calculatedLevel] || '')
        setValue('email', drawerState.currentNode.email || '')
        setValue('phone', drawerState.currentNode.phone || '')
        setValue('address', drawerState.currentNode.address || '')
        setValue('provinceId', drawerState.currentNode.provinceId || '')
        setValue('districtId', drawerState.currentNode.districtId || '')
        setValue('roleIds', drawerState.currentNode.allowedRoles?.map((r: any) => r.id) || [])
        setValue('status', drawerState.currentNode.status || 'ACTIVE')
        setLogoPreview(drawerState.currentNode.logoUrl || null)
      } else {
        setValue('name', '')
        setValue('code', drawerState.mode === 'create-root' && organization ? organization.code : '')
        setValue('unitTypeName', hierarchyLevels[calculatedLevel] || '')
        
        // Set default roles for root unit: Highest level (Manager/Deputy) + Staff
        if (drawerState.mode === 'create-root' && allRoles.length > 0) {
          const rootDefaultRoles = filteredRoles.filter(role => 
            role.rank === 0 || role.rank === 1 || role.rank === 2
          )
          setValue('roleIds', rootDefaultRoles.map(r => r.id))
        } else {
          setValue('roleIds', [])
        }

        setLogoPreview(null)
      }
    } else {
      reset()
      setLogoFile(null)
      setLogoPreview(null)
    }
  }, [drawerState, hierarchyLevels, calculatedLevel, setValue, reset])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    const payload = {
      name: data.name,
      code: data.code,
      unitTypeName: data.unitTypeName,
      parentId: drawerState.mode === 'create-child' ? drawerState.parentNode?.id : null,
      email: data.email,
      phone: data.phone,
      address: data.address,
      provinceId: data.provinceId || undefined,
      districtId: data.districtId || undefined,
      roleIds: data.roleIds || [],
      status: data.status
    }

    try {
      let resultUnit: any = null

      if (drawerState.mode === 'create-root' || drawerState.mode === 'create-child') {
        resultUnit = await createMutation.mutateAsync({ orgId, payload })
      } else if (drawerState.mode === 'edit' && drawerState.currentNode) {
        resultUnit = await updateMutation.mutateAsync({ orgId, unitId: drawerState.currentNode.id, payload })
      }

      if (resultUnit && logoFile) {
        await uploadLogoMutation.mutateAsync({ orgId, unitId: resultUnit.id, file: logoFile })
      }

      onClose()
    } catch (error: any) {
      const message = getApiErrorMessage(error, '')
      if (message.toLowerCase().includes('tên')) {
        setError('name', { type: 'manual', message: message })
      } else if (message.toLowerCase().includes('mã')) {
        setError('code', { type: 'manual', message: message })
      }
      // Toast is already handled by the hook, but setError provides better UX on the field
    }
  }

  return (
    <Drawer
      open={drawerState.isOpen}
      onClose={onClose}
      size="md"
      dismissible={!(createMutation.isPending || updateMutation.isPending || uploadLogoMutation.isPending)}
      title={drawerState.mode === 'edit' ? t('OrgUnitDrawer.editUnit') : t('OrgUnitDrawer.addANewUnit')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{t('OrgUnitDrawer.cancel')}</Button>}
          primary={
            <Button type="submit" form="org-form" disabled={createMutation.isPending || updateMutation.isPending || uploadLogoMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending || uploadLogoMutation.isPending) ? t('OrgUnitDrawer.processing') : t('OrgUnitDrawer.saveChanges')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <form id="org-form" onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
        
        {/* Logo Upload Section */}
        <div className="space-y-2">
          <label className="text-label text-[var(--color-foreground)]">Logo</label>
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-card border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)] flex items-center justify-center overflow-hidden relative group">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-[var(--color-subtle-foreground)]" />
              )}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <Upload className="w-5 h-5 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
            <div className="flex-1">
              <p className="text-xs text-[var(--color-muted-foreground)] mb-2">{t('OrgUnitDrawer.supportedFormatsPngJpgWebpMax')}</p>
              <label className="text-label cursor-pointer inline-flex items-center px-3 py-1.5 border border-[var(--color-border-strong)] rounded-control font-medium text-[var(--color-foreground)] bg-[var(--color-card)] hover:bg-[var(--color-muted)] transition-colors">
                <Upload className="w-4 h-4 mr-2" />
                {t('OrgUnitDrawer.changeLogo')}
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.belongsTo')}</label>
            <input 
              type="text" 
              value={parentName} 
              disabled 
              className="w-full px-3 py-2 border rounded-control bg-[var(--color-muted)] text-[var(--color-muted-foreground)] text-sm border-[var(--color-border)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.level')}</label>
            <div className="px-3 py-2 border rounded-control bg-[var(--color-info-bg)] text-[var(--color-info)] text-sm border-[var(--color-info-border)] font-medium">
              {t('OrgUnitDrawer.hierarchy')}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.unitName')} <span className="text-[var(--color-error)]">*</span></label>
          <input 
            type="text" 
            {...register('name')}
            placeholder={t('OrgUnitDrawer.eGEngineeringDepartmentHanoiBranch')}
            className="w-full px-3 py-2 border rounded-control focus:ring-2 focus:ring-[var(--color-info-solid)] outline-none border-[var(--color-border-strong)] transition-all font-medium"
          />
          {errors.name && <p className="text-xs text-[var(--color-error)] mt-1">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.unitCode')} <span className="text-[var(--color-error)]">*</span></label>
          <input 
            type="text" 
            {...register('code')}
            disabled={drawerState.mode === 'create-root'}
            placeholder="VD: PKT, ACC, HR..."
            className={`w-full px-3 py-2 border rounded-control outline-none transition-all ${drawerState.mode === 'create-root' ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]' : 'border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-info-solid)] font-medium'}`}
          />
          {errors.code && <p className="text-xs text-[var(--color-error)] mt-1">{errors.code.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.unitType')} <span className="text-[var(--color-error)]">*</span></label>
          <input 
            type="text" 
            {...register('unitTypeName')}
            disabled={drawerState.mode === 'edit' || drawerState.mode === 'create-child'}
            placeholder={t('OrgUnitDrawer.eGCompanyDepartment')}
            className={`w-full px-3 py-2 border rounded-control outline-none transition-all ${drawerState.mode !== 'create-root' ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]' : 'border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-info-solid)]'}`}
          />
          {errors.unitTypeName && <p className="text-xs text-[var(--color-error)] mt-1">{errors.unitTypeName.message}</p>}
        </div>

        {drawerState.mode === 'edit' && (
          <div className="space-y-1">
            <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.operatingStatus')}</label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'ACTIVE'} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(triggerCls, 'font-semibold')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{t('OrgUnitDrawer.active')}</SelectItem>
                    <SelectItem value="TRIAL">{t('OrgUnitDrawer.trialNew')}</SelectItem>
                    <SelectItem value="INACTIVE">{t('OrgUnitDrawer.pausedStopped')}</SelectItem>
                    <SelectItem value="SUSPENDED">{t('OrgUnitDrawer.suspendedLocked')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        <div className="pt-4 border-t">
          <h3 className="text-section-title text-[var(--color-foreground)] mb-4 flex items-center">
            <Mail className="w-4 h-4 mr-2 text-[var(--color-subtle-foreground)]" /> {t('OrgUnitDrawer.contactInformation')}
          </h3>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-label text-[var(--color-foreground)]">Email</label>
              <input 
                type="email" 
                {...register('email')}
                placeholder="example@company.com"
                className="w-full px-3 py-2 border rounded-control focus:ring-2 focus:ring-[var(--color-info-solid)] outline-none border-[var(--color-border-strong)] transition-all"
              />
              {errors.email && <p className="text-xs text-[var(--color-error)] mt-1">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.phoneNumber')}</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-[var(--color-subtle-foreground)]" />
                <input 
                  type="text" 
                  {...register('phone')}
                  placeholder="0912 345 678"
                  className="w-full pl-9 pr-3 py-2 border rounded-control focus:ring-2 focus:ring-[var(--color-info-solid)] outline-none border-[var(--color-border-strong)] transition-all"
                />
              </div>
              {errors.phone && <p className="text-xs text-[var(--color-error)] mt-1">{errors.phone.message}</p>}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="text-section-title text-[var(--color-foreground)] mb-4 flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-[var(--color-subtle-foreground)]" /> {t('OrgUnitDrawer.location')}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.provinceCity')}</label>
                <Controller
                  name="provinceId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => {
                        field.onChange(v === NONE ? '' : v)
                        // Đổi tỉnh thì quận cũ không còn thuộc tỉnh mới nữa; không xoá thì
                        // form vẫn giữ districtId cũ và gửi lên một quận lệch tỉnh.
                        setValue('districtId', '')
                      }}
                    >
                      <SelectTrigger className={triggerCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('OrgUnitDrawer.chooseProvinceCity')}</SelectItem>
                        {provinces.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.district')}</label>
                <Controller
                  name="districtId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || NONE}
                      onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                      disabled={!selectedProvinceId}
                    >
                      <SelectTrigger className={triggerCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('OrgUnitDrawer.chooseDistrict')}</SelectItem>
                        {districts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-label text-[var(--color-foreground)]">{t('OrgUnitDrawer.detailedAddress')}</label>
              <input 
                type="text" 
                {...register('address')}
                placeholder={t('OrgUnitDrawer.houseNumberStreetName')}
                className="w-full px-3 py-2 border rounded-control focus:ring-2 focus:ring-[var(--color-info-solid)] outline-none border-[var(--color-border-strong)] transition-all"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h3 className="text-section-title text-[var(--color-foreground)] mb-4 flex items-center">
            <Building2 className="w-4 h-4 mr-2 text-[var(--color-subtle-foreground)]" /> {t('OrgUnitDrawer.allowedRoleScope')}
          </h3>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-4 italic">{t('OrgUnitDrawer.limitsTheRolesThatCanBe')}</p>
          <div className="grid grid-cols-2 gap-3">
            {[...filteredRoles].sort((a, b) => (a.level ?? 0) - (b.level ?? 0)).map(role => {
              const disableReason = getRoleDisableReason(role)
              const isDisabled = !!disableReason

              return (
                <label 
                  key={role.id} 
                  className={cn(
                    "flex items-center p-3 rounded-card border border-[var(--color-border)] transition-all cursor-pointer group",
                    isDisabled ? "opacity-50 cursor-not-allowed bg-[var(--color-muted)]" : "hover:bg-[var(--color-muted)]"
                  )}
                >
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--color-border-strong)] text-[var(--color-info)] focus:ring-[var(--color-info-solid)] disabled:opacity-50"
                    value={role.id}
                    disabled={isDisabled}
                    {...register('roleIds')}
                  />
                  <div className="ml-3">
                    <p className="text-sm font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-info)] transition-colors">
                      {role.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-eyebrow">{role.isSystem ? t('OrgUnitDrawer.system') : t('OrgUnitDrawer.custom')}</p>
                    </div>
                    {isDisabled && (
                      <p className="text-xs text-[var(--color-error)] font-medium mt-1">{disableReason}</p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      </form>
    </Drawer>
  )
}
