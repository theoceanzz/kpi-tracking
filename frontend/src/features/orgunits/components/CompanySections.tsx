import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '../hooks/useOrganization'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useUploadOrgBranding } from '../hooks/useUploadOrgBranding'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Edit3, ShieldCheck, Layers, Trash2,
  Info, ArrowUp, ArrowDown, Plus, Target, GitBranch, SlidersHorizontal, LayoutGrid, Gift, Wallet,
  Camera, Image as ImageIcon, Loader2
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatDateTime, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import type { AxiosError } from 'axios'

/** Thông báo lỗi do backend trả về, lùi về câu mặc định nếu phản hồi không nói gì. */
function apiErrorMessage(error: unknown, fallback: string) {
  return (error as AxiosError<{ message?: string }>)?.response?.data?.message || fallback
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

// Hai giá trị canh gác của ô chọn. Radix không nhận chuỗi rỗng làm value nên "chưa chọn"
// cũng phải có mã riêng; cả hai đều được quy đổi lại trước khi gửi lên server.
const INDUSTRY_NONE = '__none__'
const INDUSTRY_OTHER = '__other__'

const isPresetIndustry = (value: string) => (INDUSTRY_PRESETS as readonly string[]).includes(value)

type ProfileForm = {
  name: string
  code: string
  /** Mục đang chọn trong ô chọn: một preset, hoặc một trong hai giá trị canh gác. */
  industryChoice: string
  /** Chỉ dùng khi chọn "Khác" — ngành nghề người dùng tự gõ. */
  industryCustom: string
  taxCode: string
  employeeCount: string
  description: string
}

const inputCls =
  'w-full bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600'

// Ô chọn phải trông y hệt ô nhập bên cạnh nó, nếu không hàng lưới đọc thành hai kiểu
// điều khiển khác nhau. Ghi đè phần bo góc / chiều cao / màu nền mặc định của shadcn,
// và cho chữ giữ chỗ nhạt bằng đúng placeholder của ô nhập.
const selectTriggerCls =
  'h-auto rounded-xl px-3.5 py-2.5 text-sm font-semibold border-slate-200 dark:border-slate-700 dark:bg-slate-900 ring-offset-0 focus:ring-0 focus:ring-offset-0 focus:border-indigo-500 transition-all data-[placeholder]:font-medium data-[placeholder]:text-slate-300 dark:data-[placeholder]:text-slate-600'

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

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ProfileForm>({
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

  const onSave = (data: ProfileForm) => {
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
    <div id="tour-company-hero" className="space-y-5">
      <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handlePickImage('logo')} />
      <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handlePickImage('cover')} />

      {/* ── Ảnh bìa + logo + định danh ────────────────────────────────────────
          Ảnh bìa ôm luôn tên công ty và nút sửa: người dùng nhận ra "đây là hồ sơ
          của tôi" trước khi phải đọc từng ô dữ liệu bên dưới. */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div
          onClick={openPicker('cover')}
          title="Bấm để đổi ảnh bìa"
          className={cn(
            'group relative h-40 sm:h-52 bg-slate-50 dark:bg-slate-800/50',
            uploadingKind === null && 'cursor-pointer'
          )}
        >
          {org?.coverUrl ? (
            <img src={org.coverUrl} alt="Ảnh bìa công ty" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600 border-b border-dashed border-slate-200 dark:border-slate-700">
              <ImageIcon size={28} />
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                Ảnh bìa công ty, khuyến nghị 1200x300
              </span>
            </div>
          )}

          {/* Lớp phủ chỉ để báo "vùng này bấm được". `pointer-events-none` nên nó không
              nuốt cú bấm, và nút bên dưới vẽ đè lên vì đứng sau trong DOM. */}
          <div className="pointer-events-none absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/15 transition-colors" />

          <button
            type="button"
            // Nút nằm TRONG vùng bấm được, không chặn thì một cú bấm mở hộp chọn tệp hai lần.
            onClick={e => { e.stopPropagation(); openPicker('cover')() }}
            disabled={uploadingKind !== null}
            className="absolute top-4 right-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 shadow-sm transition-all disabled:opacity-50"
          >
            {uploadingKind === 'cover' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            Đổi ảnh bìa
          </button>
        </div>

        {/* Logo nhô lên đè mép ảnh bìa — bố cục hồ sơ quen thuộc. */}
        <div className="px-6 sm:px-8 pb-6">
          <div className="relative -mt-12 sm:-mt-14 flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="relative shrink-0">
              {/* Nút máy ảnh là phần tử ANH EM của ô này, không nằm trong — nên bấm nút
                  không lọt xuống đây, khỏi cần chặn nổi bọt như bên ảnh bìa. */}
              <div
                onClick={openPicker('logo')}
                title="Bấm để đổi logo"
                className={cn(
                  'group relative w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-indigo-500/25 ring-4 ring-white dark:ring-slate-900 overflow-hidden',
                  uploadingKind === null && 'cursor-pointer'
                )}
              >
                {org?.logoUrl
                  ? <img src={org.logoUrl} alt={org?.name} className="w-full h-full object-cover" />
                  : org?.name?.charAt(0)}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 group-hover:bg-slate-900/40 transition-colors">
                  <Camera size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingKind !== null}
                title="Đổi logo"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {uploadingKind === 'logo' ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              </button>
            </div>

            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="min-w-0 sm:pb-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                    {org?.name}
                  </h2>
                  <span className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0',
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  )}>
                    {isActive ? 'Active' : org?.status}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] font-medium text-slate-400 dark:text-slate-500 truncate">
                  Mã DN {org?.code || 'N/A'}
                  {foundedAt && <> · Thành lập {foundedAt}</>}
                </p>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                >
                  <Edit3 size={14} /> Chỉnh sửa hồ sơ
                </button>
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
                {...register('name', { required: 'Tên công ty không được để trống' })}
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
                  {...register('industryCustom', {
                    validate: v =>
                      industryChoice !== INDUSTRY_OTHER || v.trim() !== '' ||
                      'Nhập lĩnh vực hoạt động của công ty',
                  })}
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
                  {...register('code', { required: 'Mã doanh nghiệp không được để trống' })}
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
                {...register('employeeCount', {
                  min: { value: 0, message: 'Quy mô nhân sự không được âm' },
                })}
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
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {org?.description || <span className="text-slate-300 dark:text-slate-600">Chưa có mô tả</span>}
            </p>
          )}
        </FieldCard>

        {isEditing && (
          // Thanh lưu dính đáy: form trải nhiều thẻ, không ai muốn cuộn ngược lên tìm nút.
          <div className="sticky bottom-4 z-10 flex justify-end gap-3 px-5 py-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-800 shadow-lg">
            <button
              type="button"
              onClick={() => { setIsEditing(false); reset() }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-7 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        )}
      </form>

      {/* ── Cờ tính năng ── Thẻ riêng vì đây là trạng thái BẬT/TẮT, không sửa tại chỗ:
          muốn đổi thì sang trang bật/tắt. */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tính năng đang bật</h4>
          <Link
            to="/settings/tools?section=modules"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
          >
            Quản lý tính năng →
          </Link>
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
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-7 space-y-5">
      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{title}</h3>
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
      <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 ml-0.5">{label}</label>
      {editing ? (
        <div className="space-y-1">{children}</div>
      ) : (
        <div className="px-3.5 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-sm font-semibold text-slate-900 dark:text-white truncate">
          {value || <span className="font-medium text-slate-300 dark:text-slate-600">Chưa cập nhật</span>}
        </div>
      )}
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium text-red-500 ml-0.5">{children}</p>
}

/* ========== CẤP BẬC ========== */
export function CompanyHierarchySection() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)
  const { refreshUser } = useAuth()

  const [isEditingHierarchy, setIsEditingHierarchy] = useState(false)

  const { register, control, handleSubmit, reset } = useForm({
    defaultValues: {
      hierarchyLevels: [] as { id?: string; unitTypeName: string; managerRoleLabel: string }[]
    }
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

  const onSaveHierarchy = (data: any) => {
    if (data.hierarchyLevels.length < 2) {
      toast.error('Cơ cấu tổ chức phải có ít nhất 2 cấp.')
      return
    }
    updateMutation.mutate({ hierarchyLevels: data.hierarchyLevels }, {
      onSuccess: () => {
        setIsEditingHierarchy(false)
        refreshUser()
        toast.success('Cập nhật cơ cấu tổ chức thành công')
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.message || 'Có lỗi xảy ra'
        toast.error(msg)
      }
    })
  }

  if (isLoading) return <LoadingSkeleton rows={8} />

  return (
    <section id="tour-company-hierarchy" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
       <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Cấu trúc Cấp bậc</h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Sơ đồ phân cấp quản lý</p>
            </div>
          </div>
          {!isEditingHierarchy && (
            <button
              onClick={() => setIsEditingHierarchy(true)}
              className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center group"
            >
              <Edit3 size={16} />
            </button>
          )}
       </div>

       <div className="p-8 relative">
         {isEditingHierarchy ? (
           // Cùng bề ngang với chế độ xem, để bấm "sửa" không làm cả khối nhảy rộng ra.
           <form onSubmit={handleSubmit(onSaveHierarchy)} className="max-w-2xl space-y-6">
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl text-amber-700 dark:text-amber-400 text-[11px] font-medium leading-relaxed">
                <Info size={16} className="shrink-0 mt-0.5" />
                Việc thay đổi cấu trúc ảnh hưởng đến danh mục đơn vị hiện có.
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative animate-in slide-in-from-right-2 duration-300">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-600/20 shrink-0">
                          {index + 1}
                        </div>
                        {index < fields.length - 1 && <div className="w-0.5 h-full bg-slate-100 dark:bg-slate-800 my-1" />}
                      </div>

                      <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all group-hover:border-indigo-300 dark:group-hover:border-indigo-800">
                         <input type="hidden" {...register(`hierarchyLevels.${index}.id` as const)} />
                         <div className="flex flex-col sm:flex-row items-center gap-4">
                           <div className="flex-1 w-full space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị</label>
                             <input
                               {...register(`hierarchyLevels.${index}.unitTypeName` as const, { required: true })}
                               className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                               placeholder="VD: Chi nhánh"
                              />
                           </div>
                           <div className="flex-1 w-full space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức danh quản lý</label>
                             <input
                               {...register(`hierarchyLevels.${index}.managerRoleLabel` as const)}
                               className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                               placeholder="VD: Giám đốc"
                              />
                           </div>
                         </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                         <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 disabled:opacity-20"><ArrowUp size={14} /></button>
                         <button type="button" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 disabled:opacity-20"><ArrowDown size={14} /></button>
                         {fields.length > 2 && (
                           <button type="button" onClick={() => remove(index)} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={14} /></button>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => append({ unitTypeName: '', managerRoleLabel: '' })}
                className="w-full py-4 flex items-center justify-center gap-2 border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-600 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all"
              >
                <Plus size={16} /> Thêm cấp bậc
              </button>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsEditingHierarchy(false); reset() }} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Hủy</button>
                <button type="submit" className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-indigo-700 transition-all">Lưu</button>
              </div>
           </form>
         ) : (
           // Danh sách cấp bậc là một cái thang: mỗi bậc chỉ có tên đơn vị và chức danh.
           // Ràng bề ngang lại thay vì để tràn 1500px — trước đó mỗi bậc là một thẻ cao
           // 170px với chức danh nằm cách tên cả nghìn pixel, đọc thành ba khối rời rạc
           // thay vì một thang liền mạch.
           <div className="max-w-2xl relative">
              <div className="absolute left-[15px] top-5 bottom-5 w-px bg-slate-200 dark:bg-slate-800" />
              {org?.hierarchyLevels?.map((level, idx) => (
                <div key={level.id} className="relative pl-12 py-1.5 group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center z-10">
                    <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black shadow-sm shadow-indigo-600/30">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-800 transition-all">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{level.unitTypeName}</span>
                    <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <ShieldCheck size={12} className="text-indigo-500 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {level.managerRoleLabel || (idx === (org.hierarchyLevels?.length || 0) - 1 ? 'Nhân viên' : 'Chưa đặt')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
           </div>
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
        'flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors',
        enabled
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40'
          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
      )}
    >
      <Icon size={13} className={enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'} />
      <span className={cn(
        'text-[10px] font-black uppercase tracking-widest whitespace-nowrap',
        enabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-600'
      )}>
        {label}
      </span>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        enabled ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-slate-300 dark:bg-slate-700'
      )} />
    </div>
  )
}
