import { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { getInitials, formatPhoneNumber } from '@/lib/utils'

import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  profileInfoSchema,
  securityPasswordSchema,
  type ProfileInfoFormData,
  type SecurityPasswordFormData,
} from '../schemas/profileSchema'
import { cn } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api/authApi'
import { userApi } from '@/features/users/api/userApi'
import { toast } from 'sonner'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import {
  Building2, Shield,
  CheckCircle2, UserCircle2, Loader2, Pencil, X, Save,
  Eye, EyeOff, Camera, Wand2, Check, KeyRound, AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'


export default function ProfilePage() {
  const { t } = useTranslation('profile')
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
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
      toast.success(t('ProfilePage.profilePictureUpdatedSuccessfully'))
      setUser(updatedUser)
      // Ảnh mới nằm trong cả những danh sách đã tải sẵn, không riêng gì store đăng nhập.
      // Không dọn cache thì sang danh sách nhân viên vẫn thấy ảnh cũ cho tới khi tải lại
      // trang — đúng cái cảm giác "đổi rồi mà chẳng thấy đổi".
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['organization-users'] })
      queryClient.invalidateQueries({ queryKey: ['org-unit-members'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('ProfilePage.imageUploadFailed'))),
  })

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) return toast.error(t('ProfilePage.theFileSizeMustNotExceed'))
      uploadAvatarMutation.mutate(file)
    }
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      {/* Đầu trang: ảnh đại diện + tên + vai trò/đơn vị — cùng khuôn card như mọi trang, không tô nền primary */}
      <section className="flex flex-col items-start gap-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => !uploadAvatarMutation.isPending && fileInputRef.current?.click()}
            disabled={uploadAvatarMutation.isPending}
            aria-label={t('ProfilePage.changeProfilePicture')}
            title={t('ProfilePage.changeProfilePicture')}
            className="group relative block h-20 w-20 overflow-hidden rounded-card ring-2 ring-[var(--color-border)] focus-visible:outline-none focus-visible:ring-[var(--color-ring)]"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[var(--color-primary-soft)] text-2xl font-semibold text-[var(--color-primary)]">
                {getInitials(user.fullName)}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 transition-colors group-hover:bg-slate-950/40">
              <Camera size={20} className="text-white opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </span>
            {uploadAvatarMutation.isPending && (
              <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-card)]/80">
                <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" aria-hidden="true" />
              </span>
            )}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-page-title truncate">{user.fullName}</h1>
          <p className="mt-1 truncate text-sm text-[var(--color-muted-foreground)]">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline"><Shield size={12} aria-hidden="true" /> {user.memberships?.[0]?.roleName || user.roles?.[0] || t('ProfilePage.noRoleYet')}</Badge>
            <Badge variant="outline"><Building2 size={12} aria-hidden="true" /> {user.memberships?.[0]?.orgUnitName || t('ProfilePage.noUnitYet')}</Badge>
            <Badge variant="success"><CheckCircle2 size={12} aria-hidden="true" /> {t('ProfilePage.active')}</Badge>
          </div>
        </div>
      </section>

      {/* Tab Navigation + Content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2">
          <NavTab
            active={currentTab === 'info'}
            onClick={() => setSearchParams({ tab: 'info' })}
            icon={UserCircle2}
            label={t('ProfilePage.personalInformation')}
            description={t('ProfilePage.profileContact')}
          />
          <NavTab
            active={currentTab === 'security'}
            onClick={() => setSearchParams({ tab: 'security' })}
            icon={KeyRound}
            label={t('ProfilePage.security')}
            description={t('ProfilePage.passwordAuthentication')}
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
    <ChoiceChip selected={active} className="w-full py-2.5 text-left" onClick={onClick} aria-current={active ? 'page' : undefined}>
      <Icon className={cn('shrink-0', active ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]')} aria-hidden="true" />
      <span className="min-w-0">
        <span className={cn('block text-sm font-medium', active ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]')}>{label}</span>
        <span className="block text-caption">{description}</span>
      </span>
    </ChoiceChip>
  )
}

/* ========== Profile Info Tab ========== */
function ProfileInfoTab({ user, onUserUpdate }: { user: any; onUserUpdate: (u: any) => void }) {
  const { t } = useTranslation('profile')
  const [editing, setEditing] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileInfoFormData>({
    resolver: zodResolver(profileInfoSchema()),
    defaultValues: {
      fullName: user.fullName ?? '',
      phone: user.phone ?? '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { fullName: string; phone?: string }) => userApi.update(user.id, {
      fullName: data.fullName,
      phone: data.phone || ''
    }),
    onSuccess: (updated) => {
      toast.success(t('ProfilePage.profileUpdated'))
      onUserUpdate({ ...user, fullName: updated.fullName, phone: updated.phone })
      setEditing(false)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('ProfilePage.profileUpdateFailed'))),
  })

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-section-title">{t('ProfilePage.personalInformation')}</h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{t('ProfilePage.fullNameAndPhoneNumberCan')}</p>
        </div>
        {!editing && (
          <Button variant="outline" className="shrink-0" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" /> {t('ProfilePage.edit')}
          </Button>
        )}
      </div>

      <div className="p-5">
        {editing ? (
          <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="max-w-lg space-y-4">
            <div className="space-y-2">
              <label className="text-label block">{t('ProfilePage.fullName')}</label>
              <input
                {...register('fullName')}
                className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                placeholder={t('ProfilePage.johnDoe')}
              />
              {errors.fullName && <p className="text-[var(--color-error)] text-xs mt-1">{(errors.fullName as any).message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-label block">{t('ProfilePage.phoneNumber')}</label>
              <input
                {...register('phone')}
                className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                placeholder="0912 345 678"
              />
              {errors.phone && <p className="text-[var(--color-error)] text-xs mt-1">{(errors.phone as any).message}</p>}
            </div>

            {/* Non-editable fields */}
            <div className="space-y-2">
              <label className="text-label block">Email <span className="font-normal text-[var(--color-subtle-foreground)]">{t('ProfilePage.cannotBeChanged')}</span></label>
              <div className="flex h-9 items-center rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 text-sm text-[var(--color-muted-foreground)]">
                {user.email}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <Button variant="outline" type="button" onClick={() => { setEditing(false); reset() }} disabled={updateMutation.isPending}>
                {t('ProfilePage.cancel')}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                {t('ProfilePage.saveChanges')}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <InfoField label={t('ProfilePage.fullName')} value={user.fullName} />
            <InfoField label={t('ProfilePage.employeeCode')} value={user.employeeCode || t('ProfilePage.notUpdated')} />
            <InfoField label="Email" value={user.email} />
            <InfoField label={t('ProfilePage.phoneNumber')} value={formatPhoneNumber(user.phone) || t('ProfilePage.notUpdated')} />
            <InfoField label={t('ProfilePage.unit')} value={`${user.memberships?.[0]?.orgUnitName || t('ProfilePage.notUpdated')}${user.memberships?.[0]?.unitTypeLabel ? ` (${user.memberships[0].unitTypeLabel})` : ''}`} />
            <InfoField label={t('ProfilePage.unitCode')} value={user.memberships?.[0]?.orgUnitCode || t('ProfilePage.notUpdated')} />
            <InfoField label={t('ProfilePage.position')} value={user.memberships?.[0]?.roleName || user.roles?.[0] || t('ProfilePage.no')} />
            <InfoField label={t('ProfilePage.status')} value="Đang hoạt động" />
          </dl>
        )}
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-eyebrow">{label}</dt>
      <dd className="mt-0.5 truncate text-[var(--color-foreground)]" title={value}>{value}</dd>
    </div>
  )
}

/* ========== Security Tab ========== */
function SecurityTab() {
  const { t } = useTranslation('profile')
  const { user, setUser } = useAuthStore()
  const { register, handleSubmit, formState: { errors }, watch, control, setValue, reset, setError } = useForm<SecurityPasswordFormData>({
    resolver: zodResolver(securityPasswordSchema()),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

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

  let strengthLabel = t('ProfilePage.notEntered')
  let strengthColor = 'bg-[var(--color-border)]'
  let strengthTextColor = 'text-[var(--color-subtle-foreground)]'

  if (pwd.length > 0) {
    if (strengthScore <= 2) {
      strengthLabel = t('ProfilePage.weak')
      strengthColor = 'bg-[var(--color-error-solid)]'
      strengthTextColor = 'text-[var(--color-error)]'
    } else if (strengthScore <= 3) {
      strengthLabel = t('ProfilePage.medium')
      strengthColor = 'bg-[var(--color-warning-solid)]'
      strengthTextColor = 'text-[var(--color-warning)]'
    } else {
      strengthLabel = t('ProfilePage.strong')
      strengthColor = 'bg-[var(--color-success-solid)]'
      strengthTextColor = 'text-[var(--color-success)]'
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
      toast.success(t('ProfilePage.passwordChangedSuccessfully'))
      if (user) {
        setUser({ ...user, requirePasswordChange: false })
      }
      reset()
      setShowCurrent(false); setShowNew(false); setShowConfirm(false)
    },
    onError: (error: any) => {
      const message = getApiErrorMessage(error, t('ProfilePage.passwordChangeFailedPleaseTryAgain'))
      const code = getApiErrorCode(error)
      if (code === 'CURRENT_PASSWORD_INCORRECT' || code === 'ENTER_CURRENT_PASSWORD') {
        setError('currentPassword', { type: 'manual', message: message })
      } else {
        toast.error(message)
      }
    },
  })

  const inputCls = "w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] transition-all"

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h2 className="text-section-title">{t('ProfilePage.accountSecurity')}</h2>
        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">{t('ProfilePage.changeYourSignInPasswordIt')}</p>
      </div>

      <div className="p-5">
        <div className="max-w-lg space-y-5">

          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-label block">
                {t('ProfilePage.currentPassword')}
              </label>
              <div className="relative">
                <input
                  {...register('currentPassword')}
                  type={showCurrent ? 'text' : 'password'}
                  className={inputCls + " pr-12 no-edit-hint"}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-all"
                >
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.currentPassword && <p className="text-[var(--color-error)] text-xs font-medium pl-1">{errors.currentPassword.message}</p>}
            </div>

            {/* New Password */}
            <div className="space-y-3">
              <label className="text-label block">
                {t('ProfilePage.newPassword')}
              </label>
              <div className="relative">
                <input
                  {...register('newPassword')}
                  type={showNew ? 'text' : 'password'}
                  className={inputCls + " pr-24 no-edit-hint"}
                  placeholder={t('ProfilePage.enterAtLeast8SecureCharacters')}
                />

                {/* Suggestion Button */}
                <button
                  type="button"
                  onClick={generatePassword}
                  className="absolute inset-y-0 right-10 pr-1 flex items-center text-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors text-xs font-medium"
                  title={t('ProfilePage.passwordSuggestion')}
                >
                  <Wand2 size={16} className="mr-0.5"/> {t('ProfilePage.suggest')}
                </button>

                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-all"
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Match Current Password Error */}
              {pwd && watch('currentPassword') && pwd === watch('currentPassword') && (
                <div className="mt-2.5 px-3 py-2 rounded-card flex items-center gap-2 text-xs font-medium bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)] animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle size={14} />
                  <span>{t('ProfilePage.theNewPasswordMustNotBe')}</span>
                </div>
              )}

              {/* Strength Meter & Checklist */}
              {pwd && (
                <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="text-eyebrow flex justify-between items-center mb-2.5">
                    <span className="text-[var(--color-subtle-foreground)]">{t('ProfilePage.passwordStrength')}</span>
                    <span className={cn("px-2 py-0.5 rounded-full bg-[var(--color-card)] shadow-sm", strengthTextColor)}>{strengthLabel}</span>
                  </div>

                  <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden flex gap-1 mb-4">
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 1 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 2 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 4 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                    <div className={`h-full flex-1 rounded-full ${strengthScore >= 5 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                  </div>

                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-caption">
                    <CheckItem condition={hasLength} label={t('ProfilePage.n8Characters')} />
                    <CheckItem condition={hasUpper && hasLower} label={t('ProfilePage.upperLowerCase')} />
                    <CheckItem condition={hasNumber} label={t('ProfilePage.containsDigits')} />
                    <CheckItem condition={hasSpecial} label={t('ProfilePage.specialCharacters')} />
                  </div>
                </div>
              )}
              {errors.newPassword && <p className="text-[var(--color-error)] text-xs font-medium pl-1">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-label block">
                {t('ProfilePage.confirmNewPassword')}
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  className={inputCls + " pr-12 no-edit-hint"}
                  placeholder={t('ProfilePage.reEnterTheExactSamePassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-control text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-all"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {confirmPwd && (
                <div className={cn(
                  "mt-2.5 px-3 py-2 rounded-card flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200",
                  pwd === confirmPwd
                    ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
                    : 'bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]'
                )}>
                  {pwd === confirmPwd ? <CheckCircle2 size={14} /> : <X size={14} />}
                  <span>{pwd === confirmPwd ? t('ProfilePage.passwordsMatch') : t('ProfilePage.theTwoPasswordsDoNotMatch')}</span>
                </div>
              )}
              {errors.confirmPassword && !confirmPwd && <p className="text-[var(--color-error)] text-xs font-medium pl-1">{errors.confirmPassword.message}</p>}
            </div>

            {/* Submit */}
            <div className="pt-6 border-t border-[var(--color-border)]">
              <Button className="w-full md:w-auto" type="submit" disabled={mutation.isPending || (pwd.length > 0 && (pwd !== confirmPwd || pwd === watch('currentPassword') || strengthScore < 3))}>
                {mutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                {t('ProfilePage.updateSecurity')}
              </Button>
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
        condition ? "bg-[var(--color-success-solid)] text-white shadow-sm" : "bg-[var(--color-border)] text-transparent"
      )}>
        <Check size={10} strokeWidth={4} />
      </div>
      <span className={cn("transition-colors duration-300", condition ? "text-[var(--color-foreground)]" : "text-[var(--color-subtle-foreground)]")}>
        {label}
      </span>
    </div>
  )
}
