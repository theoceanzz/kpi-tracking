import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import StatusBadge from '@/components/common/StatusBadge'
import { useCompany } from '../hooks/useCompany'
import { companyApi } from '../api/companyApi'
import { useProvinces, useDistricts } from '@/features/provinces/hooks/useProvinces'
import { toast } from 'sonner'
import { Pencil, Loader2, Building, Mail, Phone, MapPin, ReceiptText, Globe } from 'lucide-react'
import type { UpdateCompanyRequest } from '@/types/company'
import { cn } from '@/lib/utils'

export default function CompanySettingsPage() {
  const { data: company, isLoading } = useCompany()
  const [editing, setEditing] = useState(false)
  const qc = useQueryClient()

  if (isLoading) return <div className="p-6"><LoadingSkeleton type="form" rows={5} /></div>
  if (!company) return null

  return (
    // Thêm padding cho container để không chạm mép Sidebar/màn hình
    <div className="container mx-auto p-4 md:p-8 max-w-5xl space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title="Hồ sơ Công ty" 
        description="Quản lý thông tin định danh và thông tin liên hệ chính thức của doanh nghiệp." 
        action={
          !editing && (
            <button 
              onClick={() => setEditing(true)} 
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-all shadow-md font-semibold text-sm"
            >
              <Pencil size={16} /> Chỉnh sửa hồ sơ
            </button>
          )
        } 
      />

      <div className="rounded-3xl bg-[var(--color-card)] border border-[var(--color-border)] shadow-xl overflow-hidden">
        {/* Cover illustration - Tăng chiều cao để không bị ngộp */}
        <div className="h-40 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent w-full relative border-b border-[var(--color-border)]/50">
           <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--color-primary) 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        </div>
        
        {/* Company Avatar & Title Section */}
        <div className="px-6 md:px-10 flex flex-col md:flex-row items-start md:items-end -mt-16 mb-8 gap-5">
           <div className="w-32 h-32 rounded-3xl bg-[var(--color-card)] shadow-2xl border-4 border-[var(--color-card)] flex items-center justify-center relative z-20 shrink-0 overflow-hidden ring-1 ring-black/5">
              <div className="w-full h-full bg-[var(--color-primary)]/5 flex items-center justify-center">
                <Building size={48} className="text-[var(--color-primary)]" />
              </div>
           </div>
           <div className="flex-1 pb-2 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                 <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-foreground)]">{company.name}</h1>
                 <StatusBadge status={company.status} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-muted-foreground)]">
                 <span className="flex items-center gap-1.5 bg-[var(--color-muted)] px-3 py-1 rounded-full font-medium">
                    <ReceiptText size={14} className="text-[var(--color-primary)]" /> 
                    MST: <span className="text-[var(--color-foreground)]">{company.taxCode || 'N/A'}</span>
                 </span>
                 <span className="flex items-center gap-1.5">
                    <Globe size={14} /> Trụ sở chính
                 </span>
              </div>
           </div>
        </div>

        {editing ? (
          <div className="px-6 md:px-10 pb-10 pt-6 border-t border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/5">
            <div className="mb-6">
               <h3 className="text-lg font-bold">Cập nhật thông tin</h3>
               <p className="text-sm text-[var(--color-muted-foreground)]">Vui lòng kiểm tra kỹ thông tin trước khi lưu.</p>
            </div>
            <CompanyEditForm company={company} onCancel={() => setEditing(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['company'] }); setEditing(false) }} />
          </div>
        ) : (
          <div className="px-6 md:px-10 pb-12 pt-4">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Liên hệ */}
                <div className="space-y-6">
                   <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--color-primary)]">Thông tin liên hệ</h3>
                   <div className="space-y-5">
                      <ContactItem icon={<Mail />} label="Email doanh nghiệp" value={company.email} color="blue" />
                      <ContactItem icon={<Phone />} label="Số điện thoại" value={company.phone} color="emerald" />
                   </div>
                </div>
                
                {/* Địa chỉ */}
                <div className="space-y-6">
                   <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--color-primary)]">Địa điểm</h3>
                   <div className="flex gap-4 p-5 rounded-2xl bg-[var(--color-muted)]/30 border border-[var(--color-border)]/50">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-600">
                         <MapPin size={22} />
                      </div>
                      <div className="space-y-1">
                         <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Địa chỉ đăng ký</p>
                         <p className="text-[var(--color-foreground)] font-semibold leading-relaxed">
                           {company.address || 'Chưa cập nhật'}
                           <span className="block text-sm font-normal text-[var(--color-muted-foreground)] mt-1">
                             {[company.districtName, company.provinceName].filter(Boolean).join(', ')}
                           </span>
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Component nhỏ hỗ trợ hiển thị item liên hệ để code sạch hơn
function ContactItem({ icon, label, value, color }: { icon: any, label: string, value: string | null, color: string }) {
   const colors: any = {
      blue: "bg-blue-500/10 text-blue-600",
      emerald: "bg-emerald-500/10 text-emerald-600"
   }
   return (
      <div className="flex items-center gap-4 group transition-all">
         <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", colors[color])}>
            {icon}
         </div>
         <div>
            <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">{label}</p>
            <p className="text-[var(--color-foreground)] font-bold text-lg">{value || '—'}</p>
         </div>
      </div>
   )
}

function CompanyEditForm({ company, onCancel, onSaved }: { company: any; onCancel: () => void; onSaved: () => void }) {
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
    onSuccess: () => { toast.success('Cập nhật thành công'); onSaved() },
    onError: () => toast.error('Cập nhật thất bại'),
  })

  const inputCls = "w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"

  return (
    <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold ml-1">Tên công ty <span className="text-red-500">*</span></label>
          <input {...register('name')} className={inputCls} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold ml-1">Mã số thuế</label>
          <input {...register('taxCode')} className={inputCls} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold ml-1">Email</label>
          <input {...register('email')} type="email" className={inputCls} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold ml-1">Số điện thoại</label>
          <input {...register('phone')} className={inputCls} />
        </div>
      </div>

      <div className="bg-[var(--color-background)] p-6 rounded-2xl border border-[var(--color-border)] space-y-5 shadow-inner">
        <div className="flex items-center gap-2 text-[var(--color-primary)] font-bold italic mb-2">
           <MapPin size={18} /> Địa chỉ trụ sở
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-bold text-[var(--color-muted-foreground)] ml-1">Địa chỉ chi tiết</label>
          <input {...register('address')} className={inputCls} placeholder="Số nhà, tên đường..." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--color-muted-foreground)] ml-1">Tỉnh/Thành phố</label>
            <select 
               {...register('provinceId')} 
               onChange={(e) => { setValue('provinceId', e.target.value); setValue('districtId', '') }} 
               className={inputCls}
            >
              <option value="">Chọn Tỉnh/Thành phố</option>
              {provinces?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--color-muted-foreground)] ml-1">Quận/Huyện</label>
            <select {...register('districtId')} className={inputCls} disabled={!provinceId}>
              <option value="">Chọn Quận/Huyện</option>
              {districts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-6">
        <button 
           type="button" 
           onClick={onCancel} 
           className="px-8 py-3 rounded-xl text-sm font-bold border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors flex-1 sm:flex-none"
        >
          Hủy bỏ
        </button>
        <button 
           type="submit" 
           disabled={updateMutation.isPending} 
           className="px-8 py-3 rounded-xl text-sm font-bold bg-[var(--color-primary)] text-white hover:opacity-90 shadow-lg shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none"
        >
          {updateMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
          Lưu thay đổi
        </button>
      </div>
    </form>
  )
}