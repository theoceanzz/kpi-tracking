import { useMemo } from 'react'
import { format } from 'date-fns'

export function useCurrentPeriod(): string {
  return useMemo(() => format(new Date(), 'yyyy-MM'), [])
}
