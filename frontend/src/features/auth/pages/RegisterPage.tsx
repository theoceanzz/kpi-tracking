import { useState, useRef } from 'react' // 1. Thêm useState
import { useForm, useWatch, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterFormData } from '../schemas/authSchema'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
// 2. Thêm Eye và EyeOff từ lucide-react
import { Loader2, Mail, Lock, Building2, User, Phone, Eye, EyeOff, Wand2, Check, Trash2, Layers, Settings2, Clock, ArrowUp, ArrowDown, Plus } from 'lucide-react'

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false) // Thêm state redirecting
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [registeredPassword, setRegisteredPassword] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [setupMode, setSetupMode] = useState<'LATER' | 'NOW'>('LATER')
  const navigate = useNavigate()

  const { register, handleSubmit, control, setValue, setError, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      hierarchyLevels: [
        { unitTypeName: 'Chi nhánh', managerRoleLabel: 'Giám đốc' },
        { unitTypeName: 'Nhóm', managerRoleLabel: 'Trưởng nhóm' },
      ]
    }
  })

  const { fields, append, remove, move } = useFieldArray({
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
      setIsRedirecting(true)
      toast.success('Xác thực email thành công!')
      setTimeout(() => navigate('/login', { 
        state: { email: registeredEmail, password: registeredPassword } 
      }), 2000)
    },
    onError: () => {
      toast.error('Mã xác thực không hợp lệ hoặc đã hết hạn.')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    }
  })

  const handleOtpChange = (index: number, value: string) => {
    const char = value.slice(-1).toUpperCase()
    if (!char.match(/[A-Z0-9]/) && char !== '') return

    const newOtp = [...otp]
    newOtp[index] = char
    setOtp(newOtp)

    if (char && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }

    const fullCode = newOtp.join('')
    if (fullCode.length === 6) {
      verifyMutation.mutate(fullCode)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const data = e.clipboardData.getData('text').trim().toUpperCase()
    if (data.length === 6) {
      const newOtp = data.split('')
      setOtp(newOtp)
      verifyMutation.mutate(data)
    }
  }

  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authApi.register(data),
    onSuccess: (_, variables) => {
      // Xác nhận luồng: Bắt buộc người dùng phải verify email chứ ko tự động login nữa
      setRegisteredEmail(variables.email)
      setRegisteredPassword(variables.password) // Lưu lại mật khẩu để sau này tự điền ở trang login
      setIsSuccess(true)
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || ''
      const lowerMsg = msg.toLowerCase()
      
      if (lowerMsg.includes('email')) {
        setError('email', { type: 'server', message: 'Email này đã tồn tại trong hệ thống.' })
      } else if (lowerMsg.includes('phone') || lowerMsg.includes('số điện thoại')) {
        setError('phone', { type: 'server', message: 'Số điện thoại này đã được tài khoản khác sử dụng.' })
      } else if (lowerMsg.includes('tổ chức') && lowerMsg.includes('tên')) {
        setError('organizationName', { type: 'server', message: 'Tên tổ chức này đã được đăng ký.' })
      } else if (lowerMsg.includes('tổ chức') && lowerMsg.includes('mã')) {
        setError('organizationCode', { type: 'server', message: 'Mã tổ chức này đã được đăng ký.' })
      } else {
        toast.error(msg || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.')
      }
    },
  })

  const onSubmit = (data: RegisterFormData) => registerMutation.mutate(data)

  // Cập nhật pr-12 để text không đè lên icon mắt ở bên phải
  const inputCls = "w-full pl-10 pr-12 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"

  // Màn hình loading chuyển hướng chuyên nghiệp
  if (isRedirecting) {
    return (
      <div className="w-full max-w-sm mx-auto text-center space-y-8 animate-in fade-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] animate-spin mx-auto" />
          <div className="absolute inset-0 flex items-center justify-center">
             <Check className="text-[var(--color-primary)] w-10 h-10 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-extrabold text-[var(--color-foreground)]">Xác thực thành công!</h2>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Tài khoản của bạn đã sẵn sàng. <br/>
            Đang chuyển hướng bạn đến trang đăng nhập...
          </p>
        </div>
        <div className="flex justify-center gap-1.5">
           <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce [animation-delay:-0.3s]" />
           <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce [animation-delay:-0.15s]" />
           <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-bounce" />
        </div>
      </div>
    )
  }

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
            <p>• Mã OTP xác thực đã được tự động gửi vào email của bạn.</p>
            <p>• Nếu không thấy email, hãy kiểm tra lại mục Spam/Thư rác.</p>
          </div>
          
          <div className="mt-6 pt-6 border-t border-[var(--color-border)]/50 text-left">
            <p className="text-sm font-bold text-[var(--color-foreground)] mb-4 text-center">Nhập mã xác thực (OTP)</p>
            <div className="flex justify-between gap-2 max-w-xs mx-auto mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpRefs.current[index] = el }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-11 h-14 text-center text-xl font-black rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-background)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all shadow-sm disabled:opacity-50"
                  autoFocus={index === 0}
                  disabled={verifyMutation.isPending}
                />
              ))}
            </div>

            {verifyMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-[var(--color-primary)] font-bold text-sm mb-6 animate-pulse">
                <Loader2 size={18} className="animate-spin" />
                Đang xác thực mã OTP...
              </div>
            )}

            {/* Nút xác thực đã được gỡ bỏ vì hệ thống tự động kiểm tra khi nhập đủ 6 ký tự */}

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

        {/* LỰA CHỌN THIẾT LẬP (NEW) */}
        <div className="space-y-3 pt-4 border-t border-[var(--color-border)]/50">
          <label className="text-sm font-bold text-[var(--color-foreground)] flex items-center gap-2 mb-1">
            <Settings2 size={18} className="text-[var(--color-primary)]" />
            Cơ cấu tổ chức
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSetupMode('LATER')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                setupMode === 'LATER' 
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-md shadow-[var(--color-primary)]/10' 
                  : 'border-[var(--color-border)] bg-transparent hover:border-[var(--color-primary)]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${setupMode === 'LATER' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
                  <Clock size={20} />
                </div>
                {setupMode === 'LATER' && (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
              </div>
              <h4 className={`text-sm font-bold mb-1 ${setupMode === 'LATER' ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}`}>
                Thiết lập sau
              </h4>
              <p className="text-[11px] text-[var(--color-muted-foreground)] leading-relaxed">
                Sử dụng cấu trúc mặc định (2 cấp: Chi nhánh & Team). Có thể chỉnh sửa sau trong cài đặt.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSetupMode('NOW')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                setupMode === 'NOW' 
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-md shadow-[var(--color-primary)]/10' 
                  : 'border-[var(--color-border)] bg-transparent hover:border-[var(--color-primary)]/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${setupMode === 'NOW' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
                  <Layers size={20} />
                </div>
                {setupMode === 'NOW' && (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
              </div>
              <h4 className={`text-sm font-bold mb-1 ${setupMode === 'NOW' ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}`}>
                Thiết lập ngay
              </h4>
              <p className="text-[11px] text-[var(--color-muted-foreground)] leading-relaxed">
                Tự định nghĩa các cấp bậc quản lý phù hợp với đặc thù vận hành của tổ chức.
              </p>
            </button>
          </div>
        </div>

        {/* CƠ CẤU TỔ CHỨC (MODIFIED) */}
        {setupMode === 'NOW' && (
          <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-sm font-bold text-[var(--color-foreground)]">Định nghĩa Cấp bậc</h3>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">Tối thiểu 2 cấp</span>
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
                          placeholder={index === 0 ? "VD: Chi nhánh" : "VD: Team, Tổ..."}
                        />
                        {errors.hierarchyLevels?.[index]?.unitTypeName && (
                          <p className="text-red-500 text-[10px] font-medium">{errors.hierarchyLevels[index]?.unitTypeName?.message}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                         Chức danh quản lý
                        </label>
                        <input 
                          {...register(`hierarchyLevels.${index}.managerRoleLabel`)} 
                          className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition-all disabled:opacity-50"
                          placeholder={index === fields.length - 1 ? "Cấp nhân viên thực thi" : "VD: Giám đốc, Trưởng phòng..."}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 ml-auto sm:ml-0">
                      {fields.length > 2 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                          title="Xóa cấp bậc"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      
                      <div className="flex flex-col gap-1 mt-auto">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                          className="p-1.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-all disabled:opacity-20 disabled:pointer-events-none"
                          title="Di chuyển lên"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                          className="p-1.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-all disabled:opacity-20 disabled:pointer-events-none"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => append({ unitTypeName: '', managerRoleLabel: '' })}
              className="w-full py-4 flex items-center justify-center gap-2 border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] rounded-xl text-sm font-bold transition-all group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-primary)]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <div className="w-8 h-8 rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] group-hover:text-white flex items-center justify-center transition-colors">
                <Plus size={18} />
              </div>
              Thêm cấp bậc mới
            </button>
          </div>
        )}

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