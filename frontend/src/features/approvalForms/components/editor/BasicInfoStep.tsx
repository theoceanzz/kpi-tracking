import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, FolderPlus, Globe, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import type { PersonRef } from '@/features/approvalProcess/types'
import MultiSelectPopover, { type PickOption } from '@/features/approvalProcess/components/pickers/MultiSelectPopover'
import UserPickerPopover from '@/features/approvalProcess/components/pickers/UserPickerPopover'
import { approvalFormsApi } from '../../api/approvalFormsApi'
import { pickName } from '../../model/formState'
import { MAX_DESCRIPTION, MAX_NAME, type FormIssue } from '../../model/formIssues'
import { ALL_ADMIN_PERMISSIONS, type FormAdminPermission, type FormGroup, type LocalizedName, type Ref, type SubmitterScope } from '../../types'
import FormIcon from '../FormIcon'
import { FORM_COLORS, FORM_ICONS } from '../../model/icons'
import LocalizedNameDialog from '../LocalizedNameDialog'

export interface EditorInfo {
  icon: string
  color: string
  name: LocalizedName
  description: LocalizedName
  groupId: string | null
  submitterScope: SubmitterScope
  submitterUsers: PersonRef[]
  submitterUnits: Ref[]
  admins: { user: PersonRef; permissions: FormAdminPermission[] }[]
}

/** `data-field` của từng ô — hộp "chỗ chưa xong" focus vào đây. */
const fieldAnchor = (field: string) => ({ 'data-field': field })

/**
 * Bước 1 — Thông tin cơ bản: icon, tên (song ngữ), mô tả, nhóm (+ tạo nhóm ngay tại chỗ), ai được nộp, người quản lý đơn
 * và quyền của từng người.
 */
export default function BasicInfoStep({
  info, onChange, groups, lang, canEditForm, canEditAdmins, canCreateGroup, onCreateGroup, issues, showErrors,
}: {
  info: EditorInfo
  onChange: (patch: Partial<EditorInfo>) => void
  groups: FormGroup[]
  lang: string
  canEditForm: boolean
  canEditAdmins: boolean
  canCreateGroup: boolean
  onCreateGroup: () => void
  issues: FormIssue[]
  showErrors: boolean
}) {
  const { t } = useTranslation('approvalForms')
  const [translating, setTranslating] = useState(false)
  const [permsFor, setPermsFor] = useState<string | null>(null)
  const error = (field: string) => (showErrors ? issues.find((i) => i.field === field) : undefined)
  const errorText = (field: string) => {
    const e = error(field)
    return e ? <p className="mt-1 text-xs text-[var(--color-error)]">{t(`issues.${e.key}`, e.args)}</p> : null
  }
  const ro = !canEditForm
  const currentLang = lang as 'vi' | 'en'

  const { data: units } = useQuery({
    queryKey: ['approval-forms', 'directory-units'],
    queryFn: approvalFormsApi.units,
    staleTime: 5 * 60_000,
    enabled: info.submitterScope === 'SPECIFIED',
  })
  const unitOptions: PickOption[] = (units ?? []).map((u) => ({ value: u.id, label: u.name }))
  const unitName = new Map([...info.submitterUnits.map((u) => [u.id, u.name] as const), ...unitOptions.map((o) => [o.value, o.label] as const)])

  const editingAdmin = info.admins.find((a) => a.user.id === permsFor)
  const noGroups = groups.length === 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <span className="mb-1.5 block text-label">{t('basic.icon')} <span className="text-[var(--color-error)]">*</span></span>
        <IconPicker icon={info.icon} color={info.color} disabled={ro} onChange={(icon, color) => onChange({ icon, color })} />
      </div>

      <div {...fieldAnchor('name')}>
        <label htmlFor="af-name" className="mb-1.5 block text-label">
          {t('basic.name')} <span className="text-[var(--color-error)]">*</span>
        </label>
        <div className="flex gap-2">
          <Input
            id="af-name"
            value={info.name[currentLang] ?? ''}
            onChange={(e) => onChange({ name: { ...info.name, [currentLang]: e.target.value } })}
            placeholder={pickName(info.name, lang) || t('basic.namePlaceholder')}
            maxLength={MAX_NAME}
            disabled={ro}
            invalid={!!error('name')}
          />
          <Button variant="outline" size="icon" onClick={() => setTranslating(true)} disabled={ro}
            aria-label={t('basic.translations')} title={t('basic.translations')}>
            <Globe aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-1 text-caption">{t('basic.nameHint')}</p>
        {errorText('name')}
      </div>

      <div {...fieldAnchor('description')}>
        <label htmlFor="af-description" className="mb-1.5 block text-label">{t('basic.description')}</label>
        <Textarea
          id="af-description"
          rows={2}
          value={info.description[currentLang] ?? ''}
          onChange={(e) => onChange({ description: { ...info.description, [currentLang]: e.target.value } })}
          placeholder={t('basic.descriptionPlaceholder')}
          maxLength={MAX_DESCRIPTION}
          disabled={ro}
        />
        {errorText('description')}
      </div>

      <div {...fieldAnchor('group')}>
        <span className="mb-1.5 block text-label">{t('basic.group')} <span className="text-[var(--color-error)]">*</span></span>
        <div className="flex gap-2">
          {/* Chưa có nhóm nào: ô chọn báo trống và hiện nút tạo nhóm ngay bên cạnh; đã có nhóm thì chỉ chọn. */}
          <Select value={info.groupId ?? undefined} onValueChange={(groupId) => onChange({ groupId })} disabled={ro || noGroups}>
            <SelectTrigger aria-label={t('basic.group')} className={cn('flex-1', error('group') && 'border-[var(--color-error)]')}>
              <SelectValue placeholder={noGroups ? t('basic.noGroups') : t('basic.groupPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => <SelectItem key={g.id} value={g.id}>{pickName(g.name, lang)}</SelectItem>)}
            </SelectContent>
          </Select>
          {noGroups && canCreateGroup && !ro && (
            <Button variant="outline" onClick={onCreateGroup}>
              <FolderPlus aria-hidden="true" /> {t('admin.createGroup')}
            </Button>
          )}
        </div>
        {errorText('group')}
      </div>

      <div {...fieldAnchor('submitters')}>
        <span className="mb-1.5 block text-label">{t('basic.whoCanSubmit')} <span className="text-[var(--color-error)]">*</span></span>
        <Select value={info.submitterScope} onValueChange={(v) => onChange({ submitterScope: v as SubmitterScope })} disabled={ro}>
          <SelectTrigger aria-label={t('basic.whoCanSubmit')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('basic.scopeAll')}</SelectItem>
            <SelectItem value="SPECIFIED">{t('basic.scopeSpecified')}</SelectItem>
            <SelectItem value="NONE">{t('basic.scopeNone')}</SelectItem>
          </SelectContent>
        </Select>
        {info.submitterScope === 'SPECIFIED' && (
          <div className="mt-3 grid gap-3 rounded-card border border-[var(--color-border)] p-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-caption">{t('basic.members')}</span>
              <UserPickerPopover value={info.submitterUsers} onChange={(submitterUsers) => onChange({ submitterUsers })}
                placeholder={t('basic.choosePeople')} disabled={ro} invalid={!!error('submitters')} />
            </div>
            <div>
              <span className="mb-1 block text-caption">{t('basic.units')}</span>
              <MultiSelectPopover
                value={info.submitterUnits.map((u) => u.id)}
                options={unitOptions}
                onChange={(ids) => onChange({ submitterUnits: ids.map((id) => ({ id, name: unitName.get(id) ?? id })) })}
                placeholder={t('basic.chooseUnits')}
                disabled={ro}
                invalid={!!error('submitters')}
              />
            </div>
            <p className="text-caption sm:col-span-2">{t('basic.unitsHint')}</p>
          </div>
        )}
        {errorText('submitters')}
      </div>

      <div {...fieldAnchor('admins')}>
        <span className="mb-1.5 block text-label">{t('basic.admins')} <span className="text-[var(--color-error)]">*</span></span>
        <p className="mb-2 text-caption">{t('basic.adminsHint')}</p>
        {canEditAdmins && (
          <div className="mb-3 max-w-sm">
            <UserPickerPopover
              value={[]}
              placeholder={t('basic.addAdmin')}
              invalid={!!error('admins')}
              onChange={(people) => {
                const add = people.filter((p) => !info.admins.some((a) => a.user.id === p.id))
                if (add.length) onChange({ admins: [...info.admins, ...add.map((user) => ({ user, permissions: [...ALL_ADMIN_PERMISSIONS] }))] })
              }}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {info.admins.map((a) => (
            <div key={a.user.id} className="flex w-44 flex-col items-center gap-1 rounded-card border border-[var(--color-border)] p-3 text-center">
              <UserAvatar fullName={a.user.name} avatarUrl={a.user.avatarUrl} className="h-10 w-10 rounded-full text-sm"
                fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
              <span className="w-full truncate text-sm font-medium">{a.user.name}</span>
              <span className="text-caption">{t('basic.permissionCount', { count: a.permissions.length })}</span>
              {canEditAdmins && (
                <div className="flex gap-1">
                  <Button variant="link" size="sm" onClick={() => setPermsFor(a.user.id)}>{t('basic.permissions')}</Button>
                  <Button variant="link" size="sm" className="text-[var(--color-error)]"
                    onClick={() => onChange({ admins: info.admins.filter((x) => x.user.id !== a.user.id) })}>
                    {t('common.delete')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        {errorText('admins')}
      </div>

      <LocalizedNameDialog
        open={translating}
        title={t('basic.translations')}
        value={{ name: info.name, description: info.description }}
        withDescription
        draftKey="approval-form-editor:names"
        onClose={() => setTranslating(false)}
        onSave={(v) => {
          onChange({ name: v.name, description: v.description ?? {} })
          setTranslating(false)
        }}
      />
      {editingAdmin && (
        <PermissionsDialog
          name={editingAdmin.user.name}
          value={editingAdmin.permissions}
          onClose={() => setPermsFor(null)}
          onSave={(permissions) => {
            onChange({ admins: info.admins.map((a) => (a.user.id === editingAdmin.user.id ? { ...a, permissions } : a)) })
            setPermsFor(null)
          }}
        />
      )}
    </div>
  )
}

function PermissionsDialog({ name, value, onClose, onSave }: {
  name: string; value: FormAdminPermission[]; onClose: () => void; onSave: (v: FormAdminPermission[]) => void
}) {
  const { t } = useTranslation('approvalForms')
  const [perms, setPerms] = useState<FormAdminPermission[]>(value)
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('basic.setPermissions')}
      description={name}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>}
          primary={<Button onClick={() => onSave(perms)}>{t('common.confirm')}</Button>}
        />
      }
    >
      <div className="space-y-3">
        {ALL_ADMIN_PERMISSIONS.map((p) => (
          <label key={p} className="flex items-start gap-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={perms.includes(p)}
              onCheckedChange={(on) => setPerms((list) => (on ? [...list, p] : list.filter((x) => x !== p)))} />
            <span>
              <span className="block font-medium">{t(`permissions.${p}`)}</span>
              <span className="block text-caption">{t(`permissions.${p}_hint`)}</span>
            </span>
          </label>
        ))}
        <p className="flex items-center gap-1.5 text-caption"><ShieldCheck size={14} aria-hidden="true" /> {t('basic.managerAlwaysAll')}</p>
      </div>
    </Dialog>
  )
}

function IconPicker({ icon, color, disabled, onChange }: {
  icon: string; color: string; disabled?: boolean; onChange: (icon: string, color: string) => void
}) {
  const { t } = useTranslation('approvalForms')
  return (
    <Popover>
      <div className="flex items-center gap-3">
        <FormIcon icon={icon} color={color} size="lg" />
        <PopoverTrigger asChild disabled={disabled}>
          <Button variant="link" disabled={disabled}>{t('basic.changeIcon')}</Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-80">
        <p className="mb-2 text-label">{t('basic.color')}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {Object.entries(FORM_COLORS).map(([key, hex]) => (
            <button key={key} type="button" onClick={() => onChange(icon, key)} aria-label={key} aria-pressed={color === key}
              className={cn('flex h-7 w-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-[var(--color-card)]',
                color === key && 'ring-2 ring-[var(--color-ring)]')}
              style={{ backgroundColor: hex }}>
              {color === key && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
        <p className="mb-2 text-label">{t('basic.icon')}</p>
        <div className="grid grid-cols-6 gap-2">
          {Object.entries(FORM_ICONS).map(([key, Icon]) => (
            <button key={key} type="button" onClick={() => onChange(key, color)} aria-label={key} aria-pressed={icon === key}
              className={cn('flex h-10 w-10 items-center justify-center rounded-control border transition-colors',
                icon === key ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]')}>
              <Icon size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
