import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(kobo: number, compact = false): string {
  const naira = kobo / 100
  if (compact && naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`
  if (compact && naira >= 1_000) return `₦${(naira / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira)
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffH < 24) return `${diffH}h ago`
  if (diffD === 1) return 'Yesterday'
  if (diffD < 7) return `${diffD} days ago`
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(d)
}

export function formatDateFull(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export function maskAccount(acct: string): string {
  return `****${acct.slice(-4)}`
}

export function generateRequestId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const r = Math.random().toString(36).slice(2, 10)
  return `${d}-${r}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate(pattern) } catch { /* unsupported */ }
}

export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

// In a utils file
export function generateTransactionRef(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  
  return `DGN${year}${month}${day}${hours}${minutes}${seconds}${random}`
}

/**
 * Normalizes any common date input into strict 'dd/mm/yyyy'.
 * Accepts: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, Date object, ISO string.
 * Returns '' if unparseable.
 */
export function formatDateToDDMMYYYY(input: string | Date): string {
  if (!input) return ''

  // Already in dd/mm/yyyy? Validate & return as-is
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = String(input).match(ddmmyyyy)
  if (match) {
    const [, dd, mm, yyyy] = match
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    // Guard against invalid dates like 31/02/1993
    if (
      d.getFullYear() === Number(yyyy) &&
      d.getMonth() === Number(mm) - 1 &&
      d.getDate() === Number(dd)
    ) {
      return `${dd}/${mm}/${yyyy}`
    }
    return ''
  }

  // Try yyyy-mm-dd (HTML date input native format)
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/
  const isoMatch = String(input).match(yyyymmdd)
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch
    return `${dd}/${mm}/${yyyy}`
  }

  // Try dd-mm-yyyy
  const ddmmyyyyDash = /^(\d{2})-(\d{2})-(\d{4})$/
  const dashMatch = String(input).match(ddmmyyyyDash)
  if (dashMatch) {
    const [, dd, mm, yyyy] = dashMatch
    return `${dd}/${mm}/${yyyy}`
  }

  // Fall back to native Date parser
  const parsed = new Date(input)
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0')
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const yyyy = parsed.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  return ''
}