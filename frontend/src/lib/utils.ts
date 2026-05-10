import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AlertCircle, CheckCircle2, XCircle, Clock, X } from 'lucide-react'
import { KpiFrequency, KpiStatus } from '@/types/kpi'

export const FREQUENCY_MAP: Record<KpiFrequency, string> = {
  DAILY: 'Hàng ngày',
  WEEKLY: 'Hàng tuần',
  MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý',
  SEMI_ANNUALLY: '6 tháng',
  YEARLY: 'Hàng năm',
}

export const STATUS_CONFIG: Record<KpiStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { 
    label: 'Bản nháp', 
    color: 'text-slate-600 dark:text-slate-400', 
    bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', 
    icon: AlertCircle 
  },
  PENDING_APPROVAL: { 
    label: 'Chờ duyệt', 
    color: 'text-amber-600 dark:text-amber-400', 
    bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', 
    icon: Clock 
  },
  APPROVED: { 
    label: 'Đã duyệt', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', 
    icon: CheckCircle2 
  },
  REJECTED: { 
    label: 'Từ chối', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', 
    icon: XCircle 
  },
  EDIT: { 
    label: 'Đang sửa', 
    color: 'text-purple-600 dark:text-purple-400', 
    bgColor: 'bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:border-purple-900/40', 
    icon: AlertCircle 
  },
  EDITED: { 
    label: 'Đã sửa', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:border-blue-900/40', 
    icon: CheckCircle2 
  },
  INACTIVE: {
    label: 'Ngưng dùng',
    color: 'text-slate-400',
    bgColor: 'bg-slate-50 border-slate-200',
    icon: X
  }
}

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
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0
  }).format(value)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy', { locale: vi })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy HH:mm', { locale: vi })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getPrimaryMembership(user: { memberships?: Array<any> }): any | undefined {
  if (!user.memberships || user.memberships.length === 0) return undefined;
  return user.memberships.reduce((prev, current) => {
    // Prioritize the deepest unit (highest levelOrder)
    const prevLevel = prev.levelOrder ?? -1;
    const currLevel = current.levelOrder ?? -1;
    return currLevel > prevLevel ? current : prev;
  });
}

/**
 * Get the primary role for display purposes.
 */
export function getHighestRole(user: { roles?: string[]; memberships?: Array<any> }): string {
  const primaryMembership = getPrimaryMembership(user);
  if (primaryMembership) {
    return primaryMembership.roleDisplayName || primaryMembership.roleName;
  }
  if (user.roles && user.roles.length > 0) {
    return user.roles[0]!;
  }
  return 'N/A'
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
