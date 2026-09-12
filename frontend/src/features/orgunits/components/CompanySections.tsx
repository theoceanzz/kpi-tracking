import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '../hooks/useOrganization'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useUploadOrgBranding } from '../hooks/useUploadOrgBranding'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toastFirstError } from '@/lib/formErrors'
import {
  INDUSTRY_NONE,
  INDUSTRY_OTHER,
  companyProfileSchema,
  hierarchyLevelsSchema,
  type CompanyProfileFormData,
  type HierarchyLevelsFormData,
} from '../schemas/organizationSchema'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Edit3, ShieldCheck, Trash2,
  Info, ArrowUp, ArrowDown, Plus, Target, GitBranch, SlidersHorizontal, LayoutGrid, Gift, Wallet,
  Camera, Image as ImageIcon, Loader2
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useAuth } from '@/hooks/useAuth'
import type { UpdateOrganizationRequest } from '../api/organizationApi'

/** Thông báo lỗi do backend trả về, lùi về câu mặc định nếu phản hồi không nói gì. */
function apiErrorMessage(error: unknown, fallback: string) {
  return getApiErrorMessage(error, fallback)
}

/**
 * Hai khối của trang Công ty, tách thành component riêng để trang "Thiết lập công ty"
 * gắn chúng vào hai mục khác nhau của menu bên trong trang.
 */

/** Lĩnh vực hoạt động chọn sẵn. Không có "Khác" ở đây — đó là một lựa chọn của ô chọn,
 *  không phải một ngành nghề, nên nó là hằng riêng bên dưới. */
const INDUSTRY_PRESETS = [
  'Công nghệ thông tin',
  'Tài chính - Ngân hàng',
  'Bảo hiểm',
  'Bất động sản',
  'Xây dựng',
  'Sản xuất - Công nghiệp',
  'Bán lẻ - Thương mại',
  'Logistics - Vận tải',
  'Giáo dục - Đào tạo',
  'Y tế - Dược phẩm',
  'Du lịch - Khách sạn',
  'Nông nghiệp - Thực phẩm',
  'Năng lượng',
  'Truyền thông - Quảng cáo',
  'Dịch vụ chuyên nghiệp',
] as const

const isPresetIndustry = (value: string) => (INDUSTRY_PRESETS as readonly string[]).includes(value)

const inputCls =
  'h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none transition-colors placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'

// Ô chọn phải trông y hệt ô nhập bên cạnh nó, nếu không hàng lưới đọc thành hai kiểu
// điều khiển khác nhau. Ghi đè phần bo góc / chiều cao / màu nền mặc định của shadcn,
// và cho chữ giữ chỗ nhạt bằng đúng placeholder của ô nhập.
const selectTriggerCls = 'w-full'

/* ========== THÔNG TIN CÔNG TY ========== */
export function CompanyInfoSection() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)
  const brandingMutation = useUploadOrgBranding(orgId)
  const { refreshUser } = useAuth()

  const [isEditing, setIsEditing] = useState(false)
  const [uploadingKind, setUploadingKind] = useState<'logo' | 'cover' | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: '', code: '', industryChoice: INDUSTRY_NONE, industryCustom: '',
      taxCode: '', employeeCount: '', description: '',
    },
  })

  // `useWatch` chứ không phải `watch()`: hàm `watch` trả về từ `useForm` không memo hoá
  // an toàn được nên trình biên dịch React cảnh báo, còn đây là hook đăng ký đúng cách.
  const industryChoice = useWatch({ control, name: 'industryChoice' })

  // Nạp lại form mỗi khi dữ liệu server đổi (kể cả sau khi lưu) để chế độ sửa không
  // bao giờ mở ra với giá trị cũ.
  useEffect(() => {
    if (!org) return
    // Server chỉ lưu MỘT chuỗi lĩnh vực. Tách ngược ra hai ô: trùng preset thì ô chọn
    // giữ nó; có giá trị mà không trùng preset nghĩa là ngành tự gõ trước đó, phải mở
    // sẵn ô "Khác" kèm đúng chữ cũ, không thì người dùng mở ra thấy trắng như bị mất.
    const industry = org.industry ?? ''
    const custom = industry !== '' && !isPresetIndustry(industry)
    reset({
      name: org.name ?? '',
      code: org.code ?? '',
      industryChoice: industry === '' ? INDUSTRY_NONE : custom ? INDUSTRY_OTHER : industry,
      industryCustom: custom ? industry : '',
      taxCode: org.taxCode ?? '',
      employeeCount: org.employeeCount != null ? String(org.employeeCount) : '',
      description: org.description ?? '',
    })
  }, [org, reset])

  const onSave = (data: CompanyProfileFormData) => {
    // Gộp hai ô lại thành một chuỗi trước khi gửi: server không biết gì về "Khác".
    const industry =
      data.industryChoice === INDUSTRY_NONE ? ''
      : data.industryChoice === INDUSTRY_OTHER ? data.industryCustom.trim()
      : data.industryChoice

    updateMutation.mutate(
      {
        name: data.name.trim(),
        code: data.code.trim(),
        industry,
        taxCode: data.taxCode.trim(),
        // Ô trống = "chưa khai", không phải 0 nhân viên.
        employeeCount: data.employeeCount.trim() === '' ? null : Number(data.employeeCount),
        description: data.description.trim(),
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          refreshUser()
          toast.success('Cập nhật hồ sơ doanh nghiệp thành công')
        },
        onError: error => toast.error(apiErrorMessage(error, 'Không thể cập nhật hồ sơ')),
      }
    )
  }

  // Mở hộp chọn tệp. Dùng chung cho cả nút máy ảnh lẫn cú bấm thẳng vào ảnh — bấm vào
  // chính tấm ảnh muốn đổi là phản xạ tự nhiên hơn là phải nhắm vào nút nhỏ ở góc.
  const openPicker = (kind: 'logo' | 'cover') => () => {
    if (uploadingKind !== null) return
    ;(kind === 'cover' ? coverInputRef : logoInputRef).current?.click()
  }

  const handlePickImage = (kind: 'logo' | 'cover') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Xoá value ngay để chọn LẠI đúng tập tin vừa rồi vẫn kích hoạt onChange.
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Tập tin phải là ảnh')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5MB')
      return
    }
    setUploadingKind(kind)
    brandingMutation.mutate(
      { kind, file },
      {
        onSuccess: () => {
          refreshUser()
          toast.success(kind === 'cover' ? 'Đã cập nhật ảnh bìa' : 'Đã cập nhật logo')
        },
        onError: error => toast.error(apiErrorMessage(error, 'Không thể tải ảnh lên')),
        onSettled: () => setUploadingKind(null),
      }
    )
  }

  if (isLoading) return <LoadingSkeleton rows={6} />

  const isActive = (org?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  const foundedAt = org?.createdAt ? formatDateTime(org.createdAt).split(' ')[0] : null

  return (
    <div id="tour-company-hero" className="mx-auto max-w-4xl space-y-5">
      <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handlePickImage('logo')} />
      <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handlePickImage('cover')} />

      {/* ── Ảnh bìa + logo + định danh ────────────────────────────────────────
          Ảnh bìa ôm luôn tên công ty và nút sửa: người dùng nhận ra "đây là hồ sơ
          của tôi" trước khi phải đọc từng ô dữ liệu bên dưới. */}
      <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div
          onClick={openPicker('cover')}
          title="Bấm để đổi ảnh bìa"
          className={cn(
            'group relative h-40 sm:h-52 bg-[var(--color-muted)]',
            uploadingKind === null && 'cursor-pointer'
          )}
        >
          {org?.coverUrl ? (
            <img src={org.coverUrl} alt="Ảnh bìa công ty" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--color-subtle-foreground)] border-b border-dashed border-[var(--color-border)]">
              <ImageIcon size={28} />
              <span className="text-caption">
                Ảnh bìa công ty, khuyến nghị 1200x300
              </span>
            </div>
          )}

          {/* Lớp phủ chỉ để báo "vùng này bấm được". `pointer-events-none` nên nó không
              nuốt cú bấm, và nút bên dưới vẽ đè lên vì đứng sau trong DOM. */}
          <div className="pointer-events-none absolute inset-0 bg-slate-950/0 transition-colors group-hover:bg-slate-950/20" />

          {/* Nút nằm TRONG vùng bấm được, không chặn thì một cú bấm mở hộp chọn tệp hai lần. */}
          <Button
            variant="outline"
            size="sm"
            className="absolute right-4 top-4 bg-[var(--color-card)]"
            onClick={e => { e.stopPropagation(); openPicker('cover')() }}
            disabled={uploadingKind !== null}
          >
            {uploadingKind === 'cover' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
            Đổi ảnh bìa
          </Button>
        </div>

        {/* Logo nhô lên đè mép ảnh bìa — bố cục hồ sơ quen thuộc. */}
        <div className="px-5 pb-6">
          <div className="relative -mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="relative shrink-0">
              {/* Nút máy ảnh là phần tử ANH EM của ô này, không nằm trong — nên bấm nút
                  không lọt xuống đây, khỏi cần chặn nổi bọt như bên ảnh bìa. */}
              <div
                onClick={openPicker('logo')}
                title="Bấm để đổi logo"
                className={cn(
'group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-widget bg-[var(--color-primary)] text-4xl font-semibold text-[var(--color-primary-foreground)] ring-4 ring-[var(--color-card)]',
                  uploadingKind === null && 'cursor-pointer'
                )}
              >
                {org?.logoUrl
                  ? <img src={org.logoUrl} alt={org?.name} className="w-full h-full object-cover" />
                  : org?.name?.charAt(0)}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/0 transition-colors group-hover:bg-slate-950/40">
                  <Camera size={20} className="text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingKind !== null}
                title="Đổi logo"
                aria-label="Đổi logo"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-card)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {uploadingKind === 'logo' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Camera size={13} aria-hidden="true" />}
              </button>
            </div>

            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="min-w-0 sm:pb-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-page-title truncate">
                    {org?.name}
                  </h2>
                  <Badge variant={isActive ? 'success' : 'secondary'} className="shrink-0">
                    {isActive ? 'Đang hoạt động' : org?.status}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-[var(--color-muted-foreground)]">
                  Mã DN {org?.code || 'N/A'}
                  {foundedAt && <> · Thành lập {foundedAt}</>}
                </p>
              </div>

              {!isEditing && (
                <Button variant="outline" className="shrink-0" onClick={() => setIsEditing(true)}>
                  <Edit3 aria-hidden="true" /> Chỉnh sửa hồ sơ
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit(onSave)} className="space-y-5">
        {/* ── Định danh ── */}
        <FieldCard title="Thông tin định danh">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Tên công ty" editing={isEditing} value={org?.name}>
              <input
                {...register('name')}
                className={inputCls}
                placeholder="Tên công ty"
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field label="Lĩnh vực hoạt động" editing={isEditing} value={org?.industry}>
              <Controller
                control={control}
                name="industryChoice"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={selectTriggerCls}>
                      <SelectValue placeholder="Chọn lĩnh vực hoạt động" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={INDUSTRY_NONE}>Chưa cập nhật</SelectItem>
                      {INDUSTRY_PRESETS.map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                      <SelectItem value={INDUSTRY_OTHER}>Khác…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />

              {/* Ô tự gõ chỉ bung ra khi chọn "Khác" — còn lại thì danh sách đã đủ, bày
                  thêm một ô trống chỉ khiến người dùng phân vân phải điền cả hai. */}
              {industryChoice === INDUSTRY_OTHER && (
                <input
                  {...register('industryCustom')}
                  autoFocus
                  className={cn(inputCls, 'mt-2')}
                  placeholder="Nhập lĩnh vực hoạt động"
                />
              )}
              {errors.industryCustom && <FieldError>{errors.industryCustom.message}</FieldError>}
            </Field>

            {/* Mã DN chỉ hiện khi đang sửa: lúc xem nó đã nằm ngay dưới tên công ty ở
                phần đầu trang, bày lại lần nữa chỉ tổ chiếm chỗ. Nhưng vẫn phải sửa
                được — trước khi đổi giao diện, đây là một trong hai ô sửa được. */}
            {isEditing && (
              <Field label="Mã doanh nghiệp" editing value={org?.code}>
                <input
                  {...register('code')}
                  className={inputCls}
                  placeholder="VD: DEMO1"
                />
                {errors.code && <FieldError>{errors.code.message}</FieldError>}
              </Field>
            )}

            <Field label="Mã số thuế" editing={isEditing} value={org?.taxCode}>
              <input {...register('taxCode')} className={inputCls} placeholder="VD: 0102345678" />
            </Field>

            <Field
              label="Quy mô nhân sự"
              editing={isEditing}
              value={org?.employeeCount != null ? `${org.employeeCount.toLocaleString('vi-VN')} nhân viên` : null}
            >
              <input
                type="number"
                min={0}
                {...register('employeeCount')}
                className={inputCls}
                placeholder="VD: 187"
              />
              {errors.employeeCount && <FieldError>{errors.employeeCount.message}</FieldError>}
            </Field>
          </div>
        </FieldCard>

        {/* ── Mô tả ── */}
        <FieldCard title="Mô tả công ty">
          {isEditing ? (
            <textarea
              {...register('description')}
              rows={4}
              className={cn(inputCls, 'resize-y leading-relaxed')}
              placeholder="Giới thiệu ngắn về công ty"
            />
          ) : (
            <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {org?.description || <span className="text-[var(--color-subtle-foreground)]">Chưa có mô tả</span>}
            </p>
          )}
        </FieldCard>

        {isEditing && (
          // Thanh lưu dính đáy: form trải nhiều thẻ, không ai muốn cuộn ngược lên tìm nút.
          <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 shadow-lg">
            <p className="mr-auto text-caption">Có thay đổi chưa lưu</p>
            <Button variant="outline" onClick={() => { setIsEditing(false); reset() }} disabled={updateMutation.isPending}>Hủy</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
        )}
      </form>

      {/* ── Cờ tính năng ── Thẻ riêng vì đây là trạng thái BẬT/TẮT, không sửa tại chỗ:
          muốn đổi thì sang trang bật/tắt. */}
      <section className="space-y-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-section-title">Tính năng đang bật</h3>
            <p className="text-caption">Bật/tắt ở Thiết lập công cụ, mục Tính năng.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/settings/tools?section=modules">Quản lý tính năng</Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <FeatureChip icon={SlidersHorizontal} label="KPI hành vi" enabled={org?.enableQualitative} />
          <FeatureChip icon={LayoutGrid} label="BSC" enabled={org?.enableBsc} />
          <FeatureChip icon={Target} label="OKR" enabled={org?.enableOkr} />
          <FeatureChip icon={GitBranch} label="Waterfall" enabled={org?.enableWaterfall} />
          <FeatureChip icon={Gift} label="Thưởng điểm" enabled={org?.enableReward} />
          <FeatureChip icon={Wallet} label="Ví tiền" enabled={org?.enableCashWallet} />
        </div>
      </section>
    </div>
  )
}

function FieldCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="text-section-title">{title}</h3>
      {children}
    </section>
  )
}

/**
 * Một ô hồ sơ. Xem và sửa dùng CHUNG khung: nhãn ở trên, giá trị ở dưới, cùng chiều
 * cao — nên bấm "Chỉnh sửa" chỉ đổi ô thành nhập được, bố cục không nhảy một pixel nào.
 */
function Field({
  label, editing, value, children,
}: { label: string; editing: boolean; value?: string | number | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-label block">{label}</label>
      {editing ? (
        <div className="space-y-1">{children}</div>
      ) : (
        <div className="flex h-9 items-center truncate rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 text-sm text-[var(--color-foreground)]">
          {value || <span className="text-[var(--color-subtle-foreground)]">Chưa cập nhật</span>}
        </div>
      )}
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--color-error)]">{children}</p>
}

/* ========== CẤP BẬC ========== */
export function CompanyHierarchySection() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)
  const { refreshUser } = useAuth()

  const [isEditingHierarchy, setIsEditingHierarchy] = useState(false)

  const { register, control, handleSubmit, reset } = useForm<HierarchyLevelsFormData>({
    resolver: zodResolver(hierarchyLevelsSchema),
    defaultValues: { hierarchyLevels: [] },
  })

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "hierarchyLevels"
  })

  useEffect(() => {
    if (org?.hierarchyLevels) {
      reset({
        hierarchyLevels: org.hierarchyLevels.map(l => ({
          id: l.id,
          unitTypeName: l.unitTypeName,
          managerRoleLabel: l.managerRoleLabel || ''
        }))
      })
    }
  }, [org, reset])

  const onSaveHierarchy = (data: HierarchyLevelsFormData) => {
    // Form chỉ thu tên cấp bậc và nhãn quản lý; `levelOrder`/`roleLevel` do backend suy ra
    // từ thứ tự mảng nên payload không mang hai trường đó.
    updateMutation.mutate({ hierarchyLevels: data.hierarchyLevels as UpdateOrganizationRequest['hierarchyLevels'] }, {
      onSuccess: () => {
        setIsEditingHierarchy(false)
        refreshUser()
        toast.success('Cập nhật cơ cấu tổ chức thành công')
      },
      onError: (error: any) => {
        const msg = getApiErrorMessage(error, 'Có lỗi xảy ra')
        toast.error(msg)
      }
    })
  }

  if (isLoading) return <LoadingSkeleton rows={8} />

  const levels = org?.hierarchyLevels ?? []
  const saving = updateMutation.isPending

  return (
    <section id="tour-company-hierarchy" className="mx-auto max-w-3xl rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-section-title">Cấu trúc cấp bậc</h3>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
            Thứ tự từ trên xuống: cấp 1 là toàn công ty, cấp cuối là đơn vị nhỏ nhất. Mỗi cấp có một chức danh quản lý.
          </p>
        </div>
        {!isEditingHierarchy && (
          <Button variant="outline" className="shrink-0" onClick={() => setIsEditingHierarchy(true)}>
            <Edit3 aria-hidden="true" /> Chỉnh sửa
          </Button>
        )}
      </div>

      <div className="p-5">
        {isEditingHierarchy ? (
          // Cùng bề ngang với chế độ xem, để bấm "sửa" không làm cả khối nhảy rộng ra.
          <form onSubmit={handleSubmit(onSaveHierarchy, toastFirstError)} className="space-y-4">
            <div className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Đổi cấu trúc ảnh hưởng tới danh mục đơn vị và vai trò đang gắn với từng cấp. Xoá một cấp không xoá đơn vị, nhưng đơn vị đó sẽ cần gán lại cấp.</span>
            </div>

            <div className="hidden grid-cols-[2rem_1fr_1fr_5.5rem] gap-3 px-1 sm:grid">
              <span className="text-eyebrow">#</span>
              <span className="text-eyebrow">Tên cấp</span>
              <span className="text-eyebrow">Chức danh quản lý</span>
              <span className="sr-only">Sắp xếp</span>
            </div>

            <ol className="space-y-2">
              {fields.map((field, index) => (
                <li key={field.id} className="grid grid-cols-[2rem_1fr] items-start gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3 sm:grid-cols-[2rem_1fr_1fr_5.5rem] sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:px-1">
                  <span className="flex h-8 w-8 items-center justify-center rounded-control bg-[var(--color-primary)] text-xs font-semibold tabular-nums text-[var(--color-primary-foreground)]">
                    {index + 1}
                  </span>
                  <input type="hidden" {...register(`hierarchyLevels.${index}.id` as const)} />
                  <div>
                    <label className="text-label mb-1 block sm:sr-only">Tên cấp</label>
                    <input
                      {...register(`hierarchyLevels.${index}.unitTypeName` as const)}
                      className={inputCls}
                      placeholder="VD: Chi nhánh"
                      aria-label={`Tên cấp ${index + 1}`}
                    />
                  </div>
                  <div className="col-start-2 sm:col-start-auto">
                    <label className="text-label mb-1 block sm:sr-only">Chức danh quản lý</label>
                    <input
                      {...register(`hierarchyLevels.${index}.managerRoleLabel` as const)}
                      className={inputCls}
                      placeholder="VD: Giám đốc"
                      aria-label={`Chức danh quản lý cấp ${index + 1}`}
                    />
                  </div>
                  <div className="col-start-2 flex items-center gap-1 sm:col-start-auto sm:justify-end">
                    <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Chuyển lên" title="Chuyển lên">
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} aria-label="Chuyển xuống" title="Chuyển xuống">
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={fields.length <= 2}
                      onClick={() => remove(index)}
                      aria-label="Xoá cấp"
                      title={fields.length <= 2 ? 'Cần ít nhất 2 cấp' : 'Xoá cấp'}
                      className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>

            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => append({ unitTypeName: '', managerRoleLabel: '' })}
            >
              <Plus aria-hidden="true" /> Thêm cấp bậc
            </Button>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <Button type="button" variant="outline" onClick={() => { setIsEditingHierarchy(false); reset() }} disabled={saving}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                {saving ? 'Đang lưu…' : 'Lưu cấu trúc'}
              </Button>
            </div>
          </form>
        ) : (
          // Danh sách cấp bậc là một cái thang: mỗi bậc chỉ có tên đơn vị và chức danh.
          // Ràng bề ngang lại thay vì để tràn 1500px — đọc thành một thang liền mạch.
          <ol className="divide-y divide-[var(--color-border)] overflow-hidden rounded-card border border-[var(--color-border)]">
            {levels.map((level, idx) => {
              const isLast = idx === levels.length - 1
              return (
                <li key={level.id} className="flex items-center gap-3 bg-[var(--color-card)] px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-[var(--color-primary-soft)] text-xs font-semibold tabular-nums text-[var(--color-primary)]">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-foreground)]">{level.unitTypeName}</span>
                  <span className="hidden text-caption sm:inline">Quản lý bởi</span>
                  <Badge variant={level.managerRoleLabel ? 'outline' : 'secondary'} className="shrink-0">
                    <ShieldCheck size={12} aria-hidden="true" />
                    {level.managerRoleLabel || (isLast ? 'Nhân viên' : 'Chưa đặt')}
                  </Badge>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

// Cờ tính năng là trạng thái BẬT/TẮT — dùng dạng viên thuốc có chấm sáng, xanh lá cho
// mục đang bật để quét một lượt là biết ngay công ty đang dùng những gì.
function FeatureChip({ icon: Icon, label, enabled }: { icon: any; label: string; enabled?: boolean }) {
  return (
    <div
      title={`${label}: ${enabled ? 'Đang bật' : 'Đang tắt'}`}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 transition-colors',
        enabled
          ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)]'
          : 'bg-[var(--color-muted)] border-[var(--color-border)]'
      )}
    >
      <Icon size={13} className={enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-subtle-foreground)]'} />
      <span className={cn(
        'whitespace-nowrap text-xs font-medium',
        enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-muted-foreground)]'
      )}>
        {label}
      </span>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        enabled ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-border)]'
      )} />
    </div>
  )
}
