import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ALL_TIME, type OrgTimeFilters } from '@/hooks/useOrgTimeFilters'

/** Hai ô lọc + nút "Bỏ lọc" (chỉ hiện khi đang lọc). */
export function OrgTimeFilterControls({ filters }: { filters: OrgTimeFilters }) {
  const { t } = useTranslation('shared')
  return (
    <>
      <Select value={filters.unitId || undefined} onValueChange={filters.setUnitPick}>
        <SelectTrigger className="h-9 w-full sm:w-56" aria-label={t('OrgTimeFilters.filterUnit')}>
          <SelectValue placeholder={t('OrgTimeFilters.filterUnit')} />
        </SelectTrigger>
        <SelectContent>
          {filters.flatUnits.map(u => (
            <SelectItem key={u.id} value={u.id}>
              <span style={{ paddingLeft: u.level * 12 }}>{u.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.timeValue} onValueChange={filters.setTimeValue}>
        <SelectTrigger className="h-9 w-full sm:w-60" aria-label={t('OrgTimeFilters.filterCyclePeriod')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TIME}>{t('OrgTimeFilters.allCyclesPeriods')}</SelectItem>
          {filters.timeGroups.map(({ cycle, periods }) => (
            <SelectGroup key={cycle.id}>
              <SelectLabel>{cycle.name}</SelectLabel>
              <SelectItem value={`cycle:${cycle.id}`}>{t('OrgTimeFilters.wholeCycle', { name: cycle.name })}</SelectItem>
              {periods.map(p => (
                <SelectItem key={p.id} value={`period:${p.id}`}>
                  <span className="pl-3">{p.name}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {filters.filtering && (
        <Button variant="ghost" size="sm" onClick={filters.reset}>{t('OrgTimeFilters.clearFilters')}</Button>
      )}
    </>
  )
}

