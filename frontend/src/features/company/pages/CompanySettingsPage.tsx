import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useCompany } from '../hooks/useCompany'
import { companyApi } from '../api/companyApi'
import { useProvinces, useDistricts } from '@/features/provinces/hooks/useProvinces'
import { toast } from 'sonner'
import {
  Pencil, Loader2, Building2, Mail, Phone, MapPin,
  ReceiptText, Globe, CheckCircle2, Shield, Clock,
  X, Save
} from 'lucide-react'
import type { UpdateCompanyRequest, Company } from '@/types/company'
import { cn, formatDateTime } from '@/lib/utils'

export default function CompanySettingsPage() {
  const { data: company, isLoading } = useCompany()
  const [editing, setEditing] = useState(false)
  const qc = useQueryClient()

  if (isLoading) return <div className="p-8"><LoadingSkeleton type="form" rows={6} /></div>
  if (!company) return null

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    ACTIVE: { label: 'Đang hoạt động', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/40' },
    TRIAL: { label: 'Đang dùng thử', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40' },
    SUSPENDED: { label: 'Tạm khóa', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40' },
    EXPIRED: { label: 'Hết hạn', color: 'text-slate-700 dark:text-slate-400', bgColor: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  }
  const currentStatus = statusConfig[company.status] ?? { label: 'Không xác định', color: 'text-slate-700 dark:text-slate-400', bgColor: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' }

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest">
            <Building2 size={14} /> Hồ sơ tổ chức
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Thiết lập Công ty
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Quản lý thông tin pháp nhân, liên hệ, và địa chỉ trụ sở doanh nghiệp.
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 font-bold text-sm active:scale-95 shrink-0"
          >
            <Pencil size={16} className="group-hover:rotate-12 transition-transform" />
            Chỉnh sửa hồ sơ
          </button>
        )}
      </div>

      {editing ? (
        /* ====== EDIT MODE ====== */
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in zoom-in-95 fade-in duration-300">
          <div className="border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Pencil size={20} />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">Chỉnh sửa hồ sơ</h3>
                <p className="text-xs font-medium text-slate-500">Cập nhật thông tin mới nhất cho doanh nghiệp</p>
              </div>
            </div>
            <button onClick={() => setEditing(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
              <X size={20} />
            </button>
          </div>
          <div className="p-8">
            <CompanyEditForm
              company={company}
              onCancel={() => setEditing(false)}
              onSaved={() => { qc.invalidateQueries({ queryKey: ['company'] }); setEditing(false) }}
            />
          </div>
        </div>
      ) : (
        /* ====== VIEW MODE ====== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Profile Card */}
          <div className="lg:col-span-1 space-y-6">
            {/* Company Identity */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-6">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
                  <Building2 size={40} className="text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
                  <CheckCircle2 size={16} className="text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">{company.name}</h2>
                {company.taxCode && (
                  <p className="text-sm text-slate-500 mt-1">
                    MST: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{company.taxCode}</span>
                  </p>
                )}
              </div>

              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${currentStatus.bgColor} ${currentStatus.color}`}>
                <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {currentStatus.label}
              </div>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <QuickInfoCard
                icon={Clock}
                label="Ngày tạo"
                value={company.createdAt ? new Date(company.createdAt).toLocaleDateString('vi-VN') : '—'}
                color="blue"
              />
              <QuickInfoCard
                icon={Shield}
                label="Trạng thái"
                value={currentStatus.label}
                color="emerald"
              />
            </div>

            {/* Verification Badge */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[28px] p-7 text-white shadow-xl shadow-indigo-500/20">
              <div className="relative z-10 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Shield size={24} />
                </div>
                <h3 className="font-black text-lg">Xác minh doanh nghiệp</h3>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  Hồ sơ công ty đã được xác minh và kích hoạt trên hệ thống KPI Tracking.
                </p>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest pt-1">
                  <CheckCircle2 size={16} /> Đã xác minh
                </div>
              </div>
              <Globe size={160} className="absolute -bottom-14 -right-14 opacity-[0.08]" />
            </div>
          </div>

          {/* Detail Info */}
          <div className="lg:col-span-2 space-y-6">

            {/* Contact Section */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-8 space-y-6">
              <SectionHeader label="Thông tin liên hệ" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoCard icon={Mail} iconColor="text-blue-500" iconBg="bg-blue-50 dark:bg-blue-900/20" label="Email doanh nghiệp" value={company.email} />
                <InfoCard icon={Phone} iconColor="text-emerald-500" iconBg="bg-emerald-50 dark:bg-emerald-900/20" label="Số điện thoại" value={company.phone} />
                <InfoCard icon={ReceiptText} iconColor="text-amber-500" iconBg="bg-amber-50 dark:bg-amber-900/20" label="Mã số thuế" value={company.taxCode} />
                <InfoCard icon={Building2} iconColor="text-indigo-500" iconBg="bg-indigo-50 dark:bg-indigo-900/20" label="Tên công ty" value={company.name} />
              </div>
            </div>

            {/* Address Section */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-8 space-y-6">
              <SectionHeader label="Trụ sở & Vị trí" />
              <div className="flex gap-5 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center shrink-0 text-amber-500 group-hover:scale-105 transition-transform">
                  <MapPin size={28} />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Địa chỉ văn phòng</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
                    {company.address || 'Chưa cập nhật'}
                  </p>
                  {(company.districtName || company.provinceName) && (
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      {[company.districtName, company.provinceName].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-8 space-y-6">
              <SectionHeader label="Thông tin hệ thống" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ngày tạo</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{company.createdAt ? formatDateTime(company.createdAt) : '—'}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cập nhật lần cuối</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{company.updatedAt ? formatDateTime(company.updatedAt) : '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== Sub Components ========== */

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1 w-8 bg-indigo-500 rounded-full" />
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</h3>
    </div>
  )
}

function InfoCard({ icon: Icon, iconColor, iconBg, label, value }: {
  icon: any; iconColor: string; iconBg: string; label: string; value: string | null
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all group">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

function QuickInfoCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
  }
  return (
    <div className={`p-4 rounded-2xl border ${colors[color]} space-y-2`}>
      <Icon size={18} />
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  )
}

/* ========== Edit Form ========== */

function CompanyEditForm({ company, onCancel, onSaved }: { company: Company; onCancel: () => void; onSaved: () => void }) {
  const { register, handleSubmit, watch, setValue } = useForm<UpdateCompanyRequest>({
    defaultValues: {
      name: company.name,
      taxCode: company.taxCode ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
      provinceId: company.provinceId ?? '',
      districtId: company.districtId ?? '',
    },
  })

  const provinceId = watch('provinceId')
  const { data: provinces } = useProvinces()
  const { data: districts } = useDistricts(provinceId ?? null)

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCompanyRequest) => companyApi.update(data),
    onSuccess: () => { toast.success('Hồ sơ công ty đã được cập nhật'); onSaved() },
    onError: () => toast.error('Lỗi kết nối máy chủ'),
  })

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"

  return (
    <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-8">
      {/* Company Name */}
      <FormField label="Tên pháp nhân công ty" icon={Building2} full>
        <input {...register('name')} className={inputCls} placeholder="Công ty TNHH ABC" />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Mã số thuế" icon={ReceiptText}>
          <input {...register('taxCode')} className={inputCls} placeholder="0101234567" />
        </FormField>
        <FormField label="Số điện thoại" icon={Phone}>
          <input {...register('phone')} className={inputCls} placeholder="028 xxxx yyyy" />
        </FormField>
      </div>

      <FormField label="Email doanh nghiệp" icon={Mail} full>
        <input {...register('email')} type="email" className={inputCls} placeholder="info@company.com" />
      </FormField>

      {/* Address Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-1 w-6 bg-indigo-500 rounded-full" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Vị trí trụ sở</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 space-y-4">
          <FormField label="Địa chỉ chi tiết" icon={MapPin}>
            <input {...register('address')} className={inputCls} placeholder="Số nhà, tên đường, tòa nhà..." />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">Tỉnh / Thành phố</label>
              <select
                {...register('provinceId')}
                onChange={(e) => { setValue('provinceId', e.target.value); setValue('districtId', '') }}
                className={inputCls}
              >
                <option value="">— Chọn Tỉnh/TP —</option>
                {provinces?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">Quận / Huyện</label>
              <select {...register('districtId')} className={inputCls} disabled={!provinceId}>
                <option value="">— Chọn Quận/Huyện —</option>
                {districts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="px-8 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Lưu hồ sơ
        </button>
      </div>
    </form>
  )
}

function FormField({ label, icon: Icon, children, full }: { label: string; icon: any; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("space-y-2", full && "md:col-span-2")}>
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        <Icon size={13} /> {label}
      </label>
      {children}
    </div>
  )
}