import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../schemas/authSchema'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: { email: string }) => authApi.forgotPassword(data),
    onSuccess: () => { 
      toast.success('Đã gửi mã khôi phục mật khẩu! Vui lòng kiểm tra email.')
      navigate('/reset-password')
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gửi email thất bại, vui lòng kiểm tra lại địa chỉ.')),
  })

  const inputCls = "h-10 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-10 pr-12 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-page-title mb-1">Khôi phục mật khẩu</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">Đừng lo lắng, chúng tôi sẽ giúp bạn lấy lại quyền truy cập ngay thôi.</p>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <div className="space-y-2">
          <label className="text-label block">Email tài khoản</label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input {...register('email')} type="email" placeholder="name@company.com" className={inputCls} />
          </div>
          {errors.email && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.email.message}</p>}
        </div>

        <Button className="w-full mt-2" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Mail aria-hidden="true" />}
          Gửi email khôi phục
        </Button>
      </form>

      <div className="mt-8 text-center lg:text-left">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] font-medium hover:text-[var(--color-foreground)] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          Về trang đăng nhập
        </Link>
      </div>
    </div>
  )
}
