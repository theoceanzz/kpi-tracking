import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forceChangePasswordSchema, type ForceChangePasswordFormData } from '@/features/auth/schemas/authSchema'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { 
  Lock, Eye, EyeOff, Save, Loader2, ShieldCheck, 
  Wand2, Check, CheckCircle2, X, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export default function ForceChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  // useAuth.logout gọi API để backend xoá cookie phiên; logout của store chỉ dọn state cục bộ.
  const { logout } = useAuth()

  const { register, handleSubmit, control, setValue } = useForm<ForceChangePasswordFormData>({
    resolver: zodResolver(forceChangePasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

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
      const message = getApiErrorMessage(error, 'Đổi mật khẩu thất bại. Vui lòng thử lại.')
      toast.error(message)
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

  // Chuyển hướng đặt SAU toàn bộ hook, không phải trước.
  //
  // Đổi mật khẩu thành công sẽ gọi `setUser({ ...user, requirePasswordChange: false })`, tức
  // chính điều kiện này lật ngay trong lúc component còn gắn. Nếu `return` nằm trên các hook thì
  // lượt render kế tiếp chạy ít hook hơn lượt trước — React ném "Rendered fewer hooks than
  // expected" và cả trang trắng đúng vào giây người dùng vừa đổi xong mật khẩu.
  if (user && !user.requirePasswordChange) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-[var(--color-muted)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-primary)]"/>

      <div className="w-full max-w-xl animate-in fade-in zoom-in duration-500">
        <div className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center space-y-4">
            <div className="w-20 h-20 rounded-card bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-foreground)] mx-auto rotate-3 hover:rotate-0 transition-transform duration-500">
              <ShieldCheck size={44} strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h1 className="text-page-title text-[var(--color-foreground)]">Thiết lập mật khẩu mới</h1>
              <p className="text-[var(--color-muted-foreground)] text-sm font-medium px-8 leading-relaxed">
                Xin chào <span className="text-[var(--color-primary)] font-semibold">{user?.fullName}</span>. Vì đây là lần đầu bạn tham gia hệ thống, hãy đặt mật khẩu riêng để bảo vệ tài khoản của mình.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-8 md:p-10 space-y-6">
            <div className="space-y-5">
              {/* New Password */}
              <div className="space-y-2">
                <label className="text-label tracking-widest ml-1">Mật khẩu cá nhân mới</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    {...register('newPassword')}
                    type={showNew ? 'text' : 'password'}
                    className="w-full pl-12 pr-28 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] transition-all"
                    placeholder="Đặt mật khẩu bảo mật của bạn"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="ghost" size="sm" type="button" onClick={generatePassword}>
                      <Wand2 aria-hidden="true" /> Gợi ý
                    </Button>
                    <Button variant="ghost" type="button" onClick={() => setShowNew(!showNew)}>
                      {showNew ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </Button>
                  </div>
                </div>

                {/* Strength Meter */}
                {pwd && (
                  <div className="mt-3 p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="text-eyebrow flex justify-between items-center mb-3">
                      <span className="text-[var(--color-subtle-foreground)]">Độ mạnh mật khẩu</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full bg-[var(--color-card)] shadow-sm border border-[var(--color-border)]",
                        strengthScore <= 2 ? "text-[var(--color-error)]" : strengthScore <= 4 ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"
                      )}>
                        {strengthScore <= 2 ? "Yếu" : strengthScore <= 4 ? "Trung bình" : "Mạnh"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <div 
                          key={idx} 
                          className={cn(
                            "h-full flex-1 rounded-full transition-all duration-500",
                            strengthScore >= idx 
                              ? (strengthScore <= 2 ? "bg-[var(--color-error-solid)]" : strengthScore <= 4 ? "bg-[var(--color-warning-solid)]" : "bg-[var(--color-success-solid)]") 
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
                <label className="text-label tracking-widest ml-1">Xác nhận mật khẩu</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <CheckCircle2 size={18} />
                  </div>
                  <input
                    {...register('confirmPassword')}
                    type={showConfirm ? 'text' : 'password'}
                    className="w-full pl-12 pr-12 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] transition-all"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-primary)] transition-all"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPwd && (
                  <div className={cn(
                    "mt-2 px-3 py-2 rounded-card flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-1",
                    pwd === confirmPwd 
                      ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]" 
                      : "bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]"
                  )}>
                    {pwd === confirmPwd ? <Check size={14} /> : <X size={14} />}
                    {pwd === confirmPwd ? "Mật khẩu đã trùng khớp" : "Mật khẩu chưa khớp nhau"}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={mutation.isPending || pwd !== confirmPwd || strengthScore < 3}>
                {mutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                Cập nhật & Bắt đầu sử dụng
              </Button>

              <Button variant="ghost" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" type="button" onClick={logout}>
                <LogOut aria-hidden="true" /> Thoát tài khoản
              </Button>
            </div>
          </form>
        </div>
        
        <p className="mt-8 text-center text-[var(--color-subtle-foreground)] text-xs font-medium">
          Hệ thống Quản trị KPI & Phân tích hiệu suất © 2026
        </p>
      </div>
    </div>
  )
}
