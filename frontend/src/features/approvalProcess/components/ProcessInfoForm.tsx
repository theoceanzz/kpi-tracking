import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { InfoHint } from '@/components/common/InfoHint'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ApprovalObjectType, ApprovalProcessCatalog, PersonRef } from '../types'
import MultiSelectPopover from './pickers/MultiSelectPopover'
import UserPickerPopover from './pickers/UserPickerPopover'

export interface ProcessInfo {
  title: string
  objectType: ApprovalObjectType | null
  subObjectTypes: string[]
  followers: PersonRef[]
  showInObject: boolean
  active: boolean
}

/** Phần thông tin của quy trình: tiêu đề, đối tượng, đối tượng con, người theo dõi, cờ hiển thị. */
export default function ProcessInfoForm({
  value, onChange, catalog, readOnly, showErrors, onUsers,
}: {
  value: ProcessInfo
  onChange: (patch: Partial<ProcessInfo>) => void
  catalog: ApprovalProcessCatalog | undefined
  readOnly?: boolean
  showErrors?: boolean
  onUsers: (people: PersonRef[]) => void
}) {
  const { t } = useTranslation('approvalProcess')
  const groups = useMemo(() => {
    const out = new Map<string, ApprovalProcessCatalog['objects']>()
    for (const o of catalog?.objects ?? []) out.set(o.group, [...(out.get(o.group) ?? []), o])
    return [...out.entries()]
  }, [catalog])
  const isForm = value.objectType === 'FORM_REQUEST'
  // Đơn từ: đối tượng con là từng đơn của tổ chức, gom theo nhóm đơn để phân biệt khi chọn.
  const subOptions = useMemo(
    () => isForm
      ? (catalog?.forms ?? []).map((f) => ({
          value: f.id, label: f.name, group: f.groupName ?? t('info.ungroupedForms'),
          hint: f.active ? undefined : t('info.formInactive'),
        }))
      : (catalog?.objects.find((o) => o.code === value.objectType)?.subObjects ?? [])
          .map((s) => ({ value: s, label: t(`subObjects.${s}`) })),
    [catalog, value.objectType, isForm, t],
  )
  const formsMissing = showErrors && isForm && value.subObjectTypes.length === 0
  const titleMissing = showErrors && !value.title.trim()
  const objectMissing = showErrors && !value.objectType

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      <div>
        <label htmlFor="process-title" className="mb-1.5 block text-label">
          {t('info.title')} <span className="text-[var(--color-error)]">*</span>
        </label>
        <Input
          id="process-title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t('info.titlePlaceholder')}
          invalid={titleMissing}
          disabled={readOnly}
          maxLength={255}
        />
        {titleMissing && <p className="mt-1 text-caption text-[var(--color-error)]">{t('info.titleRequired')}</p>}
      </div>

      <div>
        <span className="mb-1.5 block text-label">
          {t('info.object')} <span className="text-[var(--color-error)]">*</span>
        </span>
        <Select
          value={value.objectType ?? undefined}
          onValueChange={(v) => onChange({ objectType: v as ApprovalObjectType, subObjectTypes: [] })}
          disabled={readOnly}
        >
          <SelectTrigger aria-label={t('info.object')} className={objectMissing ? 'border-[var(--color-error)]' : undefined}>
            <SelectValue placeholder={t('info.objectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {groups.map(([group, objects]) => (
              <SelectGroup key={group}>
                <SelectLabel>{t(`objectGroups.${group}`)}</SelectLabel>
                {objects.map((o) => (
                  <SelectItem key={o.code} value={o.code} disabled={!o.available}>
                    {t(`objects.${o.code}`)}
                    {!o.available && <span className="ml-2 text-caption">· {t('info.comingSoon')}</span>}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {objectMissing && <p className="mt-1 text-caption text-[var(--color-error)]">{t('info.objectRequired')}</p>}
      </div>

      <div>
        <span className="mb-1.5 flex items-center gap-1.5 text-label">
          {isForm ? t('info.forms') : t('info.subObjects')}
          {isForm && <span className="text-[var(--color-error)]">*</span>}
          <InfoHint label={t('common.moreInfo')}>{isForm ? t('info.formsHint') : t('info.subObjectsHint')}</InfoHint>
        </span>
        <MultiSelectPopover
          options={subOptions}
          value={value.subObjectTypes}
          onChange={(subObjectTypes) => onChange({ subObjectTypes })}
          placeholder={isForm ? t('info.chooseForms') : value.objectType ? t('info.allSubObjects') : t('info.chooseObjectFirst')}
          invalid={formsMissing}
          disabled={readOnly || !value.objectType}
        />
      </div>

      <div>
        <span className="mb-1.5 flex items-center gap-1.5 text-label">
          {t('info.followers')}
          <InfoHint label={t('common.moreInfo')}>{t('info.followersHint')}</InfoHint>
        </span>
        <UserPickerPopover
          value={value.followers}
          onChange={(followers) => { onUsers(followers); onChange({ followers }) }}
          placeholder={t('info.followersPlaceholder')}
          disabled={readOnly}
        />
      </div>

      {/* Giải thích nằm trong ⓘ (rê chuột / chạm) thay vì một dòng chữ luôn hiện dưới mỗi ô. */}
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-2.5">
          <Checkbox
            checked={value.showInObject}
            onCheckedChange={(showInObject) => onChange({ showInObject })}
            disabled={readOnly}
          />
          <span className="text-sm font-medium">{t('info.showInObject')}</span>
        </label>
        <InfoHint label={t('common.moreInfo')}>{t('info.showInObjectHint')}</InfoHint>
      </div>

      <div className="flex items-center gap-1.5">
        <Switch
          checked={value.active}
          onCheckedChange={(active) => onChange({ active })}
          disabled={readOnly}
          aria-labelledby="process-active-label"
        />
        <span id="process-active-label" className="ml-1 text-sm font-medium">{t('info.active')}</span>
        <InfoHint label={t('common.moreInfo')}>{t('info.activeHint')}</InfoHint>
      </div>
    </div>
  )
}
