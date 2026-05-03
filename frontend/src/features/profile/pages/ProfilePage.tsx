import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getInitials } from '@/lib/utils'
import { ROLE_MAP } from '@/constants/roles'
import { useForm, useWatch } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api/authApi'
import { userApi } from '@/features/users/api/userApi'
import { toast } from 'sonner'
import {
  User, Mail, Phone, Building2, Shield,
  CheckCircle2, UserCircle2, Loader2, Pencil, X, Save,
  Eye, EyeOff, Lock, Camera, Wand2, Check, KeyRound
} from 'lucide-react'


export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'info'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return authApi.uploadAvatar(formData)
    },
    onSuccess: (updatedUser) => {
      toast.success('Cập nhật ảnh đại diện thành công')
      setUser(updatedUser)
    },
    onError: () => toast.error('Lỗi khi tải ảnh lên'),
  })

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) return toast.error('Kích thước file không vượt quá 5MB')
      uploadAvatarMutation.mutate(file)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-[1100px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">

      {/* Hero Banner */}
      <div className="relative rounded-[28px] overflow-hidden shadow-xl">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgMHYyaC0ydi0yaDJ6bTQgMGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <div className="relative z-10 px-8 py-10 md:px-12 md:py-14">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar */}
            <div className="relative group cursor-pointer" onClick={() => !uploadAvatarMutation.isPending && fileInputRef.current?.click()}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-28 h-28 rounded-[32px] object-cover shadow-2xl ring-4 ring-white/30" />
              ) : (
                <div className="w-28 h-28 rounded-[32px] bg-white shadow-2xl flex items-center justify-center text-4xl font-black text-indigo-600 ring-4 ring-white/30">
                  {getInitials(user.fullName)}
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/40 rounded-[32px] items-center justify-center hidden group-hover:flex transition-all">
                <Camera size={24} className="text-white" />
              </div>

              <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-white z-10">
                <CheckCircle2 size={18} className="text-white" />
              </div>

              {uploadAvatarMutation.isPending && (
                <div className="absolute inset-0 bg-white/60 rounded-[32px] flex items-center justify-center backdrop-blur-sm z-20">
                  <Loader2 size={24} className="text-indigo-600 animate-spin" />
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarSelect}
              />
            </div>

            {/* Info */}
            <div className="text-center md:text-left flex-1 text-white">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{user.fullName}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold">
                  <Shield size={14} /> {user.memberships?.[0]?.roleLabel || ROLE_MAP[user.roles?.[0] || ''] || user.roles?.[0] || 'N/A'}
                </span>
                <span className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold">
                  <Building2 size={14} /> {user.memberships?.[0]?.orgUnitName || 'N/A'}
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-500/30 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold">
                  <CheckCircle2 size={14} /> Đang hoạt động
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2">
          <NavTab
            active={currentTab === 'info'}
            onClick={() => setSearchParams({ tab: 'info' })}
            icon={UserCircle2}
            label="Thông tin cá nhân"
            description="Hồ sơ & liên hệ"
          />
          <NavTab
            active={currentTab === 'security'}
            onClick={() => setSearchParams({ tab: 'security' })}
            icon={KeyRound}
            label="Bảo mật"
            description="Mật khẩu & xác thực"
          />
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {currentTab === 'info' ? (
            <ProfileInfoTab user={user} onUserUpdate={setUser} />
          ) : (
            <SecurityTab />
          )}
        </div>
      </div>
    </div>
  )
}

/* ========== Nav Tab ========== */
function NavTab({ active, onClick, icon: Icon, label, description }: {
  active: boolean; onClick: () => void; icon: any; label: string; description: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all ${
        active
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 text-slate-700 dark:text-slate-300'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
        <Icon size={20} className={active ? 'text-white' : 'text-slate-500'} />
      </div>
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className={`text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>{description}</p>
      </div>
    </button>
  )
}

/* ========== Profile Info Tab ========== */
function ProfileInfoTab({ user, onUserUpdate }: { user: any; onUserUpdate: (u: any) => void }) {
  const [editing, setEditing] = useState(false)
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      fullName: user.fullName ?? '',
      phone: user.phone ?? '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { fullName: string; phone: string }) => userApi.update(user.id, data),
    onSuccess: (updated) => {
      toast.success('Hồ sơ đã được cập nhật')
      onUserUpdate({ ...user, fullName: updated.fullName, phone: updated.phone })
      setEditing(false)
    },
    onError: () => toast.error('Cập nhật thất bại'),
  })

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <User size={20} />
          </div>
          <div>
            <h2 className="font-black text-lg text-slate-900 dark:text-white">Thông tin cá nhân</h2>
            <p className="text-xs font-medium text-slate-500">Thông tin hồ sơ và liên hệ của bạn</p>
          </div>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <Pencil size={14} /> Chỉnh sửa
          </button>
        ) : (
          <button onClick={() => { setEditing(false); reset() }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-8">
        {editing ? (
          <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6 max-w-lg animate-in fade-in duration-300">
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <User size={13} /> Họ và tên
              </label>
              <input
                {...register('fullName')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <Phone size={13} /> Số điện thoại
              </label>
              <input
                {...register('phone')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                placeholder="0912 345 678"
              />
            </div>

            {/* Non-editable fields */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <Mail size={13} /> Email <span className="text-[10px] ml-1 opacity-60">(không thể thay đổi)</span>
              </label>
              <div className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-500 cursor-not-allowed">
                {user.email}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => { setEditing(false); reset() }} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Hủy
              </button>
              <button type="submit" disabled={updateMutation.isPending} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-300">
            <InfoField icon={User} iconColor="text-indigo-500" iconBg="bg-indigo-50 dark:bg-indigo-900/20" label="Họ và tên" value={user.fullName} />
            <InfoField icon={Mail} iconColor="text-blue-500" iconBg="bg-blue-50 dark:bg-blue-900/20" label="Địa chỉ Email" value={user.email} />
            <InfoField icon={Phone} iconColor="text-emerald-500" iconBg="bg-emerald-50 dark:bg-emerald-900/20" label="Số điện thoại" value={user.phone || 'Chưa cập nhật'} />
            <InfoField icon={Building2} iconColor="text-amber-500" iconBg="bg-amber-50 dark:bg-amber-900/20" label="Đơn vị" value={`${user.memberships?.[0]?.orgUnitName || 'Chưa cập nhật'}${user.memberships?.[0]?.unitTypeLabel ? ` (${user.memberships[0].unitTypeLabel})` : ''}`} />
            <InfoField icon={Shield} iconColor="text-purple-500" iconBg="bg-purple-50 dark:bg-purple-900/20" label="Chức vụ" value={user.memberships?.[0]?.roleLabel || ROLE_MAP[user.roles?.[0] || ''] || user.roles?.[0] || 'N/A'} />
            <InfoField icon={CheckCircle2} iconColor="text-emerald-500" iconBg="bg-emerald-50 dark:bg-emerald-900/20" label="Trạng thái" value="Đang hoạt động" />
          </div>
        )}
      </div>
    </div>
  )
}

function InfoField({ icon: Icon, iconColor, iconBg, label, value }: {
  icon: any; iconColor: string; iconBg: string; label: string; value: string
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all group">
      <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{value}</p>
      </div>
    </div>
  )
}

/* ========== Security Tab ========== */
function SecurityTab() {
  const { register, handleSubmit, formState: { errors }, watch, control, setValue, reset } = useForm<{
    currentPassword: string; newPassword: string; confirmPassword: string
  }>()

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const pwd = useWatch({ control, name: 'newPassword', defaultValue: '' })
  const confirmPwd = useWatch({ control, name: 'confirmPassword', defaultValue: '' })

  const hasLength = pwd.length >= 8
  const hasUpper = /[A-Z]/.test(pwd)
  const hasLower = /[a-z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)

  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length

  let strengthLabel = 'Chưa nhập'
  let strengthColor = 'bg-gray-200 dark:bg-gray-700'
  let strengthTextColor = 'text-gray-400'

  if (pwd.length > 0) {
    if (strengthScore <= 2) {
      strengthLabel = 'Yếu'
      strengthColor = 'bg-red-500'
      strengthTextColor = 'text-red-500'
    } else if (strengthScore <= 3) {
      strengthLabel = 'Trung bình'
      strengthColor = 'bg-yellow-500'
      strengthTextColor = 'text-yellow-500'
    } else {
      strengthLabel = 'Mạnh'
      strengthColor = 'bg-emerald-500'
      strengthTextColor = 'text-emerald-500'
    }
  }

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let newPwd = 'A' + 'a' + '1' + '!' 
    for (let i = 0; i < 8; i++) {
      newPwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    newPwd = newPwd.split('').sort(() => 0.5 - Math.random()).join('')
    setValue('newPassword', newPwd, { shouldValidate: true })
    setValue('confirmPassword', newPwd, { shouldValidate: true })
    setShowNew(true)
    setShowConfirm(true)
  }

  const mutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => authApi.changePassword(data),
    onSuccess: () => { 
      toast.success('Đổi mật khẩu bảo mật thành công')
      reset()
      setShowCurrent(false); setShowNew(false); setShowConfirm(false) 
    },
    onError: () => toast.error('Đổi mật khẩu thất bại. Vui lòng kiểm tra mật khẩu hiện tại.'),
  })

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="font-black text-lg text-slate-900 dark:text-white">Bảo mật tài khoản</h2>
            <p className="text-xs font-medium text-slate-500">Quản lý mật khẩu và các thiết lập an toàn</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-lg space-y-8">
          {/* Security Alert */}
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3">
            <Shield size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 dark:text-indigo-300 leading-relaxed font-medium">
              Bạn nên đổi mật khẩu định kỳ 3 - 6 tháng một lần để đảm bảo an toàn tối đa cho tài khoản tổ chức.
            </div>
          </div>

          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  {...register('currentPassword', { required: 'Vui lòng nhập mật khẩu hiện tại' })}
                  type={showCurrent ? 'text' : 'password'}
                  className={inputCls + " pr-12"}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.currentPassword && <p className="text-red-500 text-xs font-medium pl-1">{errors.currentPassword.message}</p>}
            </div>

            {/* New Password */}
            <div className="space-y-3">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  {...register('newPassword', {
                    required: 'Vui lòng nhập mật khẩu mới',
                    minLength: { value: 8, message: 'Tối thiểu 8 ký tự' },
                    validate: (v) => v !== watch('currentPassword') || 'Mật khẩu mới phải khác mật khẩu hiện tại',
                  })}
                  type={showNew ? 'text' : 'password'}
                  className={inputCls + " pr-24"}
                  placeholder="Nhập ít nhất 8 ký tự an toàn"
                />
                
                {/* Suggestion Button */}
                <button
                  type="button"
                  onClick={generatePassword}
                  className="absolute inset-y-0 right-10 pr-1 flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors text-xs font-bold"
                  title="Gợi ý Mật khẩu"
                >
                  <Wand2 size={16} className="mr-0.5"/> Gợi ý
                </button>

                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Strength Meter & Checklist */}
              {pwd && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-2.5">
                    <span className="text-slate-400">Độ mạnh mật khẩu</span>
                    <span className={cn("px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 shadow-sm", strengthTextColor)}>{strengthLabel}</span>
                  </div>
                  
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex gap-1 mb-4">
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 1 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 2 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 4 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 5 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-[10px] font-bold text-slate-500">
                    <CheckItem condition={hasLength} label="8+ ký tự" />
                    <CheckItem condition={hasUpper && hasLower} label="Hoa & thường" />
                    <CheckItem condition={hasNumber} label="Có chữ số" />
                    <CheckItem condition={hasSpecial} label="Ký tự đặc biệt" />
                  </div>
                </div>
              )}
              {errors.newPassword && <p className="text-red-500 text-xs font-medium pl-1">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword', {
                    required: 'Vui lòng xác nhận mật khẩu',
                    validate: (v) => v === watch('newPassword') || 'Mật khẩu không khớp',
                  })}
                  type={showConfirm ? 'text' : 'password'}
                  className={inputCls + " pr-12"}
                  placeholder="Nhập lại mật khẩu khớp chính xác"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {confirmPwd && (
                <div className={cn(
                  "mt-2.5 px-3 py-2 rounded-xl flex items-center gap-2 text-[11px] font-bold animate-in fade-in slide-in-from-top-1 duration-200",
                  pwd === confirmPwd 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' 
                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20'
                )}>
                  {pwd === confirmPwd ? <CheckCircle2 size={14} /> : <X size={14} />}
                  <span>{pwd === confirmPwd ? 'Mật khẩu đã khớp nhau' : 'Hai mật khẩu chưa trùng khớp'}</span>
                </div>
              )}
              {errors.confirmPassword && !confirmPwd && <p className="text-red-500 text-xs font-medium pl-1">{errors.confirmPassword.message}</p>}
            </div>

            {/* Submit */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full md:w-auto px-10 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Cập nhật bảo mật
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function CheckItem({ condition, label }: { condition: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300",
        condition ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-200 dark:bg-slate-700 text-transparent"
      )}>
        <Check size={10} strokeWidth={4} />
      </div>
      <span className={cn("transition-colors duration-300", condition ? "text-slate-900 dark:text-white" : "text-slate-400")}>
        {label}
      </span>
    </div>
  )
}
