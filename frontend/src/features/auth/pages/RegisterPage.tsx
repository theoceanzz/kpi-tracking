import { useState } from 'react' // 1. Thêm useState
import { useForm, useWatch, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterFormData } from '../schemas/authSchema'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
// 2. Thêm Eye và EyeOff từ lucide-react
import { Loader2, Mail, Lock, Building2, User, Phone, Eye, EyeOff, Wand2, Check, Plus, Trash2, ChevronDown, ChevronUp, Layers } from 'lucide-react'

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const navigate = useNavigate()

  const { register, handleSubmit, control, setValue, setError, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      hierarchyLevels: [
        { unitTypeName: 'Chi nhánh', managerRoleLabel: 'Giám đốc chi nhánh' },
        { unitTypeName: 'Phòng ban', managerRoleLabel: 'Trưởng phòng' },
        { unitTypeName: 'Tổ', managerRoleLabel: 'Nhân viên' },
      ]
    }
  })

  const { fields, append, prepend, remove } = useFieldArray({
    control,
    name: 'hierarchyLevels'
  })

  const pwd = useWatch({ control, name: 'password', defaultValue: '' })

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
    let newPwd = 'A' + 'a' + '1' + '!' // Đảm bảo luôn có đủ loại
    for (let i = 0; i < 8; i++) {
      newPwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    newPwd = newPwd.split('').sort(() => 0.5 - Math.random()).join('')
    setValue('password', newPwd, { shouldValidate: true })
    setShowPassword(true)
  }

  const verifyMutation = useMutation({
    mutationFn: (token: string) => authApi.verifyEmail(token),
    onSuccess: () => {
      toast.success('Xác thực email thành công! Đang chuyển hướng...')
      setTimeout(() => navigate('/login'), 1500)
    },
    onError: () => {
      toast.error('Mã xác thực không hợp lệ hoặc đã hết hạn.')
    }
  })

  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authApi.register(data),
    onSuccess: (_, variables) => {
      // Xác nhận luồng: Bắt buộc người dùng phải verify email chứ ko tự động login nữa
      setRegisteredEmail(variables.email)
      setIsSuccess(true)
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || ''
      if (msg.toLowerCase().includes('email')) {
        setError('email', { type: 'server', message: 'Email này đã tồn tại trong hệ thống.' })
      } else if (msg.toLowerCase().includes('phone')) {
        setError('phone', { type: 'server', message: 'Số điện thoại này đã được tài khoản khác sử dụng.' })
      } else {
        toast.error('Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.')
      }
    },
  })

  const onSubmit = (data: RegisterFormData) => registerMutation.mutate(data)

  // Cập nhật pr-12 để text không đè lên icon mắt ở bên phải
  const inputCls = "w-full pl-10 pr-12 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"

  if (isSuccess) {
    return (
      <div className="w-full max-w-sm mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Mail className="text-emerald-500 w-10 h-10" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--color-foreground)] mb-3">Kiểm tra hộp thư</h2>
          <p className="text-[var(--color-muted-foreground)] mb-6 text-sm">
            Chúng tôi đã gửi một liên kết xác thực an toàn tới email<br/>
            <span className="font-bold text-[var(--color-foreground)] mt-2 block">{registeredEmail}</span>
          </p>
          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-medium text-left mb-8 space-y-2">
            <p>• Mã token gồm các dãy ký tự đã được tự động gửi vào email của bạn.</p>
            <p>• Nếu không thấy email, hãy kiểm tra lại mục Spam/Thư rác.</p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]/50 text-left">
            <p className="text-sm font-medium text-[var(--color-foreground)] mb-2">Hoặc nhập mã (token) trực tiếp vào đây:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Dán mã UUID..."
                className="flex-1 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              />
              <button
                onClick={() => {
                  if (!tokenInput.trim()) return toast.warning('Vui lòng nhập mã!')
                  verifyMutation.mutate(tokenInput.trim())
                }}
                disabled={verifyMutation.isPending}
                className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:shadow-md transition-all flex items-center justify-center min-w-[100px] disabled:opacity-50"
              >
                {verifyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Xác thực'}
              </button>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => navigate('/login')}
          className="w-full py-3.5 mt-2 rounded-xl bg-transparent border-2 border-[var(--color-primary)] text-[var(--color-primary)] font-bold hover:bg-[var(--color-primary)]/5 transition-all text-sm"
        >
          Trở về màn hình Đăng nhập
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-3xl font-extrabold tracking-tight text-[var(--color-foreground)] mb-2">Đăng ký Cấp Tổ chức</h2>
        <p className="text-[var(--color-muted-foreground)]">Thiết lập hệ thống quản trị mục tiêu chuyên nghiệp cho tổ chức.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Tên công ty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--color-foreground)]">Tên tổ chức <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 size={18} className="text-[var(--color-muted-foreground)]" />
              </div>
              <input {...register('organizationName')} className={inputCls} placeholder="VD: Tập đoàn Công nghệ Ánh Trăng" />
            </div>
            {errors.organizationName && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.organizationName.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--color-foreground)]">Mã tổ chức <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Wand2 size={18} className="text-[var(--color-muted-foreground)]" />
              </div>
              <input {...register('organizationCode')} className={inputCls} placeholder="VD: ABC_CORP" />
            </div>
            {errors.organizationCode && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.organizationCode.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {/* Họ tên */}
           <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--color-foreground)]">Họ và tên người đại diện</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <User size={18} className="text-[var(--color-muted-foreground)]" />
                </div>
                <input {...register('fullName')} className={inputCls} placeholder="Nguyễn Văn A" />
              </div>
              {errors.fullName && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.fullName.message}</p>}
           </div>

           {/* Số điện thoại */}
           <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--color-foreground)]">Số điện thoại</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <Phone size={18} className="text-[var(--color-muted-foreground)]" />
                </div>
                <input {...register('phone')} className={inputCls} placeholder="091xxx..." />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1.5 font-medium animate-in slide-in-from-top-1">{errors.phone.message}</p>}
           </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
           <label className="text-sm font-bold text-[var(--color-foreground)]">Email Quản trị viên <span className="text-red-500">*</span></label>
           <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input {...register('email')} type="email" className={inputCls} placeholder="admin@tochuc.com" />
           </div>
           {errors.email && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.email.message}</p>}
        </div>

        {/* Mật khẩu - Đã thêm ẩn hiện */}
        <div className="space-y-2">
           <label className="text-sm font-bold text-[var(--color-foreground)]">Mật khẩu truy cập <span className="text-red-500">*</span></label>
           <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-[var(--color-muted-foreground)]" />
             </div>
             <input 
              {...register('password')} 
              // Thay đổi type linh hoạt
              type={showPassword ? 'text' : 'password'} 
              className={inputCls + " pr-20"} // Tăng padding bên phải để chứa 2 nút
              placeholder="Bảo mật tối thiểu 8 ký tự" 
             />
             
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

            {errors.password && !pwd && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.password.message}</p>}
        </div>

        {/* CƠ CẤU TỔ CHỨC (NEW) */}
        <div className="space-y-4 pt-4 border-t border-[var(--color-border)]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-[var(--color-primary)]" />
              <h3 className="text-sm font-bold text-[var(--color-foreground)]">Thiết lập Cơ cấu tổ chức</h3>
            </div>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">Tối thiểu 3 cấp</span>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div 
                key={field.id} 
                className="group relative p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/10 hover:border-[var(--color-primary)]/30 transition-all animate-in slide-in-from-right-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1 mt-1">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                      {index + 1}
                    </div>
                    {index < fields.length - 1 && <div className="w-0.5 h-12 bg-gradient-to-b from-[var(--color-primary)] to-transparent opacity-20" />}
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider">Tên cấp bậc</label>
                      <input 
                        {...register(`hierarchyLevels.${index}.unitTypeName`)} 
                        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition-all"
                        placeholder={index === 0 ? "Tổng công ty" : "Tên đơn vị..."}
                      />
                      {errors.hierarchyLevels?.[index]?.unitTypeName && (
                        <p className="text-red-500 text-[10px] font-medium">{errors.hierarchyLevels[index]?.unitTypeName?.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                        {index === fields.length - 1 ? "Ghi chú (Tùy chọn)" : "Chức danh quản lý"}
                      </label>
                      <input 
                        {...register(`hierarchyLevels.${index}.managerRoleLabel`)} 
                        className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition-all disabled:opacity-50"
                        placeholder={index === fields.length - 1 ? "Cấp nhân viên thực thi" : "VD: Giám đốc, Trưởng phòng..."}
                      />
                    </div>
                  </div>

                  {fields.length > 3 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-6 p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => prepend({ unitTypeName: '', managerRoleLabel: '' })}
              className="flex-1 py-2.5 flex items-center justify-center gap-2 border-2 border-dashed border-indigo-200 dark:border-indigo-900/30 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 text-indigo-500 rounded-xl text-sm font-bold transition-all group"
            >
              <ChevronUp size={18} className="group-hover:-translate-y-1 transition-transform" />
              Thêm cấp bậc CHA
            </button>
            <button
              type="button"
              onClick={() => append({ unitTypeName: '', managerRoleLabel: '' })}
              className="flex-1 py-2.5 flex items-center justify-center gap-2 border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] rounded-xl text-sm font-bold transition-all group"
            >
              <ChevronDown size={18} className="group-hover:translate-y-1 transition-transform" />
              Thêm cấp bậc CON
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="w-full py-3.5 mt-4 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:shadow-lg hover:shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {registerMutation.isPending && <Loader2 size={18} className="animate-spin" />}
          Khởi tạo Hệ thống
        </button>
      </form>

      <div className="mt-8 text-center bg-[var(--color-muted)]/30 rounded-xl p-4 border border-[var(--color-border)]/50">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Đã có tài khoản tổ chức?{' '}
          <Link to="/login" className="text-[var(--color-foreground)] font-bold hover:text-[var(--color-primary)] transition-colors underline decoration-[var(--color-primary)]/30 underline-offset-4">
            Trở lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  )
}