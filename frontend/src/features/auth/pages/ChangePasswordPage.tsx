import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { changePasswordSchema, type ChangePasswordFormData } from '../schemas/authSchema'
import { toast } from 'sonner'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import PageHeader from '@/components/common/PageHeader'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export default function ChangePasswordPage() {
  const { t } = useTranslation('auth')
  const { register, handleSubmit, formState: { errors }, watch, reset, setError } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema()),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: ChangePasswordFormData) => authApi.changePassword(data),
    onSuccess: () => { toast.success(t('ChangePasswordPage.passwordChangedSuccessfully')); reset() },
    onError: (error: any) => {
      const message = getApiErrorMessage(error, t('ChangePasswordPage.passwordChangeFailed'))
      const code = getApiErrorCode(error)
      if (code === 'CURRENT_PASSWORD_INCORRECT' || code === 'ENTER_CURRENT_PASSWORD') {
        setError('currentPassword', { type: 'manual', message: message })
      } else {
        toast.error(message)
      }
    },
  })

  const inputCls = "w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div>
      <PageHeader title={t('ChangePasswordPage.changePassword')} description={t('ChangePasswordPage.changeYourAccountPassword')} />

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] p-6 max-w-md space-y-4">
        <div>
          <label className="text-label block font-medium mb-1.5">{t('ChangePasswordPage.currentPassword')}</label>
          <input {...register('currentPassword')} type="password" className={inputCls} />
          {errors.currentPassword && <p className="text-[var(--color-error)] text-xs mt-1">{errors.currentPassword.message}</p>}
        </div>

        <div>
          <label className="text-label block font-medium mb-1.5">{t('ChangePasswordPage.newPassword')}</label>
          <input {...register('newPassword')} type="password" className={inputCls} />
          {errors.newPassword && <p className="text-[var(--color-error)] text-xs mt-1">{errors.newPassword.message}</p>}
          {watch('newPassword') && watch('currentPassword') && watch('newPassword') === watch('currentPassword') && (
            <p className="text-[var(--color-error)] text-xs mt-1">{t('ChangePasswordPage.theNewPasswordMustBeDifferent')}</p>
          )}
        </div>

        <div>
          <label className="text-label block font-medium mb-1.5">{t('ChangePasswordPage.confirmNewPassword')}</label>
          <input {...register('confirmPassword')} type="password" className={inputCls} />
          {errors.confirmPassword && <p className="text-[var(--color-error)] text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <Button className="w-full" type="submit" disabled={mutation.isPending || (!!watch('newPassword') && watch('newPassword') === watch('currentPassword'))}>
          {mutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {t('ChangePasswordPage.changePassword')}
        </Button>
      </form>
    </div>
  )
}
