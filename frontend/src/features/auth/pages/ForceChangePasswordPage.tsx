import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { 
  Lock, Eye, EyeOff, Save, Loader2, ShieldCheck, 
  KeyRound, Wand2, Check, CheckCircle2, X, LogOut, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ForceChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()

  if (user && !user.requirePasswordChange) {
    return <Navigate to="/dashboard" replace />
  }
  const { register, handleSubmit, watch, control, setValue, setError, formState: { errors } } = useForm<{
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

  const mutation = useMutation({
    mutationFn: (data: any) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Mật khẩu đã được cập nhật thành công!')
      if (user) {
        setUser({ ...user, requirePasswordChange: false })
      }
      navigate('/dashboard', { replace: true })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.'
      if (message.includes('Mật khẩu hiện tại')) {
        setError('currentPassword', { type: 'manual', message: message })
      } else {
        toast.error(message)
      }
    },
  })

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-xl animate-in fade-in zoom-in duration-500">
        <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-[28px] bg-indigo-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/40 rotate-3 hover:rotate-0 transition-transform duration-500">
              <ShieldCheck size={44} strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Thiết lập mật khẩu mới</h1>
              <p className="text-slate-500 text-sm font-medium px-8 leading-relaxed">
                Xin chào <span className="text-indigo-600 font-bold">{user?.fullName}</span>. Vì đây là lần đầu bạn tham gia hệ thống, hãy đặt mật khẩu riêng để bảo vệ tài khoản của mình.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-8 md:p-10 space-y-6">
            <div className="space-y-5">
              {/* Current Password */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Mật khẩu tạm thời</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <KeyRound size={18} />
                  </div>
                  <input
                    {...register('currentPassword', { required: 'Vui lòng nhập mật khẩu hiện tại' })}
                    type={showCurrent ? 'text' : 'password'}
                    className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    placeholder="Nhập mật khẩu bạn được cấp"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-indigo-500 transition-all"
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.currentPassword && <p className="text-red-500 text-xs font-medium pl-1 mt-1">{errors.currentPassword.message}</p>}
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Mật khẩu cá nhân mới</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    {...register('newPassword', {
                      required: 'Vui lòng nhập mật khẩu mới',
                      minLength: { value: 8, message: 'Tối thiểu 8 ký tự' },
                      validate: (v) => v !== watch('currentPassword') || 'Mật khẩu mới phải khác mật khẩu hiện tại',
                    })}
                    type={showNew ? 'text' : 'password'}
                    className="w-full pl-12 pr-28 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    placeholder="Đặt mật khẩu bảo mật của bạn"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="px-2 py-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 transition-all"
                    >
                      <Wand2 size={14} /> Gợi ý
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 transition-all"
                    >
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Match Current Password Error */}
                {pwd && watch('currentPassword') && pwd === watch('currentPassword') && (
                  <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-[11px] font-bold bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-100 dark:border-red-500/20 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={14} />
                    Mật khẩu mới không được giống mật khẩu tạm thời
                  </div>
                )}

                {/* Strength Meter */}
                {pwd && (
                  <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-3">
                      <span className="text-slate-400">Độ mạnh mật khẩu</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800",
                        strengthScore <= 2 ? "text-red-500" : strengthScore <= 4 ? "text-amber-500" : "text-emerald-500"
                      )}>
                        {strengthScore <= 2 ? "Yếu" : strengthScore <= 4 ? "Trung bình" : "Mạnh"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "h-full flex-1 rounded-full transition-all duration-500",
                            strengthScore >= idx 
                              ? (strengthScore <= 2 ? "bg-red-500" : strengthScore <= 4 ? "bg-amber-500" : "bg-emerald-500") 
                              : "bg-transparent"
                          )} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Xác nhận mật khẩu</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <CheckCircle2 size={18} />
                  </div>
                  <input
                    {...register('confirmPassword', {
                      required: 'Vui lòng xác nhận mật khẩu',
                      validate: (v) => v === watch('newPassword') || 'Mật khẩu không khớp',
                    })}
                    type={showConfirm ? 'text' : 'password'}
                    className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-indigo-500 transition-all"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPwd && (
                  <div className={cn(
                    "mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-[11px] font-bold animate-in fade-in slide-in-from-top-1",
                    pwd === confirmPwd 
                      ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-100 dark:border-emerald-500/20" 
                      : "bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-100 dark:border-red-500/20"
                  )}>
                    {pwd === confirmPwd ? <Check size={14} /> : <X size={14} />}
                    {pwd === confirmPwd ? "Mật khẩu đã trùng khớp" : "Mật khẩu chưa khớp nhau"}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-4">
              <button
                type="submit"
                disabled={mutation.isPending || pwd !== confirmPwd || strengthScore < 3 || pwd === watch('currentPassword')}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {mutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Cập nhật & Bắt đầu sử dụng
              </button>

              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 text-sm font-bold transition-all py-2"
              >
                <LogOut size={16} /> Thoát tài khoản
              </button>
            </div>
          </form>
        </div>
        
        <p className="mt-8 text-center text-slate-400 text-xs font-medium">
          Hệ thống Quản trị KPI & Phân tích hiệu suất © 2026
        </p>
      </div>
    </div>
  )
}
