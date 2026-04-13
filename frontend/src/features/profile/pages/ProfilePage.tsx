import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { getInitials } from '@/lib/utils'
import { User, Mail, Phone, Building2, Shield, KeyRound, CheckCircle2, UserCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api/authApi'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'info'

  if (!user) return null

  const roleMap: Record<string, string> = { DIRECTOR: 'Giám đốc', HEAD: 'Trưởng phòng', DEPUTY_HEAD: 'Phó phòng', STAFF: 'Nhân viên' }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Cài đặt Tài khoản" description="Quản lý hồ sơ và bảo mật cá nhân của bạn" />

      {/* Hero Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-indigo-900/20 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center text-3xl font-black text-[var(--color-primary)] ring-4 ring-white/30">
            {getInitials(user.fullName)}
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{user.fullName}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-white/80 text-sm font-medium">
              <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full"><Shield size={14} /> {roleMap[user.role] ?? user.role}</span>
              <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full"><Building2 size={14} /> {user.companyName}</span>
              <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full"><CheckCircle2 size={14} className="text-emerald-400" /> Trạng thái hoạt động</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-1">
          <button 
            onClick={() => setSearchParams({ tab: 'info' })}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentTab === 'info' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'}`}
          >
            <UserCircle2 size={18} /> Thông tin cá nhân
          </button>
          <button 
            onClick={() => setSearchParams({ tab: 'security' })}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentTab === 'security' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'}`}
          >
            <KeyRound size={18} /> Bảo mật
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {currentTab === 'info' ? (
            <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden auto-animate">
              <div className="border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="text-lg font-semibold tracking-tight">Chi tiết hồ sơ</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] mb-1"><User size={14} /> Họ và Tên</p>
                  <p className="font-medium px-3 py-2 bg-[var(--color-muted)]/50 rounded-lg border border-[var(--color-border)]/50">{user.fullName}</p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] mb-1"><Mail size={14} /> Địa chỉ Email</p>
                  <p className="font-medium px-3 py-2 bg-[var(--color-muted)]/50 rounded-lg border border-[var(--color-border)]/50">{user.email}</p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] mb-1"><Phone size={14} /> Số điện thoại</p>
                  <p className="font-medium px-3 py-2 bg-[var(--color-muted)]/50 rounded-lg border border-[var(--color-border)]/50">{user.phone || 'Chưa cập nhật'}</p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] mb-1"><Building2 size={14} /> Công ty / Đơn vị</p>
                  <p className="font-medium px-3 py-2 bg-[var(--color-muted)]/50 rounded-lg border border-[var(--color-border)]/50">{user.companyName}</p>
                </div>
              </div>
            </div>
          ) : (
            <ChangePasswordTab />
          )}
        </div>
      </div>
    </div>
  )
}

function ChangePasswordTab() {
  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>()

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => authApi.changePassword(data),
    onSuccess: () => { toast.success('Đổi mật khẩu bảo mật thành công'); reset() },
    onError: () => toast.error('Đổi mật khẩu thất bại, vui lòng kiểm tra lại mật khẩu hiện tại.'),
  })

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-shadow"

  return (
    <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden auto-animate">
      <div className="border-b border-[var(--color-border)] px-6 py-4">
        <h2 className="text-lg font-semibold tracking-tight">Thiết lập Mật khẩu</h2>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Nên sử dụng mật khẩu mạnh với ít nhất 8 ký tự, bao gồm chữ cái và số.</p>
      </div>
      
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-6 space-y-6 max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Mật khẩu hiện tại</label>
            <input {...register('currentPassword', { required: 'Vui lòng nhập mật khẩu hiện tại' })} type="password" className={inputCls} placeholder="••••••••" />
            {errors.currentPassword && <p className="text-red-500 text-xs mt-1.5">{errors.currentPassword.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Mật khẩu mới</label>
              <input {...register('newPassword', { required: 'Vui lòng nhập mật khẩu mới', minLength: { value: 8, message: 'Tối thiểu 8 ký tự' } })} type="password" className={inputCls} placeholder="••••••••" />
              {errors.newPassword && <p className="text-red-500 text-xs mt-1.5">{errors.newPassword.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Xác nhận mật khẩu</label>
              <input {...register('confirmPassword', { required: 'Vui lòng xác nhận', validate: (v) => v === watch('newPassword') || 'Mật khẩu không khớp' })} type="password" className={inputCls} placeholder="••••••••" />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1.5">{errors.confirmPassword.message}</p>}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--color-border)]">
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-sm hover:opacity-90 hover:shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {mutation.isPending && <Loader2 size={16} className="animate-spin" />}
            Cập nhật Mật khẩu
          </button>
        </div>
      </form>
    </div>
  )
}
