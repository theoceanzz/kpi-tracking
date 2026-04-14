import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { toast } from 'sonner'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Loader2, Lock, ShieldCheck, Key, Eye, EyeOff, Wand2, Check, X } from 'lucide-react'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const urlToken = params.get('token') ?? ''
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const { register, handleSubmit, formState: { errors }, watch, control, setValue } = useForm<{ token: string; newPassword: string; confirmPassword: string }>({
    defaultValues: { token: urlToken }
  })

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
    setShowPassword(true)
    setShowConfirmPassword(true)
  }

  const mutation = useMutation({
    mutationFn: (data: { token: string; newPassword: string; confirmPassword: string }) =>
      authApi.resetPassword({ token: data.token, newPassword: data.newPassword, confirmPassword: data.confirmPassword }),
    onSuccess: () => { toast.success('Cập nhật mật khẩu bảo mật diện rộng thành công!'); navigate('/login') },
    onError: () => toast.error('Cập nhật thất bại. Vui lòng xác minh lại mã khôi phục.'),
  })

  const inputCls = "w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <div className="lg:hidden flex justify-center mb-6">
           <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex justify-center items-center">
              <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={24} />
           </div>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-[var(--color-foreground)] mb-2">Đặt lại Mật khẩu</h2>
        <p className="text-[var(--color-muted-foreground)]">Thiết lập mật khẩu mới mạnh mẽ cho tài khoản của bạn.</p>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--color-foreground)]">Mã khôi phục (Token) <span className="text-red-500">*</span></label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input {...register('token', { required: 'Vui lòng cung cấp mã khôi phục từ email' })} type="text" className={inputCls} placeholder="Dán mã UUID gồm các ký tự..." />
          </div>
          {errors.token && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.token.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--color-foreground)]">Thiết lập mật khẩu mới</label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input {...register('newPassword', { required: 'Vui lòng nhập mật khẩu', minLength: { value: 8, message: 'Yêu cầu mức độ bảm mật thiểu 8 ký tự' } })} type={showPassword ? 'text' : 'password'} className={inputCls + " pr-20"} placeholder="Nhập ít nhất 8 ký tự an toàn" />
             
             {/* Nút Gợi ý MK */}
             <button
              type="button"
              onClick={generatePassword}
              className="absolute inset-y-0 right-10 pr-1 flex items-center text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors text-xs font-semibold"
              title="Gợi ý Mật khẩu"
             >
                <Wand2 size={16} className="mr-0.5"/> Gợi ý
             </button>

             {/* Nút bật tắt ẩn hiện */}
             <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
             >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
             </button>
          </div>

          {/* ProgressBar & Logic hiển thị */}
          {pwd && (
            <div className="mt-2.5 p-3 rounded-lg bg-[var(--color-muted)]/30 border border-[var(--color-border)]/50 animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between items-center text-xs font-medium mb-2">
                 <span className="text-[var(--color-muted-foreground)]">Độ mạnh mật khẩu</span>
                 <span className={strengthTextColor}>{strengthLabel}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700/50 rounded-full overflow-hidden flex gap-1 mb-3">
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 1 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 2 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 4 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 5 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
              </div>
              
              <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-xs text-[var(--color-muted-foreground)]">
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasLength ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-transparent'}`}><Check size={10} strokeWidth={3}/></div>
                  <span className={hasLength ? "text-[var(--color-foreground)]" : ""}>8+ ký tự</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasUpper && hasLower ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-transparent'}`}><Check size={10} strokeWidth={3}/></div>
                  <span className={(hasUpper && hasLower) ? "text-[var(--color-foreground)]" : ""}>Chữ HOA & thường</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasNumber ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-transparent'}`}><Check size={10} strokeWidth={3}/></div>
                  <span className={hasNumber ? "text-[var(--color-foreground)]" : ""}>Có chữ số (0-9)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${hasSpecial ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-transparent'}`}><Check size={10} strokeWidth={3}/></div>
                  <span className={hasSpecial ? "text-[var(--color-foreground)]" : ""}>Ký tự đặc biệt (!@#...)</span>
                </div>
              </div>
            </div>
          )}

          {errors.newPassword && !pwd && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.newPassword.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--color-foreground)]">Xác nhận lại mật khẩu</label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ShieldCheck size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input {...register('confirmPassword', { required: 'Vui lòng xác minh bảo mật', validate: (v) => v === watch('newPassword') || 'Hai mật khẩu cung cấp không đồng nhất' })} type={showConfirmPassword ? 'text' : 'password'} className={inputCls + " pr-10"} placeholder="Nhập lại mật khẩu khớp chính xác" />
             
             {/* Nút bật tắt ẩn hiện */}
             <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
             >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
             </button>
          </div>
          
          {confirmPwd && (
            <div className={`mt-2 p-2 rounded-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-1 ${pwd === confirmPwd ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-red-50 dark:bg-red-500/10 text-red-600'}`}>
              {pwd === confirmPwd ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-red-500" />}
              <span>{pwd === confirmPwd ? '✓ Hai mật khẩu hoàn toàn khớp nhau' : '✗ Hai mật khẩu đang chưa trùng khớp'}</span>
            </div>
          )}
          {errors.confirmPassword && !confirmPwd && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" disabled={mutation.isPending} className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:shadow-lg hover:shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2">
          {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
          Hoàn tất Cập nhật
        </button>
      </form>

      <div className="mt-8 text-center text-sm">
        <Link to="/login" className="text-[var(--color-muted-foreground)] font-semibold hover:text-[var(--color-foreground)] transition-colors">
          Trở lại hệ thống chính
        </Link>
      </div>
    </div>
  )
}
