import {
  Banknote, Briefcase, Building2, Car, ClipboardCheck, CreditCard, FileSignature, FileText, Fingerprint, FolderKanban,
  Gift, GraduationCap, HandCoins, Heart, Laptop, MapPin, Megaphone, Package, Plane, Receipt, Repeat, ShoppingCart,
  Stamp, Timer, UserCheck, UserCog, UserMinus, UserPlus, Wallet, CalendarClock, type LucideIcon,
} from 'lucide-react'

/** Icon chọn được cho đơn từ — tên lưu ở `approval_forms.icon` (khớp `library.json`). */
export const FORM_ICONS: Record<string, LucideIcon> = {
  'calendar-clock': CalendarClock,
  timer: Timer,
  plane: Plane,
  'map-pin': MapPin,
  repeat: Repeat,
  fingerprint: Fingerprint,
  receipt: Receipt,
  'hand-coins': HandCoins,
  'credit-card': CreditCard,
  wallet: Wallet,
  banknote: Banknote,
  'user-plus': UserPlus,
  'user-check': UserCheck,
  'clipboard-check': ClipboardCheck,
  'user-cog': UserCog,
  'user-minus': UserMinus,
  'graduation-cap': GraduationCap,
  'shopping-cart': ShoppingCart,
  package: Package,
  laptop: Laptop,
  stamp: Stamp,
  car: Car,
  building: Building2,
  'file-signature': FileSignature,
  'file-text': FileText,
  'folder-kanban': FolderKanban,
  briefcase: Briefcase,
  megaphone: Megaphone,
  gift: Gift,
  heart: Heart,
}

/** Màu nền ô icon (chữ trắng) — tên lưu ở `approval_forms.color`. */
export const FORM_COLORS: Record<string, string> = {
  blue: '#3370ff',
  indigo: '#5b65f5',
  violet: '#7f3bf5',
  pink: '#e5328f',
  red: '#f54a45',
  orange: '#ff8800',
  amber: '#e8a300',
  green: '#2ea121',
  teal: '#14a39b',
  cyan: '#18a6d8',
}

export const DEFAULT_ICON = 'file-text'
export const DEFAULT_COLOR = 'blue'
