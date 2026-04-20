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

export function formatAssigneeNames(names: string[] | null | undefined): string {
  if (!names || names.length === 0) return 'Chưa giao'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return names.join(', ')
  return `${names[0]!}, ${names[1]!} + ${names.length - 2} người khác`
}

export async function downloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('Download failed:', error)
    window.open(url, '_blank')
  }
}
