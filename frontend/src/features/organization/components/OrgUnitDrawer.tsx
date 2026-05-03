import { useEffect, useState, useMemo } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { X, Upload, Building2, MapPin, Phone, Mail, Image as ImageIcon } from 'lucide-react'
import { 
  useCreateOrgUnit, 
  useUpdateOrgUnit, 
  useProvinces, 
  useDistricts, 
  useUploadLogo,
  useOrganization
} from '../hooks/useOrganizationStructure'
import { useRoles } from '../hooks/useUserRoles'
import { ROLE_MAP } from '@/constants/roles'
import { cn } from '@/lib/utils'


export type DrawerMode = 'create-root' | 'create-child' | 'edit'

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

const schema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên.'),
  code: z.string().min(1, 'Vui lòng nhập mã.'),
  unitTypeName: z.string().min(1, 'Vui lòng nhập loại tổ chức.'),
  email: z.string().email('Email không hợp lệ.').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  provinceId: z.string().optional(),
  districtId: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
  status: z.string().optional()
})

type FormData = z.infer<typeof schema>

export function OrgUnitDrawer({ orgId, drawerState, onClose, hierarchyLevels }: OrgUnitDrawerProps) {
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
      : Number(drawerState.currentNode?.level) ?? minDepth
      
  const parentName = drawerState.parentNode?.name || 'Không có (Root)'
  
  const totalLevels = Object.keys(hierarchyLevels || {}).length
  
  const isRoot = calculatedLevel === minDepth
  const isBottom = calculatedLevel === maxDepth
  const isMiddle = !isRoot && !isBottom

  const filteredRoles = allRoles.filter(role => {
    const roleLevel = role.level
    if (roleLevel === undefined || roleLevel === null) return false
    
    // Trường hợp 1: Công ty có 2 phân cấp (vd: Công ty -> Team)
    if (totalLevels === 2) {
      if (isRoot) return roleLevel === 0 || roleLevel === 2
      if (isBottom) return roleLevel === 2
      return roleLevel === 2
    }
    
    // Trường hợp 2: Công ty có 3 phân cấp trở lên (vd: Công ty -> Phòng -> Team)
    if (totalLevels >= 3) {
      if (isRoot) return roleLevel === 0 || roleLevel === 1 || roleLevel === 2
      if (isMiddle) return roleLevel === 1 || roleLevel === 2
      if (isBottom) return roleLevel === 2
    }
    
    // Mặc định
    if (isRoot) return true
    return roleLevel === 2
  })
      
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
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

  const formProvinceId = watch('provinceId')

  useEffect(() => {
    setSelectedProvinceId(formProvinceId)
  }, [formProvinceId])

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
        setValue('roleIds', [])
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
  }

  if (!drawerState.isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/50 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="w-[500px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {drawerState.mode === 'edit' ? 'Chỉnh sửa thành phần' : 'Thêm thành phần mới'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="org-form" onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
            
            {/* Logo Upload Section */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Logo</label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden relative group">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  )}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Upload className="w-5 h-5 text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-2">Định dạng hỗ trợ: PNG, JPG, WEBP. Tối đa 2MB.</p>
                  <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                    <Upload className="w-4 h-4 mr-2" />
                    Thay đổi logo
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Trực thuộc</label>
                <input 
                  type="text" 
                  value={parentName} 
                  disabled 
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 text-sm border-gray-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Cấp bậc</label>
                <div className="px-3 py-2 border rounded-lg bg-blue-50 text-blue-700 text-sm border-blue-100 font-medium">
                  Level {calculatedLevel}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Tên thành phần <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                {...register('name')}
                placeholder="VD: Phòng Kỹ thuật, Chi nhánh Hà Nội..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 transition-all font-medium"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Mã thành phần <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                {...register('code')}
                disabled={drawerState.mode === 'create-root'}
                placeholder="VD: PKT, ACC, HR..."
                className={`w-full px-3 py-2 border rounded-lg outline-none transition-all ${drawerState.mode === 'create-root' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 font-medium'}`}
              />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-700">Loại thành phần <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                {...register('unitTypeName')}
                disabled={drawerState.mode === 'edit' || drawerState.mode === 'create-child'}
                placeholder="VD: Công ty, Phòng ban..."
                className={`w-full px-3 py-2 border rounded-lg outline-none transition-all ${drawerState.mode !== 'create-root' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'border-gray-300 focus:ring-2 focus:ring-blue-500'}`}
              />
              {errors.unitTypeName && <p className="text-xs text-red-500 mt-1">{errors.unitTypeName.message}</p>}
            </div>

            {drawerState.mode === 'edit' && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Trạng thái vận hành</label>
                <select 
                  {...register('status')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 bg-white transition-all text-sm font-bold"
                >
                  <option value="ACTIVE">HOẠT ĐỘNG</option>
                  <option value="TRIAL">DÙNG THỬ (MỚI)</option>
                  <option value="INACTIVE">TẠM DỪNG / NGƯNG</option>
                  <option value="SUSPENDED">ĐÌNH CHỈ / KHÓA</option>
                </select>
              </div>
            )}

            <div className="pt-4 border-t">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-400" /> Thông tin liên hệ
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Email</label>
                  <input 
                    type="email" 
                    {...register('email')}
                    placeholder="example@company.com"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 transition-all"
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input 
                      type="text" 
                      {...register('phone')}
                      placeholder="0123 456 789"
                      className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-gray-400" /> Địa điểm
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Tỉnh/Thành phố</label>
                    <select 
                      {...register('provinceId')}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 bg-white transition-all text-sm"
                    >
                      <option value="">Chọn Tỉnh/Thành</option>
                      {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Quận/Huyện</label>
                    <select 
                      {...register('districtId')}
                      disabled={!selectedProvinceId}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 bg-white transition-all text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">Chọn Quận/Huyện</option>
                      {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-gray-700">Địa chỉ chi tiết</label>
                  <input 
                    type="text" 
                    {...register('address')}
                    placeholder="Số nhà, tên đường..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-gray-300 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                <Building2 className="w-4 h-4 mr-2 text-gray-400" /> Phạm vi vai trò được phép
              </h3>
              <p className="text-xs text-gray-500 mb-4 italic">Giới hạn các vai trò có thể gán cho thành viên trong đơn vị này. Để trống để cho phép tất cả.</p>
              <div className="grid grid-cols-2 gap-3">
                {filteredRoles.map(role => (
                  <label key={role.id} className="flex items-center p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all cursor-pointer group">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      value={role.id}
                      {...register('roleIds')}
                    />
                    <div className="ml-3">
                      <p className="text-sm font-black text-gray-700 group-hover:text-blue-700 transition-colors uppercase">{ROLE_MAP[role.name] || role.name}</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{role.isSystem ? 'Hệ thống' : 'Tùy chỉnh'}</p>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded font-black uppercase",
                          role.level === 0 ? "bg-red-100 text-red-600" :
                          role.level === 1 ? "bg-amber-100 text-amber-600" :
                          "bg-emerald-100 text-emerald-600"
                        )}>
                          Level {role.level}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3 rounded-b-2xl">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-white text-gray-700 font-semibold transition-all shadow-sm"
          >
            Hủy
          </button>
          <button 
            type="submit"
            form="org-form"
            disabled={createMutation.isPending || updateMutation.isPending || uploadLogoMutation.isPending}
            className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-all shadow-md shadow-blue-100 disabled:opacity-50"
          >
            {(createMutation.isPending || updateMutation.isPending || uploadLogoMutation.isPending) ? 'Đang xử lý...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  )
}

