import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>()

  const mutation = useMutation({
    mutationFn: (data: { email: string }) => authApi.forgotPassword(data),
    onSuccess: () => { 
      toast.success('Đã gửi mã khôi phục mật khẩu! Vui lòng kiểm tra email.')
      navigate('/reset-password')
    },
    onError: () => toast.error('Gửi email thất bại, vui lòng kiểm tra lại địa chỉ.'),
  })

  const inputCls = "w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-3xl font-extrabold tracking-tight text-[var(--color-foreground)] mb-2">Khôi phục Mật khẩu</h2>
        <p className="text-[var(--color-muted-foreground)]">Đừng lo lắng, chúng tôi sẽ giúp bạn lấy lại quyền truy cập ngay thôi.</p>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--color-foreground)]">Địa chỉ Email liên kết</label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input {...register('email', { required: 'Vui lòng cung cấp địa chỉ email' })} type="email" placeholder="name@company.com" className={inputCls} />
          </div>
          {errors.email && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.email.message}</p>}
        </div>

        <button type="submit" disabled={mutation.isPending} className="w-full py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:shadow-lg hover:shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2">
          {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
          Gửi Email Khôi phục
        </button>
      </form>

      <div className="mt-8 text-center lg:text-left">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] font-semibold hover:text-[var(--color-foreground)] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          Trở lại trình Đăng nhập
        </Link>
      </div>
    </div>
  )
}
