import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPeriod(period: string): string {
  if (/^\d{4}-Q\d$/.test(period)) {
    const [year, q] = period.split('-Q')
    return `Quý ${q}/${year}`
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-')
    return `Tháng ${month}/${year}`
  }
  return period
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: vi })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: vi })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const ROLE_LEVELS: Record<string, number> = {
  'DIRECTOR': 4,
  'HEAD': 3,
  'DEPUTY': 2,
  'STAFF': 1
}

export function getHighestRole(user: { roles?: string[]; memberships?: Array<{ roleName: string }> }): string {
  let highest = 'STAFF'
  let highestLevel = 0

  const allRoles = new Set<string>()
  if (user.roles) user.roles.forEach(r => allRoles.add(r))
  if (user.memberships) user.memberships.forEach(m => allRoles.add(m.roleName))

  allRoles.forEach(role => {
    const level = ROLE_LEVELS[role] || 0
    if (level > highestLevel) {
      highestLevel = level
      highest = role
    }
  })

  return highest
}
